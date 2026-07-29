/**
 * authAdapter — Firebase Auth jaisa interface, Supabase Auth ke upar.
 *
 * dataAdapter ki tarah: app ko wahi shakal milti hai jo aaj milti hai,
 * sirf peeche ka engine badalta hai. VITE_USE_SUPABASE=false karte hi
 * sab kuch Firebase pe wapas.
 *
 * ==========================================================
 * Sabse zaroori baat: `user.uid`
 * ==========================================================
 * Poore app me `session.uid` hi schoolId hai — har data path
 * `schools/${session.uid}/...` banta hai. Supabase ka apna uuid alag hai.
 * Isliye login ke baad app_users se PURANA Firebase uid (legacy_uid)
 * nikaal ke wahi `uid` me daala jaata hai. Agar yahan Supabase wala uuid
 * de diya, to har path galat school pe chala jayega.
 */

import { supabase, useSupabase } from './supabaseClient.js'
import { auth } from './firebase.js'

/* ------------------------------------------------------------------ */

const legacyUidCache = new Map()

async function legacyUidOf(supabaseUserId) {
  if (legacyUidCache.has(supabaseUserId)) return legacyUidCache.get(supabaseUserId)
  const { data, error } = await supabase
    .from('app_users').select('legacy_uid, full_name, role').eq('id', supabaseUserId).maybeSingle()
  if (error) {
    console.error('[auth] app_users padhne me dikkat:', error.message)
    return null
  }
  if (data?.legacy_uid) legacyUidCache.set(supabaseUserId, data)
  return data ?? null
}

/**
 * Supabase session se wahi shakal ka user banata hai jo Firebase deta hai:
 * uid, email, displayName, getIdToken().
 */
async function toFirebaseShapedUser(session) {
  if (!session?.user) return null
  const row = await legacyUidOf(session.user.id)
  if (!row?.legacy_uid) {
    // Login to ho gaya par ye user kisi school se juda hi nahi hai.
    // Aage badhne dena matlab khaali screen — isliye saaf mana kar dete hain.
    console.error('[auth] is user ka app_users record nahi mila — school se juda hua hi nahi hai')
    return null
  }
  return {
    uid: row.legacy_uid,
    supabaseId: session.user.id,
    email: session.user.email || '',
    displayName: row.full_name || session.user.email?.split('@')[0] || 'User',
    role: row.role || null,
    getIdToken: async () => {
      const { data } = await supabase.auth.getSession()
      return data?.session?.access_token || session.access_token || ''
    },
  }
}

/* ------------------------------------------------------------------ */
/* public API                                                          */
/* ------------------------------------------------------------------ */

/** Firebase ke onAuthStateChanged(auth, cb) jaisa. Unsubscribe lautata hai. */
export function watchAuth(handler) {
  let cancelled = false

  if (!useSupabase) {
    // Firebase raasta. Unsubscribe hamesha turant lautana hai (Promise nahi),
    // warna caller ke cleanup ke paas function hi nahi hoga.
    let unsub = null
    import('firebase/auth').then(({ onAuthStateChanged }) => {
      if (cancelled) return
      unsub = onAuthStateChanged(auth, handler)
    })
    return () => { cancelled = true; if (unsub) unsub() }
  }

  supabase.auth.getSession().then(async ({ data }) => {
    if (cancelled) return
    handler(await toFirebaseShapedUser(data?.session))
  })

  const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
    if (cancelled) return
    handler(await toFirebaseShapedUser(session))
  })

  return () => {
    cancelled = true
    sub?.subscription?.unsubscribe()
  }
}

export async function signIn(email, password) {
  if (!useSupabase) {
    const { signInWithEmailAndPassword } = await import('firebase/auth')
    return signInWithEmailAndPassword(auth, email, password)
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email: String(email).trim().toLowerCase(), password })
  if (error) throw new Error(translateAuthError(error.message))
  return data
}

export async function signOutUser() {
  if (!useSupabase) {
    const { signOut } = await import('firebase/auth')
    return signOut(auth)
  }
  legacyUidCache.clear()
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error(error.message)
}

export async function signUp(email, password, displayName) {
  if (!useSupabase) {
    const { createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth')
    const credential = await createUserWithEmailAndPassword(auth, email, password)
    if (displayName) await updateProfile(credential.user, { displayName })
    return credential
  }
  const { data, error } = await supabase.auth.signUp({
    email: String(email).trim().toLowerCase(),
    password,
    options: { data: { full_name: displayName || '' } },
  })
  if (error) throw new Error(translateAuthError(error.message))
  // app_users ki row database trigger (0010_signup_bootstrap) khud bana deta hai
  return data
}

/**
 * Google sign-in. Supabase pe ye tabhi chalega jab dashboard me Google provider
 * chaalu kiya gaya ho (Authentication > Providers > Google, client id + secret).
 * Wo abhi kiya nahi gaya — isliye saaf mana karta hai, chupchap toota nahi.
 */
export async function signInWithGoogle() {
  if (!useSupabase) {
    const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth')
    return signInWithPopup(auth, new GoogleAuthProvider())
  }
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
  if (error) {
    throw new Error(
      error.message.toLowerCase().includes('provider is not enabled')
        ? 'Google login abhi chaalu nahi hai. Email aur password se login karo.'
        : translateAuthError(error.message)
    )
  }
  return data
}

export async function sendReset(email) {
  if (!useSupabase) {
    const { sendPasswordResetEmail } = await import('firebase/auth')
    return sendPasswordResetEmail(auth, email)
  }
  const { error } = await supabase.auth.resetPasswordForEmail(String(email).trim().toLowerCase(), {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  if (error) throw new Error(error.message)
}

/**
 * Password badalna. Dono taraf pehle purana password jaanchte hain — Supabase ka
 * updateUser akela ye nahi poochta, aur bina jaanch ke khula laptop kisi aur ka
 * password badal sakta hai.
 */
export async function changePassword(currentPassword, newPassword) {
  if (!useSupabase) {
    const { updatePassword, EmailAuthProvider, reauthenticateWithCredential } = await import('firebase/auth')
    const user = auth.currentUser
    if (!user) throw new Error('Pehle login karo.')
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword))
    return updatePassword(user, newPassword)
  }

  const { data: sess } = await supabase.auth.getSession()
  const email = sess?.session?.user?.email
  if (!email) throw new Error('Pehle login karo.')

  const { error: reauth } = await supabase.auth.signInWithPassword({ email, password: currentPassword })
  if (reauth) throw new Error('Purana password galat hai.')

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw new Error(translateAuthError(error.message))
}

/**
 * Abhi ka access token. Supabase raaste me adapter token dekhta hi nahi
 * (RLS session se chalti hai), par purana code har jagah token maangta hai —
 * isliye ye wahi shakal bana ke rakhta hai.
 */
export async function getToken() {
  if (!useSupabase) return auth?.currentUser ? auth.currentUser.getIdToken() : ''
  const { data } = await supabase.auth.getSession()
  return data?.session?.access_token || ''
}

/** Kya abhi koi logged in hai — idle timeout iske liye poochta hai. */
export function hasCurrentUser() {
  if (!useSupabase) return Boolean(auth?.currentUser)
  return Boolean(currentUserCache)
}

let currentUserCache = null
export function rememberCurrentUser(user) { currentUserCache = user }

/**
 * Supabase ke angrezi error message aam bhasha me. Firebase ke messages
 * app pehle se sambhalta hai; ye sirf Supabase wale raaste ke liye hai.
 */
function translateAuthError(message) {
  const m = String(message || '').toLowerCase()
  if (m.includes('invalid login credentials')) return 'Email ya password galat hai.'
  if (m.includes('email not confirmed')) return 'Email abhi confirm nahi hua hai.'
  if (m.includes('too many requests') || m.includes('rate limit')) return 'Bahut zyada koshishein. Thodi der baad try karo.'
  return message
}

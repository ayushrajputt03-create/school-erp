// ============================================================
// _staff-store.js — staff (teacher/admin/office) login ka data layer
//
// _parent-store.js jaisa hi bantwara: niyam teacher-login.js me rehte hain
// (school code, phone ke aakhri 10 digit, DOB ke saare roop, kaun active hai)
// aur raaste yahan. teacher-login.js ko ye jaanne ki zarurat nahi ki neeche
// Firebase hai ya Supabase.
//
// Ek farak parent portal se: yahan session bhi store hi banata hai.
//   Firebase — createCustomToken(uid)
//   Supabase — magic link ka hashed_token, jise client verifyOtp() se
//              session me badalta hai.
// Dono soorat me client ko ek hi shakal milti hai: { token } ya { tokenHash }.
//
// Supabase par uid wahi purana staff legacy id rehta hai (app_users.legacy_uid),
// Supabase ka uuid nahi — poore app me har path `schools/${uid}/...` banta hai.
//
// USE_SUPABASE=false karte hi sab wapas Firebase par.
// ============================================================

const useSupabase = String(process.env.USE_SUPABASE ?? process.env.VITE_USE_SUPABASE ?? '') === 'true'

const digits = value => String(value || '').replace(/\D/g, '')
// Indian mobile ko aakhri 10 digit se milaate hain, taaki "07290810294",
// "+917290810294" aur "7290810294" ek hi maane jayein.
const phone10 = value => { const d = digits(value); return d.length > 10 ? d.slice(-10) : d }

/* ------------------------------------------------------------------ */
/* Firebase (aaj ka live raasta)                                       */
/* ------------------------------------------------------------------ */

function firebaseStore() {
  const { getApps, getApp, initializeApp, cert } = require('firebase-admin/app')
  const { getAuth } = require('firebase-admin/auth')
  const { getDatabase } = require('firebase-admin/database')

  const app = (() => {
    if (getApps().length) return getApp()
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || ''
    if (!raw) throw new Error('Server config missing: FIREBASE_SERVICE_ACCOUNT_JSON not set.')
    let credentials
    try { credentials = JSON.parse(raw) } catch { throw new Error('Server config error: FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.') }
    if (!credentials.project_id) throw new Error('Server config error: service account missing project_id.')
    return initializeApp({
      credential: cert(credentials),
      databaseURL: process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL,
    })
  })()

  const database = getDatabase(app)
  const read = async path => (await database.ref(path).once('value')).val()

  return {
    backend: 'firebase',

    async schoolIdByCode(code) {
      const mapping = await read(`schoolCodes/${code}`)
      if (mapping?.schoolId) return mapping.schoolId
      // Jis school ki schoolCodes entry hi nahi hai uske liye fallback. Pehle ye
      // poora schools tree utha leta tha — har school ka saara data — sirf ek
      // string milane ke liye. Ab sirf id ki list, phir har id se schoolCode.
      try {
        const databaseUrl = process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL
        const accessToken = await app.options.credential.getAccessToken()
        const listed = await fetch(`${databaseUrl}/schools.json?shallow=true&access_token=${accessToken.access_token}`)
        if (!listed.ok) throw new Error(`shallow list failed (${listed.status})`)
        const ids = Object.keys(await listed.json() || {})
        const codes = await Promise.all(ids.map(async id => [id, await read(`schools/${id}/profile/schoolCode`)]))
        const hit = codes.find(([, value]) => String(value || '').toUpperCase() === code)
        return hit ? hit[0] : null
      } catch (error) {
        console.warn('[staff-login] school code lookup fallback failed:', error.message)
        return null
      }
    },

    // Sirf staff aur teachers — login ke liye aur kuch nahi chahiye. schools/{id}
    // padhna har login par us school ke saare students, fees, attendance aur
    // certificates bhi utha laata tha.
    async staffCollections(schoolId) {
      const [staff, teachers] = await Promise.all([
        read(`schools/${schoolId}/staff`),
        read(`schools/${schoolId}/teachers`),
      ])
      if (staff == null && teachers == null) return null
      return { staff: staff || {}, teachers: teachers || {} }
    },

    // Rules teachersIndex par lagti hain — iske bina staff ko apne hi school ka
    // kuch nahi dikhta.
    linkStaffIndex: (schoolId, id, { role, source }) =>
      database.ref(`teachersIndex/${id}`).update({ schoolId, teacherId: id, role, source }),

    async grantSession(schoolId, id, profile) {
      const token = await getAuth(app).createCustomToken(id, {
        role: 'staff', schoolId, department: profile.department,
      })
      return { token }
    },
  }
}

/* ------------------------------------------------------------------ */
/* Supabase                                                            */
/* ------------------------------------------------------------------ */

/**
 * Nakli par sthir email. Asli email jaan-boojh kar nahi: staff table me ek hi
 * gmail do logon par laga hua hai aur auth.users me email unique hai, to asli
 * email lene par doosra aadmi login hi nahi kar paata. legacy_id se banayi
 * email hamesha ek hi rehti hai aur kabhi takraati nahi.
 */
const staffEmail = (staffId, schoolCode) =>
  `${String(staffId).toLowerCase()}@${String(schoolCode || 'school').toLowerCase()}.staff.schoolerp.app`

function supabaseStore() {
  const { createClient } = require('@supabase/supabase-js')
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('Server config missing: SUPABASE_URL not set.')
  if (!key) throw new Error('Server config missing: SUPABASE_SERVICE_ROLE_KEY not set.')

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

  const fail = (error, what) => { if (error) throw new Error(`${what}: ${error.message}`) }

  // Ek hi warm lambda me baar-baar wahi lookup na ho.
  const schools = new Map()

  async function school(schoolLegacy) {
    if (schools.has(schoolLegacy)) return schools.get(schoolLegacy)
    const { data, error } = await db.from('schools').select('id, legacy_id, code').eq('legacy_id', schoolLegacy).maybeSingle()
    fail(error, 'school lookup')
    if (data) schools.set(schoolLegacy, data)
    return data || null
  }

  return {
    backend: 'supabase',

    async schoolIdByCode(code) {
      const { data, error } = await db.from('schools').select('id, legacy_id, code').eq('code', code).maybeSingle()
      fail(error, 'school code lookup')
      if (!data) return null
      schools.set(data.legacy_id, data)
      return data.legacy_id
    },

    /**
     * RTDB ka `schools/{id}/staff` wapas usi shakal me — key legacy_id, value
     * poora original record (`source` jsonb). Isse teacher-login.js ka phone
     * aur DOB milane wala hissa jyon ka tyon chalta hai.
     *
     * `teachers` (purana "Create Teacher Login" wala collection) Postgres me
     * aaya hi nahi. Uske saare khaate ek hi school me usi phone wale staff
     * record se dhak jaate hain (jo pehle bhi pehle match hota tha), isliye
     * yahan khaali chhoda hai — ek demo khaate ko chhod kar koi farak nahi.
     */
    async staffCollections(schoolLegacy) {
      const found = await school(schoolLegacy)
      if (!found) return null
      const { data, error } = await db.from('staff').select('legacy_id, source').eq('school_id', found.id)
      fail(error, 'staff read')
      const staff = {}
      for (const row of data || []) staff[row.legacy_id] = row.source || {}
      return { staff, teachers: {} }
    },

    // Supabase me teachersIndex jaisi koi alag list nahi — RLS seedhe app_users
    // se chalti hai, aur wo row grantSession() banata hai. Isliye yahan kuch
    // karna nahi hai; method sirf isliye hai ki dono store ek jaise dikhein.
    async linkStaffIndex() {},

    /**
     * Session. Supabase custom token nahi deta, isliye ek magic link banate
     * hain aur uska hashed_token client ko dete hain — client verifyOtp() se
     * use asli session me badal leta hai. Koi email nahi jaati; generate_link
     * sirf token banata hai, bhejta nahi.
     *
     * Yahan tak pahunchne ka matlab hai ki school code, phone aur DOB teeno
     * pehle hi jaanche ja chuke hain.
     */
    async grantSession(schoolLegacy, id, profile) {
      const found = await school(schoolLegacy)
      if (!found) throw new Error('School not found.')

      const { data: ensured, error: ensureError } = await db.rpc('ensure_staff_auth_user', {
        p_school: found.id,
        p_staff_legacy: id,
        p_email: staffEmail(id, found.code),
        p_role: profile.department === 'Teacher' ? 'teacher' : 'staff',
        p_name: profile.name || '',
      })
      fail(ensureError, 'staff auth user')
      // Pehle se maujood khaate ka email badalte nahi — RPC wahi lautata hai jo
      // sach me row me hai. Magic link usi par banana zaroori hai.
      const email = ensured?.[0]?.user_email
      if (!email) throw new Error('Staff account could not be prepared.')

      const { data, error } = await db.auth.admin.generateLink({ type: 'magiclink', email })
      if (error) throw new Error(`login link: ${error.message}`)
      const tokenHash = data?.properties?.hashed_token
      if (!tokenHash) throw new Error('Login link could not be created.')
      return { tokenHash, email }
    },
  }
}

/* ------------------------------------------------------------------ */

let cached = null

function createStore() {
  if (!cached) cached = useSupabase ? supabaseStore() : firebaseStore()
  return cached
}

module.exports = { createStore, useSupabase, digits, phone10, staffEmail }

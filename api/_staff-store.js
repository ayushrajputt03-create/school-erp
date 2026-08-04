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

    // Caller kaun hai — token se, request body se NAHI. Poore app me schoolId
    // hamesha yahin se aana chahiye, warna koi bhi logged-in aadmi kisi aur
    // school ka schoolId bhej kar uska data chhoo sakta hai.
    async verifyCaller(token) {
      try {
        const decoded = await getAuth(app).verifyIdToken(token)
        return { uid: decoded.uid }
      } catch { return null }
    },

    /**
     * "Create Teacher Login" ka Firebase raasta — email + password ka asli auth
     * khaata banata hai. (Supabase par aisa khaata banane ki zarurat hi nahi
     * rehti; wahan wali tippani neeche hai.)
     */
    async ensureStaffLogin(schoolId, { email, password, staffId, profile }) {
      const adminAuth = getAuth(app)
      const displayName = profile.name || `${profile.firstName || ''} ${profile.lastName || ''}`.trim()
      const existing = await adminAuth.getUserByEmail(email).catch(() => null)
      const uid = existing
        ? (await adminAuth.updateUser(existing.uid, { password, displayName }), existing.uid)
        : (await adminAuth.createUser({ email, password, displayName })).uid

      await database.ref(`schools/${schoolId}/teachers/${uid}`).set({
        ...profile, uid, email, role: 'teacher', schoolId, isActive: true,
        createdAt: profile.createdAt || Date.now(), updatedAt: Date.now(),
      })
      await database.ref(`teachersIndex/${uid}`).set({ schoolId, teacherId: uid, role: 'teacher' })
      return { staffId: uid, created: !existing }
    },

    // Staff dashboard ka pehla payload. schoolId caller ke uid se nikalta hai.
    async staffSession(uid, { monthStart }) {
      const [index, user] = await Promise.all([read(`teachersIndex/${uid}`), read(`users/${uid}`)])
      const schoolId = index?.schoolId || user?.schoolId
      if (!schoolId) return null

      const [staff, teacher, profile, students, homework, notices, attendance] = await Promise.all([
        read(`schools/${schoolId}/staff/${uid}`),
        read(`schools/${schoolId}/teachers/${uid}`),
        read(`schools/${schoolId}/profile`),
        read(`schools/${schoolId}/students`),
        read(`schools/${schoolId}/homework`),
        read(`schools/${schoolId}/notices`),
        // Attendance yahan akela aisa node hai jo bina rukey badhta hai —
        // students x school days. Staff app sirf abhi ka mahina dikhata hai
        // (uska live listener bhi utna hi bandha hua hai), to pehla payload
        // bhi utna hi. `attendance` ka maujooda .indexOn ["date"] use hota hai.
        (async () => (await database.ref(`schools/${schoolId}/attendance`).orderByChild('date').startAt(monthStart).once('value')).val())(),
      ])
      const record = staff || teacher
      if (!record) return { schoolId, record: null }
      return {
        schoolId, record,
        profile: profile || {}, students: students || {},
        homework: homework || {}, notices: notices || {}, attendance: attendance || {},
      }
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

    // Firebase wale se ek farak: yahan school bhi mil jaata hai, kyunki
    // app_users har user ko uske school se jodta hai. Caller ka schoolId
    // hamesha yahin se aata hai, request body se nahi.
    async verifyCaller(token) {
      const { data, error } = await db.auth.getUser(token)
      if (error || !data?.user) return null
      const { data: row } = await db.from('app_users').select('legacy_uid, school_id, role').eq('id', data.user.id).maybeSingle()
      if (!row?.legacy_uid) return null
      return { uid: row.legacy_uid, supabaseId: data.user.id, schoolUuid: row.school_id, role: row.role }
    },

    /**
     * Supabase par staff ka koi alag email+password khaata banane ki zarurat
     * nahi hai: login school code + mobile + DOB se hota hai, aur wo teeno
     * `staff` row me pehle se hain. Auth user pehli baar login par
     * ensure_staff_auth_user apne aap bana deta hai.
     *
     * Phir bhi ye method kuch karta hai — wahi RPC abhi chala kar khaata pehle
     * se bana deta hai. Faayda: agar staff row me kuch gadbad hai (mobile nahi
     * mila, DOB khaali) to admin ko WAHIN pata chal jaata hai, na ki mahine
     * baad jab teacher login nahi kar paata.
     */
    async ensureStaffLogin(schoolLegacy, { staffId, profile }) {
      const found = await school(schoolLegacy)
      if (!found) throw new Error('School not found.')
      if (!staffId) throw new Error('Employee ko pehle save karo, phir login banao.')

      const { data, error } = await db.rpc('ensure_staff_auth_user', {
        p_school: found.id,
        p_staff_legacy: staffId,
        p_email: staffEmail(staffId, found.code),
        p_role: profile.department === 'Teacher' ? 'teacher' : 'staff',
        p_name: profile.name || '',
      })
      fail(error, 'staff auth user')
      if (!data?.[0]?.user_email) throw new Error('Staff account could not be prepared.')
      return { staffId, created: true }
    },

    async staffSession(uid, { monthStart }) {
      const { data: me } = await db.from('app_users').select('school_id').eq('legacy_uid', uid).maybeSingle()
      if (!me?.school_id) return null
      const { data: found } = await db.from('schools').select('id, legacy_id, name, source').eq('id', me.school_id).maybeSingle()
      if (!found) return null

      // Sab kuch RTDB wali shakal me wapas — `source` purana document hai,
      // typed column uski projection. Cutover ke baad bani rows me source na
      // ho to typed column hi kaam aate hain, isliye dono jodte hain.
      const flat = (row, extra = {}) => {
        const { source, ...columns } = row
        return { ...columns, ...extra, ...(source || {}) }
      }
      const map = (rows, extra = () => ({})) => Object.fromEntries(
        (rows || []).map(row => [row.legacy_id, flat(row, extra(row))]))

      const [staffRow, students, homework, notices, attendance] = await Promise.all([
        db.from('staff').select('*').eq('school_id', found.id).eq('legacy_id', uid).maybeSingle(),
        db.from('students').select('*').eq('school_id', found.id),
        db.from('homework').select('*').eq('school_id', found.id),
        db.from('notices').select('*').eq('school_id', found.id),
        // Wahi bandhan jo Firebase raaste par hai: attendance bina rukey badhta
        // hai, aur staff app sirf abhi ka mahina dikhata hai.
        db.from('attendance').select('*, student:students(legacy_id)').eq('school_id', found.id).gte('date', monthStart),
      ])
      if (!staffRow.data) return { schoolId: uid && found.legacy_id, record: null }

      return {
        schoolId: found.legacy_id,
        record: flat(staffRow.data),
        profile: { schoolName: found.name || '', ...(found.source?.profile || found.source || {}) },
        students: map(students.data),
        homework: map(homework.data),
        notices: map(notices.data),
        // RTDB me attendance ki key `${date}_${studentId}` thi — wahi yahan bhi,
        // warna staff app ke saare din aapas me takra jaate hain.
        attendance: Object.fromEntries((attendance.data || []).map(({ student, ...row }) => {
          const studentId = student?.legacy_id || row.source?.studentId || null
          return [`${row.date}_${studentId}`, flat(row, { studentId })]
        })),
      }
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

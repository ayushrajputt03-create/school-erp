// ============================================================
// _parent-store.js — parent portal ka data layer, do backend ke liye
//
// parent-portal.js me do tarah ki cheezein mili hui thin: ek taraf niyam
// (scrypt hashing, DOB se password, session ki umar, kaunsa bachcha kis parent
// ka hai) aur doosri taraf Firebase RTDB ke raaste. Niyam badalne nahi chahiye
// — wahi asli parent portal hai. Sirf raaste badalne hain.
//
// Isliye saare raaste yahan aa gaye. parent-portal.js ab `store.*` bulata hai
// aur use ye jaanne ki zarurat nahi ki neeche Firebase hai ya Supabase.
//
// Har method `schoolId` me LEGACY school id leta hai (wahi jo RTDB me tha aur
// jo browser ko session ke saath wapas jaata hai), uuid nahi. Isse client ka
// contract bilkul jaisa tha waisa rehta hai.
//
// Supabase taraf har table me `source` jsonb hai jisme poora original RTDB
// record pada hai — usi ko document maana jaata hai. Isliye upar ka saara
// transform (sanitizeStudent, filterNotices, fee ka hisaab) bina chhue chalta hai.
//
// USE_SUPABASE=false karke deploy karte hi sab wapas Firebase par.
// ============================================================

const useSupabase = String(process.env.USE_SUPABASE ?? process.env.VITE_USE_SUPABASE ?? '') === 'true'

const digits = value => String(value || '').replace(/\D/g, '')
const asObject = value => (value && typeof value === 'object' && !Array.isArray(value) ? value : {})

/* ------------------------------------------------------------------ */
/* Firebase (aaj ka live raasta)                                       */
/* ------------------------------------------------------------------ */

function firebaseStore() {
  const { getApps, getApp, initializeApp, cert } = require('firebase-admin/app')
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
  const at = (schoolId, suffix) => `schools/${schoolId}/${suffix}`

  return {
    backend: 'firebase',

    async schoolIdByCode(code) {
      const mapping = await read(`schoolCodes/${code}`)
      if (mapping?.schoolId && await read(`schools/${mapping.schoolId}/profile`)) return mapping.schoolId
      // Jis school ki schoolCodes entry hi nahi hai uske liye fallback. Pehle ye
      // poora schools tree utha leta tha — har school ke students, fees, sab —
      // sirf ek string milane ke liye. Ab sirf id ki list, phir har id se
      // sirf profile/schoolCode.
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
        console.warn('[parent-portal] school code lookup fallback failed:', error.message)
        return null
      }
    },

    profile: schoolId => read(at(schoolId, 'profile')),
    parent: (schoolId, parentId) => read(at(schoolId, `parents/${parentId}`)),
    parentStudentIndex: (schoolId, parentId) => read(at(schoolId, `parentStudentIndex/${parentId}`)),
    student: (schoolId, id) => read(at(schoolId, `students/${id}`)),
    allStudents: schoolId => read(at(schoolId, 'students')),
    node: (schoolId, name) => read(at(schoolId, name)),

    async studentsByIds(schoolId, ids) {
      const rows = await Promise.all(ids.map(id => read(at(schoolId, `students/${id}`))))
      const out = {}
      rows.forEach((row, index) => { if (row) out[ids[index]] = row })
      return out
    },

    async photoUrl(schoolId, studentId) {
      const value = await read(`studentPhotos/${schoolId}/${studentId}`).catch(() => null)
      return typeof value === 'string' ? value : ''
    },

    async byStudent(schoolId, name, studentId) {
      const snap = await database.ref(at(schoolId, name)).orderByChild('studentId').equalTo(studentId).once('value')
      return snap.val() || {}
    },

    async byParent(schoolId, name, parentId) {
      const snap = await database.ref(at(schoolId, name)).orderByChild('parentId').equalTo(parentId).once('value')
      return snap.val() || {}
    },

    createParent: (schoolId, parentId, doc) => database.ref(at(schoolId, `parents/${parentId}`)).set(doc),
    updateParent: (schoolId, parentId, patch) => database.ref(at(schoolId, `parents/${parentId}`)).update(patch),

    loginAttempts: async (schoolId, parentId) => (await read(at(schoolId, `parentLoginAttempts/${parentId}`))) || {},
    setLoginAttempts: (schoolId, parentId, value) => database.ref(at(schoolId, `parentLoginAttempts/${parentId}`)).set(value),
    clearLoginAttempts: (schoolId, parentId) => database.ref(at(schoolId, `parentLoginAttempts/${parentId}`)).remove(),

    session: (schoolId, parentId, token) => read(at(schoolId, `parentSessions/${parentId}/${token}`)),
    setSession: (schoolId, parentId, token, value) => database.ref(at(schoolId, `parentSessions/${parentId}/${token}`)).set(value),
    touchSession: (schoolId, parentId, token, expiresAt) =>
      database.ref(at(schoolId, `parentSessions/${parentId}/${token}/expiresAt`)).set(expiresAt),

    push: (schoolId, name, id, doc) => database.ref(at(schoolId, `${name}/${id}`)).set(doc),

    async markNotificationsRead(schoolId, ids) {
      if (!ids.length) return
      const updates = {}
      ids.forEach(id => { updates[at(schoolId, `parentNotifications/${id}/isRead`)] = true })
      await database.ref().update(updates)
    },
  }
}

/* ------------------------------------------------------------------ */
/* Supabase                                                            */
/* ------------------------------------------------------------------ */

/**
 * RTDB ke node naam -> Postgres table.
 *
 * Jo yahan nahi hai wo kv me jaata hai — bilkul wahi bantwara jo browser wale
 * adapter me src/lib/nodeMap.js karta hai. Dono ka ek jaisa rehna zaroori hai,
 * warna ek hi cheez do jagah likhi jayegi; supabase/test-parent-store.mjs isi
 * ko pakadta hai.
 */
const NODE_TABLES = {
  students: { table: 'students' },
  fees: { table: 'fee_receipts', by: 'student', activeOnly: true },
  attendance: {
    table: 'attendance',
    by: 'student',
    select: '*, student:students(legacy_id)',
    // RTDB key `${date}_${studentId}` thi. Jo rows nested shape se aayi thin
    // unke source me studentId hai hi nahi — wo parent key me pada tha —
    // isliye legacy id join se aata hai.
    keyFromRow: row => `${row.date}_${row.student?.legacy_id}`,
    fill: row => ({ date: row.date, status: row.status, studentId: row.student?.legacy_id, markedBy: row.marked_by }),
  },
  reportCards: { table: 'report_cards', by: 'student' },
  certificates: { table: 'certificates', by: 'student' },
  leaveRequests: { table: 'leave_requests', by: 'student' },
  parentNotifications: { table: 'parent_notifications', by: 'parent' },
  homework: { table: 'homework' },
  notices: { table: 'notices' },
  parents: { table: 'parents' },
  'feeManager/structures': { table: 'fee_structures' },
}

/** transport ka ek hissa table me hai, baaki kv me — dono milakar wahi shakal */
const COMPOSITE = { transport: { allocations: 'transport_allocations' } }

/** naye leave request ke liye typed columns; source hi asli document hai */
const projectLeaveRequest = doc => ({
  parent_legacy: doc.parentId ?? null,
  parent_name: doc.parentName ?? null,
  admission_no: doc.admissionNo ?? null,
  // TeacherApp apni class ki requests isi column se chhaanta hai
  class_section: doc.classSection ?? null,
  from_date: doc.fromDate ?? null,
  to_date: doc.toDate ?? null,
  reason: doc.reason ?? null,
  status: doc.status || 'pending',
})

const projectParent = doc => ({
  name: doc.name ?? null,
  phone: doc.phone || doc.id || null,
  email: doc.email ?? null,
  address: doc.address ?? null,
  language: doc.language ?? null,
  school_code: doc.schoolCode ?? null,
  default_dob: doc.defaultDOB ?? null,
  must_change_password: doc.mustChangePassword !== false,
  status: doc.status || 'active',
  password_set_at: doc.passwordSetAt ? new Date(Number(doc.passwordSetAt)).toISOString() : null,
  last_login: doc.lastLogin ? new Date(Number(doc.lastLogin)).toISOString() : null,
  updated_at: new Date().toISOString(),
})

function supabaseStore() {
  const { createClient } = require('@supabase/supabase-js')
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('Server config missing: SUPABASE_URL not set.')
  if (!key) throw new Error('Server config missing: SUPABASE_SERVICE_ROLE_KEY not set.')

  // Service role RLS ke bahar hai. Isliye handler khud tay karta hai kaun kya
  // dekh sakta hai — session token, aur bachcha usi parent ki list se.
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

  const schoolIds = new Map()
  const studentIds = new Map()
  const parentIds = new Map()

  const fail = (error, what) => { if (error) throw new Error(`${what}: ${error.message}`) }

  async function schoolUuid(legacyId) {
    if (!legacyId) return null
    if (schoolIds.has(legacyId)) return schoolIds.get(legacyId)
    const { data, error } = await db.from('schools').select('id').eq('legacy_id', legacyId).maybeSingle()
    fail(error, 'school lookup')
    if (data?.id) schoolIds.set(legacyId, data.id)
    return data?.id ?? null
  }

  async function studentUuid(school, legacyId) {
    if (!school || !legacyId) return null
    const cacheKey = `${school}/${legacyId}`
    if (studentIds.has(cacheKey)) return studentIds.get(cacheKey)
    const { data } = await db.from('students').select('id').eq('school_id', school).eq('legacy_id', legacyId).maybeSingle()
    if (data?.id) studentIds.set(cacheKey, data.id)
    return data?.id ?? null
  }

  async function parentUuid(school, legacyId) {
    if (!school || !legacyId) return null
    const cacheKey = `${school}/${legacyId}`
    if (parentIds.has(cacheKey)) return parentIds.get(cacheKey)
    const { data } = await db.from('parents').select('id').eq('school_id', school).eq('legacy_id', legacyId).maybeSingle()
    if (data?.id) parentIds.set(cacheKey, data.id)
    return data?.id ?? null
  }

  /** row -> wahi document jo app aaj RTDB se paata hai */
  const docOf = (row, def) => {
    if (!row) return null
    const doc = { ...(row.source || {}) }
    if (row.photo_path !== undefined && row.photo_path !== null) doc.photo_path = row.photo_path
    if (row.photo_url !== undefined && row.photo_url !== null) doc.photo_url = row.photo_url
    if (def?.fill) {
      for (const [k, v] of Object.entries(def.fill(row))) if (v !== null && v !== undefined) doc[k] = v
    }
    return doc
  }

  const mapOf = (rows, def) => {
    const out = {}
    for (const row of rows || []) {
      const key = def?.keyFromRow ? def.keyFromRow(row) : row.legacy_id
      if (key) out[key] = docOf(row, def)
    }
    return out
  }

  async function tableRows(school, def, tweak) {
    let query = db.from(def.table).select(def.select || '*').eq('school_id', school)
    if (def.activeOnly) query = query.is('deleted_at', null)
    if (tweak) query = tweak(query)
    const { data, error } = await query
    fail(error, def.table)
    return data || []
  }

  /* ---- kv ---- */

  async function kvGet(school, path) {
    const { data, error } = await db.from('kv').select('value').eq('school_id', school).eq('path', path).maybeSingle()
    fail(error, `kv ${path}`)
    return data?.value ?? null
  }

  // Nested key ek hi statement me — do parent saath me login karein to ek ka
  // session doosre ko mita na de. Wajah aur tafseel 0020_kv_deep.sql me.
  async function kvSet(school, path, keys, value) {
    const { error } = await db.rpc('kv_deep_set', { p_school: school, p_path: path, p_keys: keys, p_value: value })
    fail(error, `kv ${path} write`)
  }

  async function kvDel(school, path, keys) {
    const { error } = await db.rpc('kv_deep_del', { p_school: school, p_path: path, p_keys: keys })
    fail(error, `kv ${path} delete`)
  }

  const dig = (value, keys) => keys.reduce((cur, k) => (cur && typeof cur === 'object' ? cur[k] : undefined), value) ?? null

  /* ---- store ---- */

  return {
    backend: 'supabase',

    async schoolIdByCode(code) {
      const { data } = await db.from('school_codes').select('school_id').eq('code', code).maybeSingle()
      if (data?.school_id) {
        const { data: school } = await db.from('schools').select('legacy_id').eq('id', data.school_id).maybeSingle()
        if (school?.legacy_id) return school.legacy_id
      }
      // schoolCodes entry na ho to school ke apne code column se — RTDB wale
      // shallow-scan fallback ka seedha badal, aur ek hi query me.
      const { data: direct } = await db.from('schools').select('legacy_id').eq('code', code).maybeSingle()
      return direct?.legacy_id ?? null
    },

    async profile(schoolId) {
      const school = await schoolUuid(schoolId)
      if (!school) return null
      const { data, error } = await db.from('schools').select('*').eq('id', school).maybeSingle()
      fail(error, 'profile')
      if (!data) return null
      return {
        ...(data.source || {}),
        schoolName: data.name,
        schoolCode: data.code,
        academicYear: data.academic_year,
        logoURL: data.logo_url,
        logo: data.logo_url,
        schoolSealURL: data.seal_url,
        principalSignatureURL: data.principal_signature_url,
      }
    },

    async parent(schoolId, parentId) {
      const school = await schoolUuid(schoolId)
      if (!school) return null
      const { data, error } = await db.from('parents').select('*').eq('school_id', school).eq('legacy_id', parentId).maybeSingle()
      fail(error, 'parent')
      return data ? docOf(data) : null
    },

    async parentStudentIndex(schoolId, parentId) {
      const school = await schoolUuid(schoolId)
      if (!school) return null
      return dig(await kvGet(school, 'parentStudentIndex'), [parentId])
    },

    async student(schoolId, id) {
      const school = await schoolUuid(schoolId)
      if (!school || !id) return null
      const { data } = await db.from('students').select('*').eq('school_id', school).eq('legacy_id', id).is('deleted_at', null).maybeSingle()
      return data ? docOf(data) : null
    },

    async studentsByIds(schoolId, ids) {
      const school = await schoolUuid(schoolId)
      if (!school || !ids.length) return {}
      const { data, error } = await db.from('students').select('*').eq('school_id', school).in('legacy_id', ids).is('deleted_at', null)
      fail(error, 'students')
      return mapOf(data)
    },

    async allStudents(schoolId) {
      const school = await schoolUuid(schoolId)
      if (!school) return {}
      return mapOf(await tableRows(school, { table: 'students', activeOnly: true }))
    },

    /**
     * Photo private bucket me hai (student-photos), URL column khaali rehta hai.
     * Path seedha <img src> me daal dein to kuch nahi dikhta, isliye yahin par
     * signed URL bana ke dete hain — parent session waise bhi 30 minute ka hai.
     */
    async photoUrl(schoolId, studentId) {
      const school = await schoolUuid(schoolId)
      if (!school) return ''
      const { data } = await db.from('students').select('photo_url, photo_path').eq('school_id', school).eq('legacy_id', studentId).maybeSingle()
      if (data?.photo_url) return data.photo_url
      if (!data?.photo_path) return ''
      const { data: signed } = await db.storage.from('student-photos').createSignedUrl(data.photo_path, 60 * 60)
      return signed?.signedUrl || ''
    },

    async byStudent(schoolId, name, studentId) {
      const school = await schoolUuid(schoolId)
      if (!school) return {}
      const def = NODE_TABLES[name]
      if (!def) {
        // certificateRequests jaise nodes ki apni table nahi — kv me poora node
        // pada hai, usi me se is bachche ke record chhaante hain.
        const value = asObject(await kvGet(school, name))
        return Object.fromEntries(Object.entries(value).filter(([, row]) => row?.studentId === studentId))
      }
      const sid = await studentUuid(school, studentId)
      if (!sid) return {}
      return mapOf(await tableRows(school, def, q => q.eq('student_id', sid)), def)
    },

    async byParent(schoolId, name, parentId) {
      const school = await schoolUuid(schoolId)
      if (!school) return {}
      const def = NODE_TABLES[name]
      if (!def) {
        const value = asObject(await kvGet(school, name))
        return Object.fromEntries(Object.entries(value).filter(([, row]) => row?.parentId === parentId))
      }
      const pid = await parentUuid(school, parentId)
      if (!pid) return {}
      return mapOf(await tableRows(school, def, q => q.eq('parent_id', pid)), def)
    },

    async node(schoolId, name) {
      const school = await schoolUuid(schoolId)
      if (!school) return null

      const composite = COMPOSITE[name]
      if (composite) {
        const merged = { ...asObject(await kvGet(school, name)) }
        for (const [sub, table] of Object.entries(composite)) {
          merged[sub] = mapOf(await tableRows(school, { table }))
        }
        return merged
      }

      const def = NODE_TABLES[name]
      if (def) return mapOf(await tableRows(school, def), def)
      return kvGet(school, name)
    },

    async createParent(schoolId, parentId, doc) {
      const school = await schoolUuid(schoolId)
      if (!school) throw new Error('School not found.')
      const { error } = await db.from('parents').upsert(
        { school_id: school, legacy_id: parentId, source: doc, ...projectParent(doc) },
        { onConflict: 'school_id,legacy_id' }
      )
      fail(error, 'parent create')
      parentIds.delete(`${school}/${parentId}`)
    },

    /**
     * RTDB ke update() jaisa: sirf diye gaye keys badalte hain, aur `null`
     * bhejna us key ko mita dena hai — "forgot password" isi tarah passwordHash
     * hataata hai.
     */
    async updateParent(schoolId, parentId, patch) {
      const school = await schoolUuid(schoolId)
      if (!school) throw new Error('School not found.')
      const { data } = await db.from('parents').select('source').eq('school_id', school).eq('legacy_id', parentId).maybeSingle()
      const doc = { ...(data?.source || {}) }
      for (const [key, value] of Object.entries(patch || {})) {
        if (value === null) delete doc[key]
        else doc[key] = value
      }
      const { error } = await db.from('parents').update({ source: doc, ...projectParent(doc) })
        .eq('school_id', school).eq('legacy_id', parentId)
      fail(error, 'parent update')
    },

    async loginAttempts(schoolId, parentId) {
      const school = await schoolUuid(schoolId)
      if (!school) return {}
      return asObject(dig(await kvGet(school, 'parentLoginAttempts'), [parentId]))
    },

    async setLoginAttempts(schoolId, parentId, value) {
      const school = await schoolUuid(schoolId)
      if (school) await kvSet(school, 'parentLoginAttempts', [parentId], value)
    },

    async clearLoginAttempts(schoolId, parentId) {
      const school = await schoolUuid(schoolId)
      if (school) await kvDel(school, 'parentLoginAttempts', [parentId])
    },

    async session(schoolId, parentId, token) {
      const school = await schoolUuid(schoolId)
      if (!school) return null
      return dig(await kvGet(school, 'parentSessions'), [parentId, token])
    },

    async setSession(schoolId, parentId, token, value) {
      const school = await schoolUuid(schoolId)
      if (school) await kvSet(school, 'parentSessions', [parentId, token], value)
    },

    async touchSession(schoolId, parentId, token, expiresAt) {
      const school = await schoolUuid(schoolId)
      if (school) await kvSet(school, 'parentSessions', [parentId, token, 'expiresAt'], expiresAt)
    },

    async push(schoolId, name, id, doc) {
      const school = await schoolUuid(schoolId)
      if (!school) throw new Error('School not found.')

      if (name === 'leaveRequests') {
        const row = { school_id: school, legacy_id: id, source: doc, ...projectLeaveRequest(doc) }
        row.student_id = await studentUuid(school, doc.studentId)
        const { error } = await db.from('leave_requests').upsert(row, { onConflict: 'school_id,legacy_id' })
        fail(error, 'leave request')
        return
      }

      // parentMessages aur certificateRequests ki koi table nahi — kv me, wahi
      // shakal jo RTDB me thi.
      await kvSet(school, name, [id], doc)
    },

    async markNotificationsRead(schoolId, ids) {
      const school = await schoolUuid(schoolId)
      if (!school || !ids.length) return
      const { data, error } = await db.from('parent_notifications')
        .select('legacy_id, source').eq('school_id', school).in('legacy_id', ids)
      fail(error, 'notifications')
      for (const row of data || []) {
        const { error: writeError } = await db.from('parent_notifications')
          .update({ source: { ...(row.source || {}), isRead: true }, read: true })
          .eq('school_id', school).eq('legacy_id', row.legacy_id)
        fail(writeError, 'notification read')
      }
    },
  }
}

/* ------------------------------------------------------------------ */

let cached = null

/** Ek hi store poore lambda ke liye — uuid cache aur connection saath rehte hain. */
function createStore() {
  if (!cached) cached = useSupabase ? supabaseStore() : firebaseStore()
  return cached
}

module.exports = { createStore, useSupabase, digits, NODE_TABLES, COMPOSITE }

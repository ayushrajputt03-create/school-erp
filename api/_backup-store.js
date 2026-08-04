// ============================================================
// _backup-store.js — monthly backup cron ka data layer
//
// _staff-store.js / _admission-store.js jaisa hi bantwara: kis school ko
// bhejna hai, email kaisi banegi, ye sab monthly-backup.js me rehta hai;
// data kahan se aayega wo yahan.
//
// Ye file kyun bani: cutover ke baad monthly-backup.js seedhe Firebase se
// padh raha tha. Cron chalta raha, mail bhi jaati rahi — par usme cutover se
// PEHLE ka data tha. Yaani backup "ban raha hai" dikh raha tha aur asli live
// data ka koi backup tha hi nahi. Isliye is route ka Supabase par aana baaki
// sab se zyada zaroori tha.
//
// USE_SUPABASE=false karte hi sab wapas Firebase par.
// ============================================================

const useSupabase = String(process.env.USE_SUPABASE ?? process.env.VITE_USE_SUPABASE ?? '') === 'true'

// Backup me sheet ka naam -> RTDB node. Dono backend ek hi teen sheet dete
// hain, taaki school ko aane wali file ka shape backend badalne se na badle.
const SHEETS = ['students', 'fees', 'attendance']

/* ------------------------------------------------------------------ */
/* Firebase (purana raasta — USE_SUPABASE=false par abhi bhi chalta hai) */
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
    return initializeApp({
      credential: cert(credentials),
      databaseURL: process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL,
    })
  })()

  const database = getDatabase(app)
  const read = async path => (await database.ref(path).once('value')).val()

  return {
    backend: 'firebase',

    requiredEnv: ['FIREBASE_SERVICE_ACCOUNT_JSON'],

    // Poora `schools` tree padhna har school ka saara data uthata hai sirf
    // backupSettings tak pahunchne ke liye. Isliye pehle sirf id ki list, phir
    // har id se do chhote node. Shallow call na chale to purana raasta, taaki
    // backup chup-chaap band na ho jaye.
    async listSchools() {
      const databaseUrl = process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL
      try {
        const accessToken = await app.options.credential.getAccessToken()
        const listed = await fetch(`${databaseUrl}/schools.json?shallow=true&access_token=${accessToken.access_token}`)
        if (!listed.ok) throw new Error(`shallow list failed (${listed.status})`)
        const ids = Object.keys(await listed.json() || {})
        return Promise.all(ids.map(async schoolId => {
          const [settings, name] = await Promise.all([
            read(`schools/${schoolId}/backupSettings`),
            read(`schools/${schoolId}/profile/schoolName`),
          ])
          return { schoolId, schoolName: name || '', backupSettings: settings || {} }
        }))
      } catch (error) {
        console.warn('[backup] shallow school listing unavailable, falling back to full read:', error.message)
        const all = await read('schools') || {}
        return Object.entries(all).map(([schoolId, school]) => ({
          schoolId,
          schoolName: school?.profile?.schoolName || school?.name || '',
          backupSettings: school?.backupSettings || {},
        }))
      }
    },

    async schoolData(schoolId) {
      const rows = await Promise.all(SHEETS.map(node => read(`schools/${schoolId}/${node}`)))
      return Object.fromEntries(SHEETS.map((node, i) => [
        node,
        Object.entries(rows[i] || {}).map(([id, row]) => ({ id, ...row })),
      ]))
    },

    markSent: (schoolId, at) => database.ref(`schools/${schoolId}/backupSettings/lastSentAt`).set(at),
  }
}

/* ------------------------------------------------------------------ */
/* Supabase                                                            */
/* ------------------------------------------------------------------ */

function supabaseStore() {
  const { createClient } = require('@supabase/supabase-js')
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('Server config missing: SUPABASE_URL not set.')
  if (!key) throw new Error('Server config missing: SUPABASE_SERVICE_ROLE_KEY not set.')

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const fail = (error, what) => { if (error) throw new Error(`${what}: ${error.message}`) }

  // PostgREST ek baar me 1000 row se zyada nahi deta. Bina paging ke ek bade
  // school ka backup chup-chaap 1000 row par kat jaata — aur wo bilkul waisa
  // hi dikhta jaisa poora backup. Isliye paging optional nahi hai.
  const PAGE = 1000
  async function all(build, what) {
    const rows = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await build().range(from, from + PAGE - 1)
      fail(error, what)
      rows.push(...(data || []))
      if ((data || []).length < PAGE) return rows
    }
  }

  /**
   * Postgres row -> wahi shakal jo Firebase backup me aati thi.
   *
   * `source` purana RTDB document hai, typed column uski projection. Cutover
   * ke BAAD bani rows (nayi admission, nayi receipt) me source ho bhi sakta
   * hai aur nahi bhi — sirf source par bharosa karte to wo rows backup me
   * khaali aati. Isliye dono jodte hain: pehle typed column, upar source.
   */
  const flatten = (row, extra = {}) => {
    const { source, ...columns } = row
    return { id: row.legacy_id || row.id, ...columns, ...extra, ...(source || {}) }
  }

  return {
    backend: 'supabase',

    requiredEnv: ['SUPABASE_SERVICE_ROLE_KEY'],

    async listSchools() {
      const { data: schools, error } = await db.from('schools').select('id, legacy_id, name')
      fail(error, 'school list')
      // backupSettings ki apni table nahi hai — wo kv me hai, RTDB jaisa hi
      // ek blob. Ek hi query me saare school ka le lete hain.
      const { data: settings, error: kvError } = await db.from('kv').select('school_id, value').eq('path', 'backupSettings')
      fail(kvError, 'backup settings')
      const byId = new Map((settings || []).map(row => [row.school_id, row.value || {}]))
      return (schools || []).map(school => ({
        schoolId: school.legacy_id,
        supabaseId: school.id,
        schoolName: school.name || '',
        backupSettings: byId.get(school.id) || {},
      }))
    },

    async schoolData(schoolLegacy) {
      const { data: school, error } = await db.from('schools').select('id').eq('legacy_id', schoolLegacy).maybeSingle()
      fail(error, 'school lookup')
      if (!school) return Object.fromEntries(SHEETS.map(node => [node, []]))

      const [students, fees, attendance] = await Promise.all([
        all(() => db.from('students').select('*').eq('school_id', school.id), 'students read'),
        // Delete ki hui receipts fees me nahi aati — wahi niyam jo app me hai,
        // warna backup ka total school ke apne total se nahi milta.
        all(() => db.from('fee_receipts').select('*').eq('school_id', school.id).is('deleted_at', null), 'fees read'),
        // Attendance par student ka legacy id join se aata hai: purani nested
        // rows ke source me studentId hai hi nahi, wo parent key me pada tha.
        all(() => db.from('attendance').select('*, student:students(legacy_id)').eq('school_id', school.id), 'attendance read'),
      ])

      return {
        students: students.map(row => flatten(row)),
        fees: fees.map(row => flatten(row)),
        attendance: attendance.map(({ student, ...row }) => flatten(row, { studentId: student?.legacy_id || null })),
      }
    },

    async markSent(schoolLegacy, at) {
      const { data: school, error } = await db.from('schools').select('id').eq('legacy_id', schoolLegacy).maybeSingle()
      fail(error, 'school lookup')
      if (!school) return
      // kv ek hi row me poora blob rakhta hai, isliye padh kar merge karte
      // hain — seedha upsert baaki backupSettings (enabled, email) uda deta.
      const { data: existing } = await db.from('kv').select('value').eq('school_id', school.id).eq('path', 'backupSettings').maybeSingle()
      const { error: writeError } = await db.from('kv').upsert(
        { school_id: school.id, path: 'backupSettings', value: { ...(existing?.value || {}), lastSentAt: at } },
        { onConflict: 'school_id,path' },
      )
      fail(writeError, 'backup settings write')
    },
  }
}

/* ------------------------------------------------------------------ */

let cached = null

function createStore() {
  if (!cached) cached = useSupabase ? supabaseStore() : firebaseStore()
  return cached
}

module.exports = { createStore, useSupabase, SHEETS }

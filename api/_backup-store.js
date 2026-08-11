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

// Supabase only — Firebase fallback removed. Simpler codebase, no dual-backend logic.
const SHEETS = ['students', 'fees', 'attendance', 'staffAttendance']

// H aur HD dono half day hain — purana data H likhta tha, app ab HD likhti hai.
const STATUS_LABELS = { P: 'Present', A: 'Absent', L: 'Leave', H: 'Half Day', HD: 'Half Day' }
const staffName = staff => `${staff?.firstName || staff?.first_name || ''} ${staff?.lastName || staff?.last_name || ''}`.trim()
  || staff?.full_name || staff?.name || ''

/**
 * { "2026-08-09": { staffId: "P", _editedBy: "..." } } -> flat sheet rows.
 *
 * `_` se shuru hone wale keys date row ka audit meta hain (kisne/kab edit kiya),
 * employee nahi — unhe attendance line banane par sheet me jhoothi rows aa
 * jaati hain. Isliye filter zaroori hai.
 */
const staffAttendanceRows = (staffAttendance, staff) => Object.entries(staffAttendance || {})
  .flatMap(([date, marks]) => Object.entries(marks || {})
    .filter(([staffId, status]) => !staffId.startsWith('_') && typeof status === 'string')
    .map(([staffId, status]) => ({
      date,
      employeeCode: staff?.[staffId]?.employeeCode || '',
      employeeName: staffName(staff?.[staffId]) || staffId,
      status: STATUS_LABELS[status] || status,
    })))
  .sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.employeeName.localeCompare(b.employeeName))

/* ================================================================== */
/* Supabase only                                                        */
/* ================================================================== */

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

      const [students, fees, attendance, staffAttendance] = await Promise.all([
        all(() => db.from('students').select('*').eq('school_id', school.id), 'students read'),
        // Delete ki hui receipts fees me nahi aati — wahi niyam jo app me hai,
        // warna backup ka total school ke apne total se nahi milta.
        all(() => db.from('fee_receipts').select('*').eq('school_id', school.id).is('deleted_at', null), 'fees read'),
        // Attendance par student ka legacy id join se aata hai: purani nested
        // rows ke source me studentId hai hi nahi, wo parent key me pada tha.
        all(() => db.from('attendance').select('*, student:students(legacy_id)').eq('school_id', school.id), 'attendance read'),
        // Teacher/staff attendance. Naam join se hi milta hai — is table me sirf
        // staff_id hai, aur bina naam ki sheet school ke kisi kaam ki nahi.
        all(() => db.from('staff_attendance')
          .select('date, status, staff:staff(employee_code, full_name)')
          .eq('school_id', school.id), 'staff attendance read'),
      ])

      return {
        students: students.map(row => flatten(row)),
        fees: fees.map(row => flatten(row)),
        attendance: attendance.map(({ student, ...row }) => flatten(row, { studentId: student?.legacy_id || null })),
        // Firebase wali sheet ka bilkul wahi shape — school ko file backend se
        // farq nahi dikhna chahiye.
        staffAttendance: staffAttendance
          .map(row => ({
            date: row.date,
            employeeCode: row.staff?.employee_code || '',
            employeeName: staffName(row.staff) || '',
            status: STATUS_LABELS[row.status] || row.status || '',
          }))
          .sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.employeeName.localeCompare(b.employeeName)),
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

let cached = null

function createStore() {
  if (!cached) cached = supabaseStore()
  return cached
}

module.exports = { createStore, SHEETS }

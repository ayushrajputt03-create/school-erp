// ============================================================
// verify.mjs — Firebase backup ke counts vs Postgres ke counts
//
//   node supabase/verify.mjs <backup.json>
//
// Har farak dikhaya jaata hai, chupaya nahi.
// ============================================================

import fs from 'node:fs'
import { connect } from './db.mjs'

const backupPath = process.argv[2]
if (!backupPath) {
  console.error('usage: node supabase/verify.mjs <backup.json>')
  process.exit(1)
}

const db = JSON.parse(fs.readFileSync(backupPath, 'utf8'))
const schools = db.schools || {}

// ---------- Firebase side ----------
const fb = {}
const add = (k, n = 1) => { fb[k] = (fb[k] || 0) + n }
const count = (o) => (o && typeof o === 'object' ? Object.keys(o).length : 0)

add('schools', count(schools))
add('school_codes', count(db.schoolCodes))
add('app_users', count(db.users))

for (const s of Object.values(schools)) {
  add('students', count(s.students))
  add('students_deleted', count(s.deletedStudents))
  add('staff', count(s.staff))
  add('parents', count(s.parents))
  add('fee_receipts', count(s.fees))
  add('fee_structures', count((s.feeManager || {}).structures))
  add('fee_groups', count((s.feeManager || {}).groups))
  add('fee_fines', count((s.feeManager || {}).fines))
  add('certificates', count(s.certificates))
  add('report_marks', count(s.reportMarks))
  add('report_cards', count(s.reportCards))
  add('date_sheets', count(s.dateSheet))
  add('exams', count(s.exams))
  add('notices', count(s.notices))
  add('homework', count(s.homework))
  add('leave_requests', count(s.leaveRequests))
  add('admission_requests', count(s.admissionRequests))
  add('parent_notifications', count(s.parentNotifications))
  add('transport_allocations', count((s.transport || {}).allocations))

  // attendance: dono shape ginana padega
  for (const [key, rec] of Object.entries(s.attendance || {})) {
    if (!rec || typeof rec !== 'object') continue
    if (rec.date && (rec.studentId || rec.student_id)) { add('attendance', 1); continue }
    for (const block of Object.values(rec)) {
      if (!block || typeof block !== 'object') continue
      for (const [k, v] of Object.entries(block)) {
        if (typeof v === 'string' && k.startsWith('student')) add('attendance', 1)
      }
    }
  }

  for (const map of Object.values(s.staffAttendance || {})) {
    if (map && typeof map === 'object') {
      for (const v of Object.values(map)) if (typeof v === 'string') add('staff_attendance', 1)
    }
  }
}

// ---------- Postgres side ----------
const QUERIES = {
  schools: 'select count(*)::int n from schools',
  school_codes: 'select count(*)::int n from school_codes',
  app_users: 'select count(*)::int n from app_users',
  students: 'select count(*)::int n from students where deleted_at is null',
  students_deleted: 'select count(*)::int n from students where deleted_at is not null',
  staff: 'select count(*)::int n from staff',
  parents: 'select count(*)::int n from parents',
  attendance: 'select count(*)::int n from attendance',
  staff_attendance: 'select count(*)::int n from staff_attendance',
  fee_receipts: 'select count(*)::int n from fee_receipts where deleted_at is null',
  fee_structures: 'select count(*)::int n from fee_structures',
  fee_groups: 'select count(*)::int n from fee_groups',
  fee_fines: 'select count(*)::int n from fee_fines',
  certificates: 'select count(*)::int n from certificates',
  report_marks: 'select count(*)::int n from report_marks',
  report_cards: 'select count(*)::int n from report_cards',
  date_sheets: 'select count(*)::int n from date_sheets',
  exams: 'select count(*)::int n from exams',
  notices: 'select count(*)::int n from notices',
  homework: 'select count(*)::int n from homework',
  leave_requests: 'select count(*)::int n from leave_requests',
  admission_requests: 'select count(*)::int n from admission_requests',
  parent_notifications: 'select count(*)::int n from parent_notifications',
  transport_allocations: 'select count(*)::int n from transport_allocations',
}

const { client } = await connect()

console.log('TABLE                      FIREBASE   POSTGRES   FARAK')
console.log('-'.repeat(58))

let mismatches = 0
for (const [name, sql] of Object.entries(QUERIES)) {
  const pgN = (await client.query(sql)).rows[0].n
  const fbN = fb[name] || 0
  const diff = pgN - fbN
  const mark = diff === 0 ? 'OK' : (diff > 0 ? `+${diff}` : String(diff))
  if (diff !== 0) mismatches++
  console.log(`${name.padEnd(26)} ${String(fbN).padStart(6)}   ${String(pgN).padStart(8)}   ${mark}`)
}

console.log('-'.repeat(58))
console.log(mismatches === 0 ? 'SAB MILA — koi farak nahi' : `${mismatches} table me farak hai (neeche wajah dekh)`)

// ---------- rollup sahi bana ki nahi ----------
const rollup = await client.query(`
  select
    (select count(*)::int from attendance_summary) as summary_rows,
    (select coalesce(sum(present + absent + leave_count + holiday + half_day),0)::int from attendance_summary) as summary_total,
    (select count(*)::int from attendance) as attendance_rows
`)
const r = rollup.rows[0]
console.log('\n=== ROLLUP JAANCH ===')
console.log(`  attendance rows      : ${r.attendance_rows}`)
console.log(`  summary rows         : ${r.summary_rows}  (student x mahina)`)
console.log(`  summary me gine gaye : ${r.summary_total}`)
console.log(`  ${r.summary_total === r.attendance_rows ? 'OK — trigger ne sab gina' : 'GADBAD — counts nahi mil rahe'}`)

// ---------- orphan check ----------
console.log('\n=== ANAATH ROWS (jinka parent record nahi) ===')
const orphans = {
  'attendance bina student': 'select count(*)::int n from attendance a left join students s on s.id=a.student_id where s.id is null',
  'fee_receipts bina student': 'select count(*)::int n from fee_receipts f where f.student_id is null',
  'parent_students bina parent': 'select count(*)::int n from parent_students ps left join parents p on p.id=ps.parent_id where p.id is null',
  'certificates bina student': 'select count(*)::int n from certificates c where c.student_id is null',
}
for (const [label, sql] of Object.entries(orphans)) {
  const n = (await client.query(sql)).rows[0].n
  console.log(`  ${label.padEnd(30)} ${n}`)
}

// ---------- spot check ----------
console.log('\n=== NAMOONA: har school ka haal ===')
const per = await client.query(`
  select sc.name,
         (select count(*) from students st where st.school_id=sc.id and st.deleted_at is null) students,
         (select count(*) from attendance a where a.school_id=sc.id) attendance,
         (select count(*) from parents p where p.school_id=sc.id) parents,
         (select count(*) from fee_receipts f where f.school_id=sc.id) receipts
  from schools sc order by 2 desc
`)
for (const row of per.rows) {
  console.log(`  ${row.name.slice(0, 38).padEnd(40)} students=${String(row.students).padStart(4)}  att=${String(row.attendance).padStart(4)}  parents=${String(row.parents).padStart(4)}  receipts=${row.receipts}`)
}

await client.end()

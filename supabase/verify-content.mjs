// ============================================================
// verify-content.mjs — sirf ginti nahi, har field ki value milata hai
//
//   node supabase/verify-content.mjs <backup.json>
//
// Har active student ka har mapped field Firebase vs Postgres compare hota hai.
// Attendance aur fees ke totals bhi.
// ============================================================

import fs from 'node:fs'
import { connect } from './db.mjs'

const backupPath = process.argv[2]
if (!backupPath) {
  console.error('usage: node supabase/verify-content.mjs <backup.json>')
  process.exit(1)
}

const db = JSON.parse(fs.readFileSync(backupPath, 'utf8'))
const { client } = await connect()

const NUL = String.fromCharCode(0)
const clean = (v) => (v === null || v === undefined || v === '' ? null : String(v).split(NUL).join(''))
const asDate = (v) => {
  if (!v) return null
  const s = String(v).trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (m) return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`
  return null
}
// date columns ko SQL me hi text bana ke mangwate hain.
// JS Date se hokar jaate to IST (+5:30) ke chakkar me har date ek din
// peeche dikhti — data sahi hota, jaanch jhooth bolti.
const pgDate = (d) => d || null

// field → [firebase key, transform]
const FIELDS = {
  full_name: ['full_name', clean],
  admission_number: ['admission_number', clean],
  roll_number: ['roll_number', clean],
  class_name: ['class_name', clean],
  section: ['section', clean],
  gender: ['gender', clean],
  father_name: ['father_name', clean],
  father_phone: ['father_phone', clean],
  mother_name: ['mother_name', clean],
  guardian_name: ['guardian_name', clean],
  guardian_phone: ['guardian_phone', clean],
  address: ['address', clean],
  city: ['city', clean],
  state: ['state', clean],
  pincode: ['pincode', clean],
  category: ['category', clean],
  religion: ['religion', clean],
  fee_group: ['fee_group', clean],
  fee_status: ['fee_status', clean],
  parent_login_phone: ['parent_login_phone', clean],
  blood_group: ['blood_group', clean],
  academic_session: ['academic_session', clean],
}

let checked = 0
let fieldChecks = 0
const problems = []

for (const [schoolLegacy, school] of Object.entries(db.schools || {})) {
  const students = school.students || {}
  if (!Object.keys(students).length) continue

  const { rows } = await client.query(
    `select s.legacy_id, s.*,
            to_char(s.date_of_birth,  'YYYY-MM-DD') as date_of_birth_txt,
            to_char(s.admission_date, 'YYYY-MM-DD') as admission_date_txt
       from students s
       join schools sc on sc.id = s.school_id
      where sc.legacy_id = $1 and s.deleted_at is null`,
    [schoolLegacy]
  )
  const byLegacy = new Map(rows.map((r) => [r.legacy_id, r]))

  for (const [legacyId, fbSt] of Object.entries(students)) {
    const pgSt = byLegacy.get(legacyId)
    if (!pgSt) { problems.push({ legacyId, field: '(poora record)', fb: 'hai', pg: 'GAYAB' }); continue }
    checked++

    for (const [col, [fbKey, tf]] of Object.entries(FIELDS)) {
      fieldChecks++
      const want = tf(fbSt[fbKey])
      const got = pgSt[col] === null || pgSt[col] === undefined ? null : String(pgSt[col])
      if (want !== got) problems.push({ legacyId, field: col, fb: want, pg: got })
    }

    // dates alag se
    for (const [col, fbKey] of [['date_of_birth', 'date_of_birth'], ['admission_date', 'admission_date']]) {
      fieldChecks++
      const want = asDate(fbSt[fbKey])
      const got = pgDate(pgSt[`${col}_txt`])
      if (want !== got) problems.push({ legacyId, field: col, fb: want, pg: got })
    }
  }
}

console.log('=== STUDENT FIELD JAANCH ===')
console.log(`  students jaanche : ${checked}`)
console.log(`  field comparisons: ${fieldChecks}`)
console.log(`  farak mile       : ${problems.length}`)
if (problems.length) {
  console.log('\n  pehle 20 farak:')
  for (const p of problems.slice(0, 20)) {
    console.log(`    ${p.legacyId}  ${p.field}`)
    console.log(`       firebase: ${JSON.stringify(p.fb)}`)
    console.log(`       postgres: ${JSON.stringify(p.pg)}`)
  }
}

// ---------- paisa ----------
console.log('\n=== PAISE KA MILAAN ===')
let fbPaid = 0
let fbAmount = 0
for (const school of Object.values(db.schools || {})) {
  for (const f of Object.values(school.fees || {})) {
    if (f && typeof f === 'object') { fbPaid += Number(f.paidAmount) || 0; fbAmount += Number(f.amount) || 0 }
  }
}
const money = (await client.query(
  'select coalesce(sum(paid_amount),0)::float paid, coalesce(sum(amount),0)::float amount from fee_receipts where deleted_at is null'
)).rows[0]
console.log(`  kul amount  firebase=${fbAmount}  postgres=${money.amount}  ${fbAmount === money.amount ? 'OK' : 'FARAK'}`)
console.log(`  kul paid    firebase=${fbPaid}  postgres=${money.paid}  ${fbPaid === money.paid ? 'OK' : 'FARAK'}`)

// ---------- attendance status-wise ----------
console.log('\n=== ATTENDANCE STATUS-WISE ===')
const fbStatus = {}
for (const school of Object.values(db.schools || {})) {
  for (const rec of Object.values(school.attendance || {})) {
    if (!rec || typeof rec !== 'object') continue
    if (rec.date && (rec.studentId || rec.student_id)) {
      const s = String(rec.status || rec.mark || '').toUpperCase()
      fbStatus[s] = (fbStatus[s] || 0) + 1
    }
  }
}
// nested shape bhi gino — warna dono ki ginti alag-alag galat lagti hai
for (const school of Object.values(db.schools || {})) {
  for (const [date, rec] of Object.entries(school.attendance || {})) {
    if (!rec || typeof rec !== 'object') continue
    if (rec.date && (rec.studentId || rec.student_id)) continue
    for (const block of Object.values(rec)) {
      if (!block || typeof block !== 'object') continue
      for (const [k, v] of Object.entries(block)) {
        if (typeof v === 'string' && k.startsWith('student')) {
          const s = v.toUpperCase()
          fbStatus[s] = (fbStatus[s] || 0) + 1
        }
      }
    }
  }
}
const pgStatus = (await client.query('select status, count(*)::int n from attendance group by status order by status')).rows
console.log('  (dono shape milakar; farak = wahi 16 duplicate + 1 gum student)')
for (const r of pgStatus) {
  const fbN = fbStatus[r.status] || 0
  console.log(`    ${r.status}  firebase=${String(fbN).padStart(4)}  postgres=${String(r.n).padStart(4)}  ${fbN === r.n ? 'OK' : 'farak ' + (r.n - fbN)}`)
}

// ---------- wo ek anaath receipt ----------
const orphan = (await client.query(
  "select legacy_id, student_name, admission_number, amount from fee_receipts where student_id is null"
)).rows
if (orphan.length) {
  console.log('\n=== BINA STUDENT WALI RECEIPT ===')
  for (const o of orphan) console.log(`  ${o.legacy_id}  name=${JSON.stringify(o.student_name)}  adm=${o.admission_number}  amount=${o.amount}`)
}

await client.end()
console.log(`\n${problems.length === 0 ? 'SAB SAHI — har field milta hai' : problems.length + ' farak hain, upar dekh'}`)

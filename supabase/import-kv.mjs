// ============================================================
// import-kv.mjs — jin nodes ki apni table nahi hai, unhe kv me daalta hai
//
//   node supabase/import-kv.mjs <backup.json> [--apply]
//
// Jo nodes proper tables me ja chuke hain unhe chhod deta hai —
// warna wahi data do jagah ho jayega aur dono alag hone lagenge.
// ============================================================

import fs from 'node:fs'
import { connect } from './db.mjs'

const file = process.argv[2]
const APPLY = process.argv.includes('--apply')
if (!file) { console.error('usage: node supabase/import-kv.mjs <backup.json> [--apply]'); process.exit(1) }

// Ye pehle hi apni tables me chale gaye hain — kv me dobara nahi daalne
const ALREADY_TABLED = new Set([
  'profile', 'students', 'deletedStudents', 'staff', 'staffAttendance',
  'attendance', 'parents', 'parentStudentIndex', 'parentNotifications',
  'fees', 'feeManager', 'certificates', 'certificateCounters',
  'reportMarks', 'reportExams', 'reportCards', 'dateSheet', 'exams',
  'notices', 'homework', 'transport', 'leaveRequests', 'admissionRequests',
  'subscription', 'auditLogs', 'admissionCounter', 'teachers',
])

// Ye scalar hain (string/number), node nahi — schools table me pehle se hain
const SCALARS = new Set(['academicYear', 'createdAt', 'createdBy', 'lastLoginAt', 'name', 'migratedFrom', 'admissionSequenceVersion'])

const NUL = String.fromCharCode(0)
const clean = (v) => {
  if (typeof v === 'string') return v.split(NUL).join('')
  if (Array.isArray(v)) return v.map(clean)
  if (v && typeof v === 'object') {
    const o = {}
    for (const [k, x] of Object.entries(v)) o[k.split(NUL).join('')] = clean(x)
    return o
  }
  return v
}

const db = JSON.parse(fs.readFileSync(file, 'utf8'))
const { client } = await connect()
const schoolUuid = new Map((await client.query('select legacy_id, id from public.schools')).rows.map((r) => [r.legacy_id, r.id]))

const rows = []
const skippedTabled = new Set()

for (const [legacyId, school] of Object.entries(db.schools || {})) {
  const sid = schoolUuid.get(legacyId)
  if (!sid) continue
  for (const [node, value] of Object.entries(school)) {
    if (SCALARS.has(node)) continue
    if (ALREADY_TABLED.has(node)) { skippedTabled.add(node); continue }
    if (value === null || value === undefined) continue
    rows.push({ sid, path: node, value: clean(value), size: JSON.stringify(value).length })
  }
}

const byNode = {}
for (const r of rows) {
  byNode[r.path] = byNode[r.path] || { n: 0, bytes: 0 }
  byNode[r.path].n++
  byNode[r.path].bytes += r.size
}

console.log('NODE                       SCHOOLS      SIZE')
console.log('-'.repeat(48))
for (const [k, v] of Object.entries(byNode).sort((a, b) => b[1].bytes - a[1].bytes)) {
  console.log(`${k.padEnd(26)} ${String(v.n).padStart(7)}   ${(v.bytes / 1024).toFixed(1).padStart(7)} KB`)
}
console.log('-'.repeat(48))
console.log(`kv me jayenge: ${rows.length} rows, ${(rows.reduce((a, r) => a + r.size, 0) / 1024).toFixed(0)} KB`)
console.log(`\napni table wale (chhode gaye): ${[...skippedTabled].sort().join(', ')}`)

if (!APPLY) {
  console.log('\n(sirf dikhaya — kuch likha nahi. --apply lagao to chalega.)')
  await client.end()
  process.exit(0)
}

try {
  await client.query('begin')
  let n = 0
  for (const r of rows) {
    const res = await client.query(
      `insert into public.kv (school_id, path, value) values ($1::uuid, $2, $3::jsonb)
       on conflict (school_id, path) do update set value = excluded.value, updated_at = now()`,
      [r.sid, r.path, JSON.stringify(r.value)]
    )
    n += res.rowCount
  }
  await client.query('commit')
  console.log(`\nOK — kv me ${n} rows`)
} catch (err) {
  await client.query('rollback').catch(() => {})
  console.error('\nFAIL:', err.message)
  process.exitCode = 1
} finally {
  await client.end().catch(() => {})
}

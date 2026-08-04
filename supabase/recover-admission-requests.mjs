// ============================================================
// recover-admission-requests.mjs
//
// Pehle Firebase se dump nikaalo (har school ke liye ek baar). Service account
// ki zarurat nahi — firebase CLI ka apna login kaafi hai:
//
//   npx firebase database:get "/schools" --shallow --project school-open-erp
//   npx firebase database:get "/schools/<schoolId>/admissionRequests" \
//       --project school-open-erp -o dump/<schoolId>.json
//
// Phir un sab ko ek file me jodo — { "<schoolId>": { "<requestId>": {...} } } —
// aur:
//
//   node supabase/recover-admission-requests.mjs --dump dump/all.json
//   node supabase/recover-admission-requests.mjs --dump dump/all.json --apply
//
// Dump file me asli client data hota hai (bachchon ke naam, phone). Use repo ke
// bahar rakho — backups/ ki tarah ye kabhi commit nahi honi chahiye.
//
// Cutover ke beech ki atki hui admission requests Firebase se Supabase me
// laata hai.
//
// Kya hua tha: `api/admission.js` cutover me chhoot gaya tha — wo seedha
// firebase-admin use kar raha tha. Public form se aane wali har request
// FIREBASE me ja rahi thi, jabki admin ka "Admission Requests" screen Supabase
// se padhta hai. Parent ko receipt milti thi, school ko request kabhi dikhti
// nahi thi. Data kho nahi raha tha — galat database me pada tha. Route to
// a92ab3f me theek ho gaya, par jo requests us beech me aa gayi thi wo abhi
// bhi Firebase me hi hain. Ye script unhi ko nikalti hai.
//
// Do niyam jo is script me tode nahi ja sakte:
//
//   1. KUCH OVERWRITE NAHI HOGA. Sirf wahi legacy_id insert hoti hai jo
//      Supabase me hai hi nahi. Agar admin ne wahi request pehle se approve/
//      reject kar di hai, ya haath se dobara bana li hai, to Firebase ki
//      purani copy uspar nahi chadhegi. (school_id, legacy_id) par unique
//      constraint hai, isliye dobara chala do to bhi kuch nahi bigdega.
//
//   2. STATUS JAISA THA WAISA HI AAYEGA. Sab kuch 'pending' bana dena aasan
//      hota, par tab woh requests jo school ne Firebase-wale daur me hi
//      approve/reject kar di thi, dobara pending ban kar admin ki list me
//      aa jaati — do baar admission ka khatra.
//
// `source` jsonb me poora RTDB-shaped record jaata hai. Ye zaroori hai:
// admissionRequests node ka koi `fill` nahi hai, yaani admin app poori row
// `source` se banata hai. Sirf typed column bhar dein to admin ko khaali row
// dikhegi. Wahi baat _admission-store.js me bhi likhi hai.
// ============================================================
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')
const dumpFlag = process.argv.indexOf('--dump')
if (dumpFlag < 0) {
  console.error('usage: node supabase/recover-admission-requests.mjs --dump <file.json> [--apply]')
  process.exit(1)
}

/* ---- env: .env.local, ya --env se koi aur file (jaise Vercel se khinchi hui) ---- */
const envFlag = process.argv.indexOf('--env')
const envPath = envFlag > -1
  ? process.argv[envFlag + 1]
  : fileURLToPath(new URL('../.env.local', import.meta.url))
for (const raw of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const line = raw.trim(); if (!line || line.startsWith('#')) continue
  const i = line.indexOf('='); if (i < 0) continue
  const value = line.slice(i + 1).trim().replace(/^"([\s\S]*)"$/, '$1')
  process.env[line.slice(0, i).trim()] ??= value
}

const need = name => {
  const value = process.env[name]
  if (!value) { console.error(`${name} nahi mila (${envPath})`); process.exit(1) }
  return value
}

const db = createClient(need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })

/* ---- dump se saari admission requests ---- */
console.log(`\n${APPLY ? 'APPLY' : 'DRY RUN'} — Firebase dump padh raha hun...\n`)

const dump = JSON.parse(fs.readFileSync(process.argv[dumpFlag + 1], 'utf8'))
const fromFirebase = []
for (const [legacyId, requests] of Object.entries(dump)) {
  for (const [id, request] of Object.entries(requests || {})) {
    fromFirebase.push({ schoolLegacyId: legacyId, id, request })
  }
}

if (!fromFirebase.length) {
  console.log('Firebase me ek bhi admission request nahi hai. Kuch recover karne ko nahi.\n')
  process.exit(0)
}

/* ---- Supabase me kya pehle se hai ---- */
const { data: schoolRows, error: schoolError } = await db.from('schools').select('id, legacy_id, name')
if (schoolError) { console.error('schools padh nahi paya:', schoolError.message); process.exit(1) }
const uuidOf = new Map(schoolRows.map(row => [row.legacy_id, row.id]))
const nameOf = new Map(schoolRows.map(row => [row.legacy_id, row.name]))

const { data: existing, error: existingError } = await db.from('admission_requests').select('school_id, legacy_id, status')
if (existingError) { console.error('admission_requests padh nahi paya:', existingError.message); process.exit(1) }
const already = new Set(existing.map(row => `${row.school_id}|${row.legacy_id}`))

/* ---- diff ---- */
const missing = []
const skipped = []
for (const row of fromFirebase) {
  const schoolUuid = uuidOf.get(row.schoolLegacyId)
  if (!schoolUuid) { skipped.push({ ...row, why: 'school Supabase me hai hi nahi' }); continue }
  if (already.has(`${schoolUuid}|${row.id}`)) { skipped.push({ ...row, why: 'Supabase me pehle se hai' }); continue }
  missing.push({ ...row, schoolUuid })
}

const asDate = value => {
  if (!value) return null
  const text = String(value).trim()
  let m = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (m) return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`
  return null
}

/* ---- report ---- */
console.log(`Firebase me kul       : ${fromFirebase.length}`)
console.log(`Supabase me pehle se  : ${skipped.filter(s => s.why === 'Supabase me pehle se hai').length}`)
console.log(`School hi nahi mila   : ${skipped.filter(s => s.why !== 'Supabase me pehle se hai').length}`)
console.log(`LAANI HAIN            : ${missing.length}\n`)

for (const s of skipped.filter(s => s.why !== 'Supabase me pehle se hai')) {
  console.log(`  CHHODA  ${s.schoolLegacyId}/${s.id} — ${s.why}`)
}

if (missing.length) {
  console.log('  school                 | request id            | student            | class    | phone        | status')
  console.log('  ' + '-'.repeat(105))
  for (const row of missing) {
    const r = row.request || {}
    const cell = (value, width) => String(value ?? '—').slice(0, width).padEnd(width)
    console.log(`  ${cell(nameOf.get(row.schoolLegacyId) || row.schoolLegacyId, 22)} | ${cell(row.id, 21)} | ${cell(r.studentName, 18)} | ${cell(r.classAppliedFor, 8)} | ${cell(r.parentPhone, 12)} | ${r.status || 'pending'}`)
  }
  console.log('')
}

if (!missing.length) {
  console.log('Kuch laane ko nahi hai — Firebase ki har request Supabase me pahunch chuki hai.\n')
  process.exit(0)
}

if (!APPLY) {
  console.log('Ye dry run tha, kuch likha nahi gaya.')
  console.log('Upar ki list theek lage to chalao:  node supabase/recover-admission-requests.mjs --apply\n')
  process.exit(0)
}

/* ---- likho ---- */
const rows = missing.map(row => {
  const r = row.request || {}
  return {
    school_id: row.schoolUuid,
    legacy_id: row.id,
    source: r,                                   // poora document — admin isi se row banata hai
    student_name: r.studentName ?? null,
    class_applied_for: r.classAppliedFor ?? null,
    dob: asDate(r.dob),
    gender: r.gender ?? null,
    father_name: r.fatherName ?? null,
    mother_name: r.motherName ?? null,
    parent_phone: r.parentPhone ?? null,
    parent_email: r.parentEmail ?? null,
    address: r.address ?? null,
    previous_school: r.previousSchool ?? null,
    admission_number: r.admissionNumber ?? null,
    status: r.status || 'pending',               // jaisa Firebase me tha, waisa hi
    // Firebase par ye field `rejectionNote` naam se padi hai; naye rows me
    // `reviewNote`. Dono dekh lo — jo mile wahi le lo.
    review_note: r.rejectionNote ?? r.reviewNote ?? null,
    reviewed_at: r.reviewedAt ? new Date(r.reviewedAt).toISOString() : null,
    created_at: r.submittedAt ? new Date(r.submittedAt).toISOString() : new Date().toISOString(),
  }
})

// ignoreDuplicates: agar do jagah se ek saath chal jaye, ya beech me admin ne
// wahi request bana li ho, to maujooda row jaisi ki taisi rahegi.
const { data: inserted, error } = await db.from('admission_requests')
  .upsert(rows, { onConflict: 'school_id,legacy_id', ignoreDuplicates: true })
  .select('legacy_id, student_name, status')

if (error) { console.error('\nInsert fail:', error.message, '\n'); process.exit(1) }

console.log(`Likh diya — ${inserted?.length ?? 0} request Supabase me aa gayi.\n`)
for (const row of inserted || []) console.log(`  + ${row.legacy_id}  ${row.student_name}  [${row.status}]`)

/* ---- ginti milao ---- */
const { count } = await db.from('admission_requests').select('legacy_id', { count: 'exact', head: true })
console.log(`\nAb Supabase me kul admission requests: ${count}\n`)
process.exit(0)

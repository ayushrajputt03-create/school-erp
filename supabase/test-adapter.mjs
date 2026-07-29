// ============================================================
// test-adapter.mjs — adapter ko asli database ke against chalata hai
//
//   node supabase/test-adapter.mjs
//
// Har path wahi shakal lauta raha hai ya nahi jo app aaj Firebase se
// paata hai — yahi jaanchta hai. RLS alag se SQL impersonation se
// test ho chuki hai; yahan sirf path routing aur document ki shakal dekhi jaati hai.
// ============================================================

import fs from 'node:fs'

// .env.local se env uthao (browser ke bahar chal rahe hain)
for (const raw of fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const line = raw.trim()
  if (!line || line.startsWith('#')) continue
  const eq = line.indexOf('=')
  if (eq < 0) continue
  process.env[line.slice(0, eq).trim()] ??= line.slice(eq + 1).trim()
}
// service key se RLS bypass — yahan sirf adapter ki logic dekhni hai
process.env.VITE_SUPABASE_ANON_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
process.env.VITE_USE_SUPABASE = 'true'

const { databaseRequest } = await import('../src/lib/dataAdapter.js')

const SCHOOL = 'x6cLySP2vbc3D5CAfQJAomxfet33' // Triveni — sabse zyada data

let pass = 0
let fail = 0

const check = async (label, path, expect, options) => {
  try {
    const value = await databaseRequest(path, null, options)
    const result = expect(value)
    if (result === true) { pass++; console.log(`  OK    ${label}`) }
    else { fail++; console.log(`  FAIL  ${label}\n          ${result}`) }
  } catch (err) {
    fail++
    console.log(`  ERROR ${label}\n          ${err.message}`)
  }
}

const count = (v) => (v && typeof v === 'object' ? Object.keys(v).length : 0)

console.log('=== PADHNA ===')

await check('students — poora node', `schools/${SCHOOL}/students`,
  (v) => count(v) === 227 || `227 chahiye the, mile ${count(v)}`)

await check('students — ek student ki shakal', `schools/${SCHOOL}/students`, (v) => {
  const first = Object.values(v || {})[0]
  if (!first) return 'koi student nahi'
  const need = ['full_name', 'admission_number', 'class_name', 'section', 'father_name']
  const missing = need.filter((k) => !(k in first))
  return missing.length ? `ye field gayab hain: ${missing.join(', ')}` : true
})

await check('deletedStudents alag aane chahiye', `schools/${SCHOOL}/deletedStudents`,
  (v) => count(v) === 544 || `544 chahiye the, mile ${count(v)}`)

await check('staff', `schools/${SCHOOL}/staff`,
  (v) => count(v) === 13 || `13 chahiye the, mile ${count(v)}`)

await check('parents', `schools/${SCHOOL}/parents`,
  (v) => count(v) === 151 || `151 chahiye the, mile ${count(v)}`)

await check('attendance — poora', `schools/${SCHOOL}/attendance`,
  (v) => count(v) === 662 || `662 chahiye the, mile ${count(v)}`)

// Triveni ki saari attendance 2026-07-13 se shuru hoti hai, isliye us date se
// filter karne pe sab hi aate hain. Sach me filter chal raha hai ya nahi, ye
// aage ki date se hi pata chalta hai.
await check('attendance — date se chhaana (listenFromDate)', `schools/${SCHOOL}/attendance`,
  (v) => { const n = count(v); return (n > 0 && n < 662) || `date filter laga hi nahi (${n} mile)` },
  { query: 'orderBy="date"&startAt="2026-07-20"' })

await check('attendance — keys RTDB jaisi (date_studentId)', `schools/${SCHOOL}/attendance`, (v) => {
  const key = Object.keys(v || {})[0]
  if (!key) return 'koi row nahi'
  return /^\d{4}-\d{2}-\d{2}_.+/.test(key) || `key ka roop galat: ${key}`
})

await check('attendance — row ki shakal', `schools/${SCHOOL}/attendance`, (v) => {
  const first = Object.values(v || {})[0]
  if (!first) return 'koi row nahi'
  return (first.date && (first.status || first.mark)) ? true : `date/status nahi: ${JSON.stringify(first).slice(0, 90)}`
})

await check('profile', `schools/${SCHOOL}/profile`,
  (v) => (v?.schoolName && v?.schoolCode) ? true : `schoolName/schoolCode nahi: ${JSON.stringify(v).slice(0, 90)}`)

await check('profile ka logo Storage se aa raha hai', `schools/${SCHOOL}/profile`,
  (v) => String(v?.logoURL || '').startsWith('https://') || `logo abhi bhi base64/khaali: ${String(v?.logoURL).slice(0, 40)}`)

await check('fees', `schools/${SCHOOL}/fees`,
  (v) => count(v) === 13 || `13 chahiye the, mile ${count(v)}`)

await check('certificates', `schools/${SCHOOL}/certificates`,
  (v) => count(v) === 4 || `4 chahiye the, mile ${count(v)}`)

await check('feeManager — composite', `schools/${SCHOOL}/feeManager`, (v) => {
  if (!v?.structures) return 'structures nahi aaye'
  if (!v?.fines) return 'fines nahi aaye'
  return count(v.structures) > 0 || 'structures khaali hain'
})

await check('admissionRequests — sirf pending', `schools/${SCHOOL}/admissionRequests`,
  (v) => Object.values(v || {}).every((r) => r?.status === 'pending') || 'pending ke alawa bhi aa gaye',
  { query: 'orderBy="status"&equalTo="pending"' })

// ek student ko uske id se — jaise app profile kholte waqt karta hai
{
  const all = await databaseRequest(`schools/${SCHOOL}/students`, null)
  const [someId, someDoc] = Object.entries(all || {})[0] || []
  await check('ek student seedhe id se', `schools/${SCHOOL}/students/${someId}`,
    (v) => v?.full_name === someDoc?.full_name || `naam nahi mila: ${JSON.stringify(v).slice(0, 80)}`)
}

await check('kv node (backupSettings)', `schools/${SCHOOL}/backupSettings`,
  (v) => (v && typeof v === 'object') || `object chahiye tha, mila ${typeof v}`)

await check('jo node hai hi nahi (library)', `schools/${SCHOOL}/library`,
  (v) => v === null || `null chahiye tha, mila ${JSON.stringify(v).slice(0, 60)}`)

console.log('\n=== ROOT NODES ===')

await check('schoolCodes/TRITRI619', 'schoolCodes/TRITRI619',
  (v) => v?.schoolId === SCHOOL || `schoolId galat: ${JSON.stringify(v)}`)

await check('users/{owner uid}', `users/${SCHOOL}`,
  (v) => v?.role === 'owner' || `role owner hona chahiye tha: ${JSON.stringify(v)}`)

await check('teachersIndex', 'teachersIndex/JzCwTHeHGkfDmvp3aPwKF4o5BGy1',
  (v) => v?.schoolId === SCHOOL || `schoolId galat: ${JSON.stringify(v)}`)

await check('studentPhotos node', `studentPhotos/${SCHOOL}`,
  (v) => count(v) > 0 || 'koi photo nahi mili')

console.log(`\n${'='.repeat(46)}`)
console.log(`PASS ${pass}   FAIL ${fail}`)
process.exitCode = fail ? 1 : 0

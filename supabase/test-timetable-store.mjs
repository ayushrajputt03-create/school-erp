// ============================================================
// test-timetable-store.mjs — timetableStore asli database ke against
//
//   node supabase/test-timetable-store.mjs
//
// timetable.js ka test (test-timetable.mjs) sirf logic dekhta hai. Yahan wo
// cheezein dekhi jaati hain jo sirf database bata sakta hai: unique constraints
// sach me lagti hain ya nahi, teacher clash index pakadta hai ya nahi, period
// hataane par uske slots jaate hain ya nahi, aur error admin ko samajh aane
// wali bhasha me milta hai ya Postgres ka kaccha text.
//
// SAFETY — ye asli production database par chalta hai:
//   * Sirf class_name = 'ZZ-TEST' par likhta hai. Koi asli class aise nahi hoti.
//   * Periods 18/19/20 use karta hai (schema me max 20). Asli school 1-12 ke
//     aas-paas rehta hai, isliye kisi maujooda period se takrata nahi.
//   * Shuru me aur ant me — dono baar — apna banaya hua sab mita deta hai.
//   * Kisi doosri table ko chhuta hi nahi.
// ============================================================

import fs from 'node:fs'

for (const raw of fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const line = raw.trim()
  if (!line || line.startsWith('#')) continue
  const eq = line.indexOf('=')
  if (eq < 0) continue
  process.env[line.slice(0, eq).trim()] ??= line.slice(eq + 1).trim()
}
// service key se RLS bypass — RLS alag se SQL impersonation se test hoti hai,
// yahan store ki logic dekhni hai.
process.env.VITE_SUPABASE_ANON_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
process.env.VITE_USE_SUPABASE = 'true'

const { supabase } = await import('../src/lib/supabaseClient.js')
const { schoolUuid } = await import('../src/lib/dataAdapter.js')
const store = await import('../src/lib/timetableStore.js')

const SCHOOL = 'x6cLySP2vbc3D5CAfQJAomxfet33' // Triveni
const TEST_CLASS = 'ZZ-TEST'
const TEST_PERIOD_NUMBERS = [18, 19, 20]

let pass = 0, fail = 0
const check = async (label, fn) => {
  try { const r = await fn(); r === true ? (pass++, console.log(`  OK    ${label}`)) : (fail++, console.log(`  FAIL  ${label}\n          ${r}`)) }
  catch (e) { fail++; console.log(`  ERROR ${label}\n          ${e.message}`) }
}
const eq = (got, want) => JSON.stringify(got) === JSON.stringify(want) ? true : `mila ${JSON.stringify(got)}, chahiye tha ${JSON.stringify(want)}`

const schoolId = await schoolUuid(SCHOOL)
if (!schoolId) { console.log('School nahi mila — test nahi chal sakta.'); process.exit(1) }

// Test ka apna kachra saaf karta hai. Shuru me bhi chalta hai: pichhla run
// beech me mar gaya ho to uska bacha hua data aaj ke test ko jhoota fail na de.
async function cleanup() {
  await supabase.from('timetable_slots').delete().eq('school_id', schoolId).eq('class_name', TEST_CLASS)
  await supabase.from('periods').delete().eq('school_id', schoolId).in('period_number', TEST_PERIOD_NUMBERS)
}
await cleanup()

// Asli periods ginte hain taaki baad me confirm kar sakein ki store ne unhe
// chhua nahi — savePeriods poori list replace karta hai, aur agar wo asli
// periods uda de to ye test hi sabse pehle pakdega.
const realPeriodCount = (await supabase.from('periods').select('id', { count: 'exact', head: true })
  .eq('school_id', schoolId)).count || 0

// Do asli teacher chahiye clash test ke liye.
const { data: staffRows } = await supabase.from('staff').select('id, full_name')
  .eq('school_id', schoolId).eq('active', true).limit(2)
const T1 = staffRows?.[0]
const T2 = staffRows?.[1]

/* ── periods ───────────────────────────────────────────────── */

console.log('\nperiods')

let periods = []
await check('periods save hote hain', async () => {
  periods = await store.savePeriods(SCHOOL, [
    ...(await store.loadPeriods(SCHOOL)),
    { period_number: 18, start_time: '15:00', end_time: '15:45', is_break: false },
    { period_number: 19, start_time: '15:45', end_time: '16:30', is_break: true, label: 'Test Break' },
    { period_number: 20, start_time: '16:30', end_time: '17:15', is_break: false },
  ])
  return periods.filter(p => TEST_PERIOD_NUMBERS.includes(p.period_number)).length === 3
    || `${periods.length} periods mile`
})

await check('asli periods ude nahi', async () => {
  const all = await store.loadPeriods(SCHOOL)
  const real = all.filter(p => !TEST_PERIOD_NUMBERS.includes(p.period_number)).length
  return real === realPeriodCount || `pehle ${realPeriodCount} the, ab ${real}`
})

await check('periods ghadi ke kram me lautte hain', async () => {
  const all = (await store.loadPeriods(SCHOOL)).filter(p => TEST_PERIOD_NUMBERS.includes(p.period_number))
  return eq(all.map(p => p.period_number), [18, 19, 20])
})

await check('is_break aur label save hote hain', async () => {
  const all = await store.loadPeriods(SCHOOL)
  const brk = all.find(p => p.period_number === 19)
  return eq([brk?.is_break, brk?.label], [true, 'Test Break'])
})

// Ye database ka check constraint hai — store use samajhne layak bhasha me
// badalta hai. Kaccha "23514" admin ke kisi kaam ka nahi.
await check('ulta time saaf error deta hai', async () => {
  try {
    await store.savePeriods(SCHOOL, [...(await store.loadPeriods(SCHOOL)),
      { period_number: 17, start_time: '10:00', end_time: '09:00' }])
    return 'save ho gaya, hona nahi chahiye tha'
  } catch (e) {
    return e.message.includes('End time must be after')
      || `message theek nahi: ${e.message}`
  }
})

const P = Object.fromEntries((await store.loadPeriods(SCHOOL))
  .filter(p => TEST_PERIOD_NUMBERS.includes(p.period_number))
  .map(p => [p.period_number, p.id]))

/* ── slots ─────────────────────────────────────────────────── */

console.log('\nslots')

await check('class ka grid save hota hai', async () => {
  const saved = await store.saveClassTimetable(SCHOOL, TEST_CLASS, 'A', [
    { day_of_week: 1, period_id: P[18], subject: 'Maths', teacher_id: T1?.id, teacher_name: T1?.full_name },
    { day_of_week: 1, period_id: P[20], subject: 'Science', teacher_id: T2?.id, teacher_name: T2?.full_name },
    { day_of_week: 2, period_id: P[18], subject: 'English', teacher_id: T1?.id, teacher_name: T1?.full_name },
  ])
  return eq(saved.length, 3)
})

await check('class ka hafta wapas padha jaata hai', async () =>
  eq((await store.loadClassTimetable(SCHOOL, TEST_CLASS, 'A')).length, 3))

await check('dusri class ka data nahi aata', async () =>
  eq((await store.loadClassTimetable(SCHOOL, TEST_CLASS, 'B')).length, 0))

await check('teacher ka naam saath me save hota hai', async () => {
  const slots = await store.loadClassTimetable(SCHOOL, TEST_CLASS, 'A')
  return eq(slots.every(s => Boolean(s.teacher_name)), true)
})

// Grid dobara save karne par purani rows update honi chahiye, duplicate nahi
// banni. Ye wahi jagah hai jahan "pehle delete, phir insert" wala tareeka
// class ka kaam uda deta.
await check('dobara save karne par duplicate nahi bante', async () => {
  const existing = await store.loadClassTimetable(SCHOOL, TEST_CLASS, 'A')
  await store.saveClassTimetable(SCHOOL, TEST_CLASS, 'A',
    existing.map(s => ({ ...s, subject: `${s.subject} II` })))
  const after = await store.loadClassTimetable(SCHOOL, TEST_CLASS, 'A')
  return eq(after.length, 3)
})

await check('khaali kiya hua cell hat jaata hai', async () => {
  const existing = await store.loadClassTimetable(SCHOOL, TEST_CLASS, 'A')
  await store.saveClassTimetable(SCHOOL, TEST_CLASS, 'A',
    existing.map(s => (s.day_of_week === 2 ? { ...s, subject: '' } : s)))
  return eq((await store.loadClassTimetable(SCHOOL, TEST_CLASS, 'A')).length, 2)
})

/* ── teacher clash ─────────────────────────────────────────── */

console.log('\nteacher clash (database level)')

// UI save se pehle warning deti hai, par asli rok yahan hai: do admin ek saath
// alag class me wahi teacher lagayein to dono ki UI-jaanch paas ho jaati.
await check('wahi teacher usi din usi period me dusri class me nahi lag sakta', async () => {
  if (!T1) return 'test ke liye staff nahi mila'
  try {
    await store.saveClassTimetable(SCHOOL, TEST_CLASS, 'B', [
      { day_of_week: 1, period_id: P[18], subject: 'Hindi', teacher_id: T1.id, teacher_name: T1.full_name },
    ])
    return 'save ho gaya, database ko rokna chahiye tha'
  } catch (e) {
    return e.message.includes('already assigned to another class')
      || `message theek nahi: ${e.message}`
  }
})

await check('clash fail hone par purana data bacha rehta hai', async () =>
  eq((await store.loadClassTimetable(SCHOOL, TEST_CLASS, 'A')).length, 2))

await check('alag period par wahi teacher chal jaata hai', async () => {
  if (!T1) return 'test ke liye staff nahi mila'
  const saved = await store.saveClassTimetable(SCHOOL, TEST_CLASS, 'B', [
    { day_of_week: 1, period_id: P[19], subject: 'Hindi', teacher_id: T1.id, teacher_name: T1.full_name },
  ])
  return eq(saved.length, 1)
})

/* ── narrow reads ──────────────────────────────────────────── */

console.log('\nnarrow reads')

await check('teacher ka apna hafta milta hai', async () => {
  if (!T1) return 'test ke liye staff nahi mila'
  const week = await store.loadTeacherTimetable(SCHOOL, T1.id)
  const mine = week.filter(s => s.class_name === TEST_CLASS)
  return mine.length >= 2 || `${mine.length} slots mile`
})

// Clash jaanchne ke liye poore school ke slots laane ki zarurat nahi — sirf un
// teachers ke, jo is grid me lage hain. Yahi baat egress bachati hai.
await check('sirf maange gaye teachers ke slots aate hain', async () => {
  if (!T1) return 'test ke liye staff nahi mila'
  const slots = await store.loadSlotsForTeachers(SCHOOL, [T1.id])
  return eq(slots.every(s => s.teacher_id === T1.id), true)
})

await check('khaali teacher list par query hi nahi jaati', async () =>
  eq(await store.loadSlotsForTeachers(SCHOOL, []), []))

/* ── cascade ───────────────────────────────────────────────── */

console.log('\ncascade')

// Period hatao to uske slots bhi jaane chahiye — warna aise slots bach jaate
// jinka koi time hi nahi hota aur grid me kahin dikhte hi nahi.
await check('period hataane par uske slots bhi jaate hain', async () => {
  const keep = (await store.loadPeriods(SCHOOL)).filter(p => p.period_number !== 20)
  await store.savePeriods(SCHOOL, keep)
  const left = await store.loadClassTimetable(SCHOOL, TEST_CLASS, 'A')
  return eq(left.some(s => s.period_id === P[20]), false)
})

await cleanup()

await check('cleanup ke baad kuch nahi bacha', async () =>
  eq((await store.loadClassTimetable(SCHOOL, TEST_CLASS, 'A')).length, 0))

await check('asli periods ab bhi utne hi hain', async () => {
  const real = (await store.loadPeriods(SCHOOL)).filter(p => !TEST_PERIOD_NUMBERS.includes(p.period_number)).length
  return real === realPeriodCount || `pehle ${realPeriodCount} the, ab ${real}`
})

console.log(`\n${'='.repeat(46)}`)
console.log(`PASS ${pass}   FAIL ${fail}`)
process.exitCode = fail ? 1 : 0

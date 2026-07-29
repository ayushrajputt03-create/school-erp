// ============================================================
// test-adapter-write.mjs — adapter ka LIKHNE ka raasta
//
//   node supabase/test-adapter-write.mjs
//
// Sandbox: "NXT OpenERP School" (0 students, 0 attendance) — asli client
// data ko haath nahi lagta. Test ke ant me sab kuch mita diya jaata hai.
// ============================================================

import fs from 'node:fs'

for (const raw of fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const line = raw.trim()
  if (!line || line.startsWith('#')) continue
  const eq = line.indexOf('=')
  if (eq < 0) continue
  process.env[line.slice(0, eq).trim()] ??= line.slice(eq + 1).trim()
}
process.env.VITE_SUPABASE_ANON_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
process.env.VITE_USE_SUPABASE = 'true'

const { databaseRequest } = await import('../src/lib/dataAdapter.js')
const { connect } = await import('./db.mjs')

const SCHOOL = 'JfaU8V51U1cxkLqZRFzzbLdGhGD3' // NXT OpenERP — khaali sandbox
const S = `schools/${SCHOOL}`

let pass = 0
let fail = 0
const ok = (label) => { pass++; console.log(`  OK    ${label}`) }
const no = (label, why) => { fail++; console.log(`  FAIL  ${label}\n          ${why}`) }
const check = async (label, fn) => {
  try {
    const r = await fn()
    r === true ? ok(label) : no(label, r)
  } catch (err) { no(label, err.message) }
}

// pehle saaf karo — pichhla adhoora test pada ho sakta hai
const { client } = await connect()
const { rows: [school] } = await client.query('select id from schools where legacy_id = $1', [SCHOOL])
const cleanup = async () => {
  await client.query('delete from attendance where school_id = $1', [school.id])
  await client.query('delete from students where school_id = $1 and legacy_id like $2', [school.id, 'test\\_%'])
  await client.query("delete from kv where school_id = $1 and path = 'testNode'", [school.id])
}
await cleanup()

const STUDENT = 'test_student_001'

console.log('=== NAYA RECORD BANANA ===')

await check('naya student banao (PATCH)', async () => {
  await databaseRequest(`${S}/students/${STUDENT}`, null, {
    method: 'PATCH',
    body: {
      full_name: 'Test Kumar', admission_number: '9001', class_name: '5', section: 'A',
      father_name: 'Test Papa', date_of_birth: '2015-03-14', gender: 'Male',
      active: true, createdAt: Date.now(),
    },
  })
  const back = await databaseRequest(`${S}/students/${STUDENT}`, null)
  return back?.full_name === 'Test Kumar' || `wapas nahi mila: ${JSON.stringify(back)}`
})

await check('typed column bhi bhara (sirf jsonb nahi)', async () => {
  const { rows } = await client.query(
    'select class_name, section, date_of_birth::text, admission_number from students where school_id=$1 and legacy_id=$2',
    [school.id, STUDENT]
  )
  const r = rows[0]
  if (!r) return 'row hi nahi mili'
  if (r.class_name !== '5') return `class_name galat: ${r.class_name}`
  if (r.date_of_birth !== '2015-03-14') return `date_of_birth galat: ${r.date_of_birth}`
  return true
})

console.log('\n=== BADALNA ===')

await check('PATCH sirf diye gaye field badalta hai', async () => {
  await databaseRequest(`${S}/students/${STUDENT}`, null, {
    method: 'PATCH', body: { class_name: '6', updatedAt: Date.now() },
  })
  const back = await databaseRequest(`${S}/students/${STUDENT}`, null)
  if (back?.class_name !== '6') return `class update nahi hua: ${back?.class_name}`
  if (back?.full_name !== 'Test Kumar') return 'PATCH ne baaki field uda diye — ye RTDB jaisa nahi hai'
  if (back?.father_name !== 'Test Papa') return 'father_name ud gaya'
  return true
})

await check('typed column bhi saath me badla', async () => {
  const { rows } = await client.query('select class_name from students where school_id=$1 and legacy_id=$2', [school.id, STUDENT])
  return rows[0]?.class_name === '6' || `column purana hi hai: ${rows[0]?.class_name}`
})

console.log('\n=== ATTENDANCE (multi-key PATCH) ===')

await check('ek saath kai students ki attendance', async () => {
  await databaseRequest(`${S}/attendance`, null, {
    method: 'PATCH',
    body: {
      [`2026-07-28_${STUDENT}`]: {
        date: '2026-07-28', studentId: STUDENT, status: 'P',
        className: '6', section: 'A', markedBy: 'test',
      },
    },
  })
  const all = await databaseRequest(`${S}/attendance`, null)
  const row = all?.[`2026-07-28_${STUDENT}`]
  return row?.status === 'P' || `wapas nahi mili: ${JSON.stringify(all).slice(0, 120)}`
})

await check('dobara save karne se duplicate nahi banta', async () => {
  await databaseRequest(`${S}/attendance`, null, {
    method: 'PATCH',
    body: { [`2026-07-28_${STUDENT}`]: { date: '2026-07-28', studentId: STUDENT, status: 'A', markedBy: 'test' } },
  })
  const { rows } = await client.query('select count(*)::int n, max(status) s from attendance where school_id=$1', [school.id])
  if (rows[0].n !== 1) return `${rows[0].n} rows ban gayi, 1 honi chahiye thi`
  return rows[0].s === 'A' || `status update nahi hua: ${rows[0].s}`
})

await check('rollup trigger apne aap chala', async () => {
  const { rows } = await client.query(
    'select present, absent, month from attendance_summary where school_id=$1', [school.id]
  )
  const r = rows[0]
  if (!r) return 'summary bani hi nahi'
  if (r.month !== '2026-07') return `month galat: ${r.month}`
  return (r.absent === 1 && r.present === 0) || `ginti galat: present=${r.present} absent=${r.absent}`
})

console.log('\n=== kv NODE ===')

await check('kv me nested path likhna', async () => {
  await databaseRequest(`${S}/testNode/settings`, null, { method: 'PATCH', body: { theme: 'navy', size: 10 } })
  const back = await databaseRequest(`${S}/testNode/settings`, null)
  return back?.theme === 'navy' || `wapas nahi mila: ${JSON.stringify(back)}`
})

await check('kv PATCH baaki keys nahi udata', async () => {
  await databaseRequest(`${S}/testNode/settings`, null, { method: 'PATCH', body: { size: 20 } })
  const back = await databaseRequest(`${S}/testNode/settings`, null)
  if (back?.size !== 20) return `size update nahi hua: ${back?.size}`
  return back?.theme === 'navy' || 'theme ud gaya'
})

console.log('\n=== MITANA ===')

await check('attendance ki ek row mitao (null bhej ke)', async () => {
  await databaseRequest(`${S}/attendance`, null, { method: 'PATCH', body: { [`2026-07-28_${STUDENT}`]: null } })
  const { rows } = await client.query('select count(*)::int n from attendance where school_id=$1', [school.id])
  return rows[0].n === 0 || `${rows[0].n} rows abhi bhi hain`
})

await check('rollup bhi ghat gaya', async () => {
  const { rows } = await client.query('select present, absent from attendance_summary where school_id=$1', [school.id])
  if (!rows[0]) return true // row hi nahi rahi — ye bhi theek hai
  return (rows[0].present === 0 && rows[0].absent === 0) || `summary purani hi hai: ${JSON.stringify(rows[0])}`
})

await check('student delete', async () => {
  await databaseRequest(`${S}/students/${STUDENT}`, null, { method: 'DELETE' })
  const back = await databaseRequest(`${S}/students/${STUDENT}`, null)
  return back === null || `abhi bhi hai: ${JSON.stringify(back)}`
})

console.log('\n=== SAFAI ===')
await cleanup()
const { rows: left } = await client.query(
  `select (select count(*)::int from students where school_id=$1) s,
          (select count(*)::int from attendance where school_id=$1) a,
          (select count(*)::int from kv where school_id=$1 and path='testNode') k`,
  [school.id]
)
console.log(`  bacha hua: students=${left[0].s} attendance=${left[0].a} kv=${left[0].k}`)

await client.end()
console.log(`\n${'='.repeat(46)}`)
console.log(`PASS ${pass}   FAIL ${fail}`)
process.exitCode = fail ? 1 : 0

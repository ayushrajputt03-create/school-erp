// ============================================================
// test-realtime.mjs — live updates aur channel ka hisaab
//
//   node supabase/test-realtime.mjs
//
// Ab tak realtime ka koi test nahi tha. Do cheezein yahan dekhi jaati hain:
//
//   1. Database me row badle to handler tak khabar pahunche (ye asli kaam hai —
//      teacher attendance lagaye to admin ko turant dikhe).
//   2. Ek saath 40 row badlein (poori class ki attendance) to poora node
//      40 baar dobara na padha jaye. Pehle waise hi hota tha.
//
// Sandbox: NXT OpenERP (khaali school). Ant me sab mita diya jaata hai.
// ============================================================

import fs from 'node:fs'
for (const raw of fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const l = raw.trim(); if (!l || l.startsWith('#')) continue
  const i = l.indexOf('='); if (i < 0) continue
  process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim()
}
process.env.VITE_SUPABASE_ANON_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
process.env.VITE_USE_SUPABASE = 'true'

const { databaseRequest, subscribe } = await import('../src/lib/dataAdapter.js')
const { connect } = await import('./db.mjs')

const SCHOOL = 'JfaU8V51U1cxkLqZRFzzbLdGhGD3'
const S = `schools/${SCHOOL}`

let pass = 0, fail = 0
const check = (label, ok, why) => ok === true
  ? (pass++, console.log(`  OK    ${label}`))
  : (fail++, console.log(`  FAIL  ${label}\n          ${why ?? ok}`))

const { client } = await connect()
const { rows: [school] } = await client.query('select id from schools where legacy_id=$1', [SCHOOL])
const cleanup = () => client.query("delete from kv where school_id=$1 and path='rtTest'", [school.id])
await cleanup()

const wait = (ms) => new Promise(r => setTimeout(r, ms))

console.log('=== LIVE KHABAR ===')

let snapshots = []
let unsub = subscribe(`${S}/rtTest`, (snap) => { snapshots.push(snap.val()) })
await wait(2500)              // pehla snapshot + channel judne ka waqt
const initial = snapshots.length

await databaseRequest(`${S}/rtTest`, null, { method: 'PUT', body: { hello: 'duniya' } })
await wait(3000)

check('badlav ki khabar handler tak pahunchi',
  snapshots.length > initial ? true : `${initial} ke baad koi naya snapshot nahi aaya`)
check('naya snapshot me nayi value hai',
  snapshots[snapshots.length - 1]?.hello === 'duniya'
    ? true : `mila: ${JSON.stringify(snapshots[snapshots.length - 1])}`)

console.log('\n=== EK SAATH KAI BADLAV (debounce) ===')

snapshots = []
for (let i = 0; i < 12; i++) {
  await databaseRequest(`${S}/rtTest`, null, { method: 'PATCH', body: { [`k${i}`]: i } })
}
await wait(3000)

// 12 badlav -> poora node 12 baar nahi padhna chahiye
check(`12 badlav par node ${snapshots.length} baar padha (12 se kam hona chahiye)`,
  snapshots.length > 0 && snapshots.length < 12
    ? true : `${snapshots.length} baar padha`)
check('aakhri snapshot me saari 12 keys hain',
  Object.keys(snapshots[snapshots.length - 1] || {}).filter(k => k.startsWith('k')).length === 12
    ? true : `keys: ${Object.keys(snapshots[snapshots.length - 1] || {}).join(',')}`)

// ============================================================
// Ye wo case hai jisme pehla design phat gaya tha.
//
// Maine socha tha "ek school = ek channel" sabse saaf hai. Par realtime-js
// `subscribe()` ke baad `.on()` lagane par seedha error deta hai, aur listeners
// alag-alag waqt par aate hain (har subscribe pehle apna data padhta hai).
// Doosra listener judte hi poora app crash ho jaata tha.
// ============================================================
console.log('\n=== DO ALAG NODE EK SAATH ===')

await check('doosra listener judne par crash na ho, aur dono ko khabar mile', await (async () => {
  const hits = { kv: 0, students: 0 }
  let u1, u2
  try {
    u1 = subscribe(`${S}/rtTest`, () => { hits.kv++ })
    u2 = subscribe(`${S}/students`, () => { hits.students++ })
  } catch (err) {
    return `judte hi phat gaya: ${err.message}`
  }
  await wait(3000)
  const base = { ...hits }

  await databaseRequest(`${S}/rtTest`, null, { method: 'PATCH', body: { dono: 1 } })
  await databaseRequest(`${S}/students/rt_probe`, null, {
    method: 'PUT', body: { full_name: 'RT Probe', class_name: '5', section: 'A' },
  })
  await wait(4000)

  const kvOk = hits.kv > base.kv
  const stOk = hits.students > base.students
  u1(); u2()
  await client.query("delete from students where school_id=$1 and legacy_id='rt_probe'", [school.id])

  if (!kvOk) return 'kv node ko khabar nahi mili'
  if (!stOk) return 'students node ko khabar nahi mili'
  return true
})())

console.log('\n=== BAND KARNA ===')
unsub()
snapshots = []
await databaseRequest(`${S}/rtTest`, null, { method: 'PATCH', body: { baad_me: true } })
await wait(2000)
check('unsubscribe ke baad koi snapshot nahi aata',
  snapshots.length === 0 ? true : `${snapshots.length} snapshot aaye`)

await cleanup()
await client.end()
console.log(`\n${'='.repeat(46)}`)
console.log(`PASS ${pass}   FAIL ${fail}`)
process.exit(fail ? 1 : 0)

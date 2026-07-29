// ============================================================
// test-counter.mjs — receipt number ka counter
//
//   node supabase/test-counter.mjs
//
// Ye Firebase ke runTransaction ki jagah aaya hai. Sabse zaroori baat: do log
// ek saath receipt banayen to dono ko ALAG number mile. Memory se "sabse bada
// +1" karna yahi cheez todta hai — dono ek hi number padhte hain.
//
// Isliye yahan sach me kai connection ek saath chalaye jaate hain.
// Sandbox: Triveni ka counter, ant me mita diya jaata hai.
// ============================================================

import fs from 'node:fs'
for (const raw of fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const l = raw.trim(); if (!l || l.startsWith('#')) continue
  const i = l.indexOf('='); if (i < 0) continue
  process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim()
}
const { connect } = await import('./db.mjs')

let pass = 0, fail = 0
const check = async (label, fn) => {
  try { const r = await fn(); r === true ? (pass++, console.log(`  OK    ${label}`)) : (fail++, console.log(`  FAIL  ${label}\n          ${r}`)) }
  catch (e) { fail++; console.log(`  ERROR ${label}\n          ${e.message}`) }
}

const { client } = await connect()
const one = async s => (await client.query(s)).rows[0]
const SCHOOL = await one("select id from schools where legacy_id='x6cLySP2vbc3D5CAfQJAomxfet33'")
const OWNER = await one("select id from app_users where legacy_uid='x6cLySP2vbc3D5CAfQJAomxfet33'")
const OTHER = await one("select id from schools where legacy_id <> 'x6cLySP2vbc3D5CAfQJAomxfet33' limit 1")
const TEACHER = await one("select id from app_users where role='teacher' limit 1")
const reset = () => client.query('delete from fee_counters where school_id=$1 and name=$2', [SCHOOL.id, 'receipt'])
await reset()

const asUser = async (uid, fn) => {
  await client.query('begin')
  await client.query('set local role authenticated')
  await client.query(`set local request.jwt.claims = '{"sub":"${uid}","role":"authenticated"}'`)
  try { return await fn() } finally { await client.query('rollback') }
}
const reserve = async (school, seed) =>
  Number((await client.query('select public.reserve_receipt_sequence($1,$2) v', [school, seed])).rows[0].v)

console.log('=== EK SAATH KAI LOG (asli race) ===')

await check('10 alag connection, koi number do baar na mile', async () => {
  await reset()
  const conns = await Promise.all(Array.from({ length: 10 }, () => connect()))
  const got = await Promise.all(conns.map(async ({ client: c }) => {
    await c.query('begin')
    await c.query('set local role authenticated')
    await c.query(`set local request.jwt.claims = '{"sub":"${OWNER.id}","role":"authenticated"}'`)
    const { rows } = await c.query('select public.reserve_receipt_sequence($1,$2) v', [SCHOOL.id, 0])
    await c.query('commit'); await c.end()
    return Number(rows[0].v)
  }))
  const unique = new Set(got)
  if (unique.size !== got.length) return `DO RECEIPT PAR EK NUMBER: ${got.sort((a,b)=>a-b).join(',')}`
  return true
})

console.log('\n=== COUNTER PEECHE NA JAYE ===')

await check('purani receipts ke aage se chale, aur chhota seed use peeche na le jaye', async () => {
  await reset()
  return asUser(OWNER.id, async () => {
    const a = await reserve(SCHOOL.id, 0)
    const b = await reserve(SCHOOL.id, 9999)
    const c = await reserve(SCHOOL.id, 5)
    if (a !== 1) return `khaali counter se ${a} mila, 1 chahiye tha`
    if (b !== 10000) return `seed 9999 par ${b} mila, 10000 chahiye tha`
    if (c !== 10001) return `chhote seed ne counter ${c} kar diya, 10001 chahiye tha`
    return true
  })
})

console.log('\n=== IJAZAT ===')

await check('doosre school ka number na mile', async () =>
  asUser(OWNER.id, async () => {
    try { await reserve(OTHER.id, 0); return 'mil gaya' } catch { return true }
  }))

await check('teacher ko receipt number na mile', async () =>
  asUser(TEACHER.id, async () => {
    try { await reserve(SCHOOL.id, 0); return 'mil gaya' } catch { return true }
  }))

await reset()
await client.end()
console.log(`\n${'='.repeat(46)}`)
console.log(`PASS ${pass}   FAIL ${fail}`)
process.exitCode = fail ? 1 : 0

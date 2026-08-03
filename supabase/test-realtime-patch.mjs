// ============================================================
// test-realtime-patch.mjs — realtime row se patch, bina poora node padhe
//
//   node supabase/test-realtime-patch.mjs
//
// Pehle kisi bhi EK row ke badalne par adapter poora node dobara padhta tha.
// 662 rows ki attendance me ek haaziri badalne par 662 rows taar par aate the.
// Ab realtime ka payload hi poori row leke aata hai (REPLICA IDENTITY FULL),
// to use seedha local copy me laga dete hain — network par kuch nahi jaata.
//
// Isliye is test ka asli sawaal snapshot nahi, **reads** hain. Neeche fetch ko
// lapetkar sach me gine jaate hain ki PostgREST par kitni baar gaya.
//
// Utna hi zaroori doosra sawaal: patch se bana document bilkul wahi ho jo
// refetch se banta. Alag hua to screen par chup-chaap galat data baith jayega,
// aur wo refetch waale bug se bura hai. Har case me dono ki tulna hoti hai.
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

// ------------------------------------------------------------
// fetch counter — import se PEHLE lagana hai, warna supabase-js
// apne paas asli fetch pakad chuka hoga.
// ------------------------------------------------------------
const realFetch = globalThis.fetch
let reads = []
globalThis.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input?.url || ''
  const method = (init?.method || 'GET').toUpperCase()
  const m = url.match(/\/rest\/v1\/([a-z_]+)/)
  if (m && method === 'GET') reads.push(m[1])
  return realFetch(input, init)
}
const countReads = (table) => reads.filter((t) => t === table).length

const { databaseRequest, subscribe, schoolUuid } = await import('../src/lib/dataAdapter.js')
const { createClient } = await import('@supabase/supabase-js')

// Seedha Postgres is machine se nahi lagta (pooler timeout), isliye setup aur
// cleanup bhi REST se. service-role key RLS ke bahar hai, to soft-delete aur
// hard-delete waise hi lag jaate hain jaise SQL se lagte.
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const SCHOOL = 'JfaU8V51U1cxkLqZRFzzbLdGhGD3'
const S = `schools/${SCHOOL}`

let pass = 0, fail = 0
const check = (label, ok, why) => ok === true
  ? (pass++, console.log(`  OK    ${label}`))
  : (fail++, console.log(`  FAIL  ${label}\n          ${why ?? ok}`))

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

const schoolId = await schoolUuid(SCHOOL)
if (!schoolId) { console.log('sandbox school nahi mila'); process.exit(1) }

const IDS = ['pt_a', 'pt_b', 'pt_c', 'pt_d', 'pt_e']
const cleanup = async () => {
  await admin.from('attendance').delete().eq('school_id', schoolId)
  await admin.from('students').delete().eq('school_id', schoolId).in('legacy_id', IDS)
}
await cleanup()

/* ============================================================
   students — insert / update / soft delete
   ============================================================ */
console.log('=== STUDENTS: patch bina refetch ===')

const writeFive = async () => {
  for (const id of IDS) {
    await databaseRequest(`${S}/students/${id}`, null, {
      method: 'PUT',
      body: { full_name: `Patch ${id}`, class_name: '5', section: 'A', roll_number: id.slice(-1) },
    })
  }
}

// Likhne wala khud bhi padhta hai — writeOne upsert se pehle purana document
// uthata hai. Wo read is badlav se koi lena-dena nahi rakhta. Isliye pehle
// bina kisi listener ke naapo, phir listener ke saath. Dono barabar hone
// chahiye: sunne wale ka apna kharcha zero.
reads = []
await writeFive()
const writeCost = countReads('students')
await cleanup()

let snap = null
const unsubStudents = subscribe(`${S}/students`, (s) => { snap = s.val() })
await wait(3000)                       // pehla read + channel judne ka waqt

reads = []                             // yahan se ginti shuru
await writeFive()
await wait(4000)

check(`listener lagne se ek bhi read nahi badha (${countReads('students')} vs bina listener ${writeCost})`,
  countReads('students') === writeCost
    ? true : `${countReads('students')} banaam ${writeCost} — patch fallback me ja raha hai (listener khud padh raha hai)`)

check('paanchon student snapshot me aa gaye',
  IDS.every((id) => snap?.[id]?.full_name === `Patch ${id}`)
    ? true : `mila: ${Object.keys(snap || {}).join(',')}`)

// Sabse ahem: patch se bana doc == refetch se aaya doc
const fresh = await databaseRequest(`${S}/students`, null, {})
check('patch se bana node refetch se hu-ba-hu milta hai',
  same(snap, fresh) ? true : 'patch aur refetch ke documents alag hain')

// PATCH bhi wahi ek read karta hai (purana doc), isliye 1 se zyada nahi hona chahiye
reads = []
await databaseRequest(`${S}/students/pt_a`, null, { method: 'PATCH', body: { class_name: '8' } })
await wait(3000)
check(`update par sirf likhne wale ka 1 read (mila: ${countReads('students')})`,
  countReads('students') === 1 ? true : `${countReads('students')} baar padha`)
check('update snapshot me dikha',
  snap?.pt_a?.class_name === '8' ? true : `mila: ${snap?.pt_a?.class_name}`)

// soft delete: row DB me rehti hai, par `students` node (activeOnly) se hatni chahiye
reads = []
await admin.from('students').update({ deleted_at: new Date().toISOString() })
  .eq('school_id', schoolId).eq('legacy_id', 'pt_b')
await wait(3000)
check('trash me daala hua student node se hat gaya',
  snap && !('pt_b' in snap) ? true : 'pt_b abhi bhi node me hai')
check(`soft delete par bhi 0 read (mila: ${countReads('students')})`,
  countReads('students') === 0 ? true : `${countReads('students')} baar padha`)

// Asli (hard) delete. Supabase DELETE par sirf primary key bhejta hai — poori
// row nahi, chahe REPLICA IDENTITY FULL ho — kyunki mit chuki row par RLS
// jaanchi nahi ja sakti. Hamari key legacy_id hai, uuid nahi, to patch mumkin
// hi nahi. Yahan poora refetch hona CHAHIYE, aur node phir bhi sahi hona chahiye.
reads = []
await admin.from('students').delete().eq('school_id', schoolId).eq('legacy_id', 'pt_c')
await wait(3000)
check('delete hua student node se hat gaya',
  snap && !('pt_c' in snap) ? true : 'pt_c abhi bhi node me hai')
check(`delete par refetch hua (mila: ${countReads('students')})`,
  countReads('students') >= 1 ? true : 'delete par node dobara nahi padha — row atki reh jayegi')

const freshAfter = await databaseRequest(`${S}/students`, null, {})
check('delete ke baad bhi node refetch se hu-ba-hu',
  same(snap, freshAfter) ? true : 'delete ke baad dono alag ho gaye')

unsubStudents()

/* ============================================================
   attendance — key join se banti hai (date_studentId)
   ============================================================ */
console.log('\n=== ATTENDANCE: key student ke join se ===')

let aSnap = null
const unsubAtt = subscribe(`${S}/attendance`, (s) => { aSnap = s.val() })
await wait(3000)

reads = []
const DATE = '2026-08-03'
for (const id of ['pt_a', 'pt_d', 'pt_e']) {
  await databaseRequest(`${S}/attendance/${DATE}_${id}`, null, {
    method: 'PUT', body: { date: DATE, studentId: id, status: 'P' },
  })
}
await wait(4000)

check('attendance ki keys date_studentId shakal me hain',
  ['pt_a', 'pt_d', 'pt_e'].every((id) => aSnap?.[`${DATE}_${id}`]?.studentId === id)
    ? true : `keys: ${Object.keys(aSnap || {}).join(',')}`)

check(`attendance node 0 baar padha (mila: ${countReads('attendance')})`,
  countReads('attendance') === 0
    ? true : `${countReads('attendance')} baar padha`)

const freshAtt = await databaseRequest(`${S}/attendance`, null, {})
check('attendance: patch aur refetch hu-ba-hu',
  same(aSnap, freshAtt) ? true : 'attendance ke documents alag hain')

unsubAtt()

/* ============================================================
   date-bound listener — daayre se bahar ki row andar na aaye
   ============================================================ */
console.log('\n=== DATE SE BANDHA LISTENER ===')

let bSnap = null
const q = `orderBy="date"&startAt="2026-08-01"&endAt="2026-08-31"`
const unsubBound = subscribe(`${S}/attendanceLive`, (s) => { bSnap = s.val() }, { query: q })
await wait(3000)

// daayre ke andar
await databaseRequest(`${S}/attendance/2026-08-15_pt_a`, null, {
  method: 'PUT', body: { date: '2026-08-15', studentId: 'pt_a', status: 'A' },
})
// daayre ke bahar — ye snapshot me nahi aani chahiye
await databaseRequest(`${S}/attendance/2026-09-15_pt_a`, null, {
  method: 'PUT', body: { date: '2026-09-15', studentId: 'pt_a', status: 'A' },
})
await wait(4000)

check('August wali row aayi', `2026-08-15_pt_a` in (bSnap || {})
  ? true : `keys: ${Object.keys(bSnap || {}).join(',')}`)
check('September wali row nahi aayi (filter patch me bhi laga)',
  !(`2026-09-15_pt_a` in (bSnap || {}))
    ? true : 'daayre se bahar ki row ghus gayi')

const freshBound = await databaseRequest(`${S}/attendanceLive`, null, { query: q })
check('date-bound: patch aur refetch hu-ba-hu',
  same(bSnap, freshBound) ? true : 'bound listener ke documents alag hain')

// attendanceLive narrow hai — patch me poora `source` nahi ghusna chahiye
const oneDoc = bSnap?.[`2026-08-15_pt_a`] || {}
check('attendanceLive ka doc narrow hi raha (sirf date/status/studentId)',
  same(Object.keys(oneDoc).sort(), ['date', 'status', 'studentId'])
    ? true : `keys: ${Object.keys(oneDoc).join(',')}`)

unsubBound()

await cleanup()
console.log(`\n${'='.repeat(46)}`)
console.log(`PASS ${pass}   FAIL ${fail}`)
process.exit(fail ? 1 : 0)

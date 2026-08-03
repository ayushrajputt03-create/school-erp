// ============================================================
// test-counter-reserve.mjs — admission/certificate number ka counter
//
//   node supabase/test-counter-reserve.mjs
//
// Cutover me fee receipt ka counter to Supabase par aa gaya tha, par admission
// aur certificate wale Firebase RTDB ke REST par hi reh gaye — jahan Supabase
// ka token 401 deta hai. Production me admission form "Could not generate
// admission number." de raha tha.
//
// Yahan sabse ahem cheez speed ya atomicity nahi, ye hai ki **naya number kisi
// maujooda record se na takraye**. Production me dono school ka admissionCounter
// lastIssued=0 par pada hai, jabki Triveni me 771 student aur 777 tak number ja
// chuka hai. Sirf counter dekhne wala code use agla number 1 de deta.
//
// Isliye asli assertion ye hai: khaali counter par bhi RPC ka jawab school ke
// sabse bade maujooda number se BADA aana chahiye.
//
// Real schools par sirf padha jaata hai. Likhna sirf NXT OpenERP (khaali
// sandbox) me, aur ant me wahi mita diya jaata hai.
// ============================================================

import fs from 'node:fs'
for (const raw of fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const l = raw.trim(); if (!l || l.startsWith('#')) continue
  const i = l.indexOf('='); if (i < 0) continue
  process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim()
}

const { createClient } = await import('@supabase/supabase-js')
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

let pass = 0, fail = 0
const check = (label, ok, why) => ok === true
  ? (pass++, console.log(`  OK    ${label}`))
  : (fail++, console.log(`  FAIL  ${label}\n          ${why ?? ok}`))

const SANDBOX = 'JfaU8V51U1cxkLqZRFzzbLdGhGD3'
const TRIVENI = 'x6cLySP2vbc3D5CAfQJAomxfet33'

const uuidOf = async (legacy) => {
  const { data } = await admin.from('schools').select('id').eq('legacy_id', legacy).maybeSingle()
  return data?.id
}
const sandboxId = await uuidOf(SANDBOX)
const triveniId = await uuidOf(TRIVENI)

const cleanup = async () => {
  await admin.from('fee_counters').delete().eq('school_id', sandboxId).in('name', ['admission', 'certificate:tc'])
  await admin.from('students').delete().eq('school_id', sandboxId).like('legacy_id', 'ctr_%')
  await admin.from('certificates').delete().eq('school_id', sandboxId).like('legacy_id', 'ctr_%')
}
await cleanup()

/* ============================================================
   Function maujood hai?
   ============================================================ */
console.log('=== FUNCTION ===')

// Seedha bulao — na hone par PostgREST PGRST202 deta hai
const probe = await admin.rpc('reserve_counter', { p_school: sandboxId, p_name: 'admission', p_seed: 0 })
if (probe.error && /PGRST202|could not find|does not exist/i.test(probe.error.message + (probe.error.code || ''))) {
  console.log(`  FAIL  reserve_counter DB me hai\n          ${probe.error.message}`)
  console.log('\n  >> migration abhi apply nahi hui:')
  console.log('     supabase/migrations/20260805000000_reserve_counter.sql')
  process.exit(1)
}
check('reserve_counter DB me maujood hai', true)

/* ============================================================
   ASLI SAWAAL — khaali counter par bhi purane number se takraye nahi
   ============================================================ */
console.log('\n=== TAKRAAV: khaali counter, par school me pehle se numbers ===')

const trailing = (v) => Number(String(v || '').match(/(\d+)$/)?.[1] || 0)

// poora scan, kyunki admission_number text hai aur text-sort numeric sort nahi hai
const { data: allNums } = await admin
  .from('students').select('admission_number').eq('school_id', triveniId)
const triveniMax = Math.max(0, ...(allNums || []).map((r) => trailing(r.admission_number)))

const { data: counterRow } = await admin
  .from('fee_counters').select('value').eq('school_id', triveniId).eq('name', 'admission').maybeSingle()

console.log(`  (Triveni: ${allNums?.length ?? 0} students, sabse bada number ${triveniMax}, counter ${counterRow?.value ?? 'hai hi nahi'})`)

// Sandbox me nakli purana record daalo, counter chhua bhi nahi
await admin.from('students').insert({
  school_id: sandboxId, legacy_id: 'ctr_old', full_name: 'Counter Old',
  admission_number: '507', source: { full_name: 'Counter Old', admission_number: '507' },
})

const first = await admin.rpc('reserve_counter', { p_school: sandboxId, p_name: 'admission', p_seed: 0 })
check(`counter khaali tha par number 507 ke aage mila (mila: ${first.data})`,
  Number(first.data) === 508
    ? true : `mila ${first.data} — 508 aana chahiye tha, warna 507 wale student se takrata`)

const second = await admin.rpc('reserve_counter', { p_school: sandboxId, p_name: 'admission', p_seed: 0 })
check(`agla number badhta hai (${second.data})`,
  Number(second.data) === 509 ? true : `mila ${second.data}`)

/* ============================================================
   Do log ek saath — dono ko alag number
   ============================================================ */
console.log('\n=== EK SAATH DO ADMISSION ===')

const together = await Promise.all(
  Array.from({ length: 8 }, () => admin.rpc('reserve_counter', { p_school: sandboxId, p_name: 'admission', p_seed: 0 })),
)
const issued = together.map((r) => Number(r.data)).filter(Number.isFinite)
check(`8 ek saath ki request par 8 alag number (mile: ${new Set(issued).size})`,
  issued.length === 8 && new Set(issued).size === 8
    ? true : `mile: ${issued.join(',')}`)

/* ============================================================
   Counter kabhi peechhe nahi jaata
   ============================================================ */
console.log('\n=== COUNTER PEECHHE NAHI JAATA ===')

const high = await admin.rpc('reserve_counter', { p_school: sandboxId, p_name: 'admission', p_seed: 9000 })
check(`bada seed dene par wahan pahunch jaata hai (${high.data})`,
  Number(high.data) === 9001 ? true : `mila ${high.data}`)

const afterHigh = await admin.rpc('reserve_counter', { p_school: sandboxId, p_name: 'admission', p_seed: 0 })
check(`uske baad seed 0 dene par bhi peechhe nahi girta (${afterHigh.data})`,
  Number(afterHigh.data) === 9002
    ? true : `mila ${afterHigh.data} — counter peechhe gir gaya, purane number dobara milenge`)

/* ============================================================
   Certificate — har type ka apna counter
   ============================================================ */
console.log('\n=== CERTIFICATE: har type alag ===')

await admin.from('certificates').insert({
  school_id: sandboxId, legacy_id: 'ctr_tc', certificate_type: 'tc',
  certificate_number: 'TC-2026-042', source: { certificateType: 'tc', certificateNumber: 'TC-2026-042' },
})

const tc = await admin.rpc('reserve_counter', { p_school: sandboxId, p_name: 'certificate:tc', p_seed: 0 })
check(`tc ka number maujooda 042 ke aage se (mila: ${tc.data})`,
  Number(tc.data) === 43 ? true : `mila ${tc.data}`)

const bon = await admin.rpc('reserve_counter', { p_school: sandboxId, p_name: 'certificate:bonafide', p_seed: 0 })
check(`bonafide ka counter tc se alag hai (mila: ${bon.data})`,
  Number(bon.data) === 1 ? true : `mila ${bon.data} — types ka counter aapas me mil gaya`)

/* ============================================================
   Doosre school ka number nahi le sakte
   ============================================================ */
console.log('\n=== DOOSRE SCHOOL PAR ROK ===')

// service-role RLS ke bahar hai, par function khud jaanch karta hai:
// current_school_id() service role ke liye null hota hai, to Triveni se match
// nahi karega aur exception aani chahiye.
const cross = await admin.rpc('reserve_counter', { p_school: triveniId, p_name: 'admission', p_seed: 0 })
check('bina us school ka admin bane number nahi milta',
  cross.error ? true : `koi rok nahi lagi — ${cross.data} mil gaya`)

// aur Triveni ka counter chhua tak nahi gaya
const { data: triveniAfter } = await admin
  .from('fee_counters').select('value').eq('school_id', triveniId).eq('name', 'admission').maybeSingle()
check('rok lagne ke baad Triveni ka counter waisa hi hai',
  (triveniAfter?.value ?? null) === (counterRow?.value ?? null)
    ? true : `pehle ${counterRow?.value ?? 'nahi tha'}, ab ${triveniAfter?.value ?? 'nahi hai'}`)

await cleanup()
console.log(`\n${'='.repeat(46)}`)
console.log(`PASS ${pass}   FAIL ${fail}`)
process.exit(fail ? 1 : 0)

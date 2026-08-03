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
// Sabse ahem cheez speed ya atomicity nahi, TAKRAAV hai. Production me dono
// school ka admissionCounter lastIssued=0 par pada hai, jabki Triveni me 227
// active student aur number 777 tak ja chuka hai. Sirf counter dekhne wala code
// use agla number 1 de deta — yaani maujooda bachchon ke number dobara issue.
// Isliye asli assertion: khaali counter par bhi jawab school ke sabse bade
// maujooda number se BADA aana chahiye.
//
// ---------------------------------------------------------------------------
// Ye test service-role key se NAHI chal sakta, aur ye pehle galti ho chuki hai:
// reserve_counter() ki guard `current_school_id()` aur `is_school_admin()` par
// tiki hai, jo caller ki pehchaan se aate hain. Service role ke liye dono khaali
// hain, to HAR call exception deti hai — aur tab "doosre school par rok lagti
// hai" wala test bhi PASS dikhta hai, galat wajah se. Sab kuch bilkul band ho
// to rok ka test bekaar hai.
//
// Isliye yahan magic-link se asli authenticated session banti hai (wahi tareeka
// jo staff login use karta hai — koi email nahi jaata, sirf token_hash chahiye).
// ---------------------------------------------------------------------------
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

const URL_ = process.env.SUPABASE_URL
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

let pass = 0, fail = 0
const check = (label, ok, why) => ok === true
  ? (pass++, console.log(`  OK    ${label}`))
  : (fail++, console.log(`  FAIL  ${label}\n          ${why ?? ok}`))

const SANDBOX = 'JfaU8V51U1cxkLqZRFzzbLdGhGD3'   // NXT OpenERP — khaali
const TRIVENI = 'x6cLySP2vbc3D5CAfQJAomxfet33'   // asli data — sirf padhna

const uuidOf = async (legacy) => {
  const { data } = await admin.from('schools').select('id').eq('legacy_id', legacy).maybeSingle()
  return data?.id
}
const sandboxId = await uuidOf(SANDBOX)
const triveniId = await uuidOf(TRIVENI)

const cleanup = async () => {
  await admin.from('fee_counters').delete().eq('school_id', sandboxId)
    .in('name', ['admission', 'certificate:tc', 'certificate:bonafide'])
  await admin.from('students').delete().eq('school_id', sandboxId).like('legacy_id', 'ctr_%')
  await admin.from('certificates').delete().eq('school_id', sandboxId).like('legacy_id', 'ctr_%')
}
await cleanup()

/** email ka asli logged-in client — bina password ke, magic link ke token_hash se */
async function signInAs(email) {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error) throw new Error(`${email} ka link nahi bana: ${error.message}`)
  const client = createClient(URL_, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const { error: otpError } = await client.auth.verifyOtp({
    token_hash: data.properties.hashed_token, type: 'email',
  })
  if (otpError) throw new Error(`${email} ki session nahi bani: ${otpError.message}`)
  return client
}

const owner = await signInAs('iayushsingh06@gmail.com')          // NXT OpenERP ka owner
const reserve = (client, school, name, seed = 0) =>
  client.rpc('reserve_counter', { p_school: school, p_name: name, p_seed: seed })

console.log('=== SESSION ===')
const { data: who } = await owner.auth.getUser()
check(`sandbox owner ki asli session bani (${who?.user?.email})`,
  Boolean(who?.user?.id) ? true : 'session nahi bani — aage ke sab test bekaar hote')

/* ============================================================
   ASLI SAWAAL — khaali counter, par school me pehle se numbers
   ============================================================ */
console.log('\n=== TAKRAAV: khaali counter, par purane number maujood ===')

const trailing = (v) => Number(String(v || '').match(/(\d+)$/)?.[1] || 0)
const { data: allNums } = await admin.from('students').select('admission_number').eq('school_id', triveniId)
const triveniMax = Math.max(0, ...(allNums || []).map((r) => trailing(r.admission_number)))
const { data: triveniCounterBefore } = await admin
  .from('fee_counters').select('value').eq('school_id', triveniId).eq('name', 'admission').maybeSingle()
console.log(`  (Triveni: ${allNums?.length ?? 0} students, sabse bada ${triveniMax}, counter ${triveniCounterBefore?.value ?? 'hai hi nahi'})`)

// sandbox me nakli purana record — counter jaan-boojh kar khaali chhoda
await admin.from('students').insert({
  school_id: sandboxId, legacy_id: 'ctr_old', full_name: 'Counter Old',
  admission_number: '507', source: { full_name: 'Counter Old', admission_number: '507' },
})

const first = await reserve(owner, sandboxId, 'admission')
check(`counter khaali tha, phir bhi number 507 ke aage mila (mila: ${first.data})`,
  Number(first.data) === 508
    ? true : `mila ${first.data} (${first.error?.message ?? ''}) — 508 chahiye tha, warna 507 wale student se takrata`)

const second = await reserve(owner, sandboxId, 'admission')
check(`agla number badhta hai (${second.data})`,
  Number(second.data) === 509 ? true : `mila ${second.data}`)

// trash me pada bachcha bhi ginna chahiye — uska number dobara dena purane record se takrata
await admin.from('students').insert({
  school_id: sandboxId, legacy_id: 'ctr_trashed', full_name: 'Counter Trashed',
  admission_number: '1200', deleted_at: new Date().toISOString(),
  source: { full_name: 'Counter Trashed', admission_number: '1200' },
})
const afterTrash = await reserve(owner, sandboxId, 'admission')
check(`trash me pade student ka number bhi ginta hai (mila: ${afterTrash.data})`,
  Number(afterTrash.data) === 1201
    ? true : `mila ${afterTrash.data} — 1201 chahiye tha, warna trash wale se takrata`)

/* ============================================================
   Do log ek saath
   ============================================================ */
console.log('\n=== EK SAATH KAI ADMISSION ===')

const together = await Promise.all(Array.from({ length: 8 }, () => reserve(owner, sandboxId, 'admission')))
const issued = together.map((r) => Number(r.data)).filter(Number.isFinite)
check(`8 ek saath ki request par 8 alag number (alag mile: ${new Set(issued).size})`,
  issued.length === 8 && new Set(issued).size === 8
    ? true : `mile: ${issued.join(',')}`)

/* ============================================================
   Counter kabhi peechhe nahi jaata
   ============================================================ */
console.log('\n=== COUNTER PEECHHE NAHI JAATA ===')

const high = await reserve(owner, sandboxId, 'admission', 9000)
check(`bada seed dene par wahan pahunch jaata hai (${high.data})`,
  Number(high.data) === 9001 ? true : `mila ${high.data}`)

const afterHigh = await reserve(owner, sandboxId, 'admission', 0)
check(`uske baad seed 0 dene par bhi peechhe nahi girta (${afterHigh.data})`,
  Number(afterHigh.data) === 9002
    ? true : `mila ${afterHigh.data} — counter gir gaya, purane number dobara milenge`)

/* ============================================================
   Certificate — har type ka apna counter
   ============================================================ */
console.log('\n=== CERTIFICATE: har type alag ===')

await admin.from('certificates').insert({
  school_id: sandboxId, legacy_id: 'ctr_tc', certificate_type: 'tc',
  certificate_number: 'TC-2026-042', source: { certificateType: 'tc', certificateNumber: 'TC-2026-042' },
})

const tc = await reserve(owner, sandboxId, 'certificate:tc')
check(`tc ka number maujooda TC-2026-042 ke aage se (mila: ${tc.data})`,
  Number(tc.data) === 43 ? true : `mila ${tc.data} (${tc.error?.message ?? ''})`)

const bon = await reserve(owner, sandboxId, 'certificate:bonafide')
check(`bonafide ka counter tc se alag hai (mila: ${bon.data})`,
  Number(bon.data) === 1 ? true : `mila ${bon.data} — types ka counter aapas me mil gaya`)

/* ============================================================
   Rok — aur ye tabhi maayne rakhta hai jab upar wale PASS hon
   ============================================================ */
console.log('\n=== DOOSRE SCHOOL PAR ROK ===')

const cross = await reserve(owner, triveniId, 'admission')
check('sandbox ka owner Triveni ka number nahi le sakta',
  cross.error ? true : `rok nahi lagi — ${cross.data} mil gaya`)

const { data: triveniCounterAfter } = await admin
  .from('fee_counters').select('value').eq('school_id', triveniId).eq('name', 'admission').maybeSingle()
check('rok ke baad Triveni ka counter chhua tak nahi gaya',
  (triveniCounterAfter?.value ?? null) === (triveniCounterBefore?.value ?? null)
    ? true : `pehle ${triveniCounterBefore?.value ?? 'nahi tha'}, ab ${triveniCounterAfter?.value ?? 'nahi hai'}`)

console.log('\n=== TEACHER PAR ROK ===')
const teacher = await signInAs('employee_1783764549695@nxtope635.staff.schoolerp.app')
const byTeacher = await reserve(teacher, sandboxId, 'admission')
check('teacher apne hi school ka admission number nahi le sakta (sirf admin/owner)',
  byTeacher.error ? true : `rok nahi lagi — ${byTeacher.data} mil gaya`)

await cleanup()
console.log(`\n${'='.repeat(46)}`)
console.log(`PASS ${pass}   FAIL ${fail}`)
process.exit(fail ? 1 : 0)

// ============================================================
// test-staff-login.mjs — staff login, Supabase raaste par
//
//   node supabase/test-staff-login.mjs
//
// Asli handler ko nakli req/res se chalate hain, phir jo grant milta hai use
// anon client se sach me session me badalte hain. Yaani ye sirf "API ne 200
// diya" nahi dekhta — ye dekhta hai ki login ke baad RLS teacher ko wahi
// dikhati hai jo dikhani chahiye.
//
// Likhna sirf NXT OpenERP (khaali demo school) ke staff par hota hai, aur wo
// bhi sirf auth khaata banana — kisi school ka data chhua nahi jaata.
// ============================================================

import { createRequire } from 'node:module'
import { loadEnv, connect } from './db.mjs'

loadEnv()
process.env.USE_SUPABASE = 'true'

const require = createRequire(import.meta.url)
const { createClient } = require('@supabase/supabase-js')

let pass = 0
const failures = []
const check = (name, ok, detail = '') => {
  if (ok) { pass += 1; console.log(`  ok   ${name}`) }
  else { failures.push(`${name}${detail ? ` — ${detail}` : ''}`); console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`) }
}

const handler = require('../api/teacher-login.js')
const { createStore, phone10, staffEmail } = require('../api/_staff-store.js')

const call = async body => {
  let payload = null
  let code = 0
  const response = { setHeader() {}, status(v) { code = v; return this }, json(v) { payload = v; return this }, end() { return this } }
  await handler({ method: 'POST', body }, response)
  return { code, ...(payload || {}) }
}

/* ---- kis par test karenge ---- */

// NXT OpenERP — khaali demo school. Iske teacher par hi likhte hain.
const SANDBOX = { code: 'NXTOPE635', staffId: 'employee_1783764549695', phone: '1234512345', dob: '2026-07-10', classes: ['1'] }

console.log('\nstore taiyaar hai')
const store = createStore()
check('supabase store bana', store.backend === 'supabase', store.backend)
check('phone10 aakhri 10 digit leta hai', phone10('+91 07290-810294') === '7290810294', phone10('+91 07290-810294'))
check('email legacy id se banti hai, phone se nahi',
  staffEmail('employee_1', 'NXTOPE635') === 'employee_1@nxtope635.staff.schoolerp.app', staffEmail('employee_1', 'NXTOPE635'))

/* ---- galat input ---- */

console.log('\njo login nahi hone chahiye')

check('chhota school code', (await call({ schoolCode: 'AB', phone: SANDBOX.phone, password: SANDBOX.dob })).code === 400)
check('adhoora phone', (await call({ schoolCode: SANDBOX.code, phone: '12345', password: SANDBOX.dob })).code === 400)
check('khaali DOB', (await call({ schoolCode: SANDBOX.code, phone: SANDBOX.phone, password: '' })).code === 400)

const badSchool = await call({ schoolCode: 'ZZZZZZ99', phone: SANDBOX.phone, password: SANDBOX.dob })
check('anjaan school code par 404', badSchool.code === 404, String(badSchool.code))

const badPhone = await call({ schoolCode: SANDBOX.code, phone: '9000000009', password: SANDBOX.dob })
check('anjaan phone par 404', badPhone.code === 404, String(badPhone.code))
check('anjaan phone ka message madadgaar hai', /No staff member/i.test(badPhone.error || ''), badPhone.error)

const badDob = await call({ schoolCode: SANDBOX.code, phone: SANDBOX.phone, password: '01/01/1990' })
check('galat DOB par 401', badDob.code === 401, String(badDob.code))
check('galat DOB par koi token nahi', !badDob.tokenHash && !badDob.token)

// Doosre school ka staff apne school code ke bahar login na kar paaye
const crossSchool = await call({ schoolCode: SANDBOX.code, phone: '9871799495', password: '2008-03-15' })
check('doosre school ka staff yahan nahi ghus sakta', crossSchool.code === 404, String(crossSchool.code))

/* ---- sahi login ---- */

console.log('\nsahi login')

const ok = await call({ schoolCode: SANDBOX.code, phone: SANDBOX.phone, password: SANDBOX.dob })
check('200 mila', ok.code === 200, ok.error || String(ok.code))
check('tokenHash aaya', typeof ok.tokenHash === 'string' && ok.tokenHash.length > 10)
check('Firebase wala custom token nahi aaya', ok.token === undefined)
check('schoolId legacy hai, uuid nahi', ok.schoolId === 'JfaU8V51U1cxkLqZRFzzbLdGhGD3', ok.schoolId)
check('employee.uid staff ka legacy id hai', ok.employee?.uid === SANDBOX.staffId, ok.employee?.uid)
check('department mila', ok.employee?.department === 'Teacher', ok.employee?.department)
check('classes array me aayi', Array.isArray(ok.employee?.classes) && ok.employee.classes.includes('1'), JSON.stringify(ok.employee?.classes))

// DOB ke alag-alag roop — asli log yahi type karte hain
for (const variant of ['10/07/2026', '10-07-2026', '10072026', '2026-07-10']) {
  const r = await call({ schoolCode: SANDBOX.code, phone: SANDBOX.phone, password: variant })
  check(`DOB "${variant}" chalta hai`, r.code === 200, r.error || String(r.code))
}
// phone bhi kisi bhi roop me
const withPrefix = await call({ schoolCode: SANDBOX.code, phone: '+911234512345', password: SANDBOX.dob })
check('phone +91 ke saath bhi chalta hai', withPrefix.code === 200, withPrefix.error || String(withPrefix.code))
const lowerCode = await call({ schoolCode: 'nxtope635', phone: SANDBOX.phone, password: SANDBOX.dob })
check('school code chhote akshar me bhi chalta hai', lowerCode.code === 200, lowerCode.error || String(lowerCode.code))

/* ---- grant sach me session banta hai, aur RLS sahi lagti hai ---- */

console.log('\ngrant se asli session')

const anon = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const fresh = await call({ schoolCode: SANDBOX.code, phone: SANDBOX.phone, password: SANDBOX.dob })
const { data: verified, error: verifyError } = await anon.auth.verifyOtp({ token_hash: fresh.tokenHash, type: 'email' })
check('verifyOtp se session bana', Boolean(verified?.session?.access_token), verifyError?.message)
check('user ki email nakli wali hi hai',
  verified?.user?.email === staffEmail(SANDBOX.staffId, SANDBOX.code), verified?.user?.email)

// Ek token do baar na chale
const { error: replayError } = await anon.auth.verifyOtp({ token_hash: fresh.tokenHash, type: 'email' })
check('wahi token dobara nahi chalta', Boolean(replayError), 'dobara chal gaya')

// app_users se legacy uid — poore app ka har path isi se banta hai
const { data: me } = await anon.from('app_users').select('legacy_uid, role, school_id').eq('id', verified.user.id).maybeSingle()
// Ye do jaanch bekaar nahi hain: auth.users me row daalte hi migration 0010 ka
// trigger chal jaata hai aur "naya signup" maan kar role 'owner' + legacy_uid =
// uuid likh deta hai. Pakda nahi jaata to har staff ko owner ke adhikaar mil
// jaate (fees samet) aur uske saare path galat school par jaate.
check('app_users me legacy_uid staff ka purana id hai', me?.legacy_uid === SANDBOX.staffId, me?.legacy_uid)
check('role teacher hai — trigger ka owner nahi', me?.role === 'teacher', me?.role)

// RLS: teacher ko sirf apni class ke students
const { data: seen, error: seenError } = await anon.from('students').select('legacy_id, class_name')
check('students padh sakta hai (RLS ne error nahi diya)', !seenError, seenError?.message)
const outside = (seen || []).filter(s => !SANDBOX.classes.includes(String(s.class_name || '').trim()))
check('apni class ke bahar ka koi student nahi dikhta', outside.length === 0, `${outside.length} bahar ke`)

// aur doosre school ka to bilkul nahi
const { data: otherSchool } = await anon.from('schools').select('legacy_id')
check('sirf apna school dikhta hai',
  (otherSchool || []).length === 1 && otherSchool[0].legacy_id === 'JfaU8V51U1cxkLqZRFzzbLdGhGD3',
  JSON.stringify(otherSchool))

// fees teacher ko nahi
const { data: fees } = await anon.from('fee_receipts').select('id').limit(5)
check('teacher ko fee receipts nahi dikhtin', (fees || []).length === 0, `${(fees || []).length} rows`)

await anon.auth.signOut()

/* ---- database me kya bana ---- */

console.log('\ndatabase me kya likha gaya')

const { client } = await connect()
const row = await client.query(
  `select u.email, u.encrypted_password, u.confirmation_token, u.recovery_token,
          u.email_change_token_new, u.email_change, u.email_confirmed_at is not null confirmed,
          (select count(*) from auth.identities i where i.user_id = u.id) identities
     from auth.users u where u.id = md5('user|' || $1)::uuid`, [SANDBOX.staffId])
const authRow = row.rows[0]
check('auth.users me row bani', Boolean(authRow))
check('uuid wahi deterministic wala hai (auth.uid() = app_users.id)', Boolean(authRow))
check('identity bhi bani', Number(authRow?.identities) === 1, String(authRow?.identities))
check('email confirmed hai', authRow?.confirmed === true)
// Yahi wo bug tha jisne pehle har sign-in 500 kar diya tha
for (const col of ['confirmation_token', 'recovery_token', 'email_change_token_new', 'email_change']) {
  check(`${col} khaali string hai, NULL nahi`, authRow?.[col] === '', JSON.stringify(authRow?.[col]))
}

const linked = await client.query(
  `select auth_user_id = md5('user|' || legacy_id)::uuid ok from public.staff where legacy_id = $1`, [SANDBOX.staffId])
check('staff.auth_user_id jud gaya (my_visible_classes iske bina khaali)', linked.rows[0]?.ok === true)

// password se koi ghus na paaye
const { error: passwordError } = await anon.auth.signInWithPassword({
  email: staffEmail(SANDBOX.staffId, SANDBOX.code), password: SANDBOX.dob,
})
check('DOB ko password bana ke seedhe login nahi ho sakta', Boolean(passwordError), 'login ho gaya!')

/* ---- dobara chalane par kuch tuuta na ho ---- */

console.log('\nphir se login (idempotent)')

const before = await client.query(`select count(*) c from auth.users`)
const again = await call({ schoolCode: SANDBOX.code, phone: SANDBOX.phone, password: SANDBOX.dob })
const after = await client.query(`select count(*) c from auth.users`)
check('dobara login bhi 200', again.code === 200, again.error || String(again.code))
check('naya auth user nahi bana', before.rows[0].c === after.rows[0].c, `${before.rows[0].c} -> ${after.rows[0].c}`)

/* ---- RPC kisi bhi id par na chal jaye ---- */

console.log('\nRPC ka pehra')

const owner = 'JfaU8V51U1cxkLqZRFzzbLdGhGD3'  // NXT OpenERP ka owner — staff nahi
const ownerBefore = await client.query(`select role, legacy_uid, school_id from public.app_users where legacy_uid = $1`, [owner])
let refused = null
try {
  await client.query(
    `select * from public.ensure_staff_auth_user(
       (select id from public.schools where legacy_id = $1), $1, 'x@example.com', 'staff', 'X')`, [owner])
} catch (err) { refused = err.message }
check('school owner ke id par RPC mana kar deta hai', /staff nahi hai/.test(refused || ''), refused || 'chal gaya!')

const ownerAfter = await client.query(`select role, legacy_uid, school_id from public.app_users where legacy_uid = $1`, [owner])
check('owner ki app_users row jyon ki tyon hai',
  JSON.stringify(ownerBefore.rows) === JSON.stringify(ownerAfter.rows),
  `${JSON.stringify(ownerBefore.rows)} -> ${JSON.stringify(ownerAfter.rows)}`)

// Aur teeno owners abhi bhi owner hi hain — RPC ne kisi ka role nahi giraya
const owners = await client.query(`select count(*) c from public.app_users where role = 'owner'`)
check('teeno school owners waise ke waise', Number(owners.rows[0].c) === 3, String(owners.rows[0].c))

await client.end()

console.log(`\n${pass} pass, ${failures.length} fail`)
if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`)
  process.exitCode = 1
}

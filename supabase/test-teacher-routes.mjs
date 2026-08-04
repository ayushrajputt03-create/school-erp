// ============================================================
// test-teacher-routes.mjs — create-teacher aur teacher-session
//
//   node supabase/test-teacher-routes.mjs
//
// Ye do route cutover me chhoot gaye the: dono seedha firebase-admin use kar
// rahe the. Asar alag-alag tha —
//
//   create-teacher  : Supabase mode me client par `auth.currentUser` null hota
//                     hai, to "Create Teacher Login" button hi phat jaata tha.
//   teacher-session : client Supabase mode me ise bulata hi nahi (fallback
//                     `!useSupabase` me bandha hai), yaani staff ke liye koi
//                     fallback bacha hi nahi tha.
//
// Sabse ahem assertion neeche wala PEHRA wala hissa hai: schoolId hamesha
// token se nikalta hai, request se nahi. Ek galti yahan ka matlab hai ek
// school ka staff doosre school ka poora data padh le.
//
// Asli handler nakli req/res se chalte hain, aur session asli login se banta
// hai — sirf "200 aa gaya" nahi dekhte.
// ============================================================

import { createRequire } from 'node:module'
import { loadEnv } from './db.mjs'

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

const loginHandler = require('../api/teacher-login.js')
const sessionHandler = require('../api/teacher-session.js')
const createHandler = require('../api/create-teacher.js')
const { createStore } = require('../api/_staff-store.js')

const call = async (handler, req) => {
  let payload = null, code = 0
  const res = { setHeader() {}, status(v) { code = v; return this }, json(v) { payload = v; return this }, end() { return this } }
  await handler({ headers: {}, ...req }, res)
  return { code, ...(payload || {}) }
}

// NXT OpenERP — khaali demo school, wahi jo test-staff-login.mjs use karta hai.
const SANDBOX = { code: 'NXTOPE635', legacy: 'JfaU8V51U1cxkLqZRFzzbLdGhGD3', staffId: 'employee_1783764549695', phone: '1234512345', dob: '2026-07-10' }
const REAL = 'x6cLySP2vbc3D5CAfQJAomxfet33'

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const anon = createClient(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })

const store = createStore()
console.log('\nstore')
check('supabase store bana', store.backend === 'supabase', store.backend)

/* ============================================================
   asli staff session — login se lekar payload tak
   ============================================================ */
console.log('\nstaff login se lekar session tak')

const grant = await call(loginHandler, { method: 'POST', body: { schoolCode: SANDBOX.code, phone: SANDBOX.phone, password: SANDBOX.dob } })
check('login 200 diya', grant.code === 200, `${grant.code} ${grant.error || ''}`)

const { data: verified, error: otpError } = await anon.auth.verifyOtp({ token_hash: grant.tokenHash, type: 'email' })
check('grant asli session me badla', Boolean(verified?.session?.access_token), otpError?.message)
const staffToken = verified?.session?.access_token

const session = await call(sessionHandler, { method: 'GET', headers: { authorization: `Bearer ${staffToken}` } })
check('teacher-session 200 diya', session.code === 200, `${session.code} ${session.error || ''}`)
check('backend supabase bata raha hai', session.backend === 'supabase', session.backend)
check('schoolId legacy id hai, uuid nahi', session.schoolId === SANDBOX.legacy, session.schoolId)
check('teacher ka uid staff legacy id hai', session.teacher?.uid === SANDBOX.staffId, session.teacher?.uid)
check('teacher ka naam mila', Boolean(session.teacher?.name), JSON.stringify(session.teacher?.name))
check('classes array hai (CSV nahi)', Array.isArray(session.teacher?.classes), typeof session.teacher?.classes)
check('school profile me naam hai', Boolean(session.profile?.schoolName), JSON.stringify(session.profile)?.slice(0, 80))
for (const key of ['students', 'homework', 'notices', 'attendance']) {
  check(`${key} object ke roop me aaya (null nahi)`,
    session[key] && typeof session[key] === 'object' && !Array.isArray(session[key]), typeof session[key])
}

// RTDB me attendance ki key `${date}_${studentId}` thi. Shape badalne par staff
// app ke saare din aapas me takra jaate hain — isliye key ka roop bhi jaanchte hain.
const attendanceKeys = Object.keys(session.attendance || {})
check('attendance ki key `date_studentId` wali hai',
  attendanceKeys.length === 0 || attendanceKeys.every(k => /^\d{4}-\d{2}-\d{2}_.+/.test(k)),
  attendanceKeys.slice(0, 2).join(', '))

/* ============================================================
   PEHRA — schoolId token se, request se nahi
   ============================================================ */
console.log('\npehra')

check('bina token 401', (await call(sessionHandler, { method: 'GET' })).code === 401)
check('bakwaas token 401', (await call(sessionHandler, { method: 'GET', headers: { authorization: 'Bearer nonsense' } })).code === 401)
check('POST par 405', (await call(sessionHandler, { method: 'POST', headers: { authorization: `Bearer ${staffToken}` } })).code === 405)

// Sandbox khaali school hai, asli school me 200+ students. Agar sandbox ke
// staff ko asli school ka data mil gaya to schoolId token se nahi aa raha.
const { data: realStudents } = await admin.from('students').select('legacy_id')
  .eq('school_id', (await admin.from('schools').select('id').eq('legacy_id', REAL).maybeSingle()).data.id).limit(5)
const leaked = (realStudents || []).filter(s => s.legacy_id in (session.students || {}))
check('doosre school ka ek bhi student payload me nahi aaya', leaked.length === 0, `${leaked.length} leak hue`)

check('verifyCaller bakwaas token par null deta hai', (await store.verifyCaller('nonsense')) === null)
const caller = await store.verifyCaller(staffToken)
check('verifyCaller uid staff legacy id deta hai', caller?.uid === SANDBOX.staffId, caller?.uid)
check('verifyCaller school bhi batata hai', Boolean(caller?.schoolUuid), JSON.stringify(caller))

// create-teacher me schoolId body se aata hai par jaancha token se jaata hai.
const otherSchool = await call(createHandler, {
  method: 'POST',
  headers: { authorization: `Bearer ${staffToken}` },
  body: { schoolId: REAL, staffId: SANDBOX.staffId, teacherData: { name: 'X' } },
})
check('doosre school ke liye teacher banane par 403', otherSchool.code === 403, `${otherSchool.code} ${otherSchool.error || ''}`)
check('bina token create-teacher 401',
  (await call(createHandler, { method: 'POST', body: { schoolId: SANDBOX.legacy, teacherData: {} } })).code === 401)

/* ============================================================
   ensureStaffLogin — Supabase par kya karta hai
   ============================================================ */
console.log('\nensureStaffLogin')

const ensured = await store.ensureStaffLogin(SANDBOX.legacy, { staffId: SANDBOX.staffId, profile: { name: 'Sandbox Teacher', department: 'Teacher' } })
check('maujooda staff par chal gaya', ensured?.staffId === SANDBOX.staffId, JSON.stringify(ensured))

// RPC ka apna pehra: jo is school ka staff nahi hai uspar chalna nahi chahiye,
// warna kisi bhi id ki app_users row overwrite ho sakti thi — owner ki bhi.
let rejected = null
try { await store.ensureStaffLogin(SANDBOX.legacy, { staffId: 'is-naam-ka-koi-staff-nahi', profile: {} }) }
catch (error) { rejected = error.message }
check('anjaan staff id par mana kar deta hai', Boolean(rejected), rejected || 'chal gaya — ye galat hai')

let noStaffId = null
try { await store.ensureStaffLogin(SANDBOX.legacy, { profile: {} }) } catch (error) { noStaffId = error.message }
check('bina staffId saaf error deta hai', Boolean(noStaffId), noStaffId || 'chal gaya')

/* ============================================================
   dono backend ka interface ek jaisa ho
   ============================================================ */
console.log('\ndono backend ka interface')

// firebase-admin stub — service account sirf Vercel me hai. Yahan sirf ye
// dekhna hai ki dono taraf wahi method maujood hain. Naam ka ek farak bhi
// galat flag par rollback ke din pata chalta, jo sabse bura waqt hai.
const stub = (name, exports) => {
  require.cache[require.resolve(name)] = { id: name, filename: name, loaded: true, exports }
}
const noopRef = () => ({
  once: async () => ({ val: () => null }), set: async () => {}, update: async () => {},
  orderByChild: () => noopRef(), startAt: () => noopRef(),
})
stub('firebase-admin/app', { getApps: () => [], getApp: () => ({}), initializeApp: () => ({}), cert: () => ({}) })
stub('firebase-admin/auth', { getAuth: () => ({}) })
stub('firebase-admin/database', { getDatabase: () => ({ ref: () => noopRef() }) })

process.env.USE_SUPABASE = 'false'
process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({ project_id: 'stub' })
delete require.cache[require.resolve('../api/_staff-store.js')]
const { createStore: createFirebaseStore } = require('../api/_staff-store.js')

let fbMethods = null
let fbStore = null
try { fbStore = createFirebaseStore(); fbMethods = Object.keys(fbStore).sort() }
catch (error) { fbMethods = `Firebase store bana hi nahi: ${error.message}` }
const supaMethods = Object.keys(store).sort()
check('Firebase aur Supabase store ke method bilkul same hain',
  Array.isArray(fbMethods) && JSON.stringify(fbMethods) === JSON.stringify(supaMethods),
  `supabase: ${supaMethods.join(',')} | firebase: ${Array.isArray(fbMethods) ? fbMethods.join(',') : fbMethods}`)
check('Firebase store apne aap ko firebase batata hai', fbStore?.backend === 'firebase', fbStore?.backend)

console.log(`\n${'='.repeat(46)}`)
console.log(`${pass} pass, ${failures.length} fail`)
if (failures.length) { failures.forEach(f => console.log(`  ${f}`)); process.exit(1) }

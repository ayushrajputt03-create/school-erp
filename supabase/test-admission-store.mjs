// ============================================================
// test-admission-store.mjs — public admission form ka data layer
//
//   node supabase/test-admission-store.mjs
//
// Ye suite us bug ke liye bani hai jo production me pakda gaya: cutover me
// `api/admission.js` chhoot gaya tha aur seedha firebase-admin use kar raha
// tha. Form submit hota tha, parent ko "ok" milta tha, request Firebase me
// chali jaati thi — aur admin ka queue Supabase se padhta hai, to wo kabhi
// dikhti hi nahi thi. 8 me se 8 rows ka created_at migration ka tha; cutover
// ke baad ek bhi nayi request nahi bani thi.
//
// Isliye sabse ahem assertion "insert chal gaya" nahi hai, ye hai ki likhi hui
// row ADMIN KO WAISI HI DIKHE jaisi adapter deta hai. `admissionRequests` node
// ka koi `fill` nahi hai, yaani poora document `source` jsonb se banta hai —
// sirf typed column bhar dene se insert to pass ho jaata par admin ko khaali
// row dikhti. Wahi galti dobara na ho, iske liye har field wapas padhi jaati hai.
//
// Sandbox: NXT OpenERP (khaali school). Ant me sab mita diya jaata hai.
// ============================================================

import fs from 'node:fs'
for (const raw of fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const l = raw.trim(); if (!l || l.startsWith('#')) continue
  const i = l.indexOf('='); if (i < 0) continue
  process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim()
}
process.env.USE_SUPABASE = 'true'
process.env.VITE_SUPABASE_ANON_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
process.env.VITE_USE_SUPABASE = 'true'

const { createRequire } = await import('node:module')
const require = createRequire(import.meta.url)
const { createStore } = require('../api/_admission-store.js')
const { createClient } = await import('@supabase/supabase-js')
const { databaseRequest } = await import('../src/lib/dataAdapter.js')

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const SANDBOX = 'JfaU8V51U1cxkLqZRFzzbLdGhGD3'
const REAL = 'x6cLySP2vbc3D5CAfQJAomxfet33'

let pass = 0, fail = 0
const check = (label, ok, why) => ok === true
  ? (pass++, console.log(`  OK    ${label}`))
  : (fail++, console.log(`  FAIL  ${label}\n          ${why ?? ok}`))

const { data: school } = await admin.from('schools').select('id').eq('legacy_id', SANDBOX).maybeSingle()
const schoolUuid = school.id

const cleanup = async () => {
  await admin.from('admission_requests').delete().eq('school_id', schoolUuid).like('legacy_id', 'adm_req_%')
  await admin.from('kv').delete().eq('school_id', schoolUuid).eq('path', 'admissionThrottle')
}
await cleanup()

const store = createStore()

console.log('=== BACKEND ===')
check(`store Supabase par hai (mila: ${store.backend})`,
  store.backend === 'supabase' ? true : `${store.backend} — flag galat hai, test bekaar hai`)

/* ============================================================
   school identity
   ============================================================ */
console.log('\n=== SCHOOL PEHCHAAN ===')

const identity = await store.schoolIdentity(REAL)
check(`asli school ka naam mila (${identity?.schoolName})`,
  Boolean(identity?.schoolName) ? true : `mila: ${JSON.stringify(identity)}`)
check('admissions khuli hui hain',
  identity?.open === true ? true : `open=${identity?.open}`)
check('school identity me sirf naam/logo/open jaata hai, aur kuch nahi',
  JSON.stringify(Object.keys(identity).sort()) === JSON.stringify(['logo', 'open', 'schoolName'])
    ? true : `keys: ${Object.keys(identity).join(',')}`)

const missing = await store.schoolIdentity('is-naam-ka-koi-school-nahi')
check('galat school par null',
  missing === null ? true : `mila: ${JSON.stringify(missing)}`)

/* ============================================================
   ASLI SAWAAL — likhi hui request admin ko dikhti hai?
   ============================================================ */
console.log('\n=== REQUEST BANNA AUR ADMIN KO DIKHNA ===')

const id = `adm_req_${Date.now()}_test01`
const doc = {
  id,
  studentName: 'Test Aarav Sharma',
  dob: '2018-04-12',
  gender: 'Male',
  classAppliedFor: '1',
  fatherName: 'Ramesh Sharma',
  motherName: 'Sunita Sharma',
  parentPhone: '9876543210',
  parentEmail: 'ramesh@example.com',
  address: '12 Test Road, Delhi',
  previousSchool: 'Little Stars',
  status: 'pending',
  source: 'public-qr',
  submittedAt: Date.now(),
  reviewedBy: null, reviewedByName: null, reviewedAt: null, rejectionNote: null,
}
await store.createRequest(SANDBOX, id, doc)

// Adapter se padho — bilkul waise hi jaise App.jsx ka listener padhta hai
const asAdmin = await databaseRequest(`schools/${SANDBOX}/admissionRequests`, null, {
  query: 'orderBy="status"&equalTo="pending"',
})
const seen = asAdmin?.[id]

check('nayi request admin ke pending queue me dikhti hai',
  Boolean(seen) ? true : `queue me nahi mili. keys: ${Object.keys(asAdmin || {}).join(',')}`)

// Har field wapas — yahi wo jagah hai jahan sirf typed column likhne se
// insert pass hota par admin ko aadhi row milti.
const mismatched = Object.entries(doc)
  .filter(([k, v]) => JSON.stringify(seen?.[k]) !== JSON.stringify(v))
  .map(([k]) => k)
check(`saare ${Object.keys(doc).length} field hu-ba-hu wapas aaye`,
  mismatched.length === 0 ? true : `ye field alag hain: ${mismatched.join(', ')}`)

check('status server ne set kiya, body se nahi aaya',
  seen?.status === 'pending' ? true : `status=${seen?.status}`)

/* ============================================================
   pending ki ginti
   ============================================================ */
console.log('\n=== PENDING GINTI ===')

check(`sandbox me 1 pending (mila: ${await store.pendingCount(SANDBOX)})`,
  (await store.pendingCount(SANDBOX)) === 1 ? true : 'ginti galat')

await admin.from('admission_requests').update({ status: 'approved' })
  .eq('school_id', schoolUuid).eq('legacy_id', id)
check('approve karne par pending ginti 0',
  (await store.pendingCount(SANDBOX)) === 0 ? true : 'approved bhi gina ja raha hai')

const afterApprove = await databaseRequest(`schools/${SANDBOX}/admissionRequests`, null, {
  query: 'orderBy="status"&equalTo="pending"',
})
check('approve ki hui request admin ke pending queue se hat gayi',
  !(id in (afterApprove || {})) ? true : 'abhi bhi pending queue me hai')

/* ============================================================
   throttle — ek parent doosre ka record na mitaye
   ============================================================ */
console.log('\n=== THROTTLE (do parent ek saath) ===')

await store.saveThrottle(SANDBOX, '9111111111', { count: 1, windowStartedAt: Date.now(), updatedAt: Date.now() })
await store.saveThrottle(SANDBOX, '9222222222', { count: 2, windowStartedAt: Date.now(), updatedAt: Date.now() })

const first = await store.throttleFor(SANDBOX, '9111111111')
const second = await store.throttleFor(SANDBOX, '9222222222')
check('doosre parent ke apply karne par pehle ka throttle bacha raha',
  first?.count === 1 ? true : `pehla mit gaya: ${JSON.stringify(first)}`)
check('doosre parent ka apna throttle sahi hai',
  second?.count === 2 ? true : `mila: ${JSON.stringify(second)}`)

const unknown = await store.throttleFor(SANDBOX, '9999999999')
check('naye number par khaali throttle',
  JSON.stringify(unknown) === '{}' ? true : `mila: ${JSON.stringify(unknown)}`)

/* ============================================================
   dono backend ka interface ek jaisa ho
   ============================================================ */
console.log('\n=== DONO BACKEND KA INTERFACE ===')

// Firebase store banane ke liye flag palto. Ye asli Firebase se baat nahi karta
// — firebase-admin stub kar diya hai (service account waise bhi sirf Vercel me
// hai). Yahan sirf ye dekhna hai ki dono taraf wahi method maujood hain. Naam
// ka ek farak bhi galat flag par production tak chhupa rehta, aur rollback ke
// din pata chalta — jo sabse bura waqt hai pata chalne ka.
const stub = (name, exports) => {
  require.cache[require.resolve(name)] = { id: name, filename: name, loaded: true, exports }
}
const noopRef = () => ({
  once: async () => ({ val: () => null }),
  set: async () => {},
  orderByChild: () => noopRef(),
  equalTo: () => noopRef(),
})
stub('firebase-admin/app', {
  getApps: () => [], getApp: () => ({}), initializeApp: () => ({}), cert: () => ({}),
})
stub('firebase-admin/database', { getDatabase: () => ({ ref: () => noopRef() }) })

process.env.USE_SUPABASE = 'false'
process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({ project_id: 'stub' })
delete require.cache[require.resolve('../api/_admission-store.js')]
const { createStore: createFirebaseStore } = require('../api/_admission-store.js')

let fbStore = null
let fbMethods = null
try {
  fbStore = createFirebaseStore()
  fbMethods = Object.keys(fbStore).sort()
} catch (error) {
  fbMethods = `Firebase store bana hi nahi: ${error.message}`
}
const supaMethods = Object.keys(store).sort()
check('Firebase aur Supabase store ke method bilkul same hain',
  Array.isArray(fbMethods) && JSON.stringify(fbMethods) === JSON.stringify(supaMethods)
    ? true : `supabase: ${supaMethods.join(',')}\n          firebase: ${Array.isArray(fbMethods) ? fbMethods.join(',') : fbMethods}`)

check('Firebase store apne aap ko firebase batata hai',
  fbStore?.backend === 'firebase' ? true : `mila: ${fbStore?.backend}`)

await cleanup()
console.log(`\n${'='.repeat(46)}`)
console.log(`PASS ${pass}   FAIL ${fail}`)
process.exit(fail ? 1 : 0)

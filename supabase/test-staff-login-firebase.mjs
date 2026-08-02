// ============================================================
// test-staff-login-firebase.mjs — staff login ka Firebase roop
//
//   node supabase/test-staff-login-firebase.mjs
//
// Aaj live yahi raasta chalta hai. Iski jaanch sabse mushkil hai: service
// account key is machine par nahi hai, sirf Vercel par. Isliye firebase-admin
// ko nakli bana ke require cache me daalte hain aur dekhte hain ki store
// kaunse RTDB path chhuta hai aur kya token banata hai.
//
// Do cheezein pakadni hain:
//   1. Dono store ke method bilkul ek jaise hon — Firebase wale me ek naam ki
//      galti flag false rehne tak chhupi rehti, yaani production me.
//   2. Login poora `schools/{id}` na maange. Wo ek node us school ka saara
//      data hai — students, fees, attendance, certificates.
//
// Alag file isliye ki flag module load hote hi padh liya jaata hai — ek hi
// process me dono roop nahi ban sakte.
// ============================================================

import { createRequire } from 'node:module'

process.env.USE_SUPABASE = 'false'
process.env.VITE_USE_SUPABASE = 'false'
process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({ project_id: 'test' })
process.env.FIREBASE_DATABASE_URL = 'https://test.firebaseio.com'
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test'

const require = createRequire(import.meta.url)

let pass = 0
const failures = []
const check = (name, ok, detail = '') => {
  if (ok) { pass += 1; console.log(`  ok   ${name}`) }
  else { failures.push(`${name}${detail ? ` — ${detail}` : ''}`); console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`) }
}

/* ---- nakli firebase-admin ---- */

const touched = []
const data = {}
const minted = []

const refFor = path => ({
  once: async () => { touched.push(`GET ${path}`); return { val: () => data[path] ?? null, exists: () => data[path] != null } },
  set: async value => { touched.push(`SET ${path}`); data[path] = value },
  update: async value => { touched.push(`UPDATE ${path}`); data[path] = { ...(data[path] || {}), ...value } },
})

const stub = (name, exports) => { require.cache[require.resolve(name)] = { id: name, filename: name, loaded: true, exports } }

stub('firebase-admin/app', {
  getApps: () => [],
  getApp: () => ({}),
  initializeApp: () => ({ options: { credential: { getAccessToken: async () => ({ access_token: 'x' }) } } }),
  cert: () => ({}),
})
stub('firebase-admin/database', { getDatabase: () => ({ ref: path => refFor(path || '') }) })
stub('firebase-admin/auth', {
  getAuth: () => ({
    createCustomToken: async (uid, claims) => { minted.push({ uid, claims }); return `custom:${uid}` },
  }),
})

/* ---- 1. dono roop ek jaise ---- */

console.log('\ndono roop ek jaise hain')

const { createStore } = require('../api/_staff-store.js')
const firebase = createStore()
check('firebase store bana', firebase.backend === 'firebase', firebase.backend)

// Supabase roop alag se banaya nahi ja sakta (createStore ek hi cache karta hai
// aur flag load par padha jaata hai), isliye method ke naam source se milaate hain.
const storeSource = require('node:fs').readFileSync(new URL('../api/_staff-store.js', import.meta.url), 'utf8')
const supabaseMethods = [...storeSource.matchAll(/^\s{4}(?:async )?(\w+)[:(]/gm)].map(m => m[1]).filter(n => n !== 'backend')
const firebaseMethods = Object.keys(firebase).filter(k => k !== 'backend')
const missing = firebaseMethods.filter(m => !supabaseMethods.includes(m))
check('firebase ka har method supabase me bhi hai', missing.length === 0, missing.join(', '))
check('store me saare method hain', firebaseMethods.length === 4, String(firebaseMethods.length))

/* ---- 2. path aur token ---- */

console.log('\npath jaise the waise hain')

data['schoolCodes/NORPUB637'] = { schoolId: 'S1' }
data['schools/S1/staff'] = {
  emp1: { firstName: 'Poonam', lastName: 'Kumari', phone: '8750230223', dob: '1997-09-15', department: 'Teacher', assignedClasses: '9,10' },
  emp2: { firstName: 'Raj', phone: '7838296298', dob: '1994-05-28', department: 'Admin' },
  emp3: { firstName: 'Purana', phone: '9000000000', dob: '1990-01-01', department: 'Teacher', active: false },
}
data['schools/S1/teachers'] = {
  demoTchr: { firstName: 'Demo', phone: '1234512345', dob: '2026-07-10' },
}

touched.length = 0
check('schoolCodes se school milta hai', await firebase.schoolIdByCode('NORPUB637') === 'S1')
check('schoolCodes ka path', touched[0] === 'GET schoolCodes/NORPUB637', touched[0])

touched.length = 0
const school = await firebase.staffCollections('S1')
check('staff aur teachers dono aaye', Object.keys(school.staff).length === 3 && Object.keys(school.teachers).length === 1)
check('sirf staff aur teachers padhe gaye', touched.join(' | ') === 'GET schools/S1/staff | GET schools/S1/teachers', touched.join(' | '))
check('poora school node kabhi nahi manga', !touched.includes('GET schools/S1'), touched.join(' | '))

touched.length = 0
await firebase.linkStaffIndex('S1', 'emp1', { role: 'teacher', source: 'staff' })
check('teachersIndex ka path', touched[0] === 'UPDATE teachersIndex/emp1', touched[0])
check('teachersIndex me schoolId gaya', data['teachersIndex/emp1']?.schoolId === 'S1' && data['teachersIndex/emp1']?.role === 'teacher')

const grant = await firebase.grantSession('S1', 'emp1', { department: 'Teacher', name: 'Poonam Kumari' })
check('custom token bana', grant.token === 'custom:emp1', JSON.stringify(grant))
check('token me tokenHash nahi hai (wo sirf supabase par)', grant.tokenHash === undefined)
check('token uid staff ka legacy id hai', minted[0]?.uid === 'emp1', minted[0]?.uid)
check('claims me schoolId aur department', minted[0]?.claims?.schoolId === 'S1' && minted[0]?.claims?.department === 'Teacher')

/* ---- 3. handler ke niyam ---- */

console.log('\nlogin ke niyam')

const handler = require('../api/teacher-login.js')
const call = async body => {
  let payload = null
  let code = 0
  const response = { setHeader() {}, status(v) { code = v; return this }, json(v) { payload = v; return this }, end() { return this } }
  await handler({ method: 'POST', body }, response)
  return { code, ...(payload || {}) }
}

const ok = await call({ schoolCode: 'norpub637', phone: '08750230223', password: '15/09/1997' })
check('sahi login par 200 aur custom token', ok.code === 200 && ok.token === 'custom:emp1', ok.error || JSON.stringify(ok.token))
check('employee me classes array hai', JSON.stringify(ok.employee?.classes) === '["9","10"]', JSON.stringify(ok.employee?.classes))
check('schoolId wapas aaya', ok.schoolId === 'S1', ok.schoolId)

const wrongDob = await call({ schoolCode: 'NORPUB637', phone: '8750230223', password: '01/01/2000' })
check('galat DOB par 401', wrongDob.code === 401, String(wrongDob.code))

const inactive = await call({ schoolCode: 'NORPUB637', phone: '9000000000', password: '01/01/1990' })
check('active:false wale staff ko nahi ghusne deta', inactive.code === 404, String(inactive.code))

// staff pehle, teachers baad me — dono me hone par staff hi jeete
const legacyTeacher = await call({ schoolCode: 'NORPUB637', phone: '1234512345', password: '10/07/2026' })
check('purane teachers collection se bhi login hota hai', legacyTeacher.code === 200 && legacyTeacher.token === 'custom:demoTchr',
  legacyTeacher.error || String(legacyTeacher.code))

const { findByPhone } = handler.__internals
data['schools/S1/staff'].empDup = { firstName: 'Dono', phone: '1234512345', dob: '10/07/2026', department: 'Teacher' }
const both = findByPhone(await firebase.staffCollections('S1'), '1234512345')
check('ek hi phone dono jagah ho to staff pehle', both.source === 'staff' && both.match[0] === 'empDup', JSON.stringify(both?.source))

console.log(`\n${pass} pass, ${failures.length} fail`)
if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`)
  process.exitCode = 1
}

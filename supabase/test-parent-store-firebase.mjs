// ============================================================
// test-parent-store-firebase.mjs — store ka Firebase roop
//
//   node supabase/test-parent-store-firebase.mjs
//
// Aaj live yahi raasta chalta hai (VITE_USE_SUPABASE=false), par iski jaanch
// sabse mushkil hai: service account key is machine par nahi hai, sirf Vercel
// par. Isliye firebase-admin ko nakli bana ke require cache me daal dete hain
// aur dekhte hain ki store kaunse RTDB path chhuta hai.
//
// Do cheezein pakadni hain:
//   1. Dono store ke method bilkul ek jaise hon. Firebase wale me ek naam ki
//      galti bhi flag false rehne tak chhupi rehti — yaani production me.
//   2. Login ka raasta poora students node kabhi na maange. Wahi ek badlaav
//      tha jisne har parent login se megabytes hataye the.
//
// Alag file isliye hai ki flag module load hote hi padh liya jaata hai — ek hi
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

const refFor = path => ({
  once: async () => { touched.push(`GET ${path}`); return { val: () => data[path] ?? null, exists: () => data[path] != null } },
  set: async value => { touched.push(`SET ${path}`); data[path] = value },
  update: async value => { touched.push(`UPDATE ${path}`); data[path] = { ...(data[path] || {}), ...value } },
  remove: async () => { touched.push(`DELETE ${path}`); delete data[path] },
  orderByChild: child => ({ equalTo: value => ({ once: async () => { touched.push(`QUERY ${path} ${child}=${value}`); return { val: () => data[`${path}?${child}=${value}`] ?? null } } }) }),
})

const stub = (name, exports) => { require.cache[require.resolve(name)] = { id: name, filename: name, loaded: true, exports } }

stub('firebase-admin/app', {
  getApps: () => [],
  getApp: () => ({}),
  initializeApp: () => ({ options: { credential: { getAccessToken: async () => ({ access_token: 'x' }) } } }),
  cert: () => ({}),
})
stub('firebase-admin/database', {
  getDatabase: () => ({ ref: path => refFor(path || '') }),
})

/* ---- 1. dono store ke method ek jaise ---- */

console.log('\ndono roop ek jaise hain')

const { createStore } = require('../api/_parent-store.js')
const firebase = createStore()
check('firebase store bana', firebase.backend === 'firebase', firebase.backend)

// Supabase roop alag se banate hain (createStore ek hi cache karta hai), sirf
// method ke naam milane ke liye — koi query nahi chalti.
const storeSource = require('node:fs').readFileSync(new URL('../api/_parent-store.js', import.meta.url), 'utf8')
const supabaseMethods = [...storeSource.matchAll(/^\s{4}(?:async )?(\w+)[:(]/gm)].map(m => m[1])
  .filter(name => name !== 'backend')

const firebaseMethods = Object.keys(firebase).filter(k => k !== 'backend')
const missing = firebaseMethods.filter(m => !supabaseMethods.includes(m))
check('firebase ka har method supabase me bhi hai', missing.length === 0, missing.join(', '))
check('store me kaafi method hain', firebaseMethods.length >= 18, String(firebaseMethods.length))

/* ---- 2. login poore students node ko haath na lagaye ---- */

console.log('\nlogin ka raasta')

const { ensureParent } = require('../api/parent-portal.js').__internals

data['schools/S1/parents/9000000001'] = { id: '9000000001', name: 'P', students: { stu1: true }, status: 'active' }
data['schools/S1/students/stu1'] = { full_name: 'Bachcha', dob: '2015-03-15' }

touched.length = 0
const ensured = await ensureParent(firebase, 'S1', '9000000001', 'CODE99')

check('parent aur bachcha mile', ensured?.parentId === '9000000001' && Boolean(ensured.students.stu1))
check('poora students node kabhi nahi manga', !touched.includes('GET schools/S1/students'), touched.join(' | '))
check('bachcha ek-ek karke padha gaya', touched.includes('GET schools/S1/students/stu1'))
check('list na badle to kuch likha nahi jaata', !touched.some(t => t.startsWith('SET') || t.startsWith('UPDATE')), touched.join(' | '))

// parentStudentIndex me naya bachcha aaye to list update honi chahiye
data['schools/S1/parentStudentIndex/9000000001'] = { stu1: true, stu2: true }
data['schools/S1/students/stu2'] = { full_name: 'Doosra', dob: '2016-01-01' }
touched.length = 0
await ensureParent(firebase, 'S1', '9000000001', 'CODE99')
check('naya bachcha judne par list update hoti hai', touched.includes('UPDATE schools/S1/parents/9000000001'), touched.join(' | '))

/* ---- 3. path wahi hain jo pehle the ---- */

console.log('\npath jaise the waise hain')

touched.length = 0
await firebase.session('S1', '9000000001', 'tok')
check('session path', touched[0] === 'GET schools/S1/parentSessions/9000000001/tok', touched[0])

touched.length = 0
await firebase.touchSession('S1', '9000000001', 'tok', 123)
check('touchSession path', touched[0] === 'SET schools/S1/parentSessions/9000000001/tok/expiresAt', touched[0])

touched.length = 0
await firebase.loginAttempts('S1', '9000000001')
check('loginAttempts path', touched[0] === 'GET schools/S1/parentLoginAttempts/9000000001', touched[0])

touched.length = 0
await firebase.byStudent('S1', 'fees', 'stu1')
check('byStudent query', touched[0] === 'QUERY schools/S1/fees studentId=stu1', touched[0])

touched.length = 0
await firebase.byParent('S1', 'parentNotifications', '9000000001')
check('byParent query', touched[0] === 'QUERY schools/S1/parentNotifications parentId=9000000001', touched[0])

touched.length = 0
await firebase.node('S1', 'feeManager/structures')
check('feeManager/structures path', touched[0] === 'GET schools/S1/feeManager/structures', touched[0])

touched.length = 0
await firebase.push('S1', 'leaveRequests', 'lr1', { reason: 'x' })
check('push path', touched[0] === 'SET schools/S1/leaveRequests/lr1', touched[0])

touched.length = 0
await firebase.markNotificationsRead('S1', ['n1', 'n2'])
check('markRead ek hi multi-path update hai', touched.length === 1 && touched[0] === 'UPDATE ', touched.join(' | '))
check('markRead dono ids bhejta hai',
  data['']?.['schools/S1/parentNotifications/n1/isRead'] === true && data['']?.['schools/S1/parentNotifications/n2/isRead'] === true)

touched.length = 0
await firebase.photoUrl('S1', 'stu1')
check('photo path', touched[0] === 'GET studentPhotos/S1/stu1', touched[0])

console.log(`\n${pass} pass, ${failures.length} fail`)
if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`)
  process.exitCode = 1
}

// ============================================================
// test-parent-store.mjs — parent portal Supabase par
//
//   node supabase/test-parent-store.mjs
//
// Do hisse hain:
//
// 1. Naksha na bighde — api/_parent-store.js ka NODE_TABLES aur browser wale
//    src/lib/nodeMap.js ka naksha ek jaisa rehna chahiye. Ek jagah table jude
//    aur doosri jagah na jude, to ek hi cheez do jagah likhi jayegi: admin ko
//    table me dikhegi, parent ko kv me. Ye jaanch wahi rokti hai.
//
// 2. Poora handler chal ke dikhe — asli api/parent-portal.js ko nakli
//    request/response ke saath bulaya jaata hai: login, data, setPassword,
//    leaveRequest, message, certificateRequest, markRead, forgot.
//
// Saara likhna-padhna KHAALI "NXT OpenERP" school me hota hai (0 students,
// 0 parents) aur ant me poora mita diya jaata hai. Kisi asli school ka data
// chhua nahi jaata — Northstar par sirf padha jaata hai.
// ============================================================

import { createRequire } from 'node:module'
import crypto from 'node:crypto'
import { connect, loadEnv } from './db.mjs'

loadEnv()
// Store require hote hi flag padh leta hai, isliye pehle set karna zaroori hai.
process.env.USE_SUPABASE = 'true'

const require = createRequire(import.meta.url)

const SANDBOX = { uuid: '730ccc38-9302-e5c5-b92b-190b79fc761f', legacy: 'JfaU8V51U1cxkLqZRFzzbLdGhGD3', code: 'NXTOPE635' }
const LIVE = { legacy: 'Xmq2xF1zB2bnVWpFbNMH84l1dne2', code: 'NORPUB637' }

const stamp = Date.now()
const STUDENT = `test_stu_${stamp}`
const PHONE = '9000000001'
const DOB = '2015-03-15'
const DOB_PASSWORD = '15032015'

let pass = 0
const failures = []

const check = (name, ok, detail = '') => {
  if (ok) { pass += 1; console.log(`  ok   ${name}`) }
  else { failures.push(`${name}${detail ? ` — ${detail}` : ''}`); console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`) }
}

/* ------------------------------------------------------------------ */
/* 1. naksha na bighde                                                 */
/* ------------------------------------------------------------------ */

console.log('\nnaksha (store <-> nodeMap)')

const { NODE_TABLES, COMPOSITE } = require('../api/_parent-store.js')
const nodeMap = await import('../src/lib/nodeMap.js')

for (const [node, def] of Object.entries(NODE_TABLES)) {
  const browser = nodeMap.NODES[node] || nodeMap.SUB_NODES[node]
  check(`${node} -> ${def.table}`, browser?.table === def.table,
    browser ? `nodeMap kehta hai ${browser.table}` : 'nodeMap me hai hi nahi')
}

// Ulti taraf: jo node parent portal padhta hai aur nodeMap me table hai, wo
// store me chhoot na jaye — chhootne par wo chupchaap kv me chala jaata.
for (const node of ['fees', 'attendance', 'reportCards', 'certificates', 'leaveRequests', 'parentNotifications', 'homework', 'notices', 'students', 'parents']) {
  check(`${node} store me hai`, Boolean(NODE_TABLES[node]))
}
check('feeManager/structures store me hai', Boolean(NODE_TABLES['feeManager/structures']))
check('transport composite hai', COMPOSITE.transport?.allocations === 'transport_allocations')

// Jinki table nahi, wo dono jagah kv me hi jaane chahiye.
for (const node of ['certificateRequests', 'parentMessages', 'timetable', 'library']) {
  check(`${node} kv me (dono jagah)`, !NODE_TABLES[node] && nodeMap.isKvNode(node))
}

/* ------------------------------------------------------------------ */
/* 2. seed                                                             */
/* ------------------------------------------------------------------ */

const { client } = await connect()

const cleanup = async () => {
  await client.query(`delete from leave_requests where school_id = $1 and legacy_id like 'leave_req_%'`, [SANDBOX.uuid])
  await client.query(`delete from parent_notifications where school_id = $1`, [SANDBOX.uuid])
  await client.query(`delete from parents where school_id = $1 and legacy_id = $2`, [SANDBOX.uuid, PHONE])
  await client.query(`delete from students where school_id = $1 and legacy_id = $2`, [SANDBOX.uuid, STUDENT])
  await client.query(`delete from kv where school_id = $1 and path in ('parentStudentIndex','parentSessions','parentLoginAttempts','parentMessages','certificateRequests')`, [SANDBOX.uuid])
}

await cleanup()

await client.query(
  `insert into students (school_id, legacy_id, full_name, class_name, section, date_of_birth, parent_login_phone, active, source)
   values ($1, $2, 'Test Child', '5', 'A', $3, $4, true, $5)`,
  [SANDBOX.uuid, STUDENT, DOB, PHONE, JSON.stringify({
    id: STUDENT, full_name: 'Test Child', class_name: '5', section: 'A',
    dob: DOB, admission_number: 'T-1', parent_login_phone: PHONE, father_name: 'Test Parent',
  })]
)

// parentStudentIndex admissions likhta hai; login usi se bachche dhoondhta hai.
await client.query(
  `insert into kv (school_id, path, value) values ($1, 'parentStudentIndex', $2)
   on conflict (school_id, path) do update set value = excluded.value`,
  [SANDBOX.uuid, JSON.stringify({ [PHONE]: { [STUDENT]: true } })]
)

/* ------------------------------------------------------------------ */
/* 3. handler                                                          */
/* ------------------------------------------------------------------ */

const handler = require('../api/parent-portal.js')
const { createStore } = require('../api/_parent-store.js')

const call = async body => {
  let payload = null
  let code = 0
  const response = {
    status(value) { code = value; return this },
    json(value) { payload = value; return this },
  }
  await handler({ method: 'POST', body }, response)
  return { code, ...payload }
}

console.log('\nstore backend')
check('supabase store bana', createStore().backend === 'supabase', createStore().backend)

console.log('\nlogin')

const badCode = await call({ action: 'login', schoolCode: 'ZZZZZZ99', phone: PHONE, password: DOB_PASSWORD })
check('galat school code rukta hai', badCode.ok !== true && /Invalid School Code/.test(badCode.error || ''))

const unknown = await call({ action: 'login', schoolCode: SANDBOX.code, phone: '9111111119', password: DOB_PASSWORD })
check('anjaan phone rukta hai', unknown.ok !== true && /not registered/.test(unknown.error || ''))

const wrong = await call({ action: 'login', schoolCode: SANDBOX.code, phone: PHONE, password: '01011999' })
check('galat password rukta hai', wrong.ok !== true && /Incorrect password/.test(wrong.error || ''))

const attempts = await client.query(`select value from kv where school_id = $1 and path = 'parentLoginAttempts'`, [SANDBOX.uuid])
check('failed attempt ginta hai', attempts.rows[0]?.value?.[PHONE]?.failed === 1, JSON.stringify(attempts.rows[0]?.value))

const login = await call({ action: 'login', schoolCode: SANDBOX.code, phone: PHONE, password: DOB_PASSWORD })
check('DOB se login hota hai', login.ok === true, login.error)
check('session token milta hai', typeof login.sessionToken === 'string' && login.sessionToken.length === 64)
check('schoolId legacy id hai', login.schoolId === SANDBOX.legacy, String(login.schoolId))
check('parentId 10 digit phone hai', login.parentId === PHONE)

const attemptsAfter = await client.query(`select value from kv where school_id = $1 and path = 'parentLoginAttempts'`, [SANDBOX.uuid])
check('kaamyaab login par ginti mit jaati hai', attemptsAfter.rows[0]?.value?.[PHONE] === undefined)

const created = await client.query(`select source, name, phone, must_change_password from parents where school_id = $1 and legacy_id = $2`, [SANDBOX.uuid, PHONE])
check('parent account ban gaya', created.rows.length === 1)
check('parent ke columns bhare hain', created.rows[0]?.phone === PHONE && created.rows[0]?.must_change_password === true)
check('parent ki students list source me hai', created.rows[0]?.source?.students?.[STUDENT] === true, JSON.stringify(created.rows[0]?.source?.students))
check('lastLogin darj hua', Number(created.rows[0]?.source?.lastLogin) > 0)

console.log('\npayload')

const data = login.data || {}
check('school profile aaya', data.school?.schoolCode === SANDBOX.code, JSON.stringify(data.school?.schoolCode))
check('bachcha payload me hai', data.students?.length === 1 && data.students[0].id === STUDENT)
check('selectedStudent set hai', data.selectedStudent?.id === STUDENT)
check('class saaf shakal me hai', data.selectedStudent?.className === '5-A', data.selectedStudent?.className)
check('khaali node array hai, undefined nahi', Array.isArray(data.attendance) && Array.isArray(data.fees) && Array.isArray(data.notifications))
check('transport khaali object hai', data.transport && typeof data.transport.allocation === 'object')
check('library ke dono hisse hain', Array.isArray(data.library?.fines) && Array.isArray(data.library?.issues))

const session = { schoolId: login.schoolId, parentId: login.parentId, sessionToken: login.sessionToken }

const refetch = await call({ action: 'data', ...session })
check('data action chalta hai', refetch.ok === true, refetch.error)
check('data action wahi bachcha deta hai', refetch.data?.selectedStudent?.id === STUDENT)

const stale = await call({ action: 'data', ...session, sessionToken: crypto.randomBytes(32).toString('hex') })
check('nakli token rukta hai', stale.ok !== true && /session expired/i.test(stale.error || ''))

console.log('\nwrites')

const weak = await call({ action: 'setPassword', ...session, password: 'abcdefgh' })
check('kamzor password rukta hai', weak.ok !== true && /8\+ chars/.test(weak.error || ''))

const sameAsDob = await call({ action: 'setPassword', ...session, password: `Aa${DOB_PASSWORD}` })
check('DOB wala password rukta hai', sameAsDob.ok !== true, sameAsDob.error)

const setPassword = await call({ action: 'setPassword', ...session, password: 'Testing123' })
check('naya password lag gaya', setPassword.ok === true, setPassword.error)

const hashed = await client.query(`select source, must_change_password, password_set_at from parents where school_id = $1 and legacy_id = $2`, [SANDBOX.uuid, PHONE])
check('scrypt hash bana', String(hashed.rows[0]?.source?.passwordHash || '').startsWith('scrypt$'))
check('mustChangePassword hat gaya', hashed.rows[0]?.must_change_password === false)
check('passwordSetAt column me utra', Boolean(hashed.rows[0]?.password_set_at))
check('purane fields bache hue hain', hashed.rows[0]?.source?.students?.[STUDENT] === true)

const withNew = await call({ action: 'login', schoolCode: SANDBOX.code, phone: PHONE, password: 'Testing123' })
check('naye password se login hota hai', withNew.ok === true, withNew.error)

const leave = await call({
  action: 'leaveRequest', ...session, studentId: STUDENT,
  fromDate: '2026-08-10', toDate: '2026-08-11', reason: 'bukhar hai',
})
check('leave request lag gayi', leave.ok === true, leave.error)

// from_date ko text me hi maangte hain: pg `date` ko local-time Date banata hai,
// aur IST me toISOString() use ek din peeche khisak deta hai.
const leaveRow = await client.query(`select legacy_id, student_id, class_section, to_char(from_date, 'YYYY-MM-DD') from_date, status, source from leave_requests where school_id = $1`, [SANDBOX.uuid])
check('leave_requests table me utri', leaveRow.rows.length === 1)
check('student_id juda hua', Boolean(leaveRow.rows[0]?.student_id))
check('classSection column me hai (teacher isi se chhaanta hai)', leaveRow.rows[0]?.class_section === '5-A', leaveRow.rows[0]?.class_section)
check('from_date column me hai', leaveRow.rows[0]?.from_date === '2026-08-10', leaveRow.rows[0]?.from_date)
check('poora document source me hai', leaveRow.rows[0]?.source?.reason === 'bukhar hai')

const otherChild = await call({
  action: 'leaveRequest', ...session, studentId: 'student_kisi_aur_ka',
  fromDate: '2026-08-10', toDate: '2026-08-11', reason: 'bahana',
})
check('doosre bachche par leave nahi lag sakti', otherChild.ok !== true && /not linked/.test(otherChild.error || ''))

const badDate = await call({ action: 'leaveRequest', ...session, studentId: STUDENT, fromDate: '2026-08-12', toDate: '2026-08-10', reason: 'ulta' })
check('ulti tareekh rukti hai', badDate.ok !== true)

const message = await call({ action: 'message', ...session, studentId: STUDENT, subject: 'test', message: 'namaste' })
check('message bhej gaya', message.ok === true, message.error)

const messageRow = await client.query(`select value from kv where school_id = $1 and path = 'parentMessages'`, [SANDBOX.uuid])
check('message kv me utra', Object.values(messageRow.rows[0]?.value || {})[0]?.message === 'namaste')

const certReq = await call({ action: 'certificateRequest', ...session, studentId: STUDENT, certificateType: 'character', purpose: 'bank' })
check('certificate request lag gayi', certReq.ok === true, certReq.error)

const certRow = await client.query(`select value from kv where school_id = $1 and path = 'certificateRequests'`, [SANDBOX.uuid])
const certDoc = Object.values(certRow.rows[0]?.value || {})[0]
check('certificate request kv me utri', certDoc?.certificateType === 'character')
check('certificate request me studentName bhara', certDoc?.studentName === 'Test Child', certDoc?.studentName)

const afterWrites = await call({ action: 'data', ...session })
check('naye records wapas payload me dikhte hain',
  afterWrites.data?.leaveRequests?.length === 1 && afterWrites.data?.messages?.length === 1 && afterWrites.data?.certificateRequests?.length === 1,
  `leave ${afterWrites.data?.leaveRequests?.length} msg ${afterWrites.data?.messages?.length} cert ${afterWrites.data?.certificateRequests?.length}`)

console.log('\nnotifications')

const parentUuid = (await client.query(`select id from parents where school_id = $1 and legacy_id = $2`, [SANDBOX.uuid, PHONE])).rows[0].id
await client.query(
  `insert into parent_notifications (school_id, legacy_id, parent_id, type, title, body, read, source)
   values ($1, 'notif_test', $2, 'account', 'Test', 'namaste', false, $3)`,
  [SANDBOX.uuid, parentUuid, JSON.stringify({ id: 'notif_test', type: 'account', title: 'Test', message: 'namaste', isRead: false, parentId: PHONE, createdAt: stamp })]
)

const withNotif = await call({ action: 'data', ...session })
check('notification payload me aayi', withNotif.data?.notifications?.length === 1, JSON.stringify(withNotif.data?.notifications?.length))
check('notification abhi unread hai', withNotif.data?.notifications?.[0]?.isRead === false)

const markRead = await call({ action: 'markRead', ...session, ids: ['notif_test'] })
check('markRead chala', markRead.ok === true, markRead.error)

const readRow = await client.query(`select read, source from parent_notifications where school_id = $1 and legacy_id = 'notif_test'`, [SANDBOX.uuid])
check('isRead source me lag gaya (portal isi ko padhta hai)', readRow.rows[0]?.source?.isRead === true)
check('read column bhi lag gaya', readRow.rows[0]?.read === true)
check('notification ka baaki content bacha hai', readRow.rows[0]?.source?.message === 'namaste')

const profileUpdate = await call({ action: 'updateProfile', ...session, name: 'Naya Naam', email: 'a@b.com', address: 'gali 4', language: 'hindi' })
check('profile update chala', profileUpdate.ok === true, profileUpdate.error)

const updated = await client.query(`select name, language, email, source from parents where school_id = $1 and legacy_id = $2`, [SANDBOX.uuid, PHONE])
check('naam column me utra', updated.rows[0]?.name === 'Naya Naam')
check('language column me utri', updated.rows[0]?.language === 'hindi')
check('password hash update se nahi uda', String(updated.rows[0]?.source?.passwordHash || '').startsWith('scrypt$'))

console.log('\nforgot')

// Reset ab bachche ki DOB proof maangta hai. Pehle sirf school code + phone se
// chal jaata tha — dono public — to koi bhi kisi bhi parent ka password uda
// sakta tha. Galat DOB pehle jaanchte hain, warna sahi wala counter reset kar
// deta aur ye check kuch sabit nahi karta.
const forgotWrongDob = await call({ action: 'forgot', schoolCode: SANDBOX.code, phone: PHONE, dob: '01011999' })
check('galat DOB par forgot ruk gaya', forgotWrongDob.ok !== true, JSON.stringify(forgotWrongDob))

const stillSet = await client.query(`select source from parents where school_id = $1 and legacy_id = $2`, [SANDBOX.uuid, PHONE])
check('galat DOB ne password nahi uda', String(stillSet.rows[0]?.source?.passwordHash || '').startsWith('scrypt$'))

const forgot = await call({ action: 'forgot', schoolCode: SANDBOX.code, phone: PHONE, dob: DOB_PASSWORD })
check('sahi DOB par forgot chala', forgot.ok === true, forgot.error)

const reset = await client.query(`select source, must_change_password from parents where school_id = $1 and legacy_id = $2`, [SANDBOX.uuid, PHONE])
check('passwordHash hat gaya (null = mitao)', reset.rows[0]?.source?.passwordHash === undefined, JSON.stringify(reset.rows[0]?.source?.passwordHash))
check('mustChangePassword wapas true', reset.rows[0]?.must_change_password === true)
check('forgot ne bachche nahi ude', reset.rows[0]?.source?.students?.[STUDENT] === true)

const backToDob = await call({ action: 'login', schoolCode: SANDBOX.code, phone: PHONE, password: DOB_PASSWORD })
check('reset ke baad DOB se login hota hai', backToDob.ok === true, backToDob.error)

console.log('\nsession ek doosre ko mitate nahi')

// Ek hi school ke saare sessions ek hi kv row me hain. Read-modify-write karte
// to saath me aaye do login me se ek gum ho jaata; kv_deep_set isi se bachata hai.
const parallel = await Promise.all([1, 2, 3, 4, 5].map(() =>
  call({ action: 'login', schoolCode: SANDBOX.code, phone: PHONE, password: DOB_PASSWORD })))
check('paanchon login kaamyaab', parallel.every(r => r.ok === true))

const sessionRow = await client.query(`select value from kv where school_id = $1 and path = 'parentSessions'`, [SANDBOX.uuid])
const tokens = Object.keys(sessionRow.rows[0]?.value?.[PHONE] || {})
check('paanchon session bache hain', parallel.every(r => tokens.includes(r.sessionToken)), `${tokens.length} token mile`)

console.log('\nasli school par sirf padhna (Northstar)')

const store = createStore()
check('school code se legacy id milti hai', await store.schoolIdByCode(LIVE.code) === LIVE.legacy)
const liveProfile = await store.profile(LIVE.legacy)
check('profile padha ja saka', liveProfile?.schoolCode === LIVE.code, liveProfile?.schoolCode)

const liveParent = await store.parent(LIVE.legacy, '9313461891')
check('asli parent mila', Boolean(liveParent?.students), JSON.stringify(Object.keys(liveParent || {})))

const liveKid = Object.keys(liveParent?.students || {})[0]
const liveAttendance = await store.byStudent(LIVE.legacy, 'attendance', liveKid)
const attendanceKeys = Object.keys(liveAttendance)
check('attendance mili', attendanceKeys.length > 0, `${attendanceKeys.length} rows`)
check('attendance ki key `date_studentId` hai', attendanceKeys.every(k => k.endsWith(`_${liveKid}`)), attendanceKeys[0])
check('attendance ke record me date aur status hain', attendanceKeys.every(k => liveAttendance[k].date && liveAttendance[k].status))

const liveNotifs = await store.byParent(LIVE.legacy, 'parentNotifications', '9313461891')
check('notifications parent se judi hain', Object.values(liveNotifs).every(row => row.parentId === '9313461891'), `${Object.keys(liveNotifs).length} rows`)

const liveStructures = await store.node(LIVE.legacy, 'feeManager/structures')
check('fee structures aayin', Object.keys(liveStructures || {}).length > 0, `${Object.keys(liveStructures || {}).length}`)

const liveTransport = await store.node(LIVE.legacy, 'transport')
check('transport me allocations ki key hai', liveTransport && typeof liveTransport.allocations === 'object')

/* ------------------------------------------------------------------ */

console.log('\nsafai')
await cleanup()
const left = await client.query(
  `select (select count(*) from students where school_id = $1) s,
          (select count(*) from parents where school_id = $1) p,
          (select count(*) from leave_requests where school_id = $1) l,
          (select count(*) from parent_notifications where school_id = $1) n,
          (select count(*) from kv where school_id = $1) k`, [SANDBOX.uuid])
check('sandbox phir se khaali hai', Object.values(left.rows[0]).every(v => Number(v) === 0), JSON.stringify(left.rows[0]))

await client.end()

console.log(`\n${pass} pass, ${failures.length} fail`)
if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`)
  process.exitCode = 1
}

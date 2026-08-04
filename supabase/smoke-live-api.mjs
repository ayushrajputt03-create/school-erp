// Live smoke test: parent portal + staff login ko asli HTTP endpoints par
// chala kar dekhta hai. Baaki test-*.mjs store ko seedha call karte hain; ye
// pura request path check karta hai. PII kabhi print nahi karta — sirf pass/fail
// aur payload ka shape.
//
// Pehle `node supabase/dev-api-server.mjs` chalao, phir ye.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = {}
for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
  if (m) env[m[1]] = m[2]
}

const db = createClient(env.SUPABASE_URL || env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// Default local dev server; SMOKE_BASE se production par bhi chala sakte hain.
const BASE = process.env.SMOKE_BASE || 'http://localhost:3000'
const post = async (path, body) => {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  let json = null
  try { json = await r.json() } catch { /* html error page */ }
  return { status: r.status, json }
}

// DOB ko default-password format me badalna (DDMMYYYY), jaisa dobVariants karta hai.
const ddmmyyyy = (dob) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dob || ''))
  return m ? `${m[3]}${m[2]}${m[1]}` : null
}

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const { data: school } = await db.from('schools').select('id, code').eq('code', 'NORPUB637').single()
const schoolCode = school.code

/* ---------------------------------------------------------------- */
/* 1. Parent portal                                                   */
/* ---------------------------------------------------------------- */
// Parent<->student link kv/parentStudentIndex me hai, par student row par
// parent_login_phone bhi hota hai — test account chunne ke liye wahi kaafi hai.
const { data: kids } = await db
  .from('students')
  .select('legacy_id, parent_login_phone, date_of_birth')
  .eq('school_id', school.id)
  .is('deleted_at', null)
  .not('parent_login_phone', 'is', null)
  .not('date_of_birth', 'is', null)

// Ek hi phone par kai bachche ho sakte hain; portal sabse bade ki DOB maangta hai.
const byPhone = new Map()
for (const k of kids || []) {
  const list = byPhone.get(k.parent_login_phone) || []
  list.push(k)
  byPhone.set(k.parent_login_phone, list)
}

let parentCase = null
for (const [phone, list] of byPhone) {
  const eldest = list.sort((a, b) => String(a.date_of_birth).localeCompare(String(b.date_of_birth)))[0]
  const pw = ddmmyyyy(eldest.date_of_birth)
  if (String(phone).length === 10 && pw) {
    parentCase = { phone, password: pw, kidCount: list.length }
    break
  }
}

if (!parentCase) {
  check('parent: usable test account mila', false, 'koi parent DOB-linked child ke saath nahi')
} else {
  const login = await post('/api/parent-portal', {
    action: 'login', schoolCode, phone: parentCase.phone, password: parentCase.password,
  })
  check('parent login 200', login.status === 200, login.json?.error || `status ${login.status}`)
  const tok = login.json?.sessionToken
  check('parent session token mila', Boolean(tok))
  const d = login.json?.data
  check('parent login payload me data', Boolean(d), d ? `keys: ${Object.keys(d).join(',')}` : '')
  check('parent ke children aaye', Array.isArray(d?.students) && d.students.length > 0,
    `count ${d?.students?.length ?? 0}`)

  if (tok) {
    const dataCall = await post('/api/parent-portal', {
      action: 'data', schoolCode, sessionToken: tok, parentId: login.json.parentId, schoolId: login.json.schoolId,
    })
    check('parent data action 200', dataCall.status === 200, dataCall.json?.error || `status ${dataCall.status}`)
    const dd = dataCall.json?.data
    check('data payload me student list', Array.isArray(dd?.students) && dd.students.length > 0)
    const photo = dd?.students?.[0]?.photoUrl || dd?.students?.[0]?.photo || ''
    check('student photo signed URL hai (ya khaali)', !photo || photo.startsWith('http'),
      photo ? (photo.includes('token=') ? 'signed' : photo.slice(0, 24)) : 'photo nahi hai')
  }

  const bad = await post('/api/parent-portal', {
    action: 'login', schoolCode, phone: parentCase.phone, password: '00000000',
  })
  check('galat password reject hua', bad.status >= 400, `status ${bad.status}`)
}

/* ---------------------------------------------------------------- */
/* 2. Staff login                                                     */
/* ---------------------------------------------------------------- */
const { data: staff } = await db
  .from('staff')
  .select('legacy_id, phone, dob')
  .eq('school_id', school.id)
  .not('phone', 'is', null)
  .not('dob', 'is', null)

const staffCase = (staff || []).map(s => ({ phone: s.phone, password: ddmmyyyy(s.dob) })).find(s => s.password)

if (!staffCase) {
  check('staff: usable test account mila', false, 'kisi staff ke paas phone+dob dono nahi')
} else {
  const login = await post('/api/teacher-login', {
    schoolCode, phone: staffCase.phone, password: staffCase.password,
  })
  check('staff login 200', login.status === 200, login.json?.error || `status ${login.status}`)
  check('staff grant mila (magic link ya token)',
    Boolean(login.json?.tokenHash || login.json?.token || login.json?.actionLink),
    `grant keys: ${Object.keys(login.json || {}).filter(k => /token|link/i.test(k)).join(',') || 'none'}`)
  check('staff profile aaya', Boolean(login.json?.employee?.name || login.json?.employee?.id))

  const bad = await post('/api/teacher-login', { schoolCode, phone: staffCase.phone, password: '00000000' })
  check('staff galat DOB reject hua', bad.status === 401, `status ${bad.status}`)

  const noSchool = await post('/api/teacher-login', { schoolCode: 'ZZZZZZ99', phone: staffCase.phone, password: staffCase.password })
  check('galat school code reject hua', noSchool.status === 404, `status ${noSchool.status}`)
}

/* ---------------------------------------------------------------- */
/* 3. Public admission form                                           */
/* ---------------------------------------------------------------- */
// Ye section isliye hai ki cutover me `api/admission.js` chhoot gaya tha —
// wo Firebase me likhta raha jabki admin ka queue Supabase se padhta hai.
// Form "ok" lautata tha, parent ko receipt milti thi, aur request kabhi
// dikhti nahi thi. Sirf `ok: true` dekhna is bug ko nahi pakadta — isliye
// neeche likhi hui row Supabase me sach me DHOONDHI jaati hai.
{
  const SANDBOX = 'JfaU8V51U1cxkLqZRFzzbLdGhGD3'      // NXT OpenERP, khaali
  const { data: sandbox } = await db.from('schools').select('id').eq('legacy_id', SANDBOX).maybeSingle()

  const identity = await post('/api/admission', { action: 'school', schoolId: SANDBOX })
  check('admission: school identity 200', identity.status === 200, identity.json?.error || `status ${identity.status}`)
  check('admission: school mila', identity.json?.found === true && Boolean(identity.json?.schoolName))

  const marker = `Smoke Test ${Date.now()}`
  const submit = await post('/api/admission', {
    action: 'submit', schoolId: SANDBOX,
    studentName: marker, dob: '2018-04-12', parentPhone: '9000000001',
    classAppliedFor: '1', fatherName: 'Smoke Father',
  })
  check('admission: submit 200', submit.status === 200 && submit.json?.ok === true,
    submit.json?.error || `status ${submit.status}`)

  // Asli assertion — row Supabase me pahunchi ya nahi
  const { data: landed } = await db.from('admission_requests')
    .select('legacy_id, student_name, status, source')
    .eq('school_id', sandbox.id).eq('student_name', marker).maybeSingle()
  check('admission: request SUPABASE me pahunchi', Boolean(landed),
    landed ? '' : 'submit ne ok bola par row Supabase me nahi hai (Firebase me gayi?)')
  check('admission: status pending hai', landed?.status === 'pending', `status ${landed?.status}`)
  check('admission: source me poora document hai (admin isi se padhta hai)',
    landed?.source?.studentName === marker && Boolean(landed?.source?.submittedAt),
    `source keys: ${Object.keys(landed?.source || {}).join(',') || 'none'}`)

  const badPhone = await post('/api/admission', {
    action: 'submit', schoolId: SANDBOX,
    studentName: 'Bad Phone', dob: '2018-04-12', parentPhone: '123', classAppliedFor: '1',
  })
  check('admission: chhota phone reject hua', badPhone.status >= 400, `status ${badPhone.status}`)

  const honeypot = await post('/api/admission', {
    action: 'submit', schoolId: SANDBOX, applicantRef: 'bot',
    studentName: 'Bot Entry', dob: '2018-04-12', parentPhone: '9000000002', classAppliedFor: '1',
  })
  const { count: botRows } = await db.from('admission_requests')
    .select('legacy_id', { count: 'exact', head: true })
    .eq('school_id', sandbox.id).eq('student_name', 'Bot Entry')
  check('admission: honeypot chup-chaap gira, likha nahi',
    honeypot.json?.ok === true && botRows === 0, `rows: ${botRows}`)

  // sandbox saaf
  await db.from('admission_requests').delete().eq('school_id', sandbox.id).like('legacy_id', 'adm_req_%')
  await db.from('kv').delete().eq('school_id', sandbox.id).eq('path', 'admissionThrottle')
}

const failed = results.filter(r => !r.ok).length
console.log(`\n${results.length - failed} pass, ${failed} fail`)
process.exit(failed ? 1 : 0)

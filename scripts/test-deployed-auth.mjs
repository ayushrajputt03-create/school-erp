import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { connect } from '../supabase/db.mjs'

const deployment = process.argv[2]
if (!/^https:\/\/northstar-school-[a-z0-9-]+\.vercel\.app$/.test(deployment || '')) throw new Error('Pass the protected deployment URL.')
const { client } = await connect()
const school = crypto.randomUUID()
const legacy = `sec_e2e_${school}`
const staffId = `staff_${school}`
const code = `SEC${crypto.randomBytes(5).toString('hex').toUpperCase()}`
const phone = `9${String(crypto.randomInt(100000000, 999999999))}`
const password = `Test-${crypto.randomBytes(18).toString('hex')}`
const staffEmail = `${staffId}@${code.toLowerCase()}.staff.schoolerp.app`

function request(path, { method = 'POST', body, token, cookie } = {}) {
  const config = ['silent', 'include', `request = "${method}"`, 'header = "Content-Type: application/json"']
  if (body) config.push(`data = ${JSON.stringify(JSON.stringify(body))}`)
  if (token) config.push(`header = ${JSON.stringify(`Authorization: Bearer ${token}`)}`)
  if (cookie) config.push(`header = ${JSON.stringify(`Cookie: ${cookie}`)}`)
  const command = `npx.cmd --yes vercel curl ${path} --deployment ${deployment} --scope team_2hFmf0aehnQZhjSLiVnnMS8v -- --config -`
  const result = spawnSync(command, { shell: true, input: config.join('\n'), encoding: 'utf8', timeout: 120000 })
  if (result.status !== 0) throw new Error(`Deployment request failed: ${path}`)
  const text = result.stdout.trim()
  const split = text.lastIndexOf('\r\n\r\n') >= 0 ? '\r\n\r\n' : '\n\n'
  const parts = text.split(split)
  const data = JSON.parse(parts.pop())
  const headers = parts.join('\n')
  return { status: Number([...headers.matchAll(/HTTP\/[^ ]+ (\d+)/g)].at(-1)?.[1]), data,
    cookie: headers.match(/^set-cookie:\s*(erp_parent_session=[^;]+)/im)?.[1] }
}

try {
  await client.query('insert into schools(id,legacy_id,name,code,source) values($1,$2,$3,$4,$5)',
    [school, legacy, 'Security Test - Disposable', code, { profile: { schoolName: 'Security Test - Disposable', schoolCode: code } }])
  await client.query('insert into staff(school_id,legacy_id,first_name,phone,dob,employee_role,assigned_classes,source) values($1,$2,$3,$4,$5,$6,$7,$8)',
    [school, staffId, 'Test Teacher', phone, '1990-03-15', 'teacher', '5', { firstName: 'Test Teacher', phone, dob: '1990-03-15', employeeRole: 'teacher', assignedClasses: '5', active: true }])
  await client.query("insert into students(school_id,legacy_id,full_name,class_name,father_phone,source) values($1,'child','Test Child','5',$2,$3)",
    [school, phone, { full_name: 'Test Child', class_name: '5', section: 'A', dob: '2015-03-15', father_phone: phone }])
  await client.query('insert into parents(school_id,legacy_id,phone,source) values($1,$2,$2,$3)',
    [school, phone, { phone, students: { child: true }, mustChangePassword: true, status: 'active' }])

  const first = request('/api/teacher-login', { body: { schoolCode: code, phone, password: '15031990' } })
  assert.equal(first.status, 200, first.data.error || 'initial staff login')
  assert.equal(first.data.mustChangePassword, true)
  const token = first.data.session.access_token
  const initial = request('/api/teacher-session', { method: 'GET', token })
  assert.equal(initial.status, 200, initial.data.error || 'staff session')
  assert.deepEqual(initial.data.students, {})
  const changed = request('/api/staff-password', { token, body: { currentPassword: '15031990', password } })
  assert.equal(changed.status, 200, changed.data.error || 'staff password change')
  const secure = request('/api/teacher-login', { body: { schoolCode: code, phone, password } })
  assert.equal(secure.status, 200, secure.data.error || 'secure staff login')
  assert.equal(secure.data.mustChangePassword, false)
  assert.equal(request('/api/teacher-login', { body: { schoolCode: code, phone, password: '15031990' } }).status, 401)
  console.log('PASS: deployed staff first login, required password change, secure login, old DOB rejected')

  const parent = request('/api/parent-portal', { body: { action: 'login', schoolCode: code, phone, password: '15032015' } })
  assert.equal(parent.status, 200, parent.data.error || 'parent login')
  assert.ok(parent.cookie)
  assert.equal(parent.data.sessionToken, undefined)
  const unauthorized = request('/api/parent-portal', { cookie: parent.cookie, body: { action: 'message', studentId: 'not-my-child', subject: 'Test', message: 'Test' } })
  assert.equal(unauthorized.status, 400)
  const malformed = request('/api/parent-portal', { cookie: parent.cookie, body: { action: 'markRead', ids: ['../../outside'] } })
  assert.equal(malformed.status, 400)
  assert.equal(request('/api/parent-portal', { cookie: parent.cookie, body: { action: 'setPassword', password } }).status, 200)
  assert.equal(request('/api/parent-portal', { body: { action: 'login', schoolCode: code, phone, password: '15032015' } }).status, 400)
  assert.equal(request('/api/parent-portal', { body: { action: 'login', schoolCode: code, phone, password } }).status, 200)
  console.log('PASS: deployed parent cookies, IDOR rejection, notification path rejection and custom password')
} finally {
  // Delete only the uniquely named fixtures created by this invocation.
  await client.query('delete from auth.users where email=$1', [staffEmail])
  await client.query('delete from schools where id=$1 and legacy_id=$2', [school, legacy])
  await client.end()
  console.log('Disposable test fixtures cleaned up.')
}

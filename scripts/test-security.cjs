const assert = require('node:assert/strict')
const { readSession, writeSession, assertSameOrigin } = require('../api/_parent-session')
const { hashPassword, verifyPassword, requireSession } = require('../api/parent-portal').__internals

async function run() {
  let cookie
  writeSession({ setHeader: (_, value) => { cookie = value } }, { schoolId: 'school', parentId: 'parent', sessionToken: 'secret' }, { headers: { 'x-forwarded-proto': 'https' } })
  assert.match(cookie, /HttpOnly/)
  assert.match(cookie, /SameSite=Strict/)
  assert.match(cookie, /Secure/)
  assert.equal(readSession({ headers: { cookie } }).sessionToken, 'secret')
  assert.deepEqual(readSession({ headers: { cookie: 'erp_parent_session=bad' } }), {})
  assert.throws(() => assertSameOrigin({ headers: { origin: 'https://attacker.example', host: 'erp.example' } }))
  const hash = await hashPassword('A strong password 123')
  assert.equal(await verifyPassword('A strong password 123', hash), true)
  assert.equal(await verifyPassword('wrong password', hash), false)
  assert.equal(await verifyPassword('anything', 'scrypt$16384$8$1$aa$'), false, 'malformed hashes must fail closed')
  assert.equal(await verifyPassword('anything', 'scrypt$1048576$8$1$aa$bb'), false, 'untrusted hash parameters cannot increase work')
  await assert.rejects(requireSession({ session: async () => ({ expiresAt: 0 }) }, { schoolId: 's', parentId: 'p', sessionToken: 'x' }), /expired/)
  await assert.rejects(requireSession({ session: async () => ({ expiresAt: Date.now() + 10000 }), parent: async () => ({ status: 'inactive' }) }, { schoolId: 's', parentId: 'p', sessionToken: 'x' }), /inactive/)
  await assert.rejects(requireSession({ session: async () => ({ createdAt: 10, expiresAt: Date.now() + 10000 }), parent: async () => ({ passwordSetAt: 20 }) }, { schoolId: 's', parentId: 'p', sessionToken: 'x' }), /expired/)
  console.log('PASS: cookie protection, origin checks, password verification and session rejection')
}
run().catch(error => { console.error(error); process.exitCode = 1 })

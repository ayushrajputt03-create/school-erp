const { createStore } = require('./_staff-store')
const { hashPassword, verifyPassword } = require('./_password')
const { verifyDobPassword } = require('./teacher-login').__internals
const { assertSameOrigin } = require('./_parent-session')
const { assertRateLimit } = require('./_rate-limit')

module.exports = async (request, response) => {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' })
  try {
    assertSameOrigin(request)
    const store = createStore()
    const caller = await store.verifyCaller(String(request.headers.authorization || '').replace(/^Bearer /, ''))
    if (!caller) return response.status(401).json({ error: 'Please sign in again.' })
    await assertRateLimit({ request, scope: 'staff-password-account', identity: caller.uid, limit: 5, windowMs: 15 * 60 * 1000 })
    const bundle = await store.staffSession(caller.uid, { monthStart: new Date().toISOString().slice(0, 7) + '-01', token: String(request.headers.authorization || '').replace(/^Bearer /, '') })
    if (!bundle?.record) return response.status(403).json({ error: 'Staff account required.' })
    const { currentPassword, password } = request.body || {}
    const credential = await store.credential(bundle.schoolId, caller.uid)
    const dob = bundle.record.dob || bundle.record.dateOfBirth || ''
    const verified = credential?.passwordHash ? await verifyPassword(currentPassword, credential.passwordHash) : verifyDobPassword(currentPassword, dob)
    if (!verified) return response.status(401).json({ error: 'Current password is incorrect.' })
    if (typeof password !== 'string' || password.length < 12 || password.length > 128 || verifyDobPassword(password, dob)) {
      return response.status(400).json({ error: 'Choose a password of 12-128 characters, different from your date of birth.' })
    }
    await store.saveCredential(bundle.schoolId, caller.uid, { passwordHash: await hashPassword(password), mustChangePassword: false, updatedAt: Date.now() })
    response.setHeader('Cache-Control', 'no-store')
    return response.status(200).json({ ok: true })
  } catch (error) {
    return response.status(error.statusCode || 500).json({ error: error.statusCode === 429 ? error.message : 'Password could not be updated.' })
  }
}

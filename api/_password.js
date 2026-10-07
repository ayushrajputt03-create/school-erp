const crypto = require('crypto')

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 }

function hashPassword(value) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16)
    crypto.scrypt(String(value || ''), salt, SCRYPT.keylen, SCRYPT, (error, derived) => {
      if (error) return reject(error)
      resolve(`scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('hex')}$${derived.toString('hex')}`)
    })
  })
}

const isLegacyHash = stored => /^[a-f0-9]{64}$/i.test(String(stored || ''))

function verifyPassword(value, stored) {
  if (typeof value !== 'string' || value.length > 128) return Promise.resolve(false)
  if (isLegacyHash(stored)) {
    const actual = crypto.createHash('sha256').update(value).digest()
    return Promise.resolve(crypto.timingSafeEqual(actual, Buffer.from(stored, 'hex')))
  }
  const parts = String(stored || '').split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt' || Number(parts[1]) !== SCRYPT.N ||
      Number(parts[2]) !== SCRYPT.r || Number(parts[3]) !== SCRYPT.p ||
      !/^[a-f0-9]{32}$/i.test(parts[4]) || !/^[a-f0-9]{128}$/i.test(parts[5])) return Promise.resolve(false)
  const expected = Buffer.from(parts[5], 'hex')
  return new Promise(resolve => {
    crypto.scrypt(value, Buffer.from(parts[4], 'hex'), SCRYPT.keylen, SCRYPT, (error, derived) => {
      resolve(!error && crypto.timingSafeEqual(derived, expected))
    })
  })
}

module.exports = { hashPassword, verifyPassword, isLegacyHash }

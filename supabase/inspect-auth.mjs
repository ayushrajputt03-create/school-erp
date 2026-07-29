// Firebase auth export ka jaayza. Emails chhupa ke dikhta hai, hashes kabhi nahi.
import fs from 'node:fs'

const file = process.argv[2]
if (!file) { console.error('usage: node supabase/inspect-auth.mjs <auth-users.json>'); process.exit(1) }

const users = JSON.parse(fs.readFileSync(file, 'utf8')).users || []
const mask = (e) => (e ? e.replace(/^(.{2}).*(@.*)$/, '$1***$2') : '(email nahi)')

console.log(`kul users          : ${users.length}`)
console.log(`password hash wale : ${users.filter((u) => u.passwordHash).length}`)
console.log(`bina hash (google) : ${users.filter((u) => !u.passwordHash).length}`)

const providers = {}
for (const u of users) for (const p of u.providerUserInfo || []) providers[p.providerId] = (providers[p.providerId] || 0) + 1
console.log(`providers          : ${JSON.stringify(providers)}`)

console.log('\nuid                          email                          hash  salt  disabled')
console.log('-'.repeat(88))
for (const u of users) {
  console.log(
    `${(u.localId || '').padEnd(28)} ${mask(u.email).padEnd(30)} ` +
    `${(u.passwordHash ? 'haan' : 'nahi').padEnd(5)} ${(u.salt ? 'haan' : 'nahi').padEnd(5)} ${u.disabled ? 'haan' : 'nahi'}`
  )
}

const sample = users.find((u) => u.passwordHash)
if (sample) {
  console.log('\nhash ka dhaancha (value nahi, sirf lambai):')
  console.log(`  passwordHash : ${Buffer.from(sample.passwordHash, 'base64').length} bytes`)
  console.log(`  salt         : ${Buffer.from(sample.salt, 'base64').length} bytes`)
}

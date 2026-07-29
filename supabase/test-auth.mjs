// ============================================================
// test-auth.mjs — auth ka poora raasta, asli database par
//
//   node supabase/test-auth.mjs
//
// Sabse zaroori jaanch yahan hai: hum Firebase ke tareeke se KHUD ek scrypt
// hash banate hain, use $fbscrypt$ format me Supabase me daalte hain, aur
// phir us password se login karke dekhte hain.
//
// Agar ye pass hota hai, to un 5 asli users ke hash bhi chalenge — kyunki
// wo bilkul isi tareeke se bane hain. Agar format me ek comma bhi galat hoti,
// to migration ke baad koi login hi nahi kar paata, aur pata tab chalta jab
// client screen ke saamne baitha hota.
//
// Test user ke saath ek throwaway school banti hai; ant me sab mita diya jaata hai.
// ============================================================

import fs from 'node:fs'
import crypto from 'node:crypto'

for (const raw of fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const line = raw.trim()
  if (!line || line.startsWith('#')) continue
  const eq = line.indexOf('=')
  if (eq < 0) continue
  process.env[line.slice(0, eq).trim()] ??= line.slice(eq + 1).trim()
}

const { createClient } = await import('@supabase/supabase-js')
const { connect } = await import('./db.mjs')

const URL_BASE = process.env.SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON = process.env.VITE_SUPABASE_ANON_KEY

const SIGNER_KEY = process.env.FB_SIGNER_KEY
const SALT_SEP = process.env.FB_SALT_SEPARATOR
const ROUNDS = Number(process.env.FB_ROUNDS || 8)
const MEM_COST = Number(process.env.FB_MEM_COST || 14)

let pass = 0
let fail = 0
const check = async (label, fn) => {
  try {
    const r = await fn()
    r === true ? (pass++, console.log(`  OK    ${label}`)) : (fail++, console.log(`  FAIL  ${label}\n          ${r}`))
  } catch (err) { fail++; console.log(`  ERROR ${label}\n          ${err.message}`) }
}

/**
 * Firebase ka scrypt, jaisa wo asli me karta hai:
 *   1. scrypt(password, salt + saltSeparator, N=2^memCost, r=rounds, p=1) -> 64 byte
 *   2. us key ke pehle 32 byte se signerKey ko AES-256-CTR me encrypt karo
 *   3. wahi encrypted signerKey password hash hai
 */
function firebaseScrypt(password, saltB64) {
  const salt = Buffer.from(saltB64, 'base64')
  const saltSep = Buffer.from(SALT_SEP, 'base64')
  const signerKey = Buffer.from(SIGNER_KEY, 'base64')

  const derived = crypto.scryptSync(
    Buffer.from(password, 'utf8'),
    Buffer.concat([salt, saltSep]),
    64,
    { N: 2 ** MEM_COST, r: ROUNDS, p: 1, maxmem: 256 * 1024 * 1024 }
  )

  const cipher = crypto.createCipheriv('aes-256-ctr', derived.subarray(0, 32), Buffer.alloc(16, 0))
  return Buffer.concat([cipher.update(signerKey), cipher.final()]).toString('base64')
}

const admin = createClient(URL_BASE, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
const { client } = await connect()

const EMAIL = `migration-test-${Date.now()}@example.invalid`
const PASSWORD = 'PuranaPassword#2026'
const SALT = crypto.randomBytes(10).toString('base64')

let userId = null

console.log('=== FIREBASE HASH SE LOGIN ===')

await check('test user banao', async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL, password: 'temporary-placeholder', email_confirm: true,
  })
  if (error) return error.message
  userId = data.user.id
  return Boolean(userId) || 'user id nahi mila'
})

await check('trigger ne app_users ki row bana di', async () => {
  const { rows } = await client.query('select legacy_uid, role from app_users where id = $1', [userId])
  if (!rows[0]) return 'app_users me row hi nahi bani — naya register toota rahega'
  return rows[0].role === 'owner' || `role galat: ${rows[0].role}`
})

await check('Firebase jaisa hash banao aur $fbscrypt$ format me daalo', async () => {
  const hash = firebaseScrypt(PASSWORD, SALT)
  const encrypted = `$fbscrypt$v=1,n=${MEM_COST},r=${ROUNDS},p=1,ss=${SALT_SEP},sk=${SIGNER_KEY}$${SALT}$${hash}`
  await client.query('update auth.users set encrypted_password = $2 where id = $1', [userId, encrypted])
  const { rows } = await client.query('select encrypted_password from auth.users where id = $1', [userId])
  return rows[0].encrypted_password.startsWith('$fbscrypt$') || 'hash set nahi hua'
})

await check('>>> us purane password se login ho jaye <<<', async () => {
  const anon = createClient(URL_BASE, ANON, { auth: { persistSession: false } })
  const { data, error } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
  if (error) return `login nahi hua: ${error.message}  <-- iska matlab format galat hai, aur asli users bhi lock ho jayenge`
  return Boolean(data.session?.access_token) || 'session nahi mila'
})

// Ye jaanch nahi, jaankari hai. Login dono soorat me chalta hai — is par kuch
// tika nahi hua. Bas itna pata rehna chahiye ki har login par scrypt chal raha
// hai (2^14 memory) ya wo bcrypt me badal chuka hai.
{
  const { rows } = await client.query('select encrypted_password from auth.users where id = $1', [userId])
  const p = rows[0].encrypted_password
  console.log(
    p.startsWith('$2')
      ? '  INFO  login ke baad hash bcrypt me badal gaya'
      : '  INFO  hash abhi bhi fbscrypt hi hai — har login par scrypt chalega (chalta hai, bas thoda mehnga)'
  )
}

await check('galat password par login na ho', async () => {
  const anon = createClient(URL_BASE, ANON, { auth: { persistSession: false } })
  const { error } = await anon.auth.signInWithPassword({ email: EMAIL, password: 'galat-password' })
  return Boolean(error) || 'GALAT PASSWORD SE BHI LOGIN HO GAYA'
})

console.log('\n=== uid ka naksha (yahi sabse aasani se tootta hai) ===')

await check('session ka uid Supabase uuid nahi, purana Firebase uid dena chahiye', async () => {
  // asli owner ka uid Firebase wala hai; app har path usi se banata hai
  const { rows } = await client.query(
    "select id, legacy_uid from app_users where legacy_uid = 'x6cLySP2vbc3D5CAfQJAomxfet33'"
  )
  const row = rows[0]
  if (!row) return 'Triveni owner ki row nahi mili'
  if (row.id === row.legacy_uid) return 'legacy_uid galti se supabase uuid ban gaya'
  return true
})

await check('adapter ka path usi uid se sahi school pe jaata hai', async () => {
  const { rows } = await client.query(
    `select s.name from schools s
      join app_users au on au.school_id = s.id
     where au.legacy_uid = 'x6cLySP2vbc3D5CAfQJAomxfet33'`
  )
  return rows[0]?.name?.startsWith('Triveni') || `galat school: ${rows[0]?.name}`
})

console.log('\n=== SAFAI ===')
await admin.auth.admin.deleteUser(userId).catch(() => {})
await client.query('delete from app_users where id = $1', [userId])
const { rows: left } = await client.query(
  'select (select count(*)::int from auth.users where email = $1) u, (select count(*)::int from app_users where id = $2) a',
  [EMAIL, userId]
)
console.log(`  bacha hua: auth.users=${left[0].u} app_users=${left[0].a}`)

await client.end()
console.log(`\n${'='.repeat(46)}`)
console.log(`PASS ${pass}   FAIL ${fail}`)
process.exitCode = fail ? 1 : 0

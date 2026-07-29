// ============================================================
// import-auth.mjs — Firebase auth users ko Supabase auth.users me daalta hai
//
//   node supabase/import-auth.mjs <auth-users.json> [--apply]
//
// --apply ke bina sirf dikhata hai, kuch likhta nahi.
//
// Password waise ke waise rehte hain. Supabase ka GoTrue Firebase ke
// scrypt hash ko seedhe verify kar leta hai ($fbscrypt$ prefix se pehchanta hai),
// aur pehle successful login pe use chupchap bcrypt me badal deta hai.
// Kisi ko reset nahi karna padta.
//
// Format Supabase ke source se liya hai (internal/crypto/password.go):
//   $fbscrypt$v=1,n=<mem_cost>,r=<rounds>,p=1,ss=<salt_sep>,sk=<signer_key>$<salt>$<hash>
//   n = mem_cost (2^n banta hai), r = rounds, salt/hash standard base64
// ============================================================

import fs from 'node:fs'
import crypto from 'node:crypto'
import { connect, loadEnv } from './db.mjs'

const file = process.argv[2]
const APPLY = process.argv.includes('--apply')
if (!file) {
  console.error('usage: node supabase/import-auth.mjs <auth-users.json> [--apply]')
  process.exit(1)
}

loadEnv()
const SIGNER_KEY = process.env.FB_SIGNER_KEY
const SALT_SEP = process.env.FB_SALT_SEPARATOR
const ROUNDS = process.env.FB_ROUNDS || '8'
const MEM_COST = process.env.FB_MEM_COST || '14'

if (!SIGNER_KEY || !SALT_SEP) {
  console.error('FB_SIGNER_KEY / FB_SALT_SEPARATOR .env.local me nahi mile')
  process.exit(1)
}

// wahi uuid jo transform.mjs ne app_users ke liye banaya tha —
// warna auth.uid() aur app_users.id match nahi karenge aur RLS band ho jayegi
const uuidOf = (...parts) => {
  const h = crypto.createHash('md5').update(parts.join('|')).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`
}

// Firebase base64url (-_ , bina padding) deta hai; Go standard base64 padhta hai
const toStdB64 = (s) => {
  if (!s) return null
  let v = String(s).replace(/-/g, '+').replace(/_/g, '/')
  while (v.length % 4) v += '='
  return v
}

const users = JSON.parse(fs.readFileSync(file, 'utf8')).users || []

const rows = []
const skipped = []

for (const u of users) {
  if (!u.email) { skipped.push({ uid: u.localId, why: 'email nahi hai — Firebase Auth se login karta hi nahi' }); continue }
  if (!u.passwordHash || !u.salt) { skipped.push({ uid: u.localId, why: 'password hash nahi hai' }); continue }

  const salt = toStdB64(u.salt)
  const hash = toStdB64(u.passwordHash)
  const encrypted = `$fbscrypt$v=1,n=${MEM_COST},r=${ROUNDS},p=1,ss=${SALT_SEP},sk=${SIGNER_KEY}$${salt}$${hash}`

  rows.push({
    id: uuidOf('user', u.localId),
    legacy_uid: u.localId,
    email: String(u.email).toLowerCase(),
    encrypted,
    created_at: u.createdAt ? new Date(Number(u.createdAt)).toISOString() : new Date().toISOString(),
    last_sign_in: u.lastSignedInAt ? new Date(Number(u.lastSignedInAt)).toISOString() : null,
    verified: u.emailVerified === true,
    disabled: u.disabled === true,
  })
}

console.log(`export me users   : ${users.length}`)
console.log(`import honge      : ${rows.length}`)
console.log(`chhode gaye       : ${skipped.length}`)
for (const s of skipped) console.log(`   - ${s.uid}  (${s.why})`)

console.log('\nimport hone wale:')
for (const r of rows) {
  console.log(`   ${r.email.replace(/^(.{2}).*(@.*)$/, '$1***$2').padEnd(38)} uid=${r.legacy_uid.slice(0, 12)}...  -> ${r.id}`)
}

if (!APPLY) {
  console.log('\n(sirf dikhaya hai — kuch likha nahi. --apply lagao to chalega.)')
  process.exit(0)
}

const { client } = await connect()
try {
  await client.query('begin')

  for (const r of rows) {
    // auth.users
    await client.query(
      `insert into auth.users (
         instance_id, id, aud, role, email, encrypted_password,
         email_confirmed_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
         created_at, updated_at, banned_until
       ) values (
         '00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, $3,
         $4, $5, '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
         $6, $6, $7
       )
       on conflict (id) do update set
         email              = excluded.email,
         encrypted_password = excluded.encrypted_password,
         updated_at         = now()`,
      [
        r.id,
        r.email,
        r.encrypted,
        r.verified ? r.created_at : r.created_at, // Firebase pe login ho chuka hai, confirmed maan rahe hain
        r.last_sign_in,
        r.created_at,
        r.disabled ? '9999-12-31T00:00:00Z' : null,
      ]
    )

    // auth.identities — iske bina email login kaam nahi karta
    await client.query(
      `insert into auth.identities (
         provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
       ) values ($1::text, $2::uuid, $3::jsonb, 'email', $4, $5, $5)
       on conflict (provider, provider_id) do nothing`,
      [
        r.id,
        r.id,
        JSON.stringify({ sub: r.id, email: r.email, email_verified: r.verified, phone_verified: false }),
        r.last_sign_in,
        r.created_at,
      ]
    )
  }

  // Kuch school owners root/users me the hi nahi, to unka app_users row bana hi
  // nahi. Unke bina current_school_id() null dega aur RLS unhe apna hi data
  // nahi dikhayegi. Yahan jod dete hain — school ka legacy_id hi unka uid hai.
  let linked = 0
  for (const r of rows) {
    const res = await client.query(
      `insert into public.app_users (id, legacy_uid, school_id, role, email)
       select $1::uuid, $2, s.id, 'owner', $3
         from public.schools s
        where s.legacy_id = $2
       on conflict (id) do update set
         school_id = coalesce(public.app_users.school_id, excluded.school_id),
         email     = coalesce(public.app_users.email, excluded.email)
       returning id`,
      [r.id, r.legacy_uid, r.email]
    )
    linked += res.rowCount
  }

  await client.query('commit')
  console.log(`app_users se jode gaye: ${linked}`)
  console.log(`\nOK — ${rows.length} users auth.users me daal diye`)
} catch (err) {
  await client.query('rollback').catch(() => {})
  console.error('\nFAIL:', err.message)
  console.error('ROLLED BACK — kuch nahi badla.')
  process.exitCode = 1
} finally {
  await client.end().catch(() => {})
}

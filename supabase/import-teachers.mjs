// ============================================================
// import-teachers.mjs — teachersIndex + schools/*/teachers se app_users banata hai
//
//   node supabase/import-teachers.mjs <backup.json> [--apply]
//
// Kyun alag: teachers root/users me nahi the, isliye pehle import me chhoot gaye.
// Unke bina current_school_id() null lautata hai aur RLS unhe kuch bhi
// nahi dikhati — login to ho jaata hai, par screen khaali.
//
// Sath hi staff.auth_user_id bhi jodta hai, taaki can_see_class() ko
// teacher ki assigned classes mil sakein.
// ============================================================

import fs from 'node:fs'
import crypto from 'node:crypto'
import { connect } from './db.mjs'

const file = process.argv[2]
const APPLY = process.argv.includes('--apply')
if (!file) {
  console.error('usage: node supabase/import-teachers.mjs <backup.json> [--apply]')
  process.exit(1)
}

const uuidOf = (...parts) => {
  const h = crypto.createHash('md5').update(parts.join('|')).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`
}

const db = JSON.parse(fs.readFileSync(file, 'utf8'))

// uid -> { schoolLegacy, role, name, email, employeeCode }
const found = new Map()

for (const [uid, t] of Object.entries(db.teachersIndex || {})) {
  if (!t?.schoolId) continue
  found.set(uid, { schoolLegacy: t.schoolId, role: t.role || 'teacher' })
}

for (const [schoolLegacy, school] of Object.entries(db.schools || {})) {
  for (const [uid, t] of Object.entries(school.teachers || {})) {
    const prev = found.get(uid) || {}
    found.set(uid, {
      schoolLegacy,
      role: prev.role || 'teacher',
      name: [t.firstName, t.lastName].filter(Boolean).join(' ') || null,
      email: t.email || null,
      employeeCode: t.employeeCode || null,
    })
  }
}

console.log(`teachersIndex + schools/*/teachers me mile: ${found.size}`)

const { client } = await connect()

// kaunse pehle se app_users me hain
const existing = new Set((await client.query('select legacy_uid from public.app_users where legacy_uid is not null')).rows.map((r) => r.legacy_uid))
const schoolIds = new Map(
  (await client.query('select legacy_id, id, name from public.schools')).rows.map((r) => [r.legacy_id, r])
)

const plan = []
for (const [uid, t] of found) {
  const school = schoolIds.get(t.schoolLegacy)
  if (!school) { console.log(`  SKIP ${uid} — school ${t.schoolLegacy} nahi mila`); continue }
  plan.push({
    id: uuidOf('user', uid),
    uid,
    schoolId: school.id,
    schoolName: school.name,
    role: t.role,
    name: t.name,
    email: t.email,
    already: existing.has(uid),
  })
}

console.log('\nUID                          ROLE      SCHOOL                          HAAL')
console.log('-'.repeat(84))
for (const p of plan) {
  console.log(`${p.uid.slice(0, 28).padEnd(28)} ${p.role.padEnd(9)} ${(p.schoolName || '').slice(0, 30).padEnd(31)} ${p.already ? 'pehle se hai' : 'NAYA'}`)
}

if (!APPLY) {
  console.log('\n(sirf dikhaya — kuch likha nahi. --apply lagao to chalega.)')
  await client.end()
  process.exit(0)
}

try {
  await client.query('begin')

  let inserted = 0
  for (const p of plan) {
    const res = await client.query(
      `insert into public.app_users (id, legacy_uid, school_id, role, full_name, email)
       values ($1::uuid, $2, $3::uuid, $4, $5, $6)
       on conflict (id) do update set
         school_id = coalesce(public.app_users.school_id, excluded.school_id),
         role      = coalesce(public.app_users.role, excluded.role),
         full_name = coalesce(public.app_users.full_name, excluded.full_name),
         email     = coalesce(public.app_users.email, excluded.email)
       returning id`,
      [p.id, p.uid, p.schoolId, p.role, p.name, p.email]
    )
    inserted += res.rowCount
  }

  // staff row se joda — can_see_class() isi se assigned_classes padhta hai
  const linked = await client.query(`
    update public.staff s
       set auth_user_id = au.id
      from public.app_users au
     where au.legacy_uid = s.legacy_id
       and s.school_id = au.school_id
       and s.auth_user_id is distinct from au.id
  `)

  await client.query('commit')
  console.log(`\nOK — app_users: ${inserted}, staff se jode gaye: ${linked.rowCount}`)
} catch (err) {
  await client.query('rollback').catch(() => {})
  console.error('\nFAIL:', err.message)
  console.error('ROLLED BACK — kuch nahi badla.')
  process.exitCode = 1
} finally {
  await client.end().catch(() => {})
}

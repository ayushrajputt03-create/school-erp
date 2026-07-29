// ============================================================
// import-teacher-classes.mjs — har teacher ki assigned classes app_users pe daalta hai
//
//   node supabase/import-teacher-classes.mjs <backup.json> [--apply]
//
// Classes teen jagah bikhri hui hain:
//   schools/*/teachers/*.classes           -> ["9","10","11","12"]
//   schools/*/teachers/*.assignedClasses   -> "9,10"
//   schools/*/staff/*.assignedClasses      -> "1,2"
// Teeno padh ke ek jagah rakh dete hain.
// ============================================================

import fs from 'node:fs'
import crypto from 'node:crypto'
import { connect } from './db.mjs'

const file = process.argv[2]
const APPLY = process.argv.includes('--apply')
if (!file) {
  console.error('usage: node supabase/import-teacher-classes.mjs <backup.json> [--apply]')
  process.exit(1)
}

const uuidOf = (...parts) => {
  const h = crypto.createHash('md5').update(parts.join('|')).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`
}

const asClasses = (v) => {
  if (!v) return []
  const list = Array.isArray(v) ? v : String(v).split(',')
  return [...new Set(list.map((x) => String(x).trim()).filter(Boolean))]
}

const db = JSON.parse(fs.readFileSync(file, 'utf8'))
const byUid = new Map()

for (const school of Object.values(db.schools || {})) {
  for (const [uid, t] of Object.entries(school.teachers || {})) {
    const cls = [...asClasses(t.classes), ...asClasses(t.assignedClasses)]
    if (cls.length) byUid.set(uid, [...new Set([...(byUid.get(uid) || []), ...cls])])
  }
  for (const [legacyId, e] of Object.entries(school.staff || {})) {
    const cls = asClasses(e.assignedClasses)
    if (cls.length) byUid.set(legacyId, [...new Set([...(byUid.get(legacyId) || []), ...cls])])
  }
}

const { client } = await connect()

const rows = (await client.query(
  'select au.id, au.legacy_uid, au.role, s.name as school from public.app_users au left join public.schools s on s.id = au.school_id'
)).rows

console.log('UID                          ROLE     SCHOOL                     CLASSES')
console.log('-'.repeat(86))
const plan = []
for (const r of rows) {
  const cls = byUid.get(r.legacy_uid) || []
  const note = r.role === 'owner' || r.role === 'admin' ? '(admin — sab dikhega)' : cls.length ? cls.join(',') : 'KOI NAHI -> kuch nahi dikhega'
  console.log(`${(r.legacy_uid || '').slice(0, 28).padEnd(28)} ${(r.role || '').padEnd(8)} ${(r.school || '').slice(0, 26).padEnd(27)} ${note}`)
  if (cls.length) plan.push({ id: r.id, cls })
}

if (!APPLY) {
  console.log('\n(sirf dikhaya — kuch likha nahi. --apply lagao to chalega.)')
  await client.end()
  process.exit(0)
}

try {
  await client.query('begin')
  let n = 0
  for (const p of plan) {
    const res = await client.query('update public.app_users set assigned_classes = $2 where id = $1::uuid', [p.id, p.cls])
    n += res.rowCount
  }
  await client.query('commit')
  console.log(`\nOK — ${n} users ki classes set ho gayin`)
} catch (err) {
  await client.query('rollback').catch(() => {})
  console.error('\nFAIL:', err.message)
  process.exitCode = 1
} finally {
  await client.end().catch(() => {})
}

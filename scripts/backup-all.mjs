/**
 * Poore Supabase project ka backup — saare school, saari tables, storage files.
 *
 *   node scripts/backup-all.mjs
 *   node scripts/backup-all.mjs --out D:/nxt-backups
 *
 * Ye kyun hai:
 *   - Supabase ka plan `free` hai, aur free tier par KOI automatic backup nahi
 *     hota. Pro ($25) par daily backup milta hai.
 *   - `api/monthly-backup.js` ab Supabase se padhta hai, par wo sirf teen sheet
 *     (students, fees, attendance) us school ko mail karta hai jisne backup
 *     chaalu kiya ho. Poore project ka — saari tables, storage, auth users —
 *     backup sirf yahi script banati hai.
 *
 * Seedha Postgres (pg_dump) is machine se nahi lagta — pooler timeout deta hai.
 * Isliye sab kuch REST se aata hai, service-role key ke saath (RLS bypass, to
 * har school ka data aata hai).
 *
 * Tables ki list information_schema se aati hai, hardcoded nahi — kal koi nayi
 * table bane to wo apne aap backup me aa jayegi. Ye jaanbujh kar hai: is repo
 * me sabse mehngi galtiyan "ye jagah update karna bhool gaye" wali rahi hain.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

/* ---- env ---- */
const envPath = new URL('../.env.local', import.meta.url)
for (const raw of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const line = raw.trim(); if (!line || line.startsWith('#')) continue
  const i = line.indexOf('='); if (i < 0) continue
  process.env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim()
}
const URL_ = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !KEY) { console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY .env.local me nahi mile'); process.exit(1) }

const db = createClient(URL_, KEY, { auth: { persistSession: false } })

/* ---- kahan likhna hai ---- */
const outFlag = process.argv.indexOf('--out')
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const root = path.join(outFlag > -1 ? process.argv[outFlag + 1] : path.join(process.cwd(), 'backups'), stamp)
fs.mkdirSync(path.join(root, 'tables'), { recursive: true })
fs.mkdirSync(path.join(root, 'storage'), { recursive: true })

const write = (file, data) => fs.writeFileSync(path.join(root, file), JSON.stringify(data, null, 2))
const kb = n => `${(n / 1024).toFixed(0)} KB`

/* ---- 1. tables ---- */
// PostgREST ek baar me 1000 row deta hai, isliye range se page karte hain.
async function dumpTable(table) {
  const rows = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from(table).select('*').range(from, from + PAGE - 1)
    if (error) return { table, error: error.message }
    rows.push(...data)
    if (data.length < PAGE) break
  }
  write(path.join('tables', `${table}.json`), rows)
  return { table, rows: rows.length }
}

// 2026-08-04 ki poori list. Ye sirf fallback hai — asli list DB se aati hai
// (neeche), taaki kal koi nayi table bane to backup se chup-chaap chhoot na jaye.
const FALLBACK_TABLES = [
  'admission_requests', 'app_users', 'attendance', 'attendance_summary', 'audit_logs',
  'certificate_counters', 'certificates', 'counters', 'date_sheets', 'exams',
  'fee_counters', 'fee_fines', 'fee_groups', 'fee_receipts', 'fee_structures',
  'homework', 'kv', 'leave_requests', 'notices', 'parent_notifications',
  'parent_students', 'parents', 'periods', 'report_cards', 'report_marks',
  'school_codes', 'schools', 'staff', 'staff_attendance', 'students',
  'subscriptions', 'super_admins', 'timetable_slots', 'transport_allocations',
]

const probe = await db.from('schools').select('id').limit(1)
if (probe.error) { console.error('Supabase se connect nahi hua:', probe.error.message); process.exit(1) }

// DB khud batata hai ki kaunsi tables hain. Ye is repo ki sabse aam galti se
// bachne ke liye hai — "nayi cheez bani, purani list update karna bhool gaye".
const { data: listed, error: listError } = await db.rpc('backup_table_list')
const tables = Array.isArray(listed) && listed.length
  ? listed.map(t => t.table_name || t).sort()
  : FALLBACK_TABLES

if (!Array.isArray(listed) || !listed.length) {
  console.log(`  (table list DB se nahi mili${listError ? ` — ${listError.message}` : ''}; built-in list use ho rahi hai)`)
  const extra = FALLBACK_TABLES.length
  console.log(`  (${extra} tables built-in list se — agar iske baad koi nayi table bani hai to wo is backup me NAHI hai)`)
}

console.log(`Backup -> ${root}\n`)
console.log('TABLES')
const tableResults = []
for (const table of tables) {
  const result = await dumpTable(table)
  tableResults.push(result)
  console.log(result.error
    ? `  SKIP  ${table.padEnd(24)} ${result.error}`
    : `  ok    ${table.padEnd(24)} ${result.rows} rows`)
}

/* ---- 2. storage ---- */
console.log('\nSTORAGE')
const storageResults = []
for (const bucket of ['school-assets', 'student-photos']) {
  const files = []
  // buckets me folder hain (school uuid), to ek level andar jaana padta hai
  const { data: top, error } = await db.storage.from(bucket).list('', { limit: 1000 })
  if (error) { console.log(`  SKIP  ${bucket}: ${error.message}`); continue }
  for (const entry of top) {
    if (entry.id) { files.push(entry.name); continue }        // seedha file
    const { data: inner } = await db.storage.from(bucket).list(entry.name, { limit: 1000 })
    for (const f of inner || []) {
      if (f.id) { files.push(`${entry.name}/${f.name}`); continue }
      const { data: deeper } = await db.storage.from(bucket).list(`${entry.name}/${f.name}`, { limit: 1000 })
      for (const d of deeper || []) if (d.id) files.push(`${entry.name}/${f.name}/${d.name}`)
    }
  }

  let bytes = 0
  for (const file of files) {
    const { data, error: dlError } = await db.storage.from(bucket).download(file)
    if (dlError) { console.log(`  SKIP  ${bucket}/${file}: ${dlError.message}`); continue }
    const target = path.join(root, 'storage', bucket, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    const buf = Buffer.from(await data.arrayBuffer())
    fs.writeFileSync(target, buf)
    bytes += buf.length
  }
  storageResults.push({ bucket, files: files.length, bytes })
  console.log(`  ok    ${bucket.padEnd(24)} ${files.length} files, ${kb(bytes)}`)
}

/* ---- 3. auth users ---- */
// Password hash yahan NAHI aata — Supabase Admin API use kabhi nahi deta.
// Iska matlab: is backup se data poora wapas aa sakta hai, par logins nahi.
// Wahi baat manifest me likhi hai taaki restore ke waqt surprise na ho.
console.log('\nAUTH')
const users = []
for (let page = 1; ; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
  if (error) { console.log(`  SKIP  auth users: ${error.message}`); break }
  users.push(...data.users.map(u => ({
    id: u.id, email: u.email, phone: u.phone,
    created_at: u.created_at, last_sign_in_at: u.last_sign_in_at,
    app_metadata: u.app_metadata, user_metadata: u.user_metadata,
  })))
  if (data.users.length < 1000) break
}
write('auth-users.json', users)
console.log(`  ok    auth users              ${users.length} (password hash SHAAMIL NAHI)`)

/* ---- 4. manifest ---- */
const { data: schools } = await db.from('schools').select('legacy_id, name')
const manifest = {
  takenAt: new Date().toISOString(),
  project: URL_,
  schools: (schools || []).map(s => ({ legacyId: s.legacy_id, name: s.name })),
  tables: tableResults,
  storage: storageResults,
  authUsers: users.length,
  warnings: [
    'auth.users ke password hash isme nahi hain — Supabase Admin API unhe kabhi nahi deta. Data poora restore ho sakta hai, par logins dobara banane padenge.',
    'Ye ek point-in-time copy hai. Supabase free plan par koi automatic backup nahi hota.',
  ],
}
write('manifest.json', manifest)

const totalRows = tableResults.reduce((sum, r) => sum + (r.rows || 0), 0)
const failed = tableResults.filter(r => r.error)
console.log(`\n${'='.repeat(50)}`)
console.log(`${totalRows} rows, ${storageResults.reduce((s, r) => s + r.files, 0)} files, ${users.length} auth users`)
console.log(`-> ${root}`)
if (failed.length) {
  console.log(`\n${failed.length} table SKIP hui:`)
  for (const f of failed) console.log(`  ${f.table}: ${f.error}`)
  process.exit(1)
}

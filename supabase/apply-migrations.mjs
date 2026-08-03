// ============================================================
// apply-migrations.mjs — naam se di gayi migration files apply karta hai
//
//   node supabase/apply-migrations.mjs 20260803000000_fee_receipts_student_fk_restrict.sql
//   node supabase/apply-migrations.mjs            # jo bhi pending ho, sab
//
// `supabase db push` ki jagah ye kyun:
// push local file ke version number ko remote ke schema_migrations se milata
// hai. Jo migrations MCP se apply hui thin unka remote version MCP ne khud
// banaya tha, isliye wo local file ke naam se match nahi karta (jaise local
// 20260802140000 par remote 20260802174556). Push un sabko "pending" samajh kar
// dobara chalane ki koshish karta hai. Ye script sirf wahi chalati hai jo sach
// me darj nahi hain, aur version wahi darj karti hai jo file ke naam me hai —
// isse drift aage nahi badhta.
//
// Har migration apne transaction me chalti hai: beech me fail hui to poori
// palat jaati hai, aadhi lagi hui nahi rehti.
// ============================================================

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { connect } from './db.mjs'

// fileURLToPath %20 jaisi URL-encoding ko wapas asli space me badalta hai —
// "AYUSH SINGH" wale path par seedha .pathname padhne se woh %20 hi reh jaata
// tha aur folder "nahi milta" (ENOENT) ban jaata tha.
const dirPath = fileURLToPath(new URL('./migrations/', import.meta.url))

const asked = process.argv.slice(2)
const files = (asked.length ? asked : fs.readdirSync(dirPath).filter(f => f.endsWith('.sql'))).sort()

const { client } = await connect()
let applied = 0, skipped = 0

for (const file of files) {
  const version = file.slice(0, 14)
  const name = file.slice(15).replace(/\.sql$/, '')
  if (!/^\d{14}$/.test(version)) { console.log(`SKIP  ${file} (naam me 14-digit version nahi)`); skipped++; continue }

  const already = await client.query(
    'select 1 from supabase_migrations.schema_migrations where version = $1', [version])
  if (already.rowCount) { console.log(`SKIP  ${file} (pehle se darj hai)`); skipped++; continue }

  const sql = fs.readFileSync(path.join(dirPath, file), 'utf8')
  try {
    await client.query('begin')
    await client.query(sql)
    await client.query(
      'insert into supabase_migrations.schema_migrations (version, name, statements) values ($1,$2,$3)',
      [version, name, [sql]])
    await client.query('commit')
    console.log(`OK    ${file}`)
    applied++
  } catch (error) {
    await client.query('rollback')
    console.log(`FAIL  ${file}\n        ${error.message}`)
    console.log('\nKuch bhi apply nahi hua is file se — transaction palat gaya.')
    process.exitCode = 1
    break
  }
}

await client.end()
console.log(`\n${'='.repeat(46)}`)
console.log(`APPLIED ${applied}   SKIPPED ${skipped}`)

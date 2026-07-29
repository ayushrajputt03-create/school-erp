// ============================================================
// apply-migration.mjs — ek migration file ek hi query me chalata hai
//
//   node supabase/apply-migration.mjs supabase/0019_super_admin.sql
//
// run-sql.mjs ise nahi kar sakta: wo file ko LINE ke hisaab se 50-50 ke batch
// me todta hai (data import me 3000+ statement the, ek-ek bhejna bahut slow tha).
// Function body `$$ ... $$` uss batch seemaa ke beech aa jaye to aadhi body
// alag query ban jaati hai — "no language specified" wahin se aata hai.
//
// DDL ke liye ye script, bade data import ke liye run-sql.mjs.
// Poori file ek transaction me chalti hai: kuch fail hua to kuch nahi lagta.
// ============================================================

import fs from 'node:fs'
import path from 'node:path'
import { connect, scrub } from './db.mjs'

const file = process.argv[2]
if (!file) {
  console.error('usage: node supabase/apply-migration.mjs <file.sql>')
  process.exit(1)
}

const sql = fs.readFileSync(file, 'utf8')
// dump-migrations.mjs itihaas isi table se padhta hai. Yahan darj na karein to
// migration lag to jaati hai par repo me kabhi nahi utarti — aur naya
// environment shunya se khada karne par wo hissa gayab hota.
const name = path.basename(file).replace(/\.sql$/, '').replace(/^\d+_/, '')
const version = new Date().toISOString().replace(/\D/g, '').slice(0, 14)

const { client } = await connect()

try {
  await client.query('begin')
  await client.query(sql)
  await client.query(
    `insert into supabase_migrations.schema_migrations (version, name, statements)
     values ($1, $2, $3) on conflict (version) do nothing`,
    [version, name, [sql]]
  )
  await client.query('commit')
  console.log(`OK — ${file}`)
} catch (err) {
  await client.query('rollback').catch(() => {})
  console.error(`FAIL: ${scrub(err.message, process.env.SUPABASE_DB_PASSWORD)}`)
  console.error('ROLLED BACK — database jaisa tha waisa hi hai.')
  process.exitCode = 1
} finally {
  await client.end()
}

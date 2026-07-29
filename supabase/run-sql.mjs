// ============================================================
// run-sql.mjs — SQL file ko Supabase Postgres pe chalata hai
//
//   node supabase/run-sql.mjs <file.sql>
//
// Poora import ek hi transaction me chalta hai:
// beech me kuch fail hua to sab wapas roll back — aadha-adhoora
// data kabhi nahi bachega.
// ============================================================

import fs from 'node:fs'
import { connect, scrub } from './db.mjs'

const file = process.argv[2]
if (!file) {
  console.error('usage: node supabase/run-sql.mjs <file.sql>')
  process.exit(1)
}

const sql = fs.readFileSync(file, 'utf8')

// Ye script line ke hisaab se batch karta hai (neeche dekho). Function body
// `$$ ... $$` batch seemaa ke beech kat jaye to aadhi body alag query ban jaati
// hai aur "no language specified" jaisi ulti-seedhi error milti hai — jo asli
// galti se koi rishta nahi rakhti. Aisi file ke liye apply-migration.mjs hai.
if (sql.includes('$$')) {
  console.error(`${file} me $$ function body hai — ye script use beech se kaat degi.`)
  console.error(`chalao: node supabase/apply-migration.mjs ${file}`)
  process.exit(1)
}

const statements = sql.split('\n').filter((l) => l.trim())

console.log(`file      : ${file}`)
console.log(`statements: ${statements.length}`)
console.log(`size      : ${(Buffer.byteLength(sql) / 1024 / 1024).toFixed(2)} MB`)

const secret = process.env.SUPABASE_DB_PASSWORD
const t0 = Date.now()
let done = 0
let client

try {
  const conn = await connect()
  client = conn.client
  console.log(`connected : ${conn.host}`)
  console.log('transaction shuru...\n')

  await client.query('begin')

  // Ek-ek statement bhejna bahut slow tha (har ek ka apna round trip).
  // Batch me bhejte hain — 3126 chakkar ki jagah ~63.
  const BATCH = 50
  for (let i = 0; i < statements.length; i += BATCH) {
    const batch = statements.slice(i, i + BATCH)
    try {
      await client.query('savepoint batch_sp')
      await client.query(batch.join('\n'))
      done += batch.length
      process.stdout.write(`  ${Math.min(done, statements.length)}/${statements.length}\r`)
    } catch (err) {
      // Batch me kaunsa statement toota — ek-ek chala ke pakadte hain.
      // SAVEPOINT se, taaki ab tak ka kaam bacha rahe. (Poora rollback karne se
      // pehle daale hue schools mit jaate the aur jhooti FK error dikhti thi.)
      console.error(`\n\nbatch ${i + 1}-${i + batch.length} fail hua. asli statement dhoondh rahe hain...`)
      await client.query('rollback to savepoint batch_sp').catch(() => {})
      for (const [n, stmt] of batch.entries()) {
        await client.query('savepoint one_sp')
        try {
          await client.query(stmt)
          await client.query('release savepoint one_sp')
        } catch (inner) {
          console.error(`\nFAIL statement #${i + n + 1}:`)
          console.error(`  ${stmt.slice(0, 400)}`)
          console.error(`  -> ${inner.message}`)
          throw inner
        }
      }
      throw err
    } finally {
      await client.query('release savepoint batch_sp').catch(() => {})
    }
  }

  await client.query('commit')
  console.log(`\n\nOK — ${done} statements, ${((Date.now() - t0) / 1000).toFixed(1)}s`)
} catch (err) {
  if (client) await client.query('rollback').catch(() => {})
  console.error('\n' + scrub(err.message, secret))
  console.error('\nROLLED BACK — database jaisa tha waisa hi hai. Kuch nahi badla.')
  process.exitCode = 1
} finally {
  if (client) await client.end().catch(() => {})
}

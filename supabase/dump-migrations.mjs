// Jo migrations database pe lag chuki hain, unhe supabase/migrations/ me
// file bana ke rakh deta hai — taaki schema ka poora itihaas repo me rahe
// aur naya environment shunya se khada kiya ja sake.
//
//   node supabase/dump-migrations.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { connect } from './db.mjs'

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations')
fs.mkdirSync(outDir, { recursive: true })

const { client } = await connect()
const { rows } = await client.query(
  'select version, name, statements from supabase_migrations.schema_migrations order by version'
)

for (const r of rows) {
  const name = (r.name || 'migration').replace(/[^a-z0-9_]+/gi, '_')
  const file = path.join(outDir, `${r.version}_${name}.sql`)
  const body = Array.isArray(r.statements) ? r.statements.join(';\n\n') + ';\n' : String(r.statements ?? '')
  fs.writeFileSync(file, body, 'utf8')
  console.log(`  ${path.basename(file).padEnd(46)} ${(body.length / 1024).toFixed(1)} KB`)
}

console.log(`\n${rows.length} migrations likhi gayin`)
await client.end()

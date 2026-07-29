// Connection check. Password kabhi print nahi hota.
import { connect } from './db.mjs'

try {
  const { client, host } = await connect()
  const r = await client.query(
    "select current_database() as db, (select count(*)::int from information_schema.tables where table_schema='public') as tables"
  )
  console.log(`CONNECTED : ${host}`)
  console.log(`            ${JSON.stringify(r.rows[0])}`)
  await client.end()
} catch (err) {
  console.log('FAILED    :', err.message)
  process.exitCode = 1
}

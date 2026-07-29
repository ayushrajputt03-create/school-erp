// ============================================================
// upload-media.mjs — nikali hui images Supabase Storage pe daalta hai
//
//   node supabase/upload-media.mjs <mediaDir> [--apply]
//
// SUPABASE_SERVICE_ROLE_KEY chahiye (.env.local me).
// Ye key saari RLS bypass karti hai — sirf yahan, ek baar, upload ke liye.
// App ke code me ye kabhi nahi jaani chahiye.
//
// Upload ke baad Postgres me URL/path set hote hain:
//   school-assets  = public bucket  -> seedha public URL
//   student-photos = private bucket -> sirf path; signed URL app banayega
// ============================================================

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { connect, loadEnv } from './db.mjs'

const mediaDir = process.argv[2]
const APPLY = process.argv.includes('--apply')
if (!mediaDir) {
  console.error('usage: node supabase/upload-media.mjs <mediaDir> [--apply]')
  process.exit(1)
}

loadEnv()
const URL_BASE = process.env.SUPABASE_URL || 'https://fxriwwuaxuiomqzklzvk.supabase.co'
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!KEY || KEY.startsWith('PASTE_')) {
  console.error('SUPABASE_SERVICE_ROLE_KEY .env.local me nahi bhari gayi.')
  console.error('Dashboard > Project Settings > API Keys > service_role (secret)')
  process.exit(1)
}

const manifest = JSON.parse(fs.readFileSync(path.join(mediaDir, '_manifest.json'), 'utf8'))
console.log(`upload karne hain : ${manifest.length} files`)
console.log(`kul size          : ${(manifest.reduce((a, m) => a + m.bytes, 0) / 1024).toFixed(0)} KB`)

if (!APPLY) {
  console.log('\n(sirf dikhaya — kuch upload nahi hua. --apply lagao to chalega.)')
  process.exit(0)
}

// supabase-js se — ye naye sb_secret_ format aur purane JWT dono sambhal leta hai.
// Seedha fetch se "Invalid Compact JWS" aata tha, kyunki Storage Bearer ko
// JWT samajh ke parse karti hai aur naya key JWT hota hi nahi.
const sb = createClient(URL_BASE, KEY, { auth: { persistSession: false, autoRefreshToken: false } })

let ok = 0
const failed = []

for (const m of manifest) {
  const body = fs.readFileSync(m.disk)
  const { error } = await sb.storage.from(m.bucket).upload(m.storagePath, body, {
    contentType: m.mime,
    cacheControl: '31536000',
    upsert: true,
  })
  if (error) {
    failed.push({ path: m.storagePath, status: error.statusCode || 'error', text: String(error.message).slice(0, 160) })
    continue
  }
  ok++
  process.stdout.write(`  ${ok}/${manifest.length}\r`)
}

console.log(`\nupload hua : ${ok}/${manifest.length}`)
if (failed.length) {
  console.log('\nfail hue:')
  for (const f of failed) console.log(`  ${f.status}  ${f.path}\n     ${f.text}`)
  console.log('\nPostgres me kuch nahi badla — pehle upload theek karo.')
  process.exit(1)
}

// ---------- ab Postgres me URL / path set karo ----------
const { client } = await connect()
try {
  await client.query('begin')
  let updated = 0

  for (const m of manifest) {
    if (m.bucket === 'school-assets') {
      // public bucket — seedha URL chal jaata hai
      const publicUrl = `${URL_BASE}/storage/v1/object/public/school-assets/${m.storagePath}`
      const pathCol = m.column === 'logo_url' ? 'logo_path' : null
      const res = await client.query(
        pathCol
          ? `update public.schools set ${m.column} = $2, ${pathCol} = $3 where id = $1::uuid`
          : `update public.schools set ${m.column} = $2 where id = $1::uuid`,
        pathCol ? [m.matchVal, publicUrl, m.storagePath] : [m.matchVal, publicUrl]
      )
      updated += res.rowCount
    } else {
      // private bucket — URL nahi, sirf path. Signed URL app banayega.
      // photo_url null kar rahe hain kyunki usme abhi 8-20 KB ka base64 pada hai
      // aur wahi har read pe aata tha. App abhi Firebase pe hai, to kuch tootega nahi.
      const res = await client.query(
        `update public.${m.table} set photo_path = $3, photo_url = null
          where school_id = $1::uuid and ${m.matchCol} = $2`,
        [m.schoolId, m.matchVal, m.storagePath]
      )
      updated += res.rowCount
    }
  }

  await client.query('commit')
  console.log(`Postgres me ${updated} rows update huin`)

  const left = await client.query(`
    select 'schools' t, count(*) n from schools where logo_url like 'data:%' or seal_url like 'data:%'
    union all select 'students', count(*) from students where photo_url like 'data:%'
    union all select 'staff',    count(*) from staff    where photo_url like 'data:%'
  `)
  console.log('\nbase64 abhi bhi bacha hua:')
  for (const r of left.rows) console.log(`  ${r.t.padEnd(10)} ${r.n}`)
} catch (err) {
  await client.query('rollback').catch(() => {})
  console.error('\nFAIL:', err.message)
  console.error('ROLLED BACK — Postgres me kuch nahi badla. Files Storage pe chadh chuki hain (upsert hai, dobara chalane se dikkat nahi).')
  process.exitCode = 1
} finally {
  await client.end().catch(() => {})
}

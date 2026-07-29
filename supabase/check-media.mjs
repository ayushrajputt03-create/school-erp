// Storage sach me serve kar rahi hai ya nahi — asli fetch karke dekhta hai.
import { createClient } from '@supabase/supabase-js'
import { connect, loadEnv } from './db.mjs'

loadEnv()
const { client } = await connect()

console.log('=== PUBLIC (school-assets) — bina login ke khulna chahiye ===')
const pub = await client.query(
  `select name, logo_url, seal_url from public.schools where logo_url like 'https://%' or seal_url like 'https://%'`
)
for (const r of pub.rows) {
  for (const [label, url] of [['logo', r.logo_url], ['seal', r.seal_url]]) {
    if (!url || !url.startsWith('https://')) continue
    const res = await fetch(url)
    const size = res.ok ? (await res.arrayBuffer()).byteLength : 0
    console.log(
      `  ${res.ok ? 'OK ' : 'FAIL'} ${String(res.status).padEnd(4)} ${String(res.headers.get('content-type')).padEnd(12)} ` +
      `${(size / 1024).toFixed(0).padStart(4)} KB  ${label}  ${r.name.slice(0, 32)}`
    )
  }
}

console.log('\n=== PRIVATE (student-photos) — bina permission ke band hona chahiye ===')
// koi key hardcode nahi — sab .env.local se
const anon = process.env.VITE_SUPABASE_ANON_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  : null
const priv = (await client.query(`select photo_path from public.students where photo_path is not null limit 1`)).rows[0]
if (priv) {
  const direct = `${process.env.SUPABASE_URL}/storage/v1/object/public/student-photos/${priv.photo_path}`
  const res = await fetch(direct)
  console.log(`  bina login seedha URL  -> ${res.status} ${res.status === 400 || res.status === 404 || res.status === 403 ? '(band hai — sahi)' : '(KHULA HAI — GADBAD)'}`)

  const svc = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const { data, error } = await svc.storage.from('student-photos').createSignedUrl(priv.photo_path, 60)
  if (error) {
    console.log(`  signed URL             -> FAIL: ${error.message}`)
  } else {
    const r2 = await fetch(data.signedUrl)
    const size = r2.ok ? (await r2.arrayBuffer()).byteLength : 0
    console.log(`  signed URL             -> ${r2.status} ${(size / 1024).toFixed(0)} KB ${r2.ok ? '(khulti hai — sahi)' : '(nahi khuli)'}`)
  }
}

await client.end()

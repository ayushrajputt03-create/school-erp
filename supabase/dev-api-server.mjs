// Local /api server. `vercel dev` (CLI 58) .env.local ko serverless functions
// me inject nahi karta — SUPABASE_URL tak absent aata hai, aur store chupchaap
// Firebase par gir jaata hai. Ye launcher pehle .env.local padh kar process.env
// me daalta hai, phir vercel dev spawn karta hai.
//
//   node supabase/dev-api-server.mjs   # /api par 3000
//   npm run dev                        # SPA par 5173, /api proxy 3000 ko
//
// Note: seedha http://localhost:3000 mat kholna — vercel.json ka SPA catch-all
// rewrite dev me /src/*.jsx ko bhi index.html bana deta hai. UI hamesha 5173 se.
import { readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'

const env = { ...process.env }
for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = /^([A-Za-z0-9_]+)=(.*)$/.exec(line.trim())
  if (m) env[m[1]] = m[2]
}

const child = spawn('npx.cmd', ['vercel', 'dev', '--listen', '3000'], {
  env,
  stdio: 'inherit',
  shell: true, // Windows par .cmd shim bina shell ke EINVAL deta hai

})
child.on('exit', (code) => process.exit(code ?? 0))

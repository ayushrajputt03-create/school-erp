// Firebase console se copy karte waqt line ke ant ka comma / quotes
// bhi aa jaate hain. Unhe hata deta hai. Value kabhi print nahi hoti.
import fs from 'node:fs'

const path = new URL('../.env.local', import.meta.url)
const KEYS = ['FB_SIGNER_KEY', 'FB_SALT_SEPARATOR', 'FB_ROUNDS', 'FB_MEM_COST', 'SUPABASE_DB_PASSWORD']

let changed = 0
const out = fs.readFileSync(path, 'utf8').split('\n').map((raw) => {
  const line = raw.replace(/\r$/, '')
  const eq = line.indexOf('=')
  if (eq < 0) return line
  const k = line.slice(0, eq).trim()
  if (!KEYS.includes(k)) return line

  const before = line.slice(eq + 1)
  const after = before.trim().replace(/,+$/, '').replace(/^["']|["']$/g, '').trim()
  if (after !== before) {
    changed++
    console.log(`  ${k.padEnd(22)} ${before.length} -> ${after.length} chars`)
  }
  return `${k}=${after}`
})

fs.writeFileSync(path, out.join('\n'), 'utf8')
console.log(changed ? `\n${changed} lines saaf ki` : 'sab pehle se saaf thi')

// sanity: base64 sahi hai?
const env = {}
for (const line of out) {
  const eq = line.indexOf('=')
  if (eq > 0) env[line.slice(0, eq).trim()] = line.slice(eq + 1)
}
console.log('\njaanch:')
for (const k of ['FB_SIGNER_KEY', 'FB_SALT_SEPARATOR']) {
  const v = env[k] || ''
  let ok = false
  try { ok = Buffer.from(v, 'base64').toString('base64') === v } catch { ok = false }
  console.log(`  ${k.padEnd(22)} ${v.length} chars, ${Buffer.from(v, 'base64').length} bytes, base64 ${ok ? 'sahi' : 'GALAT'}`)
}
console.log(`  FB_ROUNDS              ${env.FB_ROUNDS}`)
console.log(`  FB_MEM_COST            ${env.FB_MEM_COST}`)

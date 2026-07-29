// ============================================================
// fix-env.mjs — purani SUPABASE_DB_URL line ko SUPABASE_DB_PASSWORD me badalta hai
//
// Password URL ke andar phansa hua hai. Wahan @ jaise character line ko tod dete hain.
// Ye script use nikaal ke apni alag line me rakh deta hai — aur kabhi print nahi karta.
//
//   node supabase/fix-env.mjs
// ============================================================

import fs from 'node:fs'

const path = new URL('../.env.local', import.meta.url)
const text = fs.readFileSync(path, 'utf8')

if (/^SUPABASE_DB_PASSWORD=.+/m.test(text)) {
  console.log('SUPABASE_DB_PASSWORD pehle se hai — kuch nahi badla.')
  process.exit(0)
}

const line = text.split('\n').find((l) => l.trim().startsWith('SUPABASE_DB_URL='))
if (!line) {
  console.log('SUPABASE_DB_URL nahi mila. Khud ye line jodo:')
  console.log('  SUPABASE_DB_PASSWORD=<tera database password>')
  process.exit(1)
}

// postgres: ke baad se, aakhri @ tak — beech me @ ho tab bhi sahi nikalta hai
const value = line.slice(line.indexOf('=') + 1).trim()
const start = value.indexOf('postgres:')
const end = value.lastIndexOf('@')
if (start < 0 || end < 0 || end <= start) {
  console.log('URL ka dhaancha samajh nahi aaya. Khud ye line jodo:')
  console.log('  SUPABASE_DB_PASSWORD=<tera database password>')
  process.exit(1)
}

const password = value.slice(start + 'postgres:'.length, end)
if (!password || password === 'PASTE_PASSWORD_HERE') {
  console.log('Password abhi bhara hi nahi gaya (PASTE_PASSWORD_HERE waisa hi pada hai).')
  process.exit(1)
}

const out = text
  .split('\n')
  .map((l) => (l.trim().startsWith('SUPABASE_DB_URL=') ? `# (hata diya — password ab neeche apni line me hai)\n# ${l.trim().slice(0, 40)}...` : l))
  .join('\n')
  .replace(/\n+$/, '\n')

fs.writeFileSync(path, out + `SUPABASE_DB_PASSWORD=${password}\n`, 'utf8')

console.log('Ho gaya.')
console.log(`  SUPABASE_DB_PASSWORD daal di (${password.length} characters)`)
console.log(`  special characters: ${/[^A-Za-z0-9]/.test(password) ? 'haan — isiliye URL toot rahi thi' : 'nahi'}`)
console.log('  purani SUPABASE_DB_URL line comment kar di')

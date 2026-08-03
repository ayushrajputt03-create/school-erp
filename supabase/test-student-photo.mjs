// ============================================================
// test-student-photo.mjs — student photo ka upload raasta
//
//   node supabase/test-student-photo.mjs
//
// Ye wo bug pakadta hai jo production me dikha: Supabase par har photo save
// fail ho rahi thi ("studentPhotos par likhna adapter me support nahi hai").
// Wajah — App ka useFirebaseStorage par `&& !useSupabase` laga hai, to Supabase
// par har photo base64 fallback me jaati thi aur adapter use mana kar deta tha.
// Upload ka raasta bana hi nahi tha.
//
// SAFETY — asli production bucket par chalta hai:
//   * Sirf `.../students/ZZTEST_<timestamp>.jpg` par likhta hai. Aisa koi
//     student id nahi hota.
//   * Kisi table ko chhuta hi nahi — sirf storage.
//   * Ant me apni banayi file mita deta hai, aur mitne ki tasdeeq karta hai.
// ============================================================

import fs from 'node:fs'

for (const raw of fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const line = raw.trim()
  if (!line || line.startsWith('#')) continue
  const eq = line.indexOf('=')
  if (eq < 0) continue
  process.env[line.slice(0, eq).trim()] ??= line.slice(eq + 1).trim()
}
process.env.VITE_SUPABASE_ANON_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
process.env.VITE_USE_SUPABASE = 'true'

const { uploadStudentPhoto, deleteStudentPhoto, databaseRequest } = await import('../src/lib/dataAdapter.js')
const { supabase } = await import('../src/lib/supabaseClient.js')

const SCHOOL = 'x6cLySP2vbc3D5CAfQJAomxfet33'
const STUDENT = `ZZTEST_${Date.now()}`

let pass = 0, fail = 0
const check = async (label, fn) => {
  try { const r = await fn(); r === true ? (pass++, console.log(`  OK    ${label}`)) : (fail++, console.log(`  FAIL  ${label}\n          ${r}`)) }
  catch (e) { fail++; console.log(`  ERROR ${label}\n          ${e.message}`) }
}
const eq = (got, want) => got === want ? true : `mila ${JSON.stringify(got)}, chahiye tha ${JSON.stringify(want)}`

// Sabse chhoti valid JPEG jo bucket sweekar kar le.
const jpegBytes = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
  'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA' +
  'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64')
const file = new Blob([jpegBytes], { type: 'image/jpeg' })
file.size ?? Object.defineProperty(file, 'size', { value: jpegBytes.length })

const { data: schoolRow } = await supabase.from('schools').select('id').eq('legacy_id', SCHOOL).single()
const objectPath = `${schoolRow.id}/students/${STUDENT}.jpg`

const objectExists = async () => {
  const { data } = await supabase.storage.from('student-photos')
    .list(`${schoolRow.id}/students`, { search: `${STUDENT}.jpg` })
  return (data || []).some(o => o.name === `${STUDENT}.jpg`)
}

console.log('\nupload')
let uploaded = null

await check('photo bucket me chali jaati hai', async () => {
  uploaded = await uploadStudentPhoto(SCHOOL, STUDENT, file)
  return await objectExists() || 'bucket me file nahi mili'
})

// Path pe RLS tiki hui hai: pehla folder school ka uuid hona hi chahiye,
// warna storage ki insert policy rok degi.
await check('path school ke uuid se shuru hota hai', () => eq(uploaded?.path, objectPath))

await check('signed URL wapas aata hai', () =>
  String(uploaded?.url || '').includes('/student-photos/') || `URL galat: ${String(uploaded?.url).slice(0, 60)}`)

await check('signed URL me token hai (bucket private hai)', () =>
  String(uploaded?.url || '').includes('token=') || 'token nahi mila — bucket public to nahi ho gaya?')

// Ye asli bug tha: photo dobara chadhane par path wahi rehta hai, aur cache me
// padi purani signed URL nayi photo ko chhupa deti thi.
console.log('\ndobara chadhana')
await check('wahi path par dobara upload chal jaata hai (upsert)', async () => {
  const again = await uploadStudentPhoto(SCHOOL, STUDENT, file)
  return eq(again.path, objectPath)
})

await check('dobara upload par nayi signed URL milti hai (cache saaf hota hai)', async () => {
  const again = await uploadStudentPhoto(SCHOOL, STUDENT, file)
  return again.url !== uploaded.url || 'wahi purani cached URL wapas aa gayi'
})

console.log('\npadhna')
// Adapter ka read path photo_url pehle dekhta hai, phir photo_path sign karta
// hai. Yahan sirf ye dekhna hai ki path se signed URL banti hai.
await check('bucket se signed URL ban jaati hai', async () => {
  const { data, error } = await supabase.storage.from('student-photos').createSignedUrl(objectPath, 60)
  if (error) return error.message
  return String(data?.signedUrl || '').includes('token=') || 'signed URL nahi bani'
})

// Purana raasta ab bhi mana karta hai — yahi wo error tha jo screen par aaya.
// Fix ye nahi hai ki ise chalu kar diya jaye; fix ye hai ki ab koi ise bulata
// hi nahi, kyunki photos bucket me jaati hain.
console.log('\npurana raasta')
await check('studentPhotos par likhna ab bhi mana hai', async () => {
  try {
    await databaseRequest(`studentPhotos/${SCHOOL}/${STUDENT}`, null, { method: 'PUT', body: 'data:image/jpeg;base64,xx' })
    return 'likh gaya — ye nahi hona chahiye tha'
  } catch (e) {
    return e.message.includes('support nahi hai') || `alag error: ${e.message}`
  }
})

console.log('\nsafai')
await check('photo hat jaati hai', async () => {
  await deleteStudentPhoto(SCHOOL, STUDENT)
  return (await objectExists()) === false || 'file abhi bhi bucket me hai'
})

console.log(`\n${'='.repeat(46)}`)
console.log(`PASS ${pass}   FAIL ${fail}`)
process.exitCode = fail ? 1 : 0

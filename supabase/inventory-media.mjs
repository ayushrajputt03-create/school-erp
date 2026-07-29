// Backup me kitni aur kaunsi images hain — upload se pehle ka hisaab.
import fs from 'node:fs'

const file = process.argv[2]
if (!file) { console.error('usage: node supabase/inventory-media.mjs <backup.json>'); process.exit(1) }
const db = JSON.parse(fs.readFileSync(file, 'utf8'))

const items = []
const isImg = (v) => typeof v === 'string' && v.startsWith('data:image/')

const push = (kind, schoolLegacy, ownerId, field, dataUrl) => {
  const m = dataUrl.match(/^data:(image\/[a-z+]+);base64,/)
  items.push({
    kind, schoolLegacy, ownerId, field,
    mime: m ? m[1] : 'unknown',
    bytes: Math.floor((dataUrl.length - (m ? m[0].length : 0)) * 0.75),
  })
}

for (const [sl, school] of Object.entries(db.schools || {})) {
  const p = school.profile || {}
  for (const f of ['logo', 'logoURL', 'schoolSealURL', 'principalSignatureURL']) {
    if (isImg(p[f])) push('school', sl, sl, f, p[f])
  }
  for (const bucket of ['students', 'deletedStudents']) {
    for (const [id, st] of Object.entries(school[bucket] || {})) {
      if (isImg(st?.photo_url)) push(bucket === 'students' ? 'student' : 'student_deleted', sl, id, 'photo_url', st.photo_url)
    }
  }
  for (const [id, e] of Object.entries(school.staff || {})) {
    if (isImg(e?.photoUrl)) push('staff', sl, id, 'photoUrl', e.photoUrl)
  }
}

// root/studentPhotos — ye node import hi nahi hua tha
for (const [sl, map] of Object.entries(db.studentPhotos || {})) {
  for (const [studentId, dataUrl] of Object.entries(map || {})) {
    if (isImg(dataUrl)) push('studentPhotos_node', sl, studentId, 'photo', dataUrl)
  }
}

const byKind = {}
for (const i of items) {
  byKind[i.kind] = byKind[i.kind] || { n: 0, bytes: 0 }
  byKind[i.kind].n++
  byKind[i.kind].bytes += i.bytes
}

console.log('KIND                  COUNT      SIZE')
console.log('-'.repeat(44))
let total = 0
let totalN = 0
for (const [k, v] of Object.entries(byKind).sort((a, b) => b[1].bytes - a[1].bytes)) {
  console.log(`${k.padEnd(22)} ${String(v.n).padStart(5)}   ${(v.bytes / 1024).toFixed(0).padStart(7)} KB`)
  total += v.bytes
  totalN += v.n
}
console.log('-'.repeat(44))
console.log(`${'KUL'.padEnd(22)} ${String(totalN).padStart(5)}   ${(total / 1024).toFixed(0).padStart(7)} KB`)

console.log('\nsabse badi 6:')
for (const i of items.sort((a, b) => b.bytes - a.bytes).slice(0, 6)) {
  console.log(`  ${(i.bytes / 1024).toFixed(0).padStart(5)} KB  ${i.mime.padEnd(12)} ${i.kind}/${i.field}  ${i.ownerId.slice(0, 26)}`)
}

console.log('\nmime breakdown:')
const mimes = {}
items.forEach((i) => { mimes[i.mime] = (mimes[i.mime] || 0) + 1 })
console.log(' ', JSON.stringify(mimes))

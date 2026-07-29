// ============================================================
// import-photos.mjs — saari base64 images ek jagah lata hai
//
//   node supabase/import-photos.mjs <backup.json> <outDir> [--apply]
//
// Do kaam:
//  1. root/studentPhotos node ko students.photo_url me daalta hai
//     (ye node pehle import me chhoot gaya tha — 7 photos kahin nahi thi)
//  2. saari 13 images disk pe nikaal deta hai, taaki Storage upload
//     ke liye taiyaar rahein
// ============================================================

import fs from 'node:fs'
import path from 'node:path'
import { connect } from './db.mjs'

const file = process.argv[2]
const outDir = process.argv[3]
const APPLY = process.argv.includes('--apply')
if (!file || !outDir) {
  console.error('usage: node supabase/import-photos.mjs <backup.json> <outDir> [--apply]')
  process.exit(1)
}

const db = JSON.parse(fs.readFileSync(file, 'utf8'))
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' }

const parse = (dataUrl) => {
  const m = String(dataUrl || '').match(/^data:(image\/[a-z+]+);base64,(.*)$/)
  if (!m) return null
  return { mime: m[1], ext: EXT[m[1]] || 'bin', buf: Buffer.from(m[2], 'base64') }
}

const { client } = await connect()

// school legacy_id -> uuid  (Storage path me uuid hi jaata hai, RLS wahi check karti hai)
const schoolUuid = new Map(
  (await client.query('select legacy_id, id from public.schools')).rows.map((r) => [r.legacy_id, r.id])
)

fs.mkdirSync(outDir, { recursive: true })

const manifest = []
const add = (bucket, storagePath, mime, buf, table, column, matchCol, matchVal, schoolId) => {
  const disk = path.join(outDir, storagePath.replace(/[/\\]/g, '__'))
  fs.writeFileSync(disk, buf)
  manifest.push({ bucket, storagePath, mime, disk, bytes: buf.length, table, column, matchCol, matchVal, schoolId })
}

// ---------- school ke logo / seal / signature ----------
for (const [sl, school] of Object.entries(db.schools || {})) {
  const sid = schoolUuid.get(sl)
  if (!sid) continue
  const p = school.profile || {}
  for (const [field, column] of [
    ['logoURL', 'logo_url'], ['logo', 'logo_url'],
    ['schoolSealURL', 'seal_url'],
    ['principalSignatureURL', 'principal_signature_url'],
  ]) {
    const img = parse(p[field])
    if (!img) continue
    if (manifest.some((m) => m.table === 'schools' && m.column === column && m.matchVal === sid)) continue
    add('school-assets', `${sid}/${column}.${img.ext}`, img.mime, img.buf, 'schools', column, 'id', sid, sid)
  }
}

// ---------- staff photos ----------
for (const [sl, school] of Object.entries(db.schools || {})) {
  const sid = schoolUuid.get(sl)
  if (!sid) continue
  for (const [legacyId, e] of Object.entries(school.staff || {})) {
    const img = parse(e?.photoUrl)
    if (!img) continue
    add('student-photos', `${sid}/staff/${legacyId}.${img.ext}`, img.mime, img.buf, 'staff', 'photo_url', 'legacy_id', legacyId, sid)
  }
}

// ---------- students (inline + deletedStudents) ----------
for (const [sl, school] of Object.entries(db.schools || {})) {
  const sid = schoolUuid.get(sl)
  if (!sid) continue
  for (const bucket of ['students', 'deletedStudents']) {
    for (const [legacyId, st] of Object.entries(school[bucket] || {})) {
      const img = parse(st?.photo_url)
      if (!img) continue
      add('student-photos', `${sid}/students/${legacyId}.${img.ext}`, img.mime, img.buf, 'students', 'photo_url', 'legacy_id', legacyId, sid)
    }
  }
}

// ---------- root/studentPhotos — ye node import hi nahi hua tha ----------
let fromNode = 0
for (const [sl, map] of Object.entries(db.studentPhotos || {})) {
  const sid = schoolUuid.get(sl)
  if (!sid) continue
  for (const [studentLegacy, dataUrl] of Object.entries(map || {})) {
    const img = parse(dataUrl)
    if (!img) continue
    if (manifest.some((m) => m.table === 'students' && m.matchVal === studentLegacy)) continue
    add('student-photos', `${sid}/students/${studentLegacy}.${img.ext}`, img.mime, img.buf, 'students', 'photo_url', 'legacy_id', studentLegacy, sid)
    fromNode++
  }
}

fs.writeFileSync(path.join(outDir, '_manifest.json'), JSON.stringify(manifest.map(({ disk, ...r }) => ({ ...r, disk })), null, 2))

console.log(`nikali gayi images    : ${manifest.length}`)
console.log(`  studentPhotos node se: ${fromNode}  <- ye pehle kahin migrate hi nahi hui thi`)
console.log(`  kul size             : ${(manifest.reduce((a, m) => a + m.bytes, 0) / 1024).toFixed(0)} KB`)
console.log(`  folder               : ${outDir}`)

console.log('\nBUCKET          PATH                                              SIZE')
console.log('-'.repeat(80))
for (const m of manifest) {
  console.log(`${m.bucket.padEnd(15)} ${m.storagePath.slice(0, 48).padEnd(50)} ${(m.bytes / 1024).toFixed(0).padStart(5)} KB`)
}

// ---------- studentPhotos node ka data Postgres me daal do ----------
// (Storage pe jaane tak base64 hi sahi — data hona chahiye, kahin to ho)
if (APPLY) {
  try {
    await client.query('begin')
    let n = 0
    for (const [sl, map] of Object.entries(db.studentPhotos || {})) {
      const sid = schoolUuid.get(sl)
      if (!sid) continue
      for (const [studentLegacy, dataUrl] of Object.entries(map || {})) {
        if (!parse(dataUrl)) continue
        const res = await client.query(
          `update public.students set photo_url = $3
            where school_id = $1::uuid and legacy_id = $2
              and (photo_url is null or photo_url = '')`,
          [sid, studentLegacy, dataUrl]
        )
        n += res.rowCount
      }
    }
    await client.query('commit')
    console.log(`\nOK — studentPhotos node se ${n} students ki photo_url bhar di`)
  } catch (err) {
    await client.query('rollback').catch(() => {})
    console.error('\nFAIL:', err.message)
    process.exitCode = 1
  }
} else {
  console.log('\n(--apply lagao to studentPhotos node ka data Postgres me chala jayega)')
}

await client.end().catch(() => {})

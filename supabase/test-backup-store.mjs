// ============================================================
// test-backup-store.mjs — monthly backup ka data layer
//
//   node supabase/test-backup-store.mjs
//
// Ye suite us dikkat ke liye hai jo `api/admission.js` wali se bhi chupi hui
// thi: `api/monthly-backup.js` cutover me chhoot gaya tha aur seedha Firebase
// se padh raha tha. Cron har mahine chalta raha, school ko mail bhi jaati rahi
// — par usme cutover se PEHLE ka data tha. Backup "ban raha hai" dikh raha tha
// aur live data ka koi backup tha hi nahi. Aisi galti ka pata tabhi chalta hai
// jab backup ki sach me zarurat pad jaye, yaani sabse bure waqt par.
//
// Isliye yahan sabse ahem assertion "query chal gayi" nahi hai — ye hai ki
// schoolData() me ASLI school ka ASLI data aaye, poora aaye (1000 row par kata
// hua nahi), aur markSent() baaki backupSettings ko na uda de.
//
// Sandbox: NXT OpenERP (khaali school). Ant me sab mita diya jaata hai.
// ============================================================

import fs from 'node:fs'
for (const raw of fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const l = raw.trim(); if (!l || l.startsWith('#')) continue
  const i = l.indexOf('='); if (i < 0) continue
  process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim()
}
process.env.USE_SUPABASE = 'true'
process.env.VITE_USE_SUPABASE = 'true'

const { createRequire } = await import('node:module')
const require = createRequire(import.meta.url)
const { createStore, SHEETS } = require('../api/_backup-store.js')
const { createClient } = await import('@supabase/supabase-js')

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const SANDBOX = 'JfaU8V51U1cxkLqZRFzzbLdGhGD3'
const REAL = 'x6cLySP2vbc3D5CAfQJAomxfet33'

let pass = 0, fail = 0
const check = (label, ok, why) => ok === true
  ? (pass++, console.log(`  OK    ${label}`))
  : (fail++, console.log(`  FAIL  ${label}\n          ${why ?? ok}`))

const { data: sandboxSchool } = await admin.from('schools').select('id').eq('legacy_id', SANDBOX).maybeSingle()
const { data: realSchool } = await admin.from('schools').select('id').eq('legacy_id', REAL).maybeSingle()

const cleanup = () => admin.from('kv').delete().eq('school_id', sandboxSchool.id).eq('path', 'backupSettings')
await cleanup()

const store = createStore()

console.log('=== BACKEND ===')
check(`store Supabase par hai (mila: ${store.backend})`,
  store.backend === 'supabase' ? true : `${store.backend} — flag galat hai, test bekaar hai`)

/* ============================================================
   school list — cron isi se tay karta hai kise mail jayegi
   ============================================================ */
console.log('\n=== SCHOOL LIST ===')

// Cron sirf enabled+email wale school ko bhejta hai, isliye pehle sandbox par
// settings daal kar dekhte hain ki wo list me sach me aati hain.
await admin.from('kv').insert({
  school_id: sandboxSchool.id,
  path: 'backupSettings',
  value: { enabled: true, email: 'backup-test@example.com', frequency: 'monthly' },
})

const schools = await store.listSchools()
const sandboxRow = schools.find(s => s.schoolId === SANDBOX)
const realRow = schools.find(s => s.schoolId === REAL)

check(`saare school list me aaye (${schools.length})`,
  schools.length > 0 ? true : 'list khaali hai')
check('asli school list me hai aur uska naam bhi aaya',
  Boolean(realRow?.schoolName) ? true : `mila: ${JSON.stringify(realRow)}`)
check('schoolId legacy id hai, Supabase uuid nahi',
  realRow?.schoolId === REAL ? true : `mila: ${realRow?.schoolId}`)
check('kv me rakhi backupSettings list me wapas aayi',
  sandboxRow?.backupSettings?.enabled === true && sandboxRow?.backupSettings?.email === 'backup-test@example.com'
    ? true : `mila: ${JSON.stringify(sandboxRow?.backupSettings)}`)
check('jis school ki settings nahi hai uska backupSettings khaali object hai (crash nahi)',
  schools.every(s => s.backupSettings && typeof s.backupSettings === 'object')
    ? true : 'kisi school par backupSettings null/undefined hai')

/* ============================================================
   ASLI SAWAAL — backup me asli data aata hai ya nahi
   ============================================================ */
console.log('\n=== ASLI SCHOOL KA DATA ===')

const data = await store.schoolData(REAL)

check('teeno sheet ka data mila',
  SHEETS.every(node => Array.isArray(data[node])) ? true : `mila: ${JSON.stringify(Object.keys(data))}`)

for (const node of SHEETS) {
  check(`${node}: ${data[node].length} row (khaali nahi)`,
    data[node].length > 0 ? true : `0 row — backup me ye sheet khaali jayegi`)
}

// Ginti seedhe DB se milao. Ye wo assertion hai jo 1000-row wali chup-chaap
// katauti pakadti hai — PostgREST bina range ke 1000 par ruk jaata hai aur
// kata hua backup bilkul poore backup jaisa dikhta hai.
const countOf = async (table, extra = q => q) => {
  const { count } = await extra(admin.from(table).select('*', { count: 'exact', head: true }).eq('school_id', realSchool.id))
  return count
}
const expected = {
  students: await countOf('students'),
  fees: await countOf('fee_receipts', q => q.is('deleted_at', null)),
  attendance: await countOf('attendance'),
}
for (const node of SHEETS) {
  check(`${node}: poori ${expected[node]} row aayi, 1000 par kati nahi`,
    data[node].length === expected[node] ? true : `mili ${data[node].length}, honi chahiye ${expected[node]}`)
}

/* ============================================================
   rows ka shape — Excel me kaam ki dikhein
   ============================================================ */
console.log('\n=== ROW KA SHAPE ===')

const student = data.students[0]
check('har row par id hai (sheet me pehchaan ke liye)',
  data.students.every(r => r.id) ? true : 'kisi student row par id nahi')
check('`source` blob column ban kar sheet me nahi ja raha',
  !('source' in student) ? true : 'source column sheet me chala jayega — poora JSON ek cell me')
// Naam do jagah se aa sakta hai: `full_name` (typed column, har row par) ya
// `name`/`firstName` (purane RTDB document se, sirf migrate hui rows par).
// Backup ke liye sheet me koi ek hona kaafi hai — par HAR row par hona chahiye,
// warna kuch students bina naam ke backup me jaate hain.
const nameOf = r => r.full_name || r.name || r.studentName || r.firstName
check('har student row par naam hai',
  data.students.every(nameOf) ? true
    : `${data.students.filter(r => !nameOf(r)).length} row bina naam ke. pehli row ki keys: ${Object.keys(student).slice(0, 15).join(',')}`)

const attendanceRow = data.attendance[0]
check('attendance row par studentId hai (join se, source se nahi)',
  data.attendance.some(r => r.studentId)
    ? true : `kisi row par studentId nahi. keys: ${Object.keys(attendanceRow).join(',')}`)
check('attendance row par date hai',
  Boolean(attendanceRow.date) ? true : `keys: ${Object.keys(attendanceRow).join(',')}`)

/* ============================================================
   asli xlsx — jo file school ko mail me jayegi
   ============================================================ */
console.log('\n=== ASLI XLSX ===')

const { createWorkbook } = require('../api/monthly-backup.js')
const ExcelJS = (await import('exceljs')).default
const buffer = await createWorkbook(store, REAL)
const book = await new ExcelJS.Workbook().xlsx.load(buffer)

const sheetRows = name => (book.getWorksheet(name)?.rowCount ?? 0) - 1  // header hata kar
check(`workbook me teeno sheet hain (${book.worksheets.map(s => s.name).join(', ')})`,
  ['Students', 'Fees', 'Attendance'].every(n => book.getWorksheet(n))
    ? true : `mili: ${book.worksheets.map(s => s.name).join(',')}`)
check(`Students sheet me ${sheetRows('Students')} row (DB ki ${expected.students})`,
  sheetRows('Students') === expected.students ? true : 'sheet me row kam/zyada hain')
check(`Attendance sheet me ${sheetRows('Attendance')} row (DB ki ${expected.attendance})`,
  sheetRows('Attendance') === expected.attendance ? true : 'sheet me row kam/zyada hain')

// Postgres se aane wali rows me nested object hote hain (fee_items, payments).
// Bina sambhale ExcelJS unhe "[object Object]" likh deta hai — yaani wo data
// backup me hai hi nahi, aur cell bhara hua dikhta hai.
const feesSheet = book.getWorksheet('Fees')
const objectCells = []
feesSheet.eachRow((row, n) => {
  if (n === 1) return
  row.eachCell(cell => { if (String(cell.value).includes('[object Object]')) objectCells.push(`R${n}C${cell.col}`) })
})
check('kisi cell me "[object Object]" nahi hai (nested data khoya nahi)',
  objectCells.length === 0 ? true : `${objectCells.length} cell: ${objectCells.slice(0, 5).join(', ')}`)

/* ============================================================
   markSent — baaki settings na ude
   ============================================================ */
console.log('\n=== markSent ===')

const sentAt = Date.now()
await store.markSent(SANDBOX, sentAt)
const { data: after } = await admin.from('kv').select('value')
  .eq('school_id', sandboxSchool.id).eq('path', 'backupSettings').maybeSingle()

check('lastSentAt likha gaya',
  after?.value?.lastSentAt === sentAt ? true : `mila: ${after?.value?.lastSentAt}`)
// kv ek hi row me poora blob rakhta hai. Seedha upsert karne par enabled aur
// email ud jaate — agle mahine se us school ka backup chup-chaap band.
check('enabled aur email dono bache rahe (upsert ne blob nahi udaya)',
  after?.value?.enabled === true && after?.value?.email === 'backup-test@example.com'
    ? true : `mila: ${JSON.stringify(after?.value)}`)
check('baaki settings bhi bachi rahi',
  after?.value?.frequency === 'monthly' ? true : `mila: ${JSON.stringify(after?.value)}`)

// Jis school ki settings hi nahi hai, uspar markSent phatna nahi chahiye.
let unknownError = null
try { await store.markSent('is-naam-ka-koi-school-nahi', Date.now()) } catch (e) { unknownError = e.message }
check('anjaan school par markSent chup-chaap nikal jaata hai',
  unknownError === null ? true : `phat gaya: ${unknownError}`)

/* ============================================================
   dono backend ka interface ek jaisa ho
   ============================================================ */
console.log('\n=== DONO BACKEND KA INTERFACE ===')

// firebase-admin stub kar diya hai — service account waise bhi sirf Vercel me
// hai. Yahan sirf ye dekhna hai ki dono taraf wahi method maujood hain. Naam ka
// ek farak bhi galat flag par production tak chhupa rehta, aur rollback ke din
// pata chalta — jo sabse bura waqt hai pata chalne ka.
const stub = (name, exports) => {
  require.cache[require.resolve(name)] = { id: name, filename: name, loaded: true, exports }
}
const noopRef = () => ({ once: async () => ({ val: () => null }), set: async () => {} })
stub('firebase-admin/app', {
  getApps: () => [], getApp: () => ({}), initializeApp: () => ({}), cert: () => ({}),
})
stub('firebase-admin/database', { getDatabase: () => ({ ref: () => noopRef() }) })

process.env.USE_SUPABASE = 'false'
process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({ project_id: 'stub' })
delete require.cache[require.resolve('../api/_backup-store.js')]
const { createStore: createFirebaseStore } = require('../api/_backup-store.js')

let fbStore = null, fbMethods = null
try {
  fbStore = createFirebaseStore()
  fbMethods = Object.keys(fbStore).sort()
} catch (error) {
  fbMethods = `Firebase store bana hi nahi: ${error.message}`
}
const supaMethods = Object.keys(store).sort()
check('Firebase aur Supabase store ke method bilkul same hain',
  Array.isArray(fbMethods) && JSON.stringify(fbMethods) === JSON.stringify(supaMethods)
    ? true : `supabase: ${supaMethods.join(',')}\n          firebase: ${Array.isArray(fbMethods) ? fbMethods.join(',') : fbMethods}`)
check('Firebase store apne aap ko firebase batata hai',
  fbStore?.backend === 'firebase' ? true : `mila: ${fbStore?.backend}`)

await cleanup()
console.log(`\n${'='.repeat(46)}`)
console.log(`PASS ${pass}   FAIL ${fail}`)
process.exit(fail ? 1 : 0)

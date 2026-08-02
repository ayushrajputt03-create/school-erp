// ============================================================
// test-kv-modules.mjs — jin modules ki apni table nahi hai
//
//   node supabase/test-kv-modules.mjs
//
// Library, Transport, Expenses, Accounts, Timetable — ye sab `kv` table ke
// ek hi JSON blob me rehte hain. test-adapter-write.mjs kv ko ek banaye hue
// testNode par check karta hai; ye asli module paths par chalta hai, wahi
// jo App.jsx ke saveLibraryItem/saveTransportItem/saveExpenseItem bhejte hain.
//
// Sandbox: "NXT OpenERP School" (0 students) — asli client data ko haath
// nahi lagta. Ant me sab kuch mita diya jaata hai.
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

const { databaseRequest } = await import('../src/lib/dataAdapter.js')
const { connect } = await import('./db.mjs')

const SCHOOL = 'JfaU8V51U1cxkLqZRFzzbLdGhGD3' // NXT OpenERP — khaali sandbox
const S = `schools/${SCHOOL}`

let pass = 0
let fail = 0
const check = async (label, fn) => {
  try {
    const r = await fn()
    if (r === true) { pass++; console.log(`  OK    ${label}`) }
    else { fail++; console.log(`  FAIL  ${label}\n          ${r}`) }
  } catch (err) { fail++; console.log(`  FAIL  ${label}\n          ${err.message}`) }
}

const { client } = await connect()
const { rows: [school] } = await client.query('select id from schools where legacy_id = $1', [SCHOOL])

const KV_PATHS = ['library', 'transport', 'expenses', 'accounts', 'timetable']
const STUDENT = 'test_kv_student_001'

const cleanup = async () => {
  await client.query('delete from kv where school_id = $1 and path = any($2)', [school.id, KV_PATHS])
  await client.query('delete from students where school_id = $1 and legacy_id = $2', [school.id, STUDENT])
}
await cleanup()

// kv me kya pada hai, seedha DB se — adapter par bharosa kiye bina
const kvRaw = async (path) => {
  const { rows } = await client.query('select value from kv where school_id=$1 and path=$2', [school.id, path])
  return rows[0]?.value ?? null
}

console.log('=== LIBRARY (saveLibraryItem jaisa) ===')

const BOOK = 'BK-001-1'

await check('book save hui', async () => {
  await databaseRequest(`${S}/library/books/${BOOK}`, null, {
    method: 'PUT',
    body: {
      id: BOOK, title: 'Test Kitab', author: 'Test Lekhak', category: 'General',
      price: 250, availableCopies: 1, status: 'available',
      createdAt: Date.now(), updatedAt: Date.now(),
    },
  })
  const back = await databaseRequest(`${S}/library/books/${BOOK}`, null)
  return back?.title === 'Test Kitab' || `wapas nahi mili: ${JSON.stringify(back)}`
})

await check('DB me sach me ek hi kv row bani', async () => {
  const { rows } = await client.query("select count(*)::int n from kv where school_id=$1 and path='library'", [school.id])
  return rows[0].n === 1 || `${rows[0].n} rows`
})

await check('settings PUT ne books ko nahi udaya', async () => {
  await databaseRequest(`${S}/library/settings`, null, {
    method: 'PUT',
    body: { finePerDay: 5, maxFine: 500, maxBooksPerStudent: 3, defaultIssuePeriod: 14 },
  })
  const value = await kvRaw('library')
  if (!value?.settings) return 'settings hi nahi bani'
  return Boolean(value?.books?.[BOOK]) || `books ud gaye: ${Object.keys(value).join(',')}`
})

// Issue karna do jagah likhta hai — issue banti hai aur book ki gin­ti ghatti hai.
// Agar dono ek hi blob me theek se merge na hon to counts galat ho jaati hain.
await check('book issue hone par dono jagah update hui', async () => {
  const ISSUE = 'issue_test_001'
  await databaseRequest(`${S}/library/issues/${ISSUE}`, null, {
    method: 'PUT',
    body: { id: ISSUE, bookId: BOOK, studentId: STUDENT, status: 'issued', dueDate: '2026-08-20' },
  })
  await databaseRequest(`${S}/library/books/${BOOK}`, null, {
    method: 'PUT',
    body: { id: BOOK, title: 'Test Kitab', author: 'Test Lekhak', availableCopies: 0, status: 'issued' },
  })
  const value = await kvRaw('library')
  if (value?.issues?.[ISSUE]?.status !== 'issued') return 'issue nahi bani'
  if (value?.books?.[BOOK]?.availableCopies !== 0) return `copies ghati nahi: ${value?.books?.[BOOK]?.availableCopies}`
  return value?.settings?.finePerDay === 5 || 'settings ud gayi'
})

await check('book delete se sirf wahi book gayi', async () => {
  await databaseRequest(`${S}/library/books/${BOOK}`, null, { method: 'DELETE' })
  const value = await kvRaw('library')
  if (value?.books?.[BOOK]) return 'book abhi bhi hai'
  return Boolean(value?.issues?.issue_test_001) || 'issue bhi ud gaya — delete ne zyada mita diya'
})

console.log('\n=== TRANSPORT (composite node — allocations) ===')

// transport COMPOSITE me hai par uska koi sub-table nahi bana, isliye asal me
// poora kv se aata hai. Ye us raaste ki jaanch hai.
await check('route + vehicle save hue', async () => {
  await databaseRequest(`${S}/transport/routes/route_test_001`, null, {
    method: 'PUT', body: { id: 'route_test_001', name: 'Test Route', fare: 800 },
  })
  await databaseRequest(`${S}/transport/vehicles/veh_test_001`, null, {
    method: 'PUT', body: { id: 'veh_test_001', number: 'UP00XX0000', capacity: 40 },
  })
  const back = await databaseRequest(`${S}/transport`, null)
  if (back?.routes?.route_test_001?.name !== 'Test Route') return `route nahi mila: ${JSON.stringify(back?.routes)}`
  return back?.vehicles?.veh_test_001?.capacity === 40 || 'vehicle nahi mila'
})

// Allocation sabse nazuk hai: kv likhna + students table PATCH, do alag storage.
await check('allocation kv aur student dono me lagi', async () => {
  await databaseRequest(`${S}/students/${STUDENT}`, null, {
    method: 'PATCH',
    body: { full_name: 'KV Test', admission_number: '9101', class_name: '5', section: 'A', active: true },
  })
  const ALLOC = 'alloc_test_001'
  const row = { id: ALLOC, studentId: STUDENT, routeId: 'route_test_001', routeName: 'Test Route', stopName: 'Test Stop' }
  await databaseRequest(`${S}/transport/allocations/${ALLOC}`, null, { method: 'PUT', body: row })
  await databaseRequest(`${S}/students/${STUDENT}`, null, {
    method: 'PATCH', body: { transportAllocated: true, transportInfo: row },
  })

  const value = await kvRaw('transport')
  if (value?.allocations?.[ALLOC]?.stopName !== 'Test Stop') return `kv me allocation nahi: ${JSON.stringify(value?.allocations)}`
  const student = await databaseRequest(`${S}/students/${STUDENT}`, null)
  if (student?.transportAllocated !== true) return 'student par flag nahi laga'
  return student?.transportInfo?.routeName === 'Test Route' || `transportInfo galat: ${JSON.stringify(student?.transportInfo)}`
})

await check('composite GET routes aur allocations dono deta hai', async () => {
  const back = await databaseRequest(`${S}/transport`, null)
  const keys = Object.keys(back || {}).sort().join(',')
  return keys === 'allocations,routes,vehicles' || `keys: ${keys}`
})

console.log('\n=== EXPENSES (nested — salary/structures) ===')

// Expenses do level gehra jaata hai (salary/structures/{id}). setDeep/digInto
// ka asli test yahi hai.
await check('gehra nested path bana', async () => {
  await databaseRequest(`${S}/expenses/salary/structures/struct_test_001`, null, {
    method: 'PUT', body: { id: 'struct_test_001', staffId: 'x', basic: 20000, hra: 4000 },
  })
  const back = await databaseRequest(`${S}/expenses/salary/structures/struct_test_001`, null)
  return back?.basic === 20000 || `wapas nahi mila: ${JSON.stringify(back)}`
})

await check('bhai-bandhu key par likhne se pehli nahi udi', async () => {
  await databaseRequest(`${S}/expenses/salary/payments/pay_test_001`, null, {
    method: 'PUT', body: { id: 'pay_test_001', monthKey: '2026-08', amount: 24000 },
  })
  const value = await kvRaw('expenses')
  if (!value?.salary?.payments?.pay_test_001) return 'payment nahi bana'
  return Boolean(value?.salary?.structures?.struct_test_001) || 'structure ud gaya'
})

await check('alag node (items) par likhne se salary nahi udi', async () => {
  await databaseRequest(`${S}/expenses/items/exp_test_001`, null, {
    method: 'PUT', body: { id: 'exp_test_001', head: 'Stationery', amount: 1500, date: '2026-08-02' },
  })
  const value = await kvRaw('expenses')
  if (value?.items?.exp_test_001?.amount !== 1500) return 'item nahi bana'
  return Boolean(value?.salary?.structures?.struct_test_001) || 'salary ud gayi'
})

await check('gehra DELETE sirf ek key hatata hai', async () => {
  await databaseRequest(`${S}/expenses/salary/payments/pay_test_001`, null, { method: 'DELETE' })
  const value = await kvRaw('expenses')
  if (value?.salary?.payments?.pay_test_001) return 'payment abhi bhi hai'
  if (!value?.salary?.structures?.struct_test_001) return 'structure bhi ud gaya'
  return Boolean(value?.items?.exp_test_001) || 'items bhi ud gaye'
})

console.log('\n=== TIMETABLE + ACCOUNTS ===')

await check('timetable class-wise array save hua', async () => {
  await databaseRequest(`${S}/timetable/5-A`, null, {
    method: 'PUT',
    body: [
      { day: 'Mon', period: 1, subject: 'Hindi', teacher: 'T1' },
      { day: 'Mon', period: 2, subject: 'Maths', teacher: 'T2' },
    ],
  })
  const back = await databaseRequest(`${S}/timetable/5-A`, null)
  if (!Array.isArray(back)) return `array nahi raha: ${typeof back}`
  return back[1]?.subject === 'Maths' || `galat data: ${JSON.stringify(back)}`
})

await check('accounts entry save hui', async () => {
  await databaseRequest(`${S}/accounts/entries/acc_test_001`, null, {
    method: 'PUT', body: { id: 'acc_test_001', type: 'credit', amount: 5000, note: 'test' },
  })
  const back = await databaseRequest(`${S}/accounts/entries/acc_test_001`, null)
  return back?.amount === 5000 || `wapas nahi mila: ${JSON.stringify(back)}`
})

console.log('\n=== EK HI CALL ME KAI MODULE (multi-path) ===')

// App.jsx 21 jagah khaali path par PATCH karta hai. Agar ek hi call me do alag
// kv nodes hon to dono alag rows me jaani chahiye, ek doosre ko udaye bina.
await check('do alag kv node ek saath likhe gaye', async () => {
  await databaseRequest('', null, {
    method: 'PATCH',
    body: {
      [`${S}/library/categories/cat_test_001`]: { id: 'cat_test_001', name: 'Science' },
      [`${S}/accounts/entries/acc_test_002`]: { id: 'acc_test_002', type: 'debit', amount: 300 },
    },
  })
  const lib = await kvRaw('library')
  const acc = await kvRaw('accounts')
  if (lib?.categories?.cat_test_001?.name !== 'Science') return 'library category nahi bani'
  if (acc?.entries?.acc_test_002?.amount !== 300) return 'accounts entry nahi bani'
  // aur purana data dono me bacha rehna chahiye
  if (!lib?.settings?.finePerDay) return 'library settings ud gayi'
  return Boolean(acc?.entries?.acc_test_001) || 'purani accounts entry ud gayi'
})

console.log('\n=== SAFAI ===')
await cleanup()
const { rows: left } = await client.query(
  `select (select count(*)::int from kv where school_id=$1 and path = any($2)) k,
          (select count(*)::int from students where school_id=$1) s`,
  [school.id, KV_PATHS]
)
console.log(`  bacha hua: kv=${left[0].k} students=${left[0].s}`)

await client.end()
console.log(`\n${'='.repeat(46)}`)
console.log(`PASS ${pass}   FAIL ${fail}`)
process.exitCode = fail ? 1 : 0

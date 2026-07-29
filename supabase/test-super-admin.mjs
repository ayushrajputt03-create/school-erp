// ============================================================
// test-super-admin.mjs — owner console ke teen RPC
//
//   node supabase/test-super-admin.mjs
//
// Do cheezein sabse zaroori hain:
//
//   1. Super admin ko TEENO school dikhein. RLS har school ko uske owner tak
//      seemit rakhti hai, aur ayushrajputt03@gmail.com khud bhi Northstar ka
//      owner hai — bina 0019 ke use sirf ek school dikhta.
//   2. Baaki kisi ko kuch na dikhe. Ye function SECURITY DEFINER hai, matlab
//      RLS ko bypass karta hai — iska darwaza galti se khula reh gaya to har
//      teacher poore database ka billing data padh lega.
//
// Har cheez ek transaction me hoti hai jo ant me rollback ho jaati hai —
// asli data kabhi nahi badalta.
// ============================================================

import { connect } from './db.mjs'

let pass = 0, fail = 0
const check = (label, ok, why) => ok === true
  ? (pass++, console.log(`  OK    ${label}`))
  : (fail++, console.log(`  FAIL  ${label}\n          ${why ?? ok}`))

const { client } = await connect()

const EMAILS = {
  superAdmin: 'ayushrajputt03@gmail.com',
  otherOwner: 'trivenitriratanpublicschool@gmail.com',
  teacher: '8750230223@tritri619.teacher.schoolerp.app',
}
const uid = Object.fromEntries(await Promise.all(
  Object.entries(EMAILS).map(async ([k, email]) => {
    const { rows } = await client.query('select id from auth.users where email = $1', [email])
    if (!rows[0]) throw new Error(`auth user nahi mila: ${email}`)
    return [k, rows[0].id]
  })
))

/** Ek user ban ke chalao, phir sab wapas mita do */
async function as (who, fn) {
  await client.query('begin')
  await client.query('set local role authenticated')
  await client.query(`set local request.jwt.claims = '{"sub":"${uid[who]}","role":"authenticated"}'`)
  try { return await fn() } finally { await client.query('rollback') }
}

/** Ek statement ko alag savepoint me chalata hai, taaki fail hone par baaki test chalte rahein */
async function tryQuery (sql, params) {
  await client.query('savepoint sp')
  try {
    const r = await client.query(sql, params)
    await client.query('release savepoint sp')
    return { ok: true, rows: r.rows }
  } catch (e) {
    await client.query('rollback to savepoint sp')
    return { ok: false, message: e.message }
  }
}

console.log('=== KAUN SUPER ADMIN HAI ===')

for (const who of ['superAdmin', 'otherOwner', 'teacher']) {
  await as(who, async () => {
    const { rows } = await client.query('select public.is_super_admin() b')
    check(`${who} -> is_super_admin ${who === 'superAdmin'}`,
      rows[0].b === (who === 'superAdmin') ? true : `mila ${rows[0].b}`)
  })
}

console.log('\n=== SAARE SCHOOL DIKHTE HAIN ===')

// Pehle sach jaan lo — service role se, bina RLS ke
const truth = Object.fromEntries((await client.query(`
  select s.legacy_id,
         (select count(*) from students st where st.school_id = s.id and st.deleted_at is null) students,
         (select count(*) from staff f where f.school_id = s.id) staff
    from schools s`)).rows.map(r => [r.legacy_id, r]))

await as('superAdmin', async () => {
  const { rows } = await client.query('select public.super_admin_schools() j')
  const data = rows[0].j

  check(`teeno school dikhe (${Object.keys(data).length})`,
    Object.keys(data).length === Object.keys(truth).length
      ? true : `mile ${Object.keys(data).length}, hone chahiye ${Object.keys(truth).length}`)

  for (const [legacyId, expected] of Object.entries(truth)) {
    const got = data[legacyId]
    if (!got) { check(`${legacyId} aaya`, `nahi aaya`); continue }
    const students = Object.keys(got.students || {}).length
    const staff = Object.keys(got.staff || {}).length
    check(`${got.profile?.schoolName}: ${students} student, ${staff} staff`,
      students === Number(expected.students) && staff === Number(expected.staff)
        ? true : `mila ${students}/${staff}, hona chahiye ${expected.students}/${expected.staff}`)
  }

  const one = Object.values(data)[0]
  check('createdAt epoch ms me hai (UI Date(...) karta hai)',
    Number(one.createdAt) > 1_500_000_000_000 ? true : `mila ${one.createdAt}`)
  check('profile me schoolName hai',
    Object.values(data).every(v => v.profile?.schoolName) ? true : 'kisi school ka naam khaali hai')
})

console.log('\n=== BAAKI KISI KO KUCH NAHI ===')

for (const who of ['otherOwner', 'teacher']) {
  await as(who, async () => {
    const read = await tryQuery('select public.super_admin_schools() j')
    check(`${who} saare school nahi padh sakta`, read.ok === false ? true : 'padh liya!')

    const write = await tryQuery(
      `select public.super_admin_patch($1::jsonb)`,
      [JSON.stringify({ 'schools/x6cLySP2vbc3D5CAfQJAomxfet33/subscription/pricingType': 'free' })])
    check(`${who} pricing nahi badal sakta`, write.ok === false ? true : 'badal diya!')

    // Ye sabse gehra check hai — table par ek bhi policy nahi honi chahiye,
    // warna koi apne aap ko super admin bana lega.
    const own = await tryQuery(`insert into super_admins (email) values ('hacker@example.com')`)
    check(`${who} khud ko super admin nahi bana sakta`, own.ok === false ? true : 'bana liya!')

    const peek = await tryQuery('select count(*) c from super_admins')
    check(`${who} ko super_admins list nahi dikhti`,
      peek.ok === false || Number(peek.rows[0].c) === 0 ? true : `${peek.rows[0].c} rows dikhi`)
  })
}

console.log('\n=== LIKHNA ===')

await as('superAdmin', async () => {
  const S = 'JfaU8V51U1cxkLqZRFzzbLdGhGD3'   // NXT OpenERP — khaali school

  // Is school ki subscription row hai hi nahi. Pehle version me pehla pricing
  // change chup-chaap gir jaata tha; ab function row bana leta hai.
  const before = await client.query('select count(*) c from subscriptions sub join schools s on s.id=sub.school_id where s.legacy_id=$1', [S])
  check('sandbox school ki subscription row abhi nahi hai',
    Number(before.rows[0].c) === 0 ? true : 'pehle se hai — test ka matlab badal gaya')

  await client.query('select public.super_admin_patch($1::jsonb)', [JSON.stringify({
    [`schools/${S}/subscription/pricingType`]: 'free',
    [`schools/${S}/subscription/isFree`]: true,
    [`schools/${S}/subscription/status`]: 'free',
    [`schools/${S}/subscription/pricingHistory/H1`]: { type: 'free', changedBy: 'super-admin' },
    [`schools/${S}/profile/city`]: 'Ghaziabad',
    [`schools/${S}/name`]: 'NXT OpenERP School',
    [`schools/${S}/payments/PAY1`]: { amount: 999, mode: 'UPI' },
  })])

  const { rows } = await client.query('select public.super_admin_schools() j')
  const got = rows[0].j[S]

  check('subscription row ban gayi aur pricing lagi',
    got.subscription?.pricingType === 'free' ? true : JSON.stringify(got.subscription))
  check('nested pricingHistory lagi',
    got.subscription?.pricingHistory?.H1?.type === 'free' ? true : JSON.stringify(got.subscription?.pricingHistory))
  check('profile ka city laga',
    got.profile?.city === 'Ghaziabad' ? true : `mila ${got.profile?.city}`)
  check('payment ledger bana',
    got.payments?.PAY1?.amount === 999 ? true : JSON.stringify(got.payments))

  // Ye check RLS ke bahar karna padta hai: super admin bhi asal me Northstar ka
  // owner hai, to `authenticated` role me use NXT OpenERP ki row dikhti hi nahi.
  await client.query('reset role')
  const col = await client.query('select city from schools where legacy_id=$1', [S])
  await client.query('set local role authenticated')
  check('profile typed column me bhi project hua',
    col.rows[0]?.city === 'Ghaziabad' ? true : `column me ${col.rows[0]?.city}`)

  const bad = await tryQuery('select public.super_admin_patch($1::jsonb)',
    [JSON.stringify({ 'schools/nahi-hai/profile/city': 'X' })])
  check('anjaan school par likhna mana hai', bad.ok === false ? true : 'likh diya!')

  const worse = await tryQuery('select public.super_admin_patch($1::jsonb)',
    [JSON.stringify({ [`schools/${S}/students/stu1/fullName`]: 'Hack' })])
  check('console students ko nahi chhoo sakta', worse.ok === false ? true : 'chhoo liya!')
})

await client.end()
console.log(`\n${'='.repeat(46)}`)
console.log(`PASS ${pass}   FAIL ${fail}`)
process.exit(fail ? 1 : 0)

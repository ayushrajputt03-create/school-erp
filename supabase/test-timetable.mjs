// ============================================================
// test-timetable.mjs — timetable ka pure logic
//
//   node supabase/test-timetable.mjs
//
// Iske liye database ki zarurat nahi. src/lib/timetable.js me koi Supabase
// call hai hi nahi — clash, overlap, kram aur naam padhne ka saara faisla
// wahin hota hai, aur wahi cheezein galat hone par timetable chup-chaap galat
// dikhta hai. Isliye unhe yahan seedhe jaancha jaata hai.
// ============================================================

import {
  TIMETABLE_DAYS, dayName, formatTime, formatRange, periodLabel, toInputTime,
  sortPeriods, validatePeriods, buildGrid, isEmptySlot, classKey,
  findTeacherClash, findAllClashes, teacherWeek, teacherWorkload, assignableTeachers,
} from '../src/lib/timetable.js'

let pass = 0, fail = 0
const check = (label, fn) => {
  try { const r = fn(); r === true ? (pass++, console.log(`  OK    ${label}`)) : (fail++, console.log(`  FAIL  ${label}\n          ${r}`)) }
  catch (e) { fail++; console.log(`  ERROR ${label}\n          ${e.message}`) }
}
const eq = (got, want) => JSON.stringify(got) === JSON.stringify(want) ? true : `mila ${JSON.stringify(got)}, chahiye tha ${JSON.stringify(want)}`

/* ── fixtures ──────────────────────────────────────────────── */

const P1 = { id: 'p1', period_number: 1, start_time: '09:00:00', end_time: '09:45:00', is_break: false }
const P2 = { id: 'p2', period_number: 2, start_time: '09:45:00', end_time: '10:30:00', is_break: false }
const PB = { id: 'pb', period_number: 3, start_time: '10:30:00', end_time: '11:15:00', is_break: true }
const P4 = { id: 'p4', period_number: 4, start_time: '11:15:00', end_time: '12:00:00', is_break: false }
const PERIODS = [P1, P2, PB, P4]

const slot = (over = {}) => ({
  class_name: '10', section: 'A', day_of_week: 1, period_id: 'p1',
  subject: 'Maths', teacher_id: 't1', teacher_name: 'Mr. Sharma', room: '', ...over,
})

/* ── time ──────────────────────────────────────────────────── */

console.log('\ntime')
check('Postgres time 12-hour me badalta hai', () => eq(formatTime('09:00:00'), '9:00 AM'))
check('dopahar 12 PM hai, 0 AM nahi', () => eq(formatTime('12:00:00'), '12:00 PM'))
check('raat 12 AM hai', () => eq(formatTime('00:30:00'), '12:30 AM'))
check('shaam ka waqt PM hai', () => eq(formatTime('13:05:00'), '1:05 PM'))
check('galat time khaali lautata hai', () => eq(formatTime('bakwaas'), ''))
check('range dono taraf AM/PM dikhati hai', () => eq(formatRange('11:15:00', '12:00:00'), '11:15 AM - 12:00 PM'))
check('input ke liye HH:MM', () => eq(toInputTime('9:05:00'), '09:05'))
check('period label me naam aur time dono', () => eq(periodLabel(P1), 'Period 1 (9:00 AM - 9:45 AM)'))
check('break ka label Break hai', () => eq(periodLabel(PB), 'Break (10:30 AM - 11:15 AM)'))
check('custom label period number ko hataata hai', () =>
  eq(periodLabel({ ...P1, label: 'Assembly' }), 'Assembly (9:00 AM - 9:45 AM)'))

/* ── days ──────────────────────────────────────────────────── */

console.log('\ndays')
check('chhe din, Monday se Saturday', () => eq(TIMETABLE_DAYS.map(d => d.short), ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']))
check('1 = Monday', () => eq(dayName(1), 'Monday'))
check('6 = Saturday', () => eq(dayName(6), 'Saturday'))
check('Sunday hai hi nahi', () => eq(dayName(7), ''))

/* ── periods ───────────────────────────────────────────────── */

console.log('\nperiods')
check('periods ghadi ke hisaab se lagte hain, number se nahi', () =>
  eq(sortPeriods([P4, P1, PB, P2]).map(p => p.id), ['p1', 'p2', 'pb', 'p4']))
check('sahi periods par koi error nahi', () => eq(validatePeriods(PERIODS), []))
check('duplicate period number pakda jaata hai', () => {
  const errors = validatePeriods([P1, { ...P2, period_number: 1 }])
  return errors.some(e => e.message.includes('already exists')) || `mila ${JSON.stringify(errors)}`
})
check('ulta time pakda jaata hai', () => {
  const errors = validatePeriods([{ ...P1, end_time: '08:00:00' }])
  return errors.some(e => e.message.includes('must be after')) || `mila ${JSON.stringify(errors)}`
})
// Ye wo jaanch hai jo database nahi kar sakta — do overlapping rows alag-alag
// bilkul valid hain, saath me hone par hi galat hain.
check('overlap pakda jaata hai (database ye nahi rok sakta)', () => {
  const errors = validatePeriods([P1, { ...P2, start_time: '09:30:00' }])
  return errors.some(e => e.message.includes('overlaps')) || `mila ${JSON.stringify(errors)}`
})
check('beech me gap chalta hai (recess)', () =>
  eq(validatePeriods([P1, { ...P2, start_time: '10:00:00', end_time: '10:45:00' }]), []))
check('bina time ke period error deta hai', () => {
  const errors = validatePeriods([{ period_number: 1, start_time: '', end_time: '' }])
  return errors.length >= 2 || `sirf ${errors.length} error mile`
})

/* ── grid ──────────────────────────────────────────────────── */

console.log('\ngrid')
check('grid period aur day se index hota hai', () => {
  const grid = buildGrid([slot(), slot({ day_of_week: 2, subject: 'English' })])
  return eq(grid.p1[1].subject, 'Maths') === true && eq(grid.p1[2].subject, 'English') === true
    ? true : `mila ${JSON.stringify(grid)}`
})
check('galat din grid me nahi aata', () => eq(buildGrid([slot({ day_of_week: 9 })]), {}))
check('bina period_id ka slot grid me nahi aata', () => eq(buildGrid([slot({ period_id: null })]), {}))
check('khaali slot pehchana jaata hai', () =>
  eq(isEmptySlot({ subject: '  ', teacher_id: '', teacher_name: '' }), true))
check('sirf subject wala slot khaali nahi hai', () =>
  eq(isEmptySlot({ subject: 'Maths', teacher_id: '', teacher_name: '' }), false))
check('class key 10-A banti hai', () => eq(classKey('10', 'A'), '10-A'))

/* ── clash ─────────────────────────────────────────────────── */

console.log('\nteacher clash')
const existing = [
  slot({ class_name: '9', section: 'B', day_of_week: 1, period_id: 'p1', teacher_id: 't1' }),
  slot({ class_name: '9', section: 'B', day_of_week: 2, period_id: 'p1', teacher_id: 't2' }),
]
check('wahi teacher usi din usi period me dusri class me = clash', () => {
  const clash = findTeacherClash(existing, { className: '10', section: 'A', day: 1, periodId: 'p1', teacherId: 't1' })
  return eq(clash?.class_name, '9')
})
check('alag din par clash nahi', () =>
  eq(findTeacherClash(existing, { className: '10', section: 'A', day: 3, periodId: 'p1', teacherId: 't1' }), null))
check('alag period par clash nahi', () =>
  eq(findTeacherClash(existing, { className: '10', section: 'A', day: 1, periodId: 'p2', teacherId: 't1' }), null))
// Apni hi cell dobara save karna clash nahi hai — warna admin apna banaya hua
// timetable kabhi edit hi nahi kar paata.
check('apni hi class ki cell dobara save karna clash nahi', () =>
  eq(findTeacherClash(existing, { className: '9', section: 'B', day: 1, periodId: 'p1', teacherId: 't1' }), null))
check('bina teacher ke clash nahi', () =>
  eq(findTeacherClash(existing, { className: '10', section: 'A', day: 1, periodId: 'p1', teacherId: '' }), null))

check('poore grid ki jaanch clash lautati hai', () => {
  const pending = [slot({ day_of_week: 1, period_id: 'p1', teacher_id: 't1' })]
  const clashes = findAllClashes(pending, existing, { className: '10', section: 'A' })
  return eq(clashes.length, 1)
})
check('apni purani rows clash nahi banti', () => {
  const own = [slot({ class_name: '10', section: 'A', day_of_week: 1, period_id: 'p1', teacher_id: 't1' })]
  const pending = [slot({ day_of_week: 1, period_id: 'p1', teacher_id: 't1' })]
  return eq(findAllClashes(pending, own, { className: '10', section: 'A' }), [])
})
// Grid ke andar hi do cell ek teacher ko ek waqt par nahi de sakte — ye
// existing rows se nahi, aapas me takrata hai.
check('naye slots aapas me takrayen to bhi pakda jaata hai', () => {
  const pending = [
    slot({ class_name: '10', section: 'A', day_of_week: 1, period_id: 'p1', teacher_id: 't1' }),
    slot({ class_name: '10', section: 'B', day_of_week: 1, period_id: 'p1', teacher_id: 't1' }),
  ]
  return eq(findAllClashes(pending, [], { className: '10', section: 'A' }).length, 1)
})

/* ── teacher views ─────────────────────────────────────────── */

console.log('\nteacher views')
const week = [
  slot({ day_of_week: 3, period_id: 'p4', teacher_id: 't1' }),
  slot({ day_of_week: 1, period_id: 'p2', teacher_id: 't1' }),
  slot({ day_of_week: 1, period_id: 'p1', teacher_id: 't1' }),
  slot({ day_of_week: 2, period_id: 'p1', teacher_id: 't9' }),
]
check('teacher ka hafta din phir time se sorted hai', () =>
  eq(teacherWeek(week, PERIODS, 't1').map(r => `${r.day}:${r.period.id}`), ['1:p1', '1:p2', '3:p4']))
check('dusre teacher ke slot nahi aate', () =>
  eq(teacherWeek(week, PERIODS, 't1').every(r => r.slot.teacher_id === 't1'), true))
check('hafte me time bhi aata hai', () => eq(teacherWeek(week, PERIODS, 't1')[0].time, '9:00 AM - 9:45 AM'))
check('bina teacherId ke khaali hafta', () => eq(teacherWeek(week, PERIODS, ''), []))

check('workload period ginta hai', () => {
  const rows = teacherWorkload(week)
  return eq(rows.find(r => r.teacherId === 't1')?.periods, 3)
})
check('workload zyada period wale ko upar rakhta hai', () => eq(teacherWorkload(week)[0].teacherId, 't1'))
// Purane data me teacher ka sirf naam pada hai, staff record se juda nahi.
// Wo kaam totals se gayab nahi hona chahiye — usi ko reassign karna hai.
check('bina link wala teacher bhi totals me dikhta hai', () => {
  const rows = teacherWorkload([slot({ teacher_id: null, teacher_name: 'NK' })])
  return eq(rows[0].linked, false) === true && eq(rows[0].teacherName, 'NK') === true ? true : JSON.stringify(rows)
})
check('khaali slot workload me nahi ginta', () =>
  eq(teacherWorkload([slot({ subject: '', teacher_id: null, teacher_name: '' })]), []))

/* ── assignable teachers ───────────────────────────────────── */

console.log('\nassignable teachers')
check('full_name se naam banta hai', () =>
  eq(assignableTeachers([{ id: 'a', full_name: 'Asha Verma' }])[0].name, 'Asha Verma'))
check('first+last se naam banta hai', () =>
  eq(assignableTeachers([{ id: 'b', first_name: 'Ravi', last_name: 'Gupta' }])[0].name, 'Ravi Gupta'))
check('naam na ho to email chalta hai', () =>
  eq(assignableTeachers([{ id: 'c', email: 'x@y.z' }])[0].name, 'x@y.z'))
check('inactive staff dropdown me nahi aate', () =>
  eq(assignableTeachers([{ id: 'd', full_name: 'Purana', active: false }]), []))
check('bina id ke record nahi aata', () =>
  eq(assignableTeachers([{ full_name: 'Bin Id' }]), []))
check('naam ke hisaab se sorted', () =>
  eq(assignableTeachers([{ id: '1', full_name: 'Zoya' }, { id: '2', full_name: 'Amit' }]).map(t => t.name), ['Amit', 'Zoya']))
check('object shape bhi chalti hai (staff node)', () =>
  eq(assignableTeachers({ u1: { full_name: 'Sunita' } })[0].id, 'u1'))

console.log(`\n${'='.repeat(46)}`)
console.log(`PASS ${pass}   FAIL ${fail}`)
process.exitCode = fail ? 1 : 0

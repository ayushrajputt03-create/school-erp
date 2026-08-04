// ============================================================
// test-report-columns.mjs — report card ke per-exam columns
//
//   node supabase/test-report-columns.mjs
//
// Ye suite live DB ko haath nahi lagati — buildMarksTable ek pure function hai,
// isliye yahan asli khatra network nahi, REGRESSION hai.
//
// Report card ek document hai jo parent sambhal kar rakhta hai. Isliye sabse
// pehla aur sabse ahem assertion ye hai ki JIS school ne abhi tak sirf ek hi
// exam ke marks bhare hain (aur live me abhi yahi haal hai — do record, dono
// preset_0 par), uska card bilkul waisa hi chhape jaisa pehle chhapta tha.
// Naye column tabhi aayein jab doosre exam me sach me marks pade hon.
//
// Baaki teen cheezein jo chupke se toot sakti hain:
//   - khaali cell ko zero maan lena (jo student exam me baitha hi nahi, uska
//     average neeche gir jayega)
//   - Overall ko sum bana dena (25 ka Unit Test + 100 ka Annual = bakwaas)
//   - inline edit ka index khisak jana (galat subject me marks chale jayein)
// ============================================================

import { buildMarksTable, orderExams, hasMark } from '../src/lib/reportColumns.js'

let pass = 0, fail = 0
const check = (label, ok, why) => ok === true
  ? (pass++, console.log(`  OK    ${label}`))
  : (fail++, console.log(`  FAIL  ${label}\n          ${why ?? ok}`))

const exam = (id, name, examDate, maxMarks = 100) => ({ id, name, examDate, maxMarks, enabled: true })

const record = (examId, studentId, subjects) => ({
  examId,
  studentId,
  subjects: subjects.map(([subject, obtained, maxMarks]) => ({ subject, obtained, maxMarks })),
})

// calculateReport() jaisa summary — sirf utna hi jitna buildMarksTable padhta hai.
const summary = subjects => ({ subjects: subjects.map(([subject, obtained, maxMarks]) => ({ subject, obtained, maxMarks })) })

const UT1 = exam('preset_0', 'Unit Test 1', '2026-07-10', 25)
const HALF = exam('half', 'Half Yearly Examination', '2026-09-20', 100)
const ANNUAL = exam('annual', 'Annual Examination', '2027-03-05', 100)

console.log('\n--- 1. Ek hi exam wale school ka card nahi badalna chahiye ---\n')
{
  const table = buildMarksTable({
    activeExam: UT1,
    activeSummary: summary([['English', 20, 25], ['Hindi', 18, 25]]),
    exams: { preset_0: UT1, half: HALF, annual: ANNUAL },
    marks: { 'preset_0_s1': record('preset_0', 's1', [['English', 20, 25], ['Hindi', 18, 25]]) },
    studentId: 's1',
  })
  check('multi false rehta hai jab sirf active exam me marks hain', table.multi === false, `multi=${table.multi}`)
  check('sirf ek column banta hai', table.columns.length === 1, `${table.columns.length} columns`)
  check('row count wahi rehta hai', table.rows.length === 2, `${table.rows.length} rows`)
  check('cell value summary se aati hai', table.rows[0].cells[0].obtained === 20, JSON.stringify(table.rows[0]))
}

console.log('\n--- 2. Khaali exam ka column nahi banna chahiye ---\n')
{
  const table = buildMarksTable({
    activeExam: UT1,
    activeSummary: summary([['English', 20, 25]]),
    exams: { preset_0: UT1, half: HALF },
    // Half Yearly ka record maujood hai par sab blank — student abhi baitha hi nahi.
    marks: {
      'preset_0_s1': record('preset_0', 's1', [['English', 20, 25]]),
      'half_s1': record('half', 's1', [['English', '', 100]]),
    },
    studentId: 's1',
  })
  check('blank-only exam ka column skip hota hai', table.columns.length === 1, JSON.stringify(table.columns))
  check('multi false rehta hai', table.multi === false, `multi=${table.multi}`)
}

console.log('\n--- 3. Doosre exam me marks aate hi column aata hai ---\n')
{
  const table = buildMarksTable({
    activeExam: ANNUAL,
    activeSummary: summary([['English', 88, 100], ['Hindi', 79, 100]]),
    exams: { preset_0: UT1, half: HALF, annual: ANNUAL },
    marks: {
      'preset_0_s1': record('preset_0', 's1', [['English', 20, 25], ['Hindi', 18, 25]]),
      'half_s1': record('half', 's1', [['English', 71, 100], ['Hindi', 64, 100]]),
      'annual_s1': record('annual', 's1', [['English', 88, 100], ['Hindi', 79, 100]]),
      // doosre student ka record — isse leak nahi hona chahiye
      'half_s2': record('half', 's2', [['English', 12, 100]]),
    },
    studentId: 's1',
  })
  check('teeno exam ke column bane', table.columns.length === 3, JSON.stringify(table.columns.map(c => c.name)))
  check('multi true hua', table.multi === true, `multi=${table.multi}`)
  check('column exam date ke order me hain',
    table.columns.map(c => c.examId).join(',') === 'preset_0,half,annual',
    table.columns.map(c => c.examId).join(','))
  check('active exam par active flag lagta hai',
    table.columns.filter(c => c.active).map(c => c.examId).join(',') === 'annual',
    JSON.stringify(table.columns))
  check('doosre student ka marks column me nahi aata',
    table.rows[0].cells.every(cell => cell.obtained !== 12),
    JSON.stringify(table.rows[0].cells))
}

console.log('\n--- 4. Overall weighted average hai, sum nahi ---\n')
{
  const table = buildMarksTable({
    activeExam: ANNUAL,
    activeSummary: summary([['English', 88, 100]]),
    exams: { preset_0: UT1, annual: ANNUAL },
    marks: {
      'preset_0_s1': record('preset_0', 's1', [['English', 20, 25]]),
      'annual_s1': record('annual', 's1', [['English', 88, 100]]),
    },
    studentId: 's1',
  })
  const overall = table.rows[0].overall
  // 20+88 = 108 out of 25+100 = 125 -> 86%. Sum hota to 108 "marks" dikhte,
  // jinka koi max hi nahi hota.
  check('obtained dono exam ka jod hai', overall.obtained === 108, JSON.stringify(overall))
  check('max bhi dono ka jod hai (25 + 100)', overall.maxMarks === 125, JSON.stringify(overall))
  check('percent 86 aata hai, 108 nahi', overall.percent === 86, JSON.stringify(overall))
  check('percent kabhi 100 se upar nahi ja sakta', overall.percent <= 100, JSON.stringify(overall))
}

console.log('\n--- 5. Khaali cell zero nahi hai ---\n')
{
  const table = buildMarksTable({
    activeExam: ANNUAL,
    activeSummary: summary([['English', 88, 100]]),
    exams: { preset_0: UT1, annual: ANNUAL },
    marks: {
      'preset_0_s1': record('preset_0', 's1', [['English', '', 25]]),
      'annual_s1': record('annual', 's1', [['English', 88, 100]]),
    },
    studentId: 's1',
  })
  const overall = table.rows[0].overall
  check('chhoote hue exam ka max average me nahi judta', overall.maxMarks === 100, JSON.stringify(overall))
  check('percent 88 rehta hai (70 nahi)', overall.percent === 88, JSON.stringify(overall))

  const zero = buildMarksTable({
    activeExam: ANNUAL,
    activeSummary: summary([['English', 0, 100]]),
    exams: { annual: ANNUAL },
    marks: { 'annual_s1': record('annual', 's1', [['English', 0, 100]]) },
    studentId: 's1',
  })
  check('asli zero ginaa jata hai, blank ki tarah nahi', zero.rows[0].overall?.percent === 0, JSON.stringify(zero.rows[0].overall))
  check('hasMark: 0 mark hai', hasMark(0) === true)
  check('hasMark: khaali string mark nahi hai', hasMark('') === false)
  check('hasMark: null mark nahi hai', hasMark(null) === false)

  const none = buildMarksTable({
    activeExam: ANNUAL,
    activeSummary: summary([['English', '', 100]]),
    exams: { annual: ANNUAL },
    marks: {},
    studentId: 's1',
  })
  check('bilkul marks na hon to overall null hota hai (0% nahi)', none.rows[0].overall === null, JSON.stringify(none.rows[0]))
}

console.log('\n--- 6. Inline edit ka index nahi khisakna chahiye ---\n')
{
  const table = buildMarksTable({
    activeExam: ANNUAL,
    activeSummary: summary([['English', 88, 100], ['Hindi', 79, 100], ['Science', 91, 100]]),
    exams: { preset_0: UT1, annual: ANNUAL },
    marks: {
      // purane exam me subject ka order alag hai — isse active index nahi badalna chahiye
      'preset_0_s1': record('preset_0', 's1', [['Science', 22, 25], ['English', 20, 25]]),
      'annual_s1': record('annual', 's1', [['English', 88, 100], ['Hindi', 79, 100], ['Science', 91, 100]]),
    },
    studentId: 's1',
  })
  const activeAt = table.columns.findIndex(column => column.active)
  const indexes = table.rows.map(row => row.cells[activeAt].editIndex)
  check('editIndex summary ke order se milta hai', indexes.join(',') === '0,1,2', indexes.join(','))
  check('row order summary ka hai', table.rows.map(row => row.subject).join(',') === 'English,Hindi,Science', table.rows.map(row => row.subject).join(','))
  check('purane exam ke column me editIndex null hai',
    table.rows.every(row => row.cells.filter((_, i) => i !== activeAt).every(cell => cell.editIndex === null)),
    JSON.stringify(table.rows[0].cells))
  check('purane exam ki value subject ke naam se match hui, position se nahi',
    table.rows[0].cells[table.columns.findIndex(c => c.examId === 'preset_0')].obtained === 20,
    JSON.stringify(table.rows[0].cells))
}

console.log('\n--- 7. Sirf purane exam me maujood subject bhi dikhna chahiye ---\n')
{
  const table = buildMarksTable({
    activeExam: ANNUAL,
    activeSummary: summary([['English', 88, 100]]),
    exams: { preset_0: UT1, annual: ANNUAL },
    marks: {
      'preset_0_s1': record('preset_0', 's1', [['English', 20, 25], ['Drawing', 24, 25]]),
      'annual_s1': record('annual', 's1', [['English', 88, 100]]),
    },
    studentId: 's1',
  })
  check('Drawing ki row bhi banti hai', table.rows.map(r => r.subject).join(',') === 'English,Drawing', table.rows.map(r => r.subject).join(','))
  const drawing = table.rows[1]
  const activeAt = table.columns.findIndex(column => column.active)
  check('Drawing ka active cell khaali hai', drawing.cells[activeAt].obtained === null, JSON.stringify(drawing.cells))
  check('Drawing edit nahi ho sakta (active record me hai hi nahi)', drawing.cells[activeAt].editIndex === null, JSON.stringify(drawing.cells))
  check('Drawing ka overall sirf UT1 se banta hai', drawing.overall.percent === 96, JSON.stringify(drawing.overall))
}

console.log('\n--- 8. Subject naam ka case/space match ---\n')
{
  const table = buildMarksTable({
    activeExam: ANNUAL,
    activeSummary: summary([['English', 88, 100]]),
    exams: { preset_0: UT1, annual: ANNUAL },
    marks: {
      'preset_0_s1': record('preset_0', 's1', [[' english ', 20, 25]]),
      'annual_s1': record('annual', 's1', [['English', 88, 100]]),
    },
    studentId: 's1',
  })
  check('"english" aur "English" ek hi row hain', table.rows.length === 1, table.rows.map(r => r.subject).join(','))
  check('dono cells bhare hue hain', table.rows[0].cells.every(cell => cell.obtained !== null), JSON.stringify(table.rows[0].cells))
}

console.log('\n--- 9. Exam order: bina date wale aakhir me ---\n')
{
  const order = orderExams({
    b: exam('b', 'No Date', ''),
    a: exam('a', 'Annual', '2027-03-05'),
    c: exam('c', 'Unit Test', '2026-07-10'),
  })
  check('date wale pehle, date-less aakhir me', order.map(e => e.id).join(',') === 'c,a,b', order.map(e => e.id).join(','))
  check('id-less entry chhant jaati hai', orderExams({ x: { name: 'broken' }, a: UT1 }).length === 1)
  check('null exams par nahi girta', orderExams(null).length === 0)
}

console.log('\n--- 10. Adhoore data par crash nahi ---\n')
{
  const table = buildMarksTable({ activeExam: null, activeSummary: null, exams: null, marks: null, studentId: 's1' })
  check('sab null hone par bhi table banta hai', table.rows.length === 0 && table.columns.length === 1, JSON.stringify(table))
  check('multi false rehta hai', table.multi === false)
}

console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES'} — ${pass} pass, ${fail} fail\n`)
process.exit(fail === 0 ? 0 : 1)

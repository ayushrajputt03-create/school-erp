// ============================================================
// verify-report-card-table.mjs
//
//   node scripts/verify-report-card-table.mjs
//
// Multi-exam marks table A4 par fit hota hai ya nahi — yahi naapna hai.
//
// Column badhne se table chaudi hoti hai, aur report card ek chhapne wala
// document hai: agar table print ke 186mm text block se bahar nikli to
// aakhri column kat kar chhapega. Browser screen par kuch nahi bolega, dikkat
// tabhi pata chalegi jab parent ke haath me adhoora card pahunch jayega.
//
// Isliye ye script asli CSS load karti hai (ReportCardManager.css +
// reportCardTemplates.css), asli buildMarksTable se columns banati hai, aur
// print media emulate karke naapti hai:
//
//   1. ek exam par table bilkul pehle jaisi hai (2 column, koi Overall nahi)
//   2. paanch exam par bhi table 186mm ke andar hai, overflow nahi
//   3. har column padhne layak chaudai me hai (kata hua nahi)
//
// Dono design par chalta hai — classic (.report-card-table) aur formal
// template (.rt-table-marks), kyunki dono ke print rules alag hain.
// ============================================================
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { buildMarksTable } from '../src/lib/reportColumns.js'

const managerCss = readFileSync(new URL('../src/ReportCardManager.css', import.meta.url), 'utf8')
const templateCss = readFileSync(new URL('../src/reportCardTemplates.css', import.meta.url), 'utf8')

let pass = 0, fail = 0
const check = (label, ok, why) => ok === true
  ? (pass++, console.log(`  OK    ${label}`))
  : (fail++, console.log(`  FAIL  ${label}\n          ${why ?? ok}`))

const MM = 96 / 25.4          // 1mm in CSS px
const PRINT_WIDTH = 186 * MM  // A4 minus the margins the print rules already use

const SUBJECTS = ['English', 'Hindi', 'Mathematics', 'Science', 'Social Studies', 'Computer']
const EXAMS = [
  { id: 'ut1', name: 'Unit Test 1', examDate: '2026-07-10', maxMarks: 25 },
  { id: 'ut2', name: 'Periodic Test 2 (PT-2)', examDate: '2026-08-18', maxMarks: 25 },
  { id: 'half', name: 'Half Yearly Examination', examDate: '2026-09-20', maxMarks: 100 },
  { id: 'pre', name: 'Pre Board Examination', examDate: '2027-01-15', maxMarks: 100 },
  { id: 'annual', name: 'Annual Examination', examDate: '2027-03-05', maxMarks: 100 },
]

const marksFor = list => Object.fromEntries(list.map(exam => [`${exam.id}_s1`, {
  examId: exam.id,
  studentId: 's1',
  subjects: SUBJECTS.map((subject, index) => ({ subject, obtained: exam.maxMarks - index * 2, maxMarks: exam.maxMarks })),
}]))

function tableFor(count) {
  const list = EXAMS.slice(0, count)
  const active = list[list.length - 1]
  return buildMarksTable({
    activeExam: active,
    activeSummary: { subjects: SUBJECTS.map((subject, index) => ({ subject, obtained: active.maxMarks - index * 2, maxMarks: active.maxMarks })) },
    exams: Object.fromEntries(list.map(exam => [exam.id, exam])),
    marks: marksFor(list),
    studentId: 's1',
  })
}

// MarksTable ka markup — JSX se mel khata hai. Yahan sirf isliye dobara likha
// hai kyunki node JSX+CSS import nahi kar sakta; data asli function se aata hai.
const renderTable = (table, className) => {
  const { multi, columns, rows } = table
  const head = `<tr><th>Subject</th>${multi
    ? columns.map(c => `<th>${c.name}</th>`).join('') + '<th>Overall</th>'
    : '<th>Marks</th>'}</tr>`
  const body = rows.map(row => `<tr><td>${row.subject}</td>${row.cells.map(cell =>
    `<td class="rt-total"><span class="rt-mark">${cell.obtained ?? '—'}<i class="rt-mark-max"> / ${cell.maxMarks ?? ''}</i></span></td>`).join('')
  }${multi ? `<td class="rt-total rt-overall"><b>${row.overall.percent}%</b><i class="rt-mark-max"> ${row.overall.obtained}/${row.overall.maxMarks}</i></td>` : ''}</tr>`).join('')
  return `<table class="${className}${multi ? ' rt-multi' : ''}"><thead>${head}</thead><tbody>${body}</tbody></table>`
}

const page1 = (table) => `<div class="report-preview-wrap"><article class="report-card-paper print-target">
  <div class="report-outer-border"><div class="report-inner-border premium-report-inner">
    ${renderTable(table, 'report-card-table premium-marks-table rt-table-marks')}
  </div></div>
</article></div>`

const page2 = (table) => `<article class="report-card-paper rt rt-formal theme-navy print-target">
  <div class="rt-inner">${renderTable(table, 'rt-table rt-table-marks')}</div>
</article>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: Math.ceil(210 * MM), height: 1200 } })

for (const [designLabel, shell] of [['classic', page1], ['formal template', page2]]) {
  for (const count of [1, 3, 5]) {
    const table = tableFor(count)
    await page.setContent(`<html><head><style>${managerCss}\n${templateCss}</style></head>
      <body class="erp-printing"><div class="report-card-module">${shell(table)}</div></body></html>`)
    await page.emulateMedia({ media: 'print' })
    await page.waitForTimeout(120)

    const measured = await page.evaluate(() => {
      const table = document.querySelector('table')
      const box = table.getBoundingClientRect()
      const headers = [...table.querySelectorAll('thead th')]
      return {
        width: box.width,
        right: box.right,
        overflow: table.scrollWidth - table.clientWidth,
        headers: headers.length,
        narrowest: Math.min(...headers.slice(1).map(th => th.getBoundingClientRect().width)),
        docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }
    })

    const label = `${designLabel}, ${count} exam`
    if (count === 1) {
      check(`${label}: table pehle jaisi hai (Subject + Marks)`, measured.headers === 2, `${measured.headers} headers`)
    } else {
      check(`${label}: har exam ka column + Overall`, measured.headers === count + 2, `${measured.headers} headers, ${count + 2} chahiye`)
    }
    check(`${label}: 186mm print block ke andar (${measured.width.toFixed(0)}px / ${PRINT_WIDTH.toFixed(0)}px)`,
      measured.width <= PRINT_WIDTH + 1, `${measured.width.toFixed(1)}px`)
    check(`${label}: table khud overflow nahi kar rahi`, measured.overflow <= 1, `${measured.overflow}px overflow`)
    check(`${label}: page horizontally scroll nahi karta`, measured.docOverflow <= 1, `${measured.docOverflow}px`)
    check(`${label}: sabse patla column bhi >= 40px hai`, measured.narrowest >= 40, `${measured.narrowest.toFixed(1)}px`)
  }
}

await browser.close()
console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES'} — ${pass} pass, ${fail} fail\n`)
process.exit(fail === 0 ? 0 : 1)

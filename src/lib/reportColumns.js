// Per-exam columns for the report card marks table.
//
// The ERP already stores marks per exam: every record is keyed `${examId}_${studentId}`
// and carries its own maxMarks, subject list, status and remarks. What was missing is the
// VIEW - the printed card only ever showed the one exam that was selected, so a parent could
// not see Unit Test 1 next to the Half Yearly on a single sheet.
//
// This module turns the records the app already has into table columns. It reads; it never
// writes and never reshapes stored marks. A school with one exam entered keeps exactly the
// one-column card it printed before - `multi` stays false and the caller renders the old
// header. Extra columns only appear once a second exam actually has marks for that student.
//
// "Overall" is a weighted average, not a sum. Adding a Unit Test out of 25 to an Annual out
// of 100 gives a number that means nothing; sum(obtained) / sum(maxMarks) weights each exam
// by the marks it was actually worth, which is what a percentage on a report card means.

const FAR_FUTURE = '9999-12-31'

const normalizeSubject = value => String(value ?? '').trim().toLowerCase()

// A blank cell is not a zero. Marks Entry seeds new records with obtained: '', and a student
// who missed an exam must print as an empty cell rather than a scored zero that would drag
// the weighted average down.
export function hasMark(value) {
  if (value === '' || value === null || value === undefined) return false
  return Number.isFinite(Number(value))
}

const markNumber = value => hasMark(value) ? Number(value) : null

// Chronological, because that is the order a report card reads in. Exams with no date sort
// last rather than first, and ties fall back to the order the exams object already had, so
// the preset list (Unit Test 1, 2, 3, ... Annual) keeps its shape when no dates are set.
export function orderExams(exams) {
  return Object.values(exams || {})
    .filter(exam => exam && exam.id)
    .map((exam, index) => ({ exam, index }))
    .sort((a, b) => String(a.exam.examDate || FAR_FUTURE).localeCompare(String(b.exam.examDate || FAR_FUTURE)) || a.index - b.index)
    .map(item => item.exam)
}

// { subjectKey: { subject, obtained, maxMarks } } for one stored marks record.
function subjectsOf(record, fallbackMax) {
  const map = new Map()
  for (const row of record?.subjects || []) {
    const key = normalizeSubject(row.subject)
    if (!key) continue
    map.set(key, {
      subject: row.subject,
      obtained: markNumber(row.obtained),
      maxMarks: Number(row.maxMarks || fallbackMax || 0) || null,
    })
  }
  return map
}

const columnHasMarks = column => [...column.cells.values()].some(cell => cell.obtained !== null)

/**
 * Builds the marks table for one student.
 *
 * @param activeExam  the exam currently selected in the generator - always gets a column,
 *                    even with no marks yet, because that is the card being worked on.
 * @param activeSummary  calculateReport() output for that exam. Its subject order drives the
 *                    row order, and its index is what onEditMark expects, so inline editing
 *                    keeps writing to the same record it always did.
 * @param exams       all exams, keyed by id (reportData.exams).
 * @param marks       all stored marks records (reportData.marks) - filtered by studentId here.
 */
export function buildMarksTable({ activeExam, activeSummary, exams, marks, studentId }) {
  const activeId = activeExam?.id || ''
  const studentRows = Object.values(marks || {}).filter(row => row && row.studentId === studentId)
  const examOrder = orderExams(exams)
  const rankOf = examId => {
    const at = examOrder.findIndex(exam => exam.id === examId)
    return at === -1 ? examOrder.length : at
  }

  const columns = []
  for (const exam of examOrder) {
    if (exam.id === activeId) continue
    const record = studentRows.find(row => row.examId === exam.id)
    if (!record) continue
    const column = { examId: exam.id, name: exam.name || 'Exam', active: false, cells: subjectsOf(record, exam.maxMarks) }
    if (columnHasMarks(column)) columns.push(column)
  }

  const activeCells = new Map()
  const rows = []
  ;(activeSummary?.subjects || []).forEach((row, index) => {
    const key = normalizeSubject(row.subject)
    activeCells.set(key, { subject: row.subject, obtained: markNumber(row.obtained), maxMarks: Number(row.maxMarks || 0) || null, index })
    rows.push({ key, subject: row.subject })
  })
  const activeColumn = { examId: activeId, name: activeExam?.name || 'Marks', active: true, cells: activeCells }

  // Keep the active exam in date order with the rest rather than pinning it first, so the
  // card reads left to right in the order the exams were actually taken.
  const ordered = [...columns, activeColumn].sort((a, b) => rankOf(a.examId) - rankOf(b.examId))

  // A subject that exists only in another exam still deserves a row; it just cannot be edited
  // inline, because there is no active-exam record behind it.
  const seen = new Set(rows.map(row => row.key))
  for (const column of ordered) {
    for (const [key, cell] of column.cells) {
      if (seen.has(key)) continue
      seen.add(key)
      rows.push({ key, subject: cell.subject })
    }
  }

  const body = rows.map(row => {
    const cells = ordered.map(column => {
      const cell = column.cells.get(row.key)
      return {
        examId: column.examId,
        obtained: cell?.obtained ?? null,
        maxMarks: cell?.maxMarks ?? null,
        editIndex: column.active ? (cell?.index ?? null) : null,
      }
    })
    const scored = cells.filter(cell => cell.obtained !== null)
    const obtained = scored.reduce((sum, cell) => sum + cell.obtained, 0)
    const maxMarks = scored.reduce((sum, cell) => sum + Number(cell.maxMarks || 0), 0)
    return {
      subject: row.subject,
      cells,
      overall: scored.length
        ? { obtained, maxMarks, percent: maxMarks ? Math.round((obtained / maxMarks) * 100) : 0 }
        : null,
    }
  })

  return {
    multi: ordered.length > 1,
    columns: ordered.map(column => ({ examId: column.examId, name: column.name, active: column.active })),
    rows: body,
  }
}

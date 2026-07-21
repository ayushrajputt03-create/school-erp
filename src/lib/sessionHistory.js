// Per-session snapshots of a student's class. Pure module - no Firebase, no React.
//
// The app keeps ONE record per student and re-admission overwrites it with the new class,
// so "which class was this child in during 2025-26" is not derivable from the live record.
// It has to be captured at the moment of promotion and never touched again. Everything here
// is append-only and defensive: a student with no history behaves exactly like before.

const entriesOf = student => (Array.isArray(student?.sessionHistory) ? student.sessionHistory.filter(Boolean) : [])

const sessionOf = value => String(value || '').trim()

// Snapshot the outgoing session before an old student is re-admitted into a new one.
// Returns the history to store: unchanged when there is nothing new to record, so calling
// it on a new admission, a same-session edit, or a repeat save never mutates or duplicates.
export const promotionHistory = (previous, next) => {
  const existing = entriesOf(previous)
  const fromSession = sessionOf(previous?.academicSession)
  const toSession = sessionOf(next?.academicSession)
  if (!previous || !fromSession || fromSession === toSession) return existing
  if (existing.some(entry => sessionOf(entry.session) === fromSession)) return existing
  return [...existing, {
    session: fromSession,
    className: previous.className || '',
    rollNumber: previous.rollNumber || '',
    feeGroup: previous.feeGroup || '',
    recordedAt: Date.now(),
  }]
}

// The class a student sat in during a given session. Falls back to their current class when
// the session is the current one, and returns '' when that session predates any snapshot -
// history genuinely does not exist for promotions made before this was recorded, and guessing
// would be worse than showing nothing.
export const classInSession = (student, session) => {
  const wanted = sessionOf(session)
  if (!student || !wanted) return student?.className || ''
  if (sessionOf(student.academicSession) === wanted) return student.className || ''
  const match = entriesOf(student).find(entry => sessionOf(entry.session) === wanted)
  return match ? match.className || '' : ''
}

// Every session this student has a known class for, oldest first, including the current one.
export const sessionsKnownFor = student => {
  const past = entriesOf(student)
    .map(entry => sessionOf(entry.session))
    .filter(Boolean)
  const current = sessionOf(student?.academicSession)
  const all = current ? [...past, current] : past
  return [...new Set(all)].sort()
}

// ---------------------------------------------------------------------------
// Reading a whole session back. Everything below is read-only derivation over
// data the app already stores - nothing here writes, and nothing here invents a
// value that was not recorded. A session with no snapshots simply looks empty.
// ---------------------------------------------------------------------------

const pad = value => String(value).padStart(2, '0')
const isoDay = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

// Calendar span of a session, honouring the school's configured start month.
// "2025-26" with an April start is 2025-04-01 .. 2026-03-31.
export const sessionRange = (session, startMonth = 4) => {
  const startYear = Number(String(session || '').match(/\d{4}/)?.[0])
  if (!startYear) return null
  const month = Number(startMonth)
  const index = Number.isInteger(month) && month >= 1 && month <= 12 ? month - 1 : 3
  return {
    start: isoDay(new Date(startYear, index, 1)),
    end: isoDay(new Date(startYear + 1, index, 0)),
  }
}

export const isDateInSession = (date, session, startMonth) => {
  const range = sessionRange(session, startMonth)
  const day = String(date || '').slice(0, 10)
  if (!range || day.length !== 10) return false
  return day >= range.start && day <= range.end
}

// The day a fee row belongs to. Rows come from two writers with different shapes,
// so fall back through every date the app has ever stored on one.
export const feeRowDate = row => {
  const direct = String(row?.receiptDate || row?.date || '').slice(0, 10)
  if (direct.length === 10) return direct
  if (row?.paidAt) return isoDay(new Date(row.paidAt))
  const period = String(row?.billingPeriod || '')
  return /^\d{4}-\d{2}$/.test(period) ? `${period}-01` : ''
}

// Students as they were in a given session, with className swapped to the class they
// actually sat in. Students without a snapshot for that session are left out rather
// than shown with their present-day class, which would be plainly wrong.
export const studentsInSession = (students = [], session) => {
  const wanted = sessionOf(session)
  if (!wanted) return students
  return students
    .map(student => {
      const className = classInSession(student, wanted)
      if (!className) return null
      const entry = entriesOf(student).find(item => sessionOf(item.session) === wanted)
      return {
        ...student,
        className,
        rollNumber: entry?.rollNumber || student.rollNumber || '',
        feeGroup: entry?.feeGroup || student.feeGroup || '',
      }
    })
    .filter(Boolean)
}

// Every session the workspace can show, newest first, with the live one always present.
export const sessionOptionsFrom = (students = [], currentSession) => {
  const all = students.reduce((set, student) => {
    sessionsKnownFor(student).forEach(item => set.add(item))
    return set
  }, new Set())
  const current = sessionOf(currentSession)
  if (current) all.add(current)
  return [...all].filter(Boolean).sort().reverse()
}

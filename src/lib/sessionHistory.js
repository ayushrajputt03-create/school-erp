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

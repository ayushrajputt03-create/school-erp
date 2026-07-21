// Read-only view of a past academic session.
//
// Nothing in this file writes. It renders only what the workspace already recorded:
// students are shown in the class they were snapshotted into for that session, and
// fees/attendance are filtered to that session's calendar span. A session with no
// snapshots renders empty on purpose - inventing a class for a student whose promotion
// happened before history was recorded would be worse than showing nothing.

import { useEffect, useMemo, useState } from 'react'
import { Archive, GraduationCap, IndianRupee, CalendarCheck } from 'lucide-react'
import { studentsInSession, sessionRange, isDateInSession, feeRowDate } from './lib/sessionHistory'

const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0))
const readableDate = value => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
const statusOf = value => {
  const raw = String(typeof value === 'object' && value ? value.status ?? '' : value ?? '').trim().toUpperCase()
  if (raw.startsWith('P')) return 'P'
  if (raw.startsWith('L')) return 'L'
  return raw ? 'A' : ''
}
const paidOf = row => Number(row?.paidAmount ?? row?.amount ?? 0) || 0

const TABS = [
  { id: 'students', label: 'Students', icon: GraduationCap },
  { id: 'fees', label: 'Fee Collection', icon: IndianRupee },
  { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
]

export default function SessionArchive({ session, sessionStartMonth, students = [], fees = {}, loadSessionAttendance }) {
  const [tab, setTab] = useState('students')

  const range = useMemo(() => sessionRange(session, sessionStartMonth), [session, sessionStartMonth])
  const sessionStudents = useMemo(() => studentsInSession(students, session), [students, session])
  const studentById = useMemo(
    () => Object.fromEntries(sessionStudents.map(student => [student.id, student])),
    [sessionStudents],
  )

  // The live attendance listener only holds the current month, so a past session has to be
  // fetched. Do it lazily - the request fires the first time this tab is opened and never
  // again for the same session, so browsing students and fees costs nothing extra.
  const [attendance, setAttendance] = useState(null)
  const [attendanceError, setAttendanceError] = useState(false)
  useEffect(() => {
    setAttendance(null)
    setAttendanceError(false)
  }, [session])
  useEffect(() => {
    if (tab !== 'attendance' || attendance || attendanceError || !range || !loadSessionAttendance) return undefined
    let active = true
    loadSessionAttendance(range.start, range.end).then(result => {
      if (!active) return
      if (result) setAttendance(result)
      else setAttendanceError(true)
    })
    return () => { active = false }
  }, [tab, attendance, attendanceError, range, loadSessionAttendance])

  // Stamp the date once per row instead of recomputing it inside every sort comparison.
  const sessionFees = useMemo(() => Object.entries(fees)
    .map(([id, row]) => ({ id, ...row, rowDate: feeRowDate(row) }))
    .filter(row => isDateInSession(row.rowDate, session, sessionStartMonth))
    .sort((a, b) => b.rowDate.localeCompare(a.rowDate)),
  [fees, session, sessionStartMonth])

  const collected = sessionFees.reduce((total, row) => total + paidOf(row), 0)

  const sessionDates = useMemo(() => Object.keys(attendance || {})
    .filter(date => Object.keys(attendance[date] || {}).length)
    .sort()
    .reverse(),
  [attendance])

  const nameOf = id => studentById[id]?.name || students.find(student => student.id === id)?.name || id
  const classOf = id => studentById[id]?.className || '-'

  return <>
    <div className="panel session-archive-banner">
      <div className="table-toolbar">
        <div>
          <strong><Archive size={16} style={{ verticalAlign: '-2px', marginRight: 6 }} />Viewing {session} — past session (read only)</strong>
          <small>
            {range ? `${readableDate(range.start)} to ${readableDate(range.end)} · ` : ''}
            Records cannot be edited here. Switch back to the current session from the header to make changes.
          </small>
        </div>
      </div>
    </div>

    <div className="panel" style={{ marginTop: 14 }}>
      <div className="sub-tabs">{TABS.map(({ id, label, icon: Icon }) =>
        <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><Icon size={15} /> {label}</button>)}
      </div>

      {tab === 'students' && <>
        <div className="table-toolbar"><div><strong>{sessionStudents.length} students on record</strong><small>Class shown is the class this student was in during {session}.</small></div></div>
        <div className="table-scroll"><table><thead><tr><th>Admission No</th><th>Student</th><th>Class</th><th>Father Name</th><th>Fee Group</th><th>Phone</th></tr></thead><tbody>
          {sessionStudents.map(student => <tr key={student.id}>
            <td>{student.roll}</td>
            <td><strong>{student.name}</strong></td>
            <td>{student.className}</td>
            <td>{student.fatherName || student.guardian || '-'}</td>
            <td>{student.feeGroup || '-'}</td>
            <td>{student.phone || '-'}</td>
          </tr>)}
          {!sessionStudents.length && <tr><td colSpan="6"><div className="empty-state">No student records were saved for {session}. Class history is recorded from the promotion onwards, so students promoted before this feature existed will not appear here.</div></td></tr>}
        </tbody></table></div>
      </>}

      {tab === 'fees' && <>
        <div className="table-toolbar"><div><strong>{money(collected)} collected</strong><small>{sessionFees.length} receipts dated inside {session}.</small></div></div>
        <div className="table-scroll"><table><thead><tr><th>Date</th><th>Receipt No</th><th>Student</th><th>Class</th><th>Month</th><th>Mode</th><th>Paid</th></tr></thead><tbody>
          {sessionFees.map(row => <tr key={row.id}>
            <td>{readableDate(row.rowDate)}</td>
            <td>{row.receiptNumber || row.invoiceNumber || '-'}</td>
            <td>{row.studentName || nameOf(row.studentId)}</td>
            <td>{row.className || classOf(row.studentId)}</td>
            <td>{row.billingMonth || row.billingPeriod || '-'}</td>
            <td>{row.method || '-'}</td>
            <td>{money(paidOf(row))}</td>
          </tr>)}
          {!sessionFees.length && <tr><td colSpan="7"><div className="empty-state">No fee receipts fall inside {session}.</div></td></tr>}
        </tbody></table></div>
      </>}

      {tab === 'attendance' && <>
        <div className="table-toolbar"><div><strong>{attendance ? `${sessionDates.length} days marked` : 'Loading attendance...'}</strong><small>Attendance saved between {range ? `${readableDate(range.start)} and ${readableDate(range.end)}` : session}. Fetched only when you open this tab.</small></div></div>
        {attendanceError && <div className="empty-state">Could not load attendance for {session}. Check your connection and reopen this tab.</div>}
        {!attendance && !attendanceError && <div className="empty-state">Fetching this session's attendance...</div>}
        {attendance &&
        <div className="table-scroll"><table><thead><tr><th>Date</th><th>Present</th><th>Absent</th><th>Leave</th><th>Total marked</th><th>Rate</th></tr></thead><tbody>
          {sessionDates.map(date => {
            const marks = Object.values(attendance[date] || {}).map(statusOf)
            const present = marks.filter(mark => mark === 'P').length
            const rate = marks.length ? Math.round((present / marks.length) * 100) : 0
            return <tr key={date}>
              <td><strong>{readableDate(date)}</strong></td>
              <td style={{ color: '#168357' }}>{present}</td>
              <td style={{ color: '#d14343' }}>{marks.filter(mark => mark === 'A').length}</td>
              <td style={{ color: '#c17a20' }}>{marks.filter(mark => mark === 'L').length}</td>
              <td>{marks.length}</td>
              <td><span className={`status ${rate >= 75 ? 'paid' : 'overdue'}`}>{rate}%</span></td>
            </tr>
          })}
          {!sessionDates.length && <tr><td colSpan="6"><div className="empty-state">No attendance was saved inside {session}.</div></td></tr>}
        </tbody></table></div>}
      </>}
    </div>
  </>
}

import React, { useState, useEffect } from 'react'
import { auth } from '../lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { useStudentData } from '../hooks/useStudentData'
import { useAttendance } from '../hooks/useAttendance'
import { useFees } from '../hooks/useFees'
import { useMarks } from '../hooks/useMarks'
import { useNotices } from '../hooks/useNotices'
import ParentSidebar from '../components/parent/ParentSidebar'
import ParentTopbar from '../components/parent/ParentTopbar'
import KPICards from '../components/parent/KPICards'
import AttendanceCalendar from '../components/parent/AttendanceCalendar'
import FeeWidget from '../components/parent/FeeWidget'
import SubjectProgress from '../components/parent/SubjectProgress'
import NoticesFeed from '../components/parent/NoticesFeed'
import QuickActions from '../components/parent/QuickActions'
import ChildSwitcher from '../components/parent/ChildSwitcher'
import '../styles/parent.css'

const IS_DEMO = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo')

function generateDemoData() {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const mm = String(m).padStart(2, '0')
  const attendanceMap = {}
  for (let d = 1; d <= now.getDate(); d++) {
    const dd = String(d).padStart(2, '0')
    const dateStr = `${y}-${mm}-${dd}`
    const dow = new Date(y, m - 1, d).getDay()
    if (dow === 0) { attendanceMap[dateStr] = 'holiday'; continue }
    const r = Math.random()
    attendanceMap[dateStr] = r > 0.15 ? 'present' : r > 0.05 ? 'late' : 'absent'
  }

  const fees = [
    { id: 'f1', title: 'Tuition Fee — Q2', amount: 12500, dueDate: `${y}-${mm}-15`, status: 'unpaid' },
    { id: 'f2', title: 'Annual Charges', amount: 5000, dueDate: `${y}-${mm}-01`, status: 'paid', paidAt: `${y}-${mm}-02` },
    { id: 'f3', title: 'Transport Fee', amount: 3000, dueDate: `${y}-${mm}-10`, status: 'partial' },
    { id: 'f4', title: 'Lab Fee', amount: 1500, dueDate: `${y}-04-01`, status: 'paid', paidAt: `${y}-04-03` },
  ]

  const subjects = [
    { id: 's1', subjectName: 'Mathematics', marksObtained: 87, totalMarks: 100, examType: 'Unit Test 2' },
    { id: 's2', subjectName: 'Science', marksObtained: 72, totalMarks: 100, examType: 'Unit Test 2' },
    { id: 's3', subjectName: 'English', marksObtained: 91, totalMarks: 100, examType: 'Unit Test 2' },
    { id: 's4', subjectName: 'Hindi', marksObtained: 68, totalMarks: 100, examType: 'Unit Test 2' },
    { id: 's5', subjectName: 'Social Science', marksObtained: 78, totalMarks: 100, examType: 'Unit Test 2' },
    { id: 's6', subjectName: 'Computer', marksObtained: 95, totalMarks: 100, examType: 'Unit Test 2' },
  ]

  const ts = (daysAgo) => {
    const d = new Date()
    d.setDate(d.getDate() - daysAgo)
    return { toDate: () => d }
  }

  const notices = [
    { id: 'n1', title: 'Annual Day Rehearsal Schedule', body: 'Rehearsals for the Annual Day function will begin from Monday. Students selected for performances must attend after school from 3:00 PM to 5:00 PM. Please ensure your ward carries light snacks and water. Costumes will be provided by the school.', category: 'event', createdAt: ts(0), targetClasses: ['7A'] },
    { id: 'n2', title: 'Unit Test 3 — Date Sheet Released', body: 'Unit Test 3 will be held from 21st to 25th July. Syllabus and date sheet have been shared on the school portal. Please ensure regular revision at home.', category: 'exam', createdAt: ts(1), targetClasses: ['7A'], read: false },
    { id: 'n3', title: 'Fee Payment Reminder', body: 'Q2 tuition fee is due by 15th of this month. Late payment will attract a fine of ₹50 per day. Please pay through the online portal or at the school accounts office.', category: 'urgent', createdAt: ts(3), targetClasses: ['7A'] },
    { id: 'n4', title: 'Independence Day Celebrations', body: 'The school will celebrate Independence Day on 15th August with a flag hoisting ceremony, cultural programs, and sweet distribution. All students must attend in full uniform.', category: 'event', createdAt: ts(5), targetClasses: ['7A'], read: true },
    { id: 'n5', title: 'Library Books Return', body: 'All library books issued before summer break must be returned by the end of this week. Students with pending books will not be issued new ones.', category: 'general', createdAt: ts(7), targetClasses: ['7A'], read: true },
  ]

  return { attendanceMap, fees, subjects, notices }
}

function DemoParentDashboard() {
  const [activeNav, setActiveNav] = useState('dashboard')
  const now = new Date()
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1)
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [demo] = useState(() => generateDemoData())

  const attendanceDays = Object.values(demo.attendanceMap)
  const presentDays = attendanceDays.filter(s => s === 'present').length
  const totalCountable = attendanceDays.filter(s => s !== 'holiday').length
  const attendancePct = totalCountable > 0 ? Math.round((presentDays / totalCountable) * 100) : 0

  const unpaidFees = demo.fees.filter(f => f.status !== 'paid')
  const totalDue = unpaidFees.reduce((sum, f) => sum + (f.amount || 0), 0)

  const totalMarks = demo.subjects.reduce((s, m) => s + m.marksObtained, 0)
  const totalPossible = demo.subjects.reduce((s, m) => s + m.totalMarks, 0)
  const examAvg = Math.round((totalMarks / totalPossible) * 100)

  const unreadNotices = demo.notices.filter(n => !n.read).length

  return <div className="parent-dashboard">
    <ParentSidebar
      activeNav={activeNav}
      onNavChange={setActiveNav}
      feesDue={totalDue > 0}
      noticeCount={unreadNotices}
    >
      <ChildSwitcher
        studentIds={['demo-child-1']}
        currentId="demo-child-1"
        onChange={() => {}}
        demoChildren={[{ id: 'demo-child-1', name: 'Arjun Sharma', className: '7', section: 'A' }]}
      />
    </ParentSidebar>

    <div className="pd-main">
      <ParentTopbar
        parentName="Rajesh Sharma"
        notices={demo.notices}
        onLogout={() => window.location.href = '/'}
      />

      <div className="pd-content">
        <KPICards
          attendance={attendancePct}
          feesDue={totalDue}
          lastExamAvg={examAvg}
          homeworkPending={3}
          subjectNames={['Maths', 'Science', 'Hindi']}
        />

        <div className="pd-grid">
          <AttendanceCalendar
            studentId="demo"
            month={calMonth}
            year={calYear}
            data={demo.attendanceMap}
            loading={false}
            error={null}
            onMonthChange={(m, y) => { setCalMonth(m); setCalYear(y) }}
          />

          <FeeWidget
            studentId="demo"
            data={demo.fees}
            loading={false}
            error={null}
          />

          <SubjectProgress
            studentId="demo"
            data={demo.subjects}
            loading={false}
            error={null}
          />

          <div>
            <NoticesFeed
              studentId="demo"
              classId="7A"
              data={demo.notices}
              loading={false}
              error={null}
            />
            <div style={{ height: 20 }} />
            <QuickActions
              studentId="demo"
              studentName="Arjun Sharma"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
}

export default function ParentDashboard() {
  if (IS_DEMO) return <DemoParentDashboard />

  const [user, setUser] = useState(null)
  const [claims, setClaims] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [activeNav, setActiveNav] = useState('dashboard')

  const studentIds = claims?.studentIds || (claims?.studentId ? [claims.studentId] : [])
  const [selectedStudentId, setSelectedStudentId] = useState('')

  useEffect(() => {
    if (!auth) { setAuthLoading(false); return }
    const unsub = onAuthStateChanged(auth, async firebaseUser => {
      if (firebaseUser) {
        const token = await firebaseUser.getIdTokenResult()
        setUser(firebaseUser)
        setClaims(token.claims)
      } else {
        setUser(null)
        setClaims(null)
      }
      setAuthLoading(false)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    if (studentIds.length > 0 && !selectedStudentId) {
      setSelectedStudentId(studentIds[0])
    }
  }, [studentIds, selectedStudentId])

  const now = new Date()
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1)
  const [calYear, setCalYear] = useState(now.getFullYear())

  const student = useStudentData(selectedStudentId)
  const attendance = useAttendance(selectedStudentId, calMonth, calYear)
  const fees = useFees(selectedStudentId)
  const marks = useMarks(selectedStudentId)
  const notices = useNotices(student.data?.classId)

  if (authLoading) {
    return <div className="parent-dashboard" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div className="pd-skeleton" style={{ width: 120, height: 20 }} />
    </div>
  }

  if (!user || claims?.role !== 'parent') {
    return <div className="parent-dashboard" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div className="pd-empty">
        <div className="pd-empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <p className="pd-empty-text">Please sign in as a parent to access this dashboard.</p>
      </div>
    </div>
  }

  const attendanceDays = Object.values(attendance.data)
  const totalDays = attendanceDays.length
  const presentDays = attendanceDays.filter(s => s === 'present').length
  const attendancePct = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0

  const unpaidFees = fees.data.filter(f => f.status !== 'paid')
  const totalDue = unpaidFees.reduce((sum, f) => sum + (f.amount || 0), 0)

  const totalMarks = marks.data.reduce((s, m) => s + (m.marksObtained || 0), 0)
  const totalPossible = marks.data.reduce((s, m) => s + (m.totalMarks || 0), 0)
  const examAvg = totalPossible > 0 ? Math.round((totalMarks / totalPossible) * 100) : 0

  const unreadNotices = notices.data.filter(n => !n.read).length

  return <div className="parent-dashboard">
    <ParentSidebar
      activeNav={activeNav}
      onNavChange={setActiveNav}
      feesDue={totalDue > 0}
      noticeCount={unreadNotices}
    >
      <ChildSwitcher
        studentIds={studentIds}
        currentId={selectedStudentId}
        onChange={setSelectedStudentId}
      />
    </ParentSidebar>

    <div className="pd-main">
      <ParentTopbar
        parentName={user.displayName || claims?.name || 'Parent'}
        notices={notices.data}
        onLogout={() => auth.signOut()}
      />

      <div className="pd-content">
        <KPICards
          attendance={attendancePct}
          feesDue={totalDue}
          lastExamAvg={examAvg}
          homeworkPending={0}
          subjectNames={marks.data.map(m => m.subjectName).filter(Boolean)}
        />

        <div className="pd-grid">
          <AttendanceCalendar
            studentId={selectedStudentId}
            month={calMonth}
            year={calYear}
            data={attendance.data}
            loading={attendance.loading}
            error={attendance.error}
            onMonthChange={(m, y) => { setCalMonth(m); setCalYear(y) }}
          />

          <FeeWidget
            studentId={selectedStudentId}
            data={fees.data}
            loading={fees.loading}
            error={fees.error}
          />

          <SubjectProgress
            studentId={selectedStudentId}
            data={marks.data}
            loading={marks.loading}
            error={marks.error}
          />

          <div>
            <NoticesFeed
              studentId={selectedStudentId}
              classId={student.data?.classId}
              data={notices.data}
              loading={notices.loading}
              error={notices.error}
            />
            <div style={{ height: 20 }} />
            <QuickActions
              studentId={selectedStudentId}
              studentName={student.data?.name || ''}
            />
          </div>
        </div>
      </div>
    </div>
  </div>
}

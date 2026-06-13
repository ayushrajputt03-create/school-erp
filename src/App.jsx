import React, { useEffect, useState } from 'react'
import {
  Bell, BookOpen, CalendarCheck, Check, ChevronRight, IndianRupee,
  GraduationCap, LayoutDashboard, LogOut, Menu, MessageSquareText,
  MoreHorizontal, Plus, Search, Settings, ShieldCheck, Sparkles, Users, X,
  Eye, Receipt, Save, ClipboardList, Download, Upload, Link2, Cake,
  UserCheck, Clock3, TrendingUp, WalletCards
} from 'lucide-react'
import './app.css'
import AuthScreen from './AuthScreen'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth, isFirebaseConfigured } from './lib/firebase'

const databaseUrl = import.meta.env.VITE_FIREBASE_DATABASE_URL?.replace(/\/$/, '')

async function databaseRequest(path, token, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  const url = `${databaseUrl}/${path ? `${path}.json` : '.json'}?auth=${encodeURIComponent(token)}`

  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) throw new Error(payload?.error || `Database request failed (${response.status})`)
    return payload
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Database connection timed out. Please retry.')
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

const seedStudents = [
  { id: 1, name: 'Aarav Sharma', roll: '2026-041', className: '10-A', guardian: 'Ramesh Sharma', phone: '98765 43210', attendance: 94, fee: 'Paid', initials: 'AS', tone: 'blue' },
  { id: 2, name: 'Meera Kapoor', roll: '2026-042', className: '8-B', guardian: 'Anil Kapoor', phone: '98112 48810', attendance: 88, fee: 'Pending', initials: 'MK', tone: 'violet' },
  { id: 3, name: 'Kabir Verma', roll: '2026-043', className: '6-A', guardian: 'Nitin Verma', phone: '99102 34118', attendance: 96, fee: 'Paid', initials: 'KV', tone: 'green' },
  { id: 4, name: 'Ananya Singh', roll: '2026-044', className: '9-C', guardian: 'Priya Singh', phone: '98991 22018', attendance: 81, fee: 'Overdue', initials: 'AS', tone: 'orange' },
  { id: 5, name: 'Vihaan Gupta', roll: '2026-045', className: '5-A', guardian: 'Sanjay Gupta', phone: '98201 99881', attendance: 91, fee: 'Paid', initials: 'VG', tone: 'cyan' },
  { id: 6, name: 'Ira Malhotra', roll: '2026-046', className: '7-B', guardian: 'Rohit Malhotra', phone: '99901 22341', attendance: 86, fee: 'Pending', initials: 'IM', tone: 'pink' },
]

const seedNotices = [
  { id: 1, title: 'Parent Teacher Meeting', detail: 'Classes 6-10, Saturday at 10:00 AM', date: '15 Jun', type: 'Event', priority: 'High' },
  { id: 2, title: 'Summer assignment submission', detail: 'All class teachers to verify submissions', date: '18 Jun', type: 'Academic', priority: 'Normal' },
  { id: 3, title: 'Inter-house football trials', detail: 'Senior wing sports ground after school', date: '20 Jun', type: 'Sports', priority: 'Normal' },
]

const timetable = [
  ['08:00', 'Mathematics', 'Science', 'English', 'Mathematics', 'Computer'],
  ['09:00', 'English', 'Mathematics', 'Social Sci.', 'Science', 'Hindi'],
  ['10:00', 'Science', 'Computer', 'Mathematics', 'English', 'Social Sci.'],
  ['11:15', 'Hindi', 'Social Sci.', 'Computer', 'Hindi', 'Mathematics'],
  ['12:15', 'Social Sci.', 'English', 'Science', 'Computer', 'Science'],
]
const defaultTimetable = {
  '10-A': timetable.flatMap(row => row.slice(1).map((subject, index) => ({
    id: `${row[0]}_${index}`,
    time: row[0],
    day: ['Monday','Tuesday','Wednesday','Thursday','Friday'][index],
    subject,
    teacher: ['NK','RS','AM','PK','SJ'][index],
    room: `R${204 + index}`,
  }))),
  '9-C': timetable.flatMap(row => row.slice(1).map((subject, index) => ({
    id: `${row[0]}_${index}`,
    time: row[0],
    day: ['Monday','Tuesday','Wednesday','Thursday','Friday'][index],
    subject: row.slice(1)[(index + 2) % 5],
    teacher: ['AM','PK','SJ','NK','RS'][index],
    room: `R${310 + index}`,
  }))),
}

const dateKey = date => {
  const local = new Date(date)
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset())
  return local.toISOString().slice(0, 10)
}
const today = () => dateKey(new Date())
const money = value => `₹${Number(value || 0).toLocaleString('en-IN')}`
const readableDate = value => new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
const timeAgo = timestamp => {
  const minutes = Math.max(1, Math.round((Date.now() - timestamp) / 60000))
  if (minutes < 60) return `${minutes} min`
  if (minutes < 1440) return `${Math.round(minutes / 60)} hr`
  return `${Math.round(minutes / 1440)} d`
}

const nav = [
  { id: 'dashboard', label: 'Command Center', icon: LayoutDashboard },
  { id: 'admissions', label: 'Admissions', icon: ClipboardList },
  { id: 'students', label: 'Students', icon: Users },
  { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
  { id: 'fees', label: 'Fee Management', icon: IndianRupee },
  { id: 'academics', label: 'Academics', icon: BookOpen },
  { id: 'notices', label: 'Notices', icon: MessageSquareText },
]

function useStoredState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key)
      return saved ? JSON.parse(saved) : initialValue
    } catch {
      return initialValue
    }
  })
  useEffect(() => localStorage.setItem(key, JSON.stringify(value)), [key, value])
  return [value, setValue]
}

function Header({ title, subtitle, onMenu, profile, onSignOut }) {
  return (
    <header className="topbar">
      <button className="icon-button mobile-menu" onClick={onMenu} aria-label="Open menu"><Menu size={20} /></button>
      <div className="page-heading">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="topbar-actions">
        <div className="global-search"><Search size={16} /><input placeholder="Search anything" /></div>
        <button className="icon-button notification" aria-label="Notifications"><Bell size={19} /><i /></button>
        <div className="profile">
          <span className="avatar tone-blue">{profile.initials}</span>
          <div><strong>{profile.name}</strong><small>{profile.role}</small></div>
        </div>
        <button className="icon-button" onClick={onSignOut} aria-label="Sign out" title="Sign out"><LogOut size={18} /></button>
      </div>
    </header>
  )
}

function Sidebar({ page, setPage, open, close, schoolName, cloudMode }) {
  return (
    <>
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><GraduationCap size={23} /></div>
          <div><strong>Northstar</strong><span>School OS</span></div>
          <button className="icon-button sidebar-close" onClick={close}><X size={18} /></button>
        </div>
        <div className="school-switcher">
          <span className="school-logo">NS</span>
          <div><strong>{schoolName}</strong><small>Academic year 2026-27</small></div>
          <MoreHorizontal size={17} />
        </div>
        <nav>
          <span className="nav-label">Workspace</span>
          {nav.map(({ id, label, icon: Icon }) => (
            <button key={id} className={page === id ? 'active' : ''} onClick={() => { setPage(id); close() }}>
              <Icon size={18} /><span>{label}</span>{page === id && <ChevronRight size={15} />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button><Settings size={18} /><span>School Settings</span></button>
          <div className="trial-card">
            <Sparkles size={18} />
            <strong>{cloudMode ? 'Cloud workspace' : 'Development demo'}</strong>
            <p>{cloudMode ? 'Securely synced with Firebase.' : 'Changes stay on this device.'}</p>
          </div>
        </div>
      </aside>
      {open && <button className="sidebar-overlay" onClick={close} aria-label="Close menu" />}
    </>
  )
}

const Stat = ({ label, value, note, icon: Icon, color, trend }) => (
  <div className="stat-card">
    <div className={`stat-icon ${color}`}><Icon size={20} /></div>
    <div className="stat-copy"><span>{label}</span><strong>{value}</strong><small className={trend ? 'positive' : ''}>{note}</small></div>
  </div>
)

function SummaryPanel({ title, subtitle, items }) {
  return <section className="panel summary-panel">
    <div className="panel-header"><div><h3>{title}</h3><p>{subtitle}</p></div></div>
    <div className="summary-grid">{items.map(item => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}</div>
  </section>
}

function Dashboard({ students, notices, fees, attendance, activities, staff, staffAttendance, approvals, expenses, setPage }) {
  const [financeRange, setFinanceRange] = useState('This Month')
  const todayMarks = attendance[today()] || {}
  const marked = Object.values(todayMarks)
  const present = marked.filter(mark => mark === 'P').length
  const absent = marked.filter(mark => mark === 'A').length
  const leave = marked.filter(mark => mark === 'L').length
  const attendanceRate = marked.length ? Math.round(present / marked.length * 100) : 0
  const collected = Object.values(fees).filter(fee => fee.status === 'paid').reduce((sum, fee) => sum + Number(fee.amount || 0), 0)
  const billed = students.length * 18500
  const feeRate = billed ? Math.min(100, Math.round(collected / billed * 100)) : 0
  const newAdmissions = students.filter(student => student.admissionType === 'New').length
  const dropouts = students.filter(student => !student.active).length
  const rteStudents = students.filter(student => student.admissionScheme === 'RTE').length
  const ewsStudents = students.filter(student => student.admissionScheme === 'EWS').length
  const staffRows = Object.values(staff || {})
  const staffMarks = staffAttendance[today()] || {}
  const staffPresent = Object.values(staffMarks).filter(mark => mark === 'P').length
  const staffAbsent = Object.values(staffMarks).filter(mark => mark === 'A').length
  const staffLeave = Object.values(staffMarks).filter(mark => mark === 'L').length
  const birthdayDistance = dob => {
    if (!dob) return 999
    const birth = new Date(`${dob}T00:00:00`)
    const current = new Date()
    const next = new Date(current.getFullYear(), birth.getMonth(), birth.getDate())
    next.setHours(0, 0, 0, 0)
    const start = new Date(current.getFullYear(), current.getMonth(), current.getDate())
    if (next < start) next.setFullYear(next.getFullYear() + 1)
    return Math.round((next - start) / 86400000)
  }
  const birthdaysToday = students.filter(student => birthdayDistance(student.dob) === 0)
  const upcomingBirthdays = students.filter(student => birthdayDistance(student.dob) > 0 && birthdayDistance(student.dob) <= 7).sort((a, b) => birthdayDistance(a.dob) - birthdayDistance(b.dob))
  const pendingFeeApprovals = Object.values(approvals.fees || {}).filter(item => item.status === 'pending').length
  const pendingLeaveApprovals = Object.values(approvals.leaves || {}).filter(item => item.status === 'pending').length
  const boys = students.filter(student => student.gender === 'Male').length
  const girls = students.filter(student => student.gender === 'Female').length
  const knownGender = boys + girls
  const boysRate = knownGender ? Math.round(boys / knownGender * 100) : 0
  const overdueStudents = students.filter(student => student.fee !== 'Paid').slice(0, 5)
  const rangeDays = financeRange === 'This Week' ? 7 : financeRange === 'This Month' ? 30 : 365
  const cutoff = Date.now() - rangeDays * 86400000
  const income = Object.values(fees).filter(item => (item.paidAt || 0) >= cutoff && item.status === 'paid').reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const expense = Object.values(expenses || {}).filter(item => (item.paidAt || item.createdAt || 0) >= cutoff).reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const financeMax = Math.max(income, expense, 1)
  const attendanceBars = Array.from({ length: 6 }, (_, offset) => {
    const date = new Date()
    date.setDate(date.getDate() - (5 - offset))
    const key = dateKey(date)
    const values = Object.values(attendance[key] || {})
    return { label: date.toLocaleDateString('en-IN', { weekday: 'short' }), value: values.length ? Math.round(values.filter(mark => mark === 'P').length / values.length * 100) : 0 }
  })
  return (
    <>
      <div className="welcome-row">
        <div><span className="eyebrow">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</span><h2>School command center</h2><p>Live operational data from your Firebase workspace.</p></div>
        <button className="primary-button" onClick={() => setPage('students')}><Plus size={17} /> Add student</button>
      </div>
      <section className="stat-grid">
        <Stat label="Total students" value={students.length} note={`${students.filter(s => s.createdAt && Date.now() - s.createdAt < 30 * 86400000).length} added this month`} icon={Users} color="blue" trend />
        <Stat label="Present today" value={`${attendanceRate}%`} note={`${present} of ${marked.length || students.length} marked present`} icon={CalendarCheck} color="green" trend />
        <Stat label="Fee collected" value={money(collected)} note={`${feeRate}% of monthly billing`} icon={IndianRupee} color="orange" />
        <Stat label="Active staff" value={staffRows.length} note="Firebase employee records" icon={GraduationCap} color="violet" />
      </section>
      <section className="command-summary-grid">
        <SummaryPanel title="Student Summary" subtitle="Current admission strength" items={[
          { label: 'Total Students', value: students.length },
          { label: 'New Admissions', value: newAdmissions },
          { label: 'Dropouts', value: dropouts },
          { label: 'RTE Students', value: rteStudents },
          { label: 'EWS Students', value: ewsStudents },
        ]} />
        <SummaryPanel title="Employee Summary" subtitle="Staff attendance today" items={[
          { label: 'Total Staff', value: staffRows.length },
          { label: 'Present Today', value: staffPresent },
          { label: 'Absent Today', value: staffAbsent },
          { label: 'On Leave', value: staffLeave },
        ]} />
      </section>
      <section className="dashboard-grid">
        <div className="panel attendance-panel">
          <div className="panel-header"><div><h3>Attendance overview</h3><p>Student attendance over the last 7 days</p></div><select><option>This week</option><option>Last week</option></select></div>
          <div className="chart-wrap">
            <div className="chart-y"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div>
            <div className="bar-chart">
              {attendanceBars.map(day => <div className="bar-column" key={day.label}><div className="bar-track"><div className="bar-fill" style={{ '--bar-height': `${day.value}%` }} title={`${day.value}% present`} /></div><span>{day.label}</span></div>)}
            </div>
          </div>
          <div className="chart-summary"><span><i className="dot green" />Present <strong>{present}</strong></span><span><i className="dot red" />Absent <strong>{absent}</strong></span><span><i className="dot amber" />On leave <strong>{leave}</strong></span></div>
        </div>
        <div className="panel collection-panel">
          <div className="panel-header"><div><h3>Fee collection</h3><p>June 2026</p></div><button className="text-button" onClick={() => setPage('fees')}>View details</button></div>
          <div className="donut-row">
            <button className="donut" style={{ '--fee-rate': `${feeRate}%` }} title={`${feeRate}% collected`} onClick={() => setPage('fees')}><div><strong>{feeRate}%</strong><span>Collected</span></div></button>
            <div className="fee-legend">
              <span><i className="dot blue" /><small>Collected</small><strong>{money(collected)}</strong></span>
              <span><i className="dot gray" /><small>Pending</small><strong>{money(Math.max(0, billed - collected))}</strong></span>
            </div>
          </div>
          <div className="target"><div><span>Monthly billing</span><strong>{money(billed)}</strong></div><div className="progress"><i style={{ width: `${feeRate}%` }} /></div></div>
        </div>
        <div className="panel activity-panel">
          <div className="panel-header"><div><h3>Recent activity</h3><p>Latest updates from your team</p></div><MoreHorizontal size={18} /></div>
          <div className="activity-list">
            {activities.slice(0, 6).map((activity, i) => <div className="activity" key={activity.id}><span className={`activity-icon a${i % 4}`}>{activity.icon}</span><div><strong>{activity.title}</strong><p>{activity.detail}</p></div><time>{timeAgo(activity.at)}</time></div>)}
            {!activities.length && <div className="empty-state">Actions performed in the ERP will appear here.</div>}
          </div>
        </div>
        <div className="panel notice-panel">
          <div className="panel-header"><div><h3>Upcoming & notices</h3><p>What needs your attention</p></div><button className="text-button" onClick={() => setPage('notices')}>View all</button></div>
          <div className="notice-list">
            {notices.slice(0, 3).map(n => <div className="notice-item" key={n.id}><div className="date-box"><strong>{n.date.split(' ')[0]}</strong><span>{n.date.split(' ')[1]}</span></div><div><strong>{n.title}</strong><p>{n.detail}</p></div>{n.priority === 'High' && <span className="priority">Important</span>}</div>)}
          </div>
        </div>
      </section>
      <section className="dashboard-insights">
        <div className="panel birthday-panel">
          <div className="panel-header"><div><h3>Birthdays</h3><p>Today and the next 7 days</p></div><Cake size={18} /></div>
          <div className="birthday-block"><span>Birthdays Today</span>{birthdaysToday.map(student => <div className="birthday-person" key={student.id}><span className={`avatar tone-${student.tone}`}>{student.initials}</span><div><strong>{student.name}</strong><small>{student.className}</small></div></div>)}{!birthdaysToday.length && <p>No birthdays today.</p>}</div>
          <div className="birthday-block"><span>Upcoming</span>{upcomingBirthdays.map(student => <div className="birthday-person" key={student.id}><span className={`avatar tone-${student.tone}`}>{student.initials}</span><div><strong>{student.name}</strong><small>In {birthdayDistance(student.dob)} day{birthdayDistance(student.dob) === 1 ? '' : 's'} · {student.className}</small></div></div>)}{!upcomingBirthdays.length && <p>No birthdays in the next 7 days.</p>}</div>
        </div>
        <div className="panel approval-panel">
          <div className="panel-header"><div><h3>Pending Approvals</h3><p>Items waiting for review</p></div><Clock3 size={18} /></div>
          <div className="approval-list"><div><span className="approval-icon fee"><WalletCards size={18} /></span><div><strong>Fee approvals</strong><small>Payment adjustments and waivers</small></div><b>{pendingFeeApprovals}</b></div><div><span className="approval-icon leave"><UserCheck size={18} /></span><div><strong>Leave approvals</strong><small>Employee leave requests</small></div><b>{pendingLeaveApprovals}</b></div></div>
        </div>
        <div className="panel gender-panel">
          <div className="panel-header"><div><h3>Boys / Girls Count</h3><p>Gender distribution from student profiles</p></div></div>
          <div className="gender-content"><div className="gender-donut" style={{ '--boys-rate': `${boysRate}%` }}><div><strong>{knownGender}</strong><span>Profiles</span></div></div><div className="gender-legend"><span><i className="dot blue" />Boys <strong>{boys}</strong></span><span><i className="dot pink-dot" />Girls <strong>{girls}</strong></span><span><i className="dot gray" />Not specified <strong>{students.length - knownGender}</strong></span></div></div>
        </div>
        <div className="panel reminder-panel">
          <div className="panel-header"><div><h3>Payment Reminder</h3><p>Top overdue student accounts</p></div><button className="text-button" onClick={() => setPage('fees')}>Open ledger</button></div>
          <div className="reminder-list">{overdueStudents.map(student => <div key={student.id}><span className={`avatar tone-${student.tone}`}>{student.initials}</span><div><strong>{student.name}</strong><small>{student.roll} · {student.className}</small></div><b>{money(18500)}</b></div>)}{!overdueStudents.length && <div className="empty-state">No overdue fee accounts.</div>}</div>
        </div>
        <div className="panel finance-report">
          <div className="panel-header"><div><h3>Earning / Expense Report</h3><p>Firebase financial transactions</p></div><select value={financeRange} onChange={event => setFinanceRange(event.target.value)}><option>This Week</option><option>This Month</option><option>This Year</option></select></div>
          <div className="finance-bars"><div><span>Income</span><div><i className="income" style={{ width: `${income / financeMax * 100}%` }} /></div><strong>{money(income)}</strong></div><div><span>Expense</span><div><i className="expense" style={{ width: `${expense / financeMax * 100}%` }} /></div><strong>{money(expense)}</strong></div></div>
          <div className="finance-balance"><TrendingUp size={17} /><span>Net balance</span><strong>{money(income - expense)}</strong></div>
        </div>
      </section>
    </>
  )
}

function StudentModal({ close, addStudent }) {
  const [form, setForm] = useState({ name: '', className: '1-A', guardian: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const submit = async e => {
    e.preventDefault()
    const parts = form.name.trim().split(/\s+/)
    setSaving(true)
    try {
      await addStudent({ ...form, initials: parts.map(p => p[0]).slice(0, 2).join('').toUpperCase(), attendance: 100, fee: 'Pending' })
      close()
    } finally {
      setSaving(false)
    }
  }
  return <div className="modal-backdrop"><form className="modal" onSubmit={submit}>
    <div className="modal-header"><div><h3>Add new student</h3><p>Create a student profile and admission record.</p></div><button type="button" className="icon-button" onClick={close}><X size={19} /></button></div>
    <div className="form-grid">
      <label className="full">Student name<input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Full name" /></label>
      <label>Class & section<select value={form.className} onChange={e => setForm({...form, className: e.target.value})}>{['1-A','2-A','3-A','4-B','5-A','6-A','7-B','8-B','9-C','10-A'].map(c => <option key={c}>{c}</option>)}</select></label>
      <label>Guardian name<input required value={form.guardian} onChange={e => setForm({...form, guardian: e.target.value})} placeholder="Parent / guardian" /></label>
      <label className="full">Phone number<input required value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="10-digit mobile number" /></label>
    </div>
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={close}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? 'Saving...' : <><Plus size={16} /> Add student</>}</button></div>
  </form></div>
}

function StudentProfile({ student, close }) {
  if (!student) return null
  return <div className="modal-backdrop"><section className="modal profile-modal">
    <div className="modal-header"><div><h3>{student.name}</h3><p>{student.roll} · Class {student.className}</p></div><button className="icon-button" onClick={close}><X size={19} /></button></div>
    <div className="profile-hero"><span className={`avatar tone-${student.tone}`}>{student.initials}</span><div><strong>{student.name}</strong><span className={`status ${student.fee.toLowerCase()}`}>{student.fee}</span></div></div>
    <dl className="profile-details">
      <div><dt>Admission number</dt><dd>{student.roll}</dd></div>
      <div><dt>Class & section</dt><dd>{student.className}</dd></div>
      <div><dt>Guardian</dt><dd>{student.guardian}</dd></div>
      <div><dt>Phone</dt><dd>{student.phone}</dd></div>
      <div><dt>Attendance</dt><dd>{student.attendance}%</dd></div>
      <div><dt>Joined</dt><dd>{student.createdAt ? new Date(student.createdAt).toLocaleDateString('en-IN') : 'Not available'}</dd></div>
    </dl>
  </section></div>
}

function Students({ students, onAddStudent }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All classes')
  const [modal, setModal] = useState(false)
  const [selected, setSelected] = useState(null)
  const classes = [...new Set(students.map(student => student.className))].sort()
  const filtered = students.filter(s => (filter === 'All classes' || s.className === filter) && `${s.name} ${s.roll} ${s.phone}`.toLowerCase().includes(search.trim().toLowerCase()))
  const addStudent = student => onAddStudent({ ...student, roll: `2026-${String(students.length + 1).padStart(4, '0')}` })
  return <>
    <div className="section-actions"><div><h2>Student directory</h2><p>Manage profiles, guardians, attendance and fee status.</p></div><button className="primary-button" onClick={() => setModal(true)}><Plus size={17} /> Add student</button></div>
    <div className="mini-stats"><div><span>All students</span><strong>{students.length}</strong></div><div><span>New admissions</span><strong>{students.filter(s => s.createdAt && Date.now() - s.createdAt < 30 * 86400000).length}</strong></div><div><span>Avg. attendance</span><strong>{students.length ? Math.round(students.reduce((sum, s) => sum + s.attendance, 0) / students.length) : 0}%</strong></div><div><span>Fee defaulters</span><strong>{students.filter(s => s.fee !== 'Paid').length}</strong></div></div>
    <div className="panel table-panel">
      <div className="table-toolbar"><div className="table-search"><Search size={16} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student, roll no. or phone" /></div><select value={filter} onChange={e => setFilter(e.target.value)}><option>All classes</option>{classes.map(c => <option key={c}>{c}</option>)}</select></div>
      <div className="table-scroll"><table><thead><tr><th>Student</th><th>Class</th><th>Guardian</th><th>Attendance</th><th>Fee status</th><th /></tr></thead><tbody>
        {filtered.map(s => <tr key={s.id} onClick={() => setSelected(s)} className="clickable-row"><td><div className="student-cell"><span className={`avatar tone-${s.tone}`}>{s.initials}</span><div><strong>{s.name}</strong><small>{s.roll}</small></div></div></td><td><span className="class-pill">{s.className}</span></td><td><strong className="regular">{s.guardian}</strong><small className="cell-sub">{s.phone}</small></td><td><div className="attendance-cell"><span>{s.attendance}%</span><div><i style={{width: `${s.attendance}%`}} /></div></div></td><td><span className={`status ${s.fee.toLowerCase()}`}>{s.fee}</span></td><td><button className="icon-button" aria-label={`View ${s.name}`}><Eye size={17} /></button></td></tr>)}
        {!filtered.length && <tr><td colSpan="6"><div className="empty-state">No students match this search.</div></td></tr>}
      </tbody></table></div>
    </div>
    {modal && <StudentModal close={() => setModal(false)} addStudent={addStudent} />}
    {selected && <StudentProfile student={selected} close={() => setSelected(null)} />}
  </>
}

const admissionClasses = ['Nursery-A','LKG-A','UKG-A','1-A','2-A','3-A','4-B','5-A','6-A','7-B','8-B','9-C','10-A','11-A','12-A']

function AdmissionForm({ students, onAddStudent, onOpenRegister }) {
  const [expanded, setExpanded] = useState(true)
  const [saving, setSaving] = useState(false)
  const [permanentAddress, setPermanentAddress] = useState(false)
  const [form, setForm] = useState({
    className: 'Nursery-A', admissionScheme: 'General', roll: `2026-${String(students.length + 1).padStart(4, '0')}`,
    admissionDate: today(), newAdmission: true, name: '', fatherName: '', motherName: '', guardian: '',
    gender: '', dob: '', phone: '', email: '', state: '', city: '', address: '', pincode: '',
    aadhaar: '', penId: '', apaarId: '', feeGroup: 'Standard', smsEnabled: true,
  })
  const update = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const submit = async event => {
    event.preventDefault()
    setSaving(true)
    try {
      await onAddStudent(form)
      setForm(current => ({ ...current, roll: `2026-${String(students.length + 2).padStart(4, '0')}`, name: '', fatherName: '', motherName: '', guardian: '', phone: '', email: '', address: '', aadhaar: '', penId: '', apaarId: '' }))
    } finally { setSaving(false) }
  }
  return <form className="admission-form" onSubmit={submit}>
    <div className="admission-toolbar">
      <button type="button" className="secondary-button" onClick={() => {
        const content = `NXT OpenERP School\nADMISSION FORM\n\nAdmission No: __________  Date: __________\nStudent Name: ______________________________\nClass/Section: __________  Gender: __________\nFather: __________________  Mother: __________________\nMobile: __________________  DOB: __________________\nAddress: ____________________________________________`
        const link = document.createElement('a')
        link.href = URL.createObjectURL(new Blob([content], { type: 'text/plain' }))
        link.download = 'admission-form.txt'
        link.click()
        URL.revokeObjectURL(link.href)
      }}><Download size={16} /> Download Admission Form</button>
      <label className="secondary-button file-button"><Upload size={16} /> Import Excel<input type="file" accept=".csv,text/csv" onChange={async event => {
        const file = event.target.files?.[0]
        if (!file) return
        const rows = (await file.text()).split(/\r?\n/).slice(1).filter(Boolean)
        for (const row of rows) {
          const [name, className, guardian, phone] = row.split(',').map(value => value?.trim())
          if (name && className) await onAddStudent({ name, className, guardian: guardian || '', phone: phone || '', roll: `2026-${Date.now().toString().slice(-6)}`, admissionDate: today(), admissionScheme: 'General', newAdmission: true })
        }
        event.target.value = ''
      }} /></label>
      <button type="button" className="secondary-button" onClick={onOpenRegister}><Search size={16} /> Search Student</button>
    </div>
    <section className="panel admission-card">
      <div className="admission-grid five">
        <label>Class*<select required value={form.className} onChange={e => update('className', e.target.value)}>{admissionClasses.map(item => <option key={item}>{item}</option>)}</select></label>
        <label>Section*<input required value={form.className.split('-')[1] || 'A'} onChange={e => update('className', `${form.className.split('-')[0]}-${e.target.value}`)} /></label>
        <label>Admission Scheme*<select required value={form.admissionScheme} onChange={e => update('admissionScheme', e.target.value)}><option>General</option><option>RTE</option><option>EWS</option><option>Scholarship</option><option>Staff Ward</option></select></label>
        <label>Admission Number*<input required value={form.roll} onChange={e => update('roll', e.target.value)} /></label>
        <label>Date of Admission*<input required type="date" value={form.admissionDate} onChange={e => update('admissionDate', e.target.value)} /></label>
      </div>
      <label className="check-line"><input type="checkbox" checked={form.newAdmission} onChange={e => update('newAdmission', e.target.checked)} /> New Admission</label>
    </section>
    <section className="panel admission-card">
      <button type="button" className="collapse-title" onClick={() => setExpanded(!expanded)}><span>Student Information</span><ChevronRight className={expanded ? 'rotated' : ''} size={18} /></button>
      {expanded && <div className="admission-fields">
        <div className="admission-grid four">
          <label>Student Name*<input required value={form.name} onChange={e => update('name', e.target.value)} /></label>
          <label>Father&apos;s Name*<input required value={form.fatherName} onChange={e => update('fatherName', e.target.value)} /></label>
          <label>Mother&apos;s Name*<input required value={form.motherName} onChange={e => update('motherName', e.target.value)} /></label>
          <label>Guardian&apos;s Name<input value={form.guardian} onChange={e => update('guardian', e.target.value)} /></label>
          <label>Gender*<select required value={form.gender} onChange={e => update('gender', e.target.value)}><option value="">Select gender</option><option>Male</option><option>Female</option><option>Other</option></select></label>
          <label>Date of Birth*<input required type="date" value={form.dob} onChange={e => update('dob', e.target.value)} /></label>
          <label>Phone Number*<input required value={form.phone} onChange={e => update('phone', e.target.value)} /></label>
          <label>Email Id<input type="email" value={form.email} onChange={e => update('email', e.target.value)} /></label>
          <label>State<input value={form.state} onChange={e => update('state', e.target.value)} /></label>
          <label>City<input value={form.city} onChange={e => update('city', e.target.value)} /></label>
          <label>Residence Address*<input required value={form.address} onChange={e => update('address', e.target.value)} /></label>
          <label>Pincode<input value={form.pincode} onChange={e => update('pincode', e.target.value)} /></label>
          <label>Aadhaar Card<input value={form.aadhaar} onChange={e => update('aadhaar', e.target.value)} /></label>
          <label>PEN Id<input value={form.penId} onChange={e => update('penId', e.target.value)} /></label>
          <label>APAAR Id<input value={form.apaarId} onChange={e => update('apaarId', e.target.value)} /></label>
          <label>Fee Group*<select required value={form.feeGroup} onChange={e => update('feeGroup', e.target.value)}><option>Standard</option><option>Transport</option><option>Hostel</option><option>RTE</option></select></label>
        </div>
        <div className="admission-options">
          <label className="check-line"><input type="checkbox" checked={permanentAddress} onChange={e => setPermanentAddress(e.target.checked)} /> Add Permanent Address</label>
          <div className="sms-toggle"><button type="button" className={!form.smsEnabled ? 'active' : ''} onClick={() => update('smsEnabled', false)}>Don&apos;t Send SMS</button><button type="button" className={form.smsEnabled ? 'active' : ''} onClick={() => update('smsEnabled', true)}>Send SMS</button></div>
        </div>
        {permanentAddress && <label className="permanent-field">Permanent Address<input value={form.permanentAddress || ''} onChange={e => update('permanentAddress', e.target.value)} /></label>}
      </div>}
    </section>
    <button className="primary-button admission-submit" disabled={saving}><Save size={16} /> {saving ? 'Submitting...' : 'Submit'}</button>
  </form>
}

function StudentRegisterTable({ students }) {
  return <div className="panel table-panel"><div className="table-scroll"><table><thead><tr><th>Student</th><th>Admission No.</th><th>Class</th><th>Father</th><th>Mobile</th><th>Admission</th><th>Status</th></tr></thead><tbody>
    {students.map(student => <tr key={student.id}><td><div className="student-cell"><span className={`avatar tone-${student.tone}`}>{student.initials}</span><strong>{student.name}</strong></div></td><td>{student.roll}</td><td>{student.className}</td><td>{student.fatherName || student.guardian}</td><td>{student.phone}</td><td>{student.admissionType}</td><td><span className={`status ${student.active ? 'paid' : 'overdue'}`}>{student.active ? 'Active' : 'Inactive'}</span></td></tr>)}
    {!students.length && <tr><td colSpan="7"><div className="empty-state">No students found.</div></td></tr>}
  </tbody></table></div></div>
}

function AdmissionRegister({ students, compact = false }) {
  const [query, setQuery] = useState('')
  const [type, setType] = useState(compact ? 'All Students' : 'Active Students')
  const [admissionType, setAdmissionType] = useState('All')
  const [category, setCategory] = useState('All categories')
  const filtered = students.filter(student =>
    `${student.name} ${student.roll} ${student.phone}`.toLowerCase().includes(query.toLowerCase()) &&
    (type !== 'Active Students' || student.active) &&
    (admissionType === 'All' || (admissionType === 'New' ? student.admissionType === 'New' : student.admissionType !== 'New')) &&
    (category === 'All categories' || student.feeGroup === category)
  )
  return <>
    <div className="register-filters panel">
      <label>Search By<select value={type} onChange={e => setType(e.target.value)}><option>Active Students</option><option>All Students</option></select></label>
      {!compact && <label>Admission Type<select value={admissionType} onChange={e => setAdmissionType(e.target.value)}><option>All</option><option>New</option><option>Except New</option></select></label>}
      {!compact && <label>Select Category<select value={category} onChange={e => setCategory(e.target.value)}><option>All categories</option><option>Standard</option><option>Transport</option><option>Hostel</option><option>RTE</option></select></label>}
      <label className="filter-search">Student Search<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Name, admission no. or mobile" /></label>
      <button className="primary-button"><Search size={16} /> Search</button>
    </div>
    <StudentRegisterTable students={filtered} />
  </>
}

function EnquiryModule({ enquiries, onSaveEnquiry }) {
  const [tab, setTab] = useState('Enquiry')
  const [status, setStatus] = useState('Pending')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [form, setForm] = useState({ name: '', className: 'Nursery-A', fatherName: '', motherName: '', dob: '', mobile: '', aadhaar: '', status: 'Pending' })
  const filtered = enquiries.filter(item => (!status || item.status === status) && (!from || item.createdDate >= from) && (!to || item.createdDate <= to))
  const submit = async event => {
    event.preventDefault()
    await onSaveEnquiry(form)
    setForm(current => ({ ...current, name: '', fatherName: '', motherName: '', mobile: '', aadhaar: '' }))
  }
  return <>
    <div className="sub-tabs"><button className={tab === 'Enquiry' ? 'active' : ''} onClick={() => setTab('Enquiry')}>Enquiry</button><button className={tab === 'Facility' ? 'active' : ''} onClick={() => setTab('Facility')}>Facility</button></div>
    {tab === 'Enquiry' ? <>
      <form className="panel enquiry-entry" onSubmit={submit}>
        <div className="admission-grid four"><label>Name*<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label><label>Class<select value={form.className} onChange={e => setForm({ ...form, className: e.target.value })}>{admissionClasses.map(item => <option key={item}>{item}</option>)}</select></label><label>Father Name<input value={form.fatherName} onChange={e => setForm({ ...form, fatherName: e.target.value })} /></label><label>Mother Name<input value={form.motherName} onChange={e => setForm({ ...form, motherName: e.target.value })} /></label><label>DOB<input type="date" value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })} /></label><label>Mobile No.*<input required value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} /></label><label>Aadhaar Card<input value={form.aadhaar} onChange={e => setForm({ ...form, aadhaar: e.target.value })} /></label><label>Status<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option>Pending</option><option>Confirmed</option><option>Rejected</option></select></label></div>
        <button className="primary-button"><Plus size={16} /> Add enquiry</button>
      </form>
      <div className="register-filters panel"><label>Select Status<select value={status} onChange={e => setStatus(e.target.value)}><option>Pending</option><option>Confirmed</option><option>Rejected</option><option value="">All Status</option></select></label><label>From Date<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label>To Date<input type="date" value={to} onChange={e => setTo(e.target.value)} /></label><button className="primary-button"><Search size={16} /> Search</button><button className="secondary-button" onClick={() => { setStatus(''); setFrom(''); setTo('') }}>Clear</button></div>
      <div className="share-link"><Link2 size={15} /><span>{`${location.origin}/?admission=enquiry`}</span><button className="text-button" onClick={() => navigator.clipboard?.writeText(`${location.origin}/?admission=enquiry`)}>Copy link</button></div>
      <div className="panel table-panel"><div className="table-scroll"><table><thead><tr><th>Name</th><th>Class</th><th>Father Name</th><th>Mother Name</th><th>DOB</th><th>Mobile No</th><th>Aadhaar Card</th><th>Status</th></tr></thead><tbody>{filtered.map(item => <tr key={item.id}><td>{item.name}</td><td>{item.className}</td><td>{item.fatherName}</td><td>{item.motherName}</td><td>{item.dob}</td><td>{item.mobile}</td><td>{item.aadhaar}</td><td><span className={`status ${item.status === 'Confirmed' ? 'paid' : item.status === 'Rejected' ? 'overdue' : 'pending'}`}>{item.status}</span></td></tr>)}{!filtered.length && <tr><td colSpan="8"><div className="empty-state">No enquiries found.</div></td></tr>}</tbody></table></div></div>
    </> : <div className="panel facility-panel"><h3>Admission facilities</h3><p>Transport, hostel, day-care and scholarship requirements can be captured during counselling.</p><div className="facility-grid">{['School Transport','Hostel','Day Care','Scholarship'].map(item => <label key={item}><input type="checkbox" /> {item}</label>)}</div></div>}
  </>
}

function Admissions({ students, enquiries, onAddStudent, onSaveEnquiry }) {
  const [page, setPage] = useState('add')
  const tabs = [['add','Add Student'],['master','Master Register'],['enquiry','Enquiry Form'],['register','Student Register']]
  return <>
    <div className="section-actions"><div><h2>Admission management</h2><p>Applications, enquiries and student registers in one workspace.</p></div></div>
    <div className="admission-tabs">{tabs.map(([id,label]) => <button key={id} className={page === id ? 'active' : ''} onClick={() => setPage(id)}>{label}</button>)}</div>
    {page === 'add' && <AdmissionForm students={students} onAddStudent={onAddStudent} onOpenRegister={() => setPage('master')} />}
    {page === 'master' && <AdmissionRegister students={students} />}
    {page === 'enquiry' && <EnquiryModule enquiries={enquiries} onSaveEnquiry={onSaveEnquiry} />}
    {page === 'register' && <AdmissionRegister students={students} compact />}
  </>
}

function Attendance({ students, attendance, onSaveAttendance }) {
  const [date, setDate] = useState(today())
  const [marks, setMarks] = useState({})
  const [saved, setSaved] = useState(false)
  const [savingId, setSavingId] = useState('')
  useEffect(() => setMarks(attendance[date] || {}), [attendance, date])
  const present = students.filter(s => marks[s.id] === 'P').length
  const absent = students.filter(s => marks[s.id] === 'A').length
  const updateAll = status => setMarks(Object.fromEntries(students.map(s => [s.id, status])))
  const updateOne = async (studentId, status) => {
    const next = { ...marks, [studentId]: status }
    setMarks(next)
    setSavingId(studentId)
    try { await onSaveAttendance({ [studentId]: status }, date) } finally { setSavingId('') }
  }
  return <>
    <div className="section-actions"><div><h2>Daily attendance</h2><p>{readableDate(date)} · Saved records load automatically</p></div><div className="section-control"><input type="date" value={date} onChange={e => setDate(e.target.value)} /><button className="primary-button" onClick={async () => { await onSaveAttendance(marks, date); setSaved(true); setTimeout(() => setSaved(false), 1800) }}>{saved ? <Check size={17} /> : <Save size={17} />}{saved ? 'Attendance saved' : 'Save attendance'}</button></div></div>
    <div className="attendance-summary"><div><strong>{students.length}</strong><span>Students</span></div><div className="present"><strong>{present}</strong><span>Present</span></div><div className="absent"><strong>{absent}</strong><span>Absent</span></div><div><strong>{students.length ? Math.round(present / students.length * 100) : 0}%</strong><span>Attendance rate</span></div></div>
    <div className="panel table-panel">
      <div className="table-toolbar"><div><strong>All classes</strong><small>{students.length} students</small></div><div className="toolbar-actions"><button className="secondary-button" onClick={() => updateAll('P')}>Mark all present</button><button className="secondary-button" onClick={() => updateAll('A')}>Mark all absent</button></div></div>
      <div className="attendance-list">{students.map(s => <div className="attendance-row" key={s.id}><div className="student-cell"><span className={`avatar tone-${s.tone}`}>{s.initials}</span><div><strong>{s.name}</strong><small>{s.roll} · {s.className}{savingId === s.id ? ' · Saving...' : ''}</small></div></div><div className="mark-control">{['P','A','L'].map(mark => <button key={mark} className={marks[s.id] === mark ? `selected ${mark}` : ''} onClick={() => updateOne(s.id, mark)}>{mark === 'P' ? 'Present' : mark === 'A' ? 'Absent' : 'Leave'}</button>)}</div></div>)}</div>
    </div>
  </>
}

function PaymentModal({ students, close, onRecordPayment }) {
  const pending = students.filter(student => student.fee !== 'Paid')
  const [form, setForm] = useState({ studentId: pending[0]?.id || '', amount: 18500, method: 'UPI' })
  const [saving, setSaving] = useState(false)
  const submit = async event => {
    event.preventDefault()
    setSaving(true)
    try { await onRecordPayment(form.studentId, Number(form.amount), form.method); close() } finally { setSaving(false) }
  }
  return <div className="modal-backdrop"><form className="modal" onSubmit={submit}>
    <div className="modal-header"><div><h3>Record fee payment</h3><p>Create a receipt and update the student ledger.</p></div><button type="button" className="icon-button" onClick={close}><X size={19} /></button></div>
    <div className="form-grid">
      <label className="full">Student<select required value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })}>{pending.map(student => <option value={student.id} key={student.id}>{student.name} · {student.roll}</option>)}</select></label>
      <label>Amount<input required type="number" min="1" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></label>
      <label>Payment method<select value={form.method} onChange={e => setForm({ ...form, method: e.target.value })}><option>UPI</option><option>Cash</option><option>Card</option><option>Bank transfer</option></select></label>
    </div>
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={close}>Cancel</button><button className="primary-button" disabled={saving}><Receipt size={16} /> {saving ? 'Recording...' : 'Record payment'}</button></div>
  </form></div>
}

function Fees({ students, fees, onRecordPayment }) {
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const total = students.length * 18500
  const collected = Object.values(fees).filter(fee => fee.status === 'paid').reduce((sum, fee) => sum + Number(fee.amount || 0), 0)
  const filtered = students.filter(student => `${student.name} ${student.roll} ${student.className}`.toLowerCase().includes(search.trim().toLowerCase()))
  return <>
    <div className="section-actions"><div><h2>Fee management</h2><p>Track collections, pending dues and receipts.</p></div><button className="primary-button" onClick={() => setModal(true)} disabled={!students.some(student => student.fee !== 'Paid')}><Plus size={17} /> Record payment</button></div>
    <section className="stat-grid fee-stats"><Stat label="Total billed" value={money(total)} note="Current billing cycle" icon={IndianRupee} color="blue" /><Stat label="Collected" value={money(collected)} note={`${total ? Math.round(collected/total*100) : 0}% collection rate`} icon={Check} color="green" trend /><Stat label="Pending" value={money(Math.max(0, total-collected))} note={`${students.filter(s => s.fee !== 'Paid').length} student accounts`} icon={Bell} color="orange" /></section>
    <div className="panel table-panel"><div className="table-toolbar"><div><strong>Student fee ledger</strong><small>Monthly tuition fee</small></div><div className="table-search"><Search size={16} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ledger" /></div></div><div className="table-scroll"><table><thead><tr><th>Student</th><th>Invoice</th><th>Amount</th><th>Paid on</th><th>Status</th><th>Action</th></tr></thead><tbody>
      {filtered.map(s => { const fee = fees[`${s.id}_2026-06`]; return <tr key={s.id}><td><div className="student-cell"><span className={`avatar tone-${s.tone}`}>{s.initials}</span><div><strong>{s.name}</strong><small>{s.className}</small></div></div></td><td>{fee?.invoiceNumber || `INV-202606-${s.roll.replace(/\D/g, '').slice(-4)}`}</td><td><strong>{money(fee?.amount || 18500)}</strong></td><td>{fee?.paidAt ? new Date(fee.paidAt).toLocaleDateString('en-IN') : '—'}</td><td><span className={`status ${s.fee.toLowerCase()}`}>{s.fee}</span></td><td>{s.fee !== 'Paid' ? <button className="text-button" onClick={() => onRecordPayment(s.id, 18500, 'UPI')}>Mark paid</button> : <button className="text-button muted" title={fee?.method || 'Payment received'}><Receipt size={14} /> Receipt</button>}</td></tr> })}
      {!filtered.length && <tr><td colSpan="6"><div className="empty-state">No ledger entries match this search.</div></td></tr>}
    </tbody></table></div></div>
    {modal && <PaymentModal students={students} close={() => setModal(false)} onRecordPayment={onRecordPayment} />}
  </>
}

function PeriodModal({ initial, className, close, onSave }) {
  const [form, setForm] = useState(initial || { day: 'Monday', time: '08:00', subject: '', teacher: '', room: '' })
  const [saving, setSaving] = useState(false)
  const submit = async event => {
    event.preventDefault()
    setSaving(true)
    try { await onSave(className, form); close() } finally { setSaving(false) }
  }
  return <div className="modal-backdrop"><form className="modal" onSubmit={submit}>
    <div className="modal-header"><div><h3>{initial?.subject ? 'Edit period' : 'Add period'}</h3><p>{className} weekly timetable</p></div><button type="button" className="icon-button" onClick={close} aria-label="Close period form"><X size={19} /></button></div>
    <div className="form-grid">
      <label>Day<select value={form.day} onChange={e => setForm({ ...form, day: e.target.value })}>{['Monday','Tuesday','Wednesday','Thursday','Friday'].map(day => <option key={day}>{day}</option>)}</select></label>
      <label>Time<input required type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} /></label>
      <label className="full">Subject<input required value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} /></label>
      <label>Teacher<input required value={form.teacher} onChange={e => setForm({ ...form, teacher: e.target.value })} /></label>
      <label>Room<input required value={form.room} onChange={e => setForm({ ...form, room: e.target.value })} /></label>
    </div>
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={close}>Cancel</button><button className="primary-button" disabled={saving}><Save size={16} /> {saving ? 'Saving...' : 'Save period'}</button></div>
  </form></div>
}

function Academics({ timetableData, onSavePeriod }) {
  const classes = Object.keys(timetableData).length ? Object.keys(timetableData) : ['10-A']
  const [className, setClassName] = useState(classes[0])
  const [editing, setEditing] = useState(null)
  const periods = timetableData[className] || []
  const times = [...new Set(periods.map(period => period.time))].sort()
  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday']
  return <>
    <div className="section-actions"><div><h2>Academic planner</h2><p>Class timetable and teaching schedule for this week.</p></div><button className="primary-button" onClick={() => setEditing({})}><Plus size={17} /> Add period</button></div>
    <div className="academic-banner"><div><span className="eyebrow">Current term</span><h3>Term I · 2026-27</h3><p>72 instructional days · 4 assessments planned</p></div><div className="term-progress"><span>Term progress <strong>38%</strong></span><div className="progress"><i style={{width:'38%'}} /></div></div></div>
    <div className="panel timetable-panel"><div className="panel-header"><div><h3>Weekly timetable</h3><p>Class {className} · Click any period to edit</p></div><select value={className} onChange={e => setClassName(e.target.value)}>{classes.map(item => <option key={item}>{item}</option>)}</select></div><div className="table-scroll"><table className="timetable"><thead><tr><th>Time</th>{days.map(d => <th key={d}>{d}</th>)}</tr></thead><tbody>{times.map(time => <tr key={time}><td><strong>{time}</strong></td>{days.map((day, i) => { const period = periods.find(item => item.time === time && item.day === day); return <td key={day}>{period ? <button className="period-button" onClick={() => setEditing(period)}><span className={`subject s${i}`}>{period.subject}</span><small>{period.teacher} · {period.room}</small></button> : <button className="empty-period" onClick={() => setEditing({ day, time })}>+ Add</button>}</td> })}</tr>)}</tbody></table>{!times.length && <div className="empty-state">No periods yet. Add the first period for {className}.</div>}</div></div>
    {editing && <PeriodModal initial={editing.subject ? editing : { day: editing.day || 'Monday', time: editing.time || '08:00', subject: '', teacher: '', room: '' }} className={className} close={() => setEditing(null)} onSave={onSavePeriod} />}
  </>
}

function Notices({ notices, onAddNotice }) {
  const [form, setForm] = useState({ title: '', detail: '', audience: 'Entire school', type: 'Notice', priority: 'Normal' })
  const [filter, setFilter] = useState('All audiences')
  const [saving, setSaving] = useState(false)
  const filtered = notices.filter(notice => filter === 'All audiences' || notice.audience === filter)
  const add = async e => {
    e.preventDefault()
    if (!form.title.trim() || !form.detail.trim()) return
    setSaving(true)
    try {
      await onAddNotice({ ...form, date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) })
      setForm({ title: '', detail: '', audience: 'Entire school', type: 'Notice', priority: 'Normal' })
    } finally { setSaving(false) }
  }
  return <>
    <div className="section-actions"><div><h2>Notices & communication</h2><p>Publish announcements for students, parents and staff.</p></div></div>
    <div className="notice-layout">
      <form className="panel compose-panel" onSubmit={add}><div className="panel-header"><div><h3>Create announcement</h3><p>Share an update with your school community.</p></div></div><label>Announcement title<input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="What would you like to announce?" /></label><label>Audience<select value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value })}><option>Entire school</option><option>Students only</option><option>Staff only</option></select></label><label>Message<textarea required value={form.detail} onChange={e => setForm({ ...form, detail: e.target.value })} placeholder="Write the announcement details..." /></label><button className="primary-button" disabled={saving}><MessageSquareText size={16} /> {saving ? 'Publishing...' : 'Publish notice'}</button></form>
      <div className="panel notice-feed"><div className="panel-header"><div><h3>Published notices</h3><p>{filtered.length} active announcements</p></div><select value={filter} onChange={e => setFilter(e.target.value)}><option>All audiences</option><option>Entire school</option><option>Students only</option><option>Staff only</option></select></div>{filtered.map(n => <article key={n.id}><div className="notice-meta"><span className="class-pill">{n.type}</span><time>{n.date}</time></div><h4>{n.title}</h4><p>{n.detail}</p><div className="notice-footer"><span>{n.audience}</span><button className="icon-button"><MoreHorizontal size={17} /></button></div></article>)}{!filtered.length && <div className="empty-state">No notices for this audience.</div>}</div>
    </div>
  </>
}

const tones = ['blue', 'violet', 'green', 'orange', 'cyan', 'pink']

function studentFromRow(row, index) {
  const initials = row.full_name.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()
  return {
    id: row.id,
    name: row.full_name,
    roll: row.admission_number,
    className: `${row.class_name}-${row.section}`,
    guardian: row.guardian_name || 'Not provided',
    phone: row.guardian_phone || 'Not provided',
    attendance: row.attendance_rate ?? 100,
    fee: row.fee_status || 'Pending',
    createdAt: row.createdAt || 0,
    admissionScheme: row.admission_scheme || 'General',
    admissionDate: row.admission_date || '',
    admissionType: row.admission_type || 'New',
    fatherName: row.father_name || row.guardian_name || '',
    motherName: row.mother_name || '',
    gender: row.gender || '',
    dob: row.date_of_birth || '',
    email: row.email || '',
    state: row.state || '',
    city: row.city || '',
    address: row.address || '',
    pincode: row.pincode || '',
    aadhaar: row.aadhaar || '',
    penId: row.pen_id || '',
    apaarId: row.apaar_id || '',
    feeGroup: row.fee_group || 'Standard',
    smsEnabled: row.sms_enabled !== false,
    active: row.active !== false,
    initials,
    tone: tones[index % tones.length],
  }
}

function noticeFromRow(row) {
  const published = row.publishAt || row.publish_at || Date.now()
  return {
    id: row.id,
    title: row.title,
    detail: row.body,
    date: new Date(published).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
    type: row.category,
    priority: row.priority,
    audience: row.audience === 'students' ? 'Students only' : row.audience === 'staff' ? 'Staff only' : row.audience || 'Entire school',
    publishAt: published,
  }
}

function useSchoolWorkspace(session) {
  const developmentDemo = !isFirebaseConfigured && import.meta.env.VITE_APP_ENV !== 'production'
  const [students, setStudents] = useStoredState('northstar-students', seedStudents)
  const [notices, setNotices] = useStoredState('northstar-notices', seedNotices)
  const [fees, setFees] = useStoredState('northstar-fees', {})
  const [attendance, setAttendance] = useStoredState('northstar-attendance-records', {})
  const [timetableData, setTimetableData] = useStoredState('northstar-timetable', defaultTimetable)
  const [enquiries, setEnquiries] = useStoredState('northstar-enquiries', [])
  const [staff, setStaff] = useState({})
  const [staffAttendance, setStaffAttendance] = useState({})
  const [approvals, setApprovals] = useState({ fees: {}, leaves: {} })
  const [expenses, setExpenses] = useState({})
  const [activities, setActivities] = useState([])
  const [workspace, setWorkspace] = useState({
    loading: Boolean(session && isFirebaseConfigured),
    schoolId: null,
    schoolName: 'Northstar Public School',
    role: 'Administrator',
    staffCount: 1,
    error: '',
  })

  useEffect(() => {
    if (!session || !isFirebaseConfigured) return
    let active = true

    async function load() {
      setWorkspace(current => ({ ...current, loading: true, error: '' }))
      try {
        const token = await session.getIdToken()
        let userData = await databaseRequest(`users/${session.uid}`, token)

        if (!userData) {
          const schoolId = `school_${session.uid}_${Date.now()}`
          const createdAt = Date.now()
          await databaseRequest(`schools/${schoolId}`, token, { method: 'PUT', body: {
            name: 'NXT OpenERP School',
            academicYear: '2026-27',
            createdBy: session.uid,
            createdAt,
          } })
          await databaseRequest('', token, { method: 'PATCH', body: {
            [`schoolMembers/${schoolId}/${session.uid}`]: {
              userId: session.uid,
              role: 'owner',
              status: 'active',
              createdAt,
            },
            [`users/${session.uid}`]: {
              schoolId,
              fullName: session.displayName || session.email.split('@')[0],
              role: 'owner',
              createdAt,
            },
          } })
          userData = {
            schoolId,
            fullName: session.displayName || session.email.split('@')[0],
            role: 'owner',
          }
        }

        const schoolId = userData.schoolId
        const [school, studentData, noticeData, feeData, attendanceData] = await Promise.all([
          databaseRequest(`schools/${schoolId}`, token),
          databaseRequest(`students/${schoolId}`, token),
          databaseRequest(`notices/${schoolId}`, token),
          databaseRequest(`fees/${schoolId}`, token),
          databaseRequest(`attendance/${schoolId}`, token),
        ])
        if (!active) return
        const studentRows = Object.entries(studentData || {})
          .map(([id, row]) => ({ id, ...row }))
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        const noticeRows = Object.entries(noticeData || {})
          .map(([id, row]) => ({ id, ...row }))
          .sort((a, b) => (b.publishAt || 0) - (a.publishAt || 0))
        const attendanceByDate = Object.values(attendanceData || {}).reduce((dates, record) => {
          dates[record.date] ||= {}
          dates[record.date][record.studentId] = record.status
          return dates
        }, {})
        const nextFees = feeData || {}
        const nextActivities = [
          ...studentRows.map(row => ({ id: `student-${row.id}`, title: 'Student admitted', detail: `${row.full_name} joined Class ${row.class_name}-${row.section}`, at: row.createdAt || 0, icon: '+' })),
          ...Object.entries(nextFees).map(([id, row]) => ({ id: `fee-${id}`, title: 'Fee payment received', detail: `${money(row.amount)} via ${row.method || 'payment'}`, at: row.paidAt || row.updatedAt || 0, icon: '₹' })),
          ...noticeRows.map(row => ({ id: `notice-${row.id}`, title: 'Notice published', detail: row.title, at: row.publishAt || 0, icon: 'N' })),
          ...Object.entries(attendanceData || {}).map(([id, row]) => ({ id: `attendance-${id}`, title: 'Attendance updated', detail: `${row.date} attendance marked`, at: row.updatedAt || 0, icon: '✓' })),
        ].filter(item => item.at).sort((a, b) => b.at - a.at)
        setStudents(studentRows.map(studentFromRow))
        setNotices(noticeRows.map(noticeFromRow))
        setFees(nextFees)
        setAttendance(attendanceByDate)
        setTimetableData(school?.timetable || defaultTimetable)
        setEnquiries(Object.entries(school?.enquiries || {}).map(([id, item]) => ({ id, ...item })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)))
        setStaff(school?.staff || {})
        setStaffAttendance(school?.staffAttendance || {})
        setApprovals({ fees: school?.approvals?.fees || {}, leaves: school?.approvals?.leaves || {} })
        setExpenses(school?.expenses || {})
        setActivities(nextActivities)
        setWorkspace({
          loading: false,
          schoolId,
          schoolName: school?.name || 'NXT OpenERP School',
          staffCount: school?.staffCount || 1,
          role: userData.role === 'owner' ? 'Owner' : userData.role === 'admin' ? 'Administrator' : 'Staff',
          error: '',
        })
      } catch (error) {
        if (active) setWorkspace(current => ({ ...current, loading: false, error: error.message }))
      }
    }

    load()
    return () => { active = false }
  }, [session, setAttendance, setEnquiries, setFees, setNotices, setStudents, setTimetableData])

  const addStudent = async student => {
    if (developmentDemo) {
      const createdAt = Date.now()
      setStudents(current => [{ ...student, id: createdAt, createdAt, attendance: 100, fee: 'Pending', initials: student.name.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase(), tone: tones[current.length % tones.length] }, ...current])
      setActivities(current => [{ id: `student-${createdAt}`, title: 'Student admitted', detail: `${student.name} joined Class ${student.className}`, at: createdAt, icon: '+' }, ...current])
      return
    }
    const [className, section = 'A'] = student.className.split('-')
    const studentId = `student_${Date.now()}`
    const row = {
      full_name: student.name,
      admission_number: student.roll,
      class_name: className,
      section,
      guardian_name: student.guardian,
      guardian_phone: student.phone,
      admission_scheme: student.admissionScheme || 'General',
      admission_date: student.admissionDate || today(),
      admission_type: student.newAdmission === false ? 'Existing' : 'New',
      father_name: student.fatherName || student.guardian,
      mother_name: student.motherName || '',
      gender: student.gender || '',
      date_of_birth: student.dob || '',
      email: student.email || '',
      state: student.state || '',
      city: student.city || '',
      address: student.address || '',
      pincode: student.pincode || '',
      aadhaar: student.aadhaar || '',
      pen_id: student.penId || '',
      apaar_id: student.apaarId || '',
      fee_group: student.feeGroup || 'Standard',
      sms_enabled: student.smsEnabled !== false,
      active: true,
      attendance_rate: 100,
      fee_status: 'Pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    const token = await session.getIdToken()
    await databaseRequest(`students/${workspace.schoolId}/${studentId}`, token, { method: 'PUT', body: row })
    setStudents(current => [studentFromRow({ id: studentId, ...row }, current.length), ...current])
    setActivities(current => [{ id: `student-${studentId}`, title: 'Student admitted', detail: `${student.name} joined Class ${student.className}`, at: row.createdAt, icon: '+' }, ...current])
  }

  const recordPayment = async (studentId, amount = 18500, method = 'UPI') => {
    const paidAt = Date.now()
    const invoiceId = `${studentId}_2026-06`
    const invoiceNumber = `INV-202606-${String(paidAt).slice(-6)}`
    const row = { studentId, billingMonth: '2026-06', invoiceNumber, amount, method, status: 'paid', paidAt, updatedAt: paidAt }
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest('', token, { method: 'PATCH', body: {
        [`fees/${workspace.schoolId}/${invoiceId}`]: row,
        [`students/${workspace.schoolId}/${studentId}/fee_status`]: 'Paid',
        [`students/${workspace.schoolId}/${studentId}/updatedAt`]: paidAt,
      } })
    }
    setFees(current => ({ ...current, [invoiceId]: row }))
    setStudents(current => current.map(student => student.id === studentId ? { ...student, fee: 'Paid' } : student))
    setActivities(current => [{ id: `fee-${invoiceId}`, title: 'Fee payment received', detail: `${money(amount)} via ${method}`, at: paidAt, icon: '₹' }, ...current])
  }

  const addNotice = async notice => {
    if (developmentDemo) {
      const publishAt = Date.now()
      setNotices(current => [{ ...notice, id: publishAt, publishAt }, ...current])
      setActivities(current => [{ id: `notice-${publishAt}`, title: 'Notice published', detail: notice.title, at: publishAt, icon: 'N' }, ...current])
      return
    }
    const noticeId = `notice_${Date.now()}`
    const row = {
      title: notice.title,
      body: notice.detail,
      category: notice.type,
      priority: notice.priority,
      audience: notice.audience === 'Students only' ? 'students' : notice.audience === 'Staff only' ? 'staff' : 'Entire school',
      publishAt: Date.now(),
      createdBy: session.uid,
    }
    const token = await session.getIdToken()
    await databaseRequest(`notices/${workspace.schoolId}/${noticeId}`, token, { method: 'PUT', body: row })
    setNotices(current => [{ ...notice, id: noticeId, publishAt: row.publishAt }, ...current])
    setActivities(current => [{ id: `notice-${noticeId}`, title: 'Notice published', detail: notice.title, at: row.publishAt, icon: 'N' }, ...current])
  }

  const saveAttendance = async (marks, date = today()) => {
    const changes = {}
    Object.entries(marks).forEach(([studentId, status]) => {
      changes[`attendance/${workspace.schoolId}/${date}_${studentId}`] = {
        studentId,
        date,
        status,
        markedBy: session?.uid || 'demo',
        updatedAt: Date.now(),
      }
    })
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest('', token, { method: 'PATCH', body: changes })
    }
    setAttendance(current => ({ ...current, [date]: { ...(current[date] || {}), ...marks } }))
    setActivities(current => [{ id: `attendance-${date}-${Date.now()}`, title: 'Attendance updated', detail: `${Object.keys(marks).length} records saved for ${readableDate(date)}`, at: Date.now(), icon: '✓' }, ...current])
  }

  const savePeriod = async (className, period) => {
    const id = `${period.day}_${period.time}`.replace(/[:\s]/g, '-')
    const next = {
      ...timetableData,
      [className]: [...(timetableData[className] || []).filter(item => !(item.day === period.day && item.time === period.time)), { ...period, id }],
    }
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/timetable`, token, { method: 'PUT', body: next })
    }
    setTimetableData(next)
    setActivities(current => [{ id: `period-${id}-${Date.now()}`, title: 'Timetable updated', detail: `${period.subject} added to ${className}`, at: Date.now(), icon: 'T' }, ...current])
  }

  const saveEnquiry = async enquiry => {
    const id = `enquiry_${Date.now()}`
    const row = { ...enquiry, createdAt: Date.now(), createdDate: today() }
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/enquiries/${id}`, token, { method: 'PUT', body: row })
    }
    setEnquiries(current => [{ id, ...row }, ...current])
    setActivities(current => [{ id, title: 'Admission enquiry added', detail: `${enquiry.name} enquired for ${enquiry.className}`, at: row.createdAt, icon: 'E' }, ...current])
  }

  return { students, notices, fees, attendance, timetableData, enquiries, staff, staffAttendance, approvals, expenses, activities, workspace, addStudent, recordPayment, addNotice, saveAttendance, savePeriod, saveEnquiry, developmentDemo }
}

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(isFirebaseConfigured)

  useEffect(() => {
    if (!isFirebaseConfigured) return
    return onAuthStateChanged(auth, user => {
      setSession(user)
      setAuthLoading(false)
    })
  }, [])

  const data = useSchoolWorkspace(session)

  if (!isFirebaseConfigured && import.meta.env.VITE_APP_ENV === 'production') {
    return <main className="setup-error"><ShieldCheck size={30} /><h1>Secure setup required</h1><p>Firebase environment variables are missing. Configure the deployment before launch.</p></main>
  }
  if (authLoading) return <main className="app-loading"><span className="loader" /><p>Securing your workspace...</p></main>
  if (isFirebaseConfigured && !session) return <AuthScreen />

  if (data.workspace.loading) return <main className="app-loading"><span className="loader" /><p>Loading school data...</p></main>
  if (data.workspace.error) return <main className="setup-error"><ShieldCheck size={30} /><h1>Workspace unavailable</h1><p>{data.workspace.error}</p><button className="secondary-button" onClick={() => signOut(auth)}>Sign out</button></main>

  const userName = session?.displayName || session?.email?.split('@')[0] || 'Demo Admin'
  const profile = {
    name: userName,
    role: data.workspace.role,
    initials: userName.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase(),
  }
  const current = nav.find(item => item.id === page) || nav[0]
  const screens = {
    dashboard: <Dashboard students={data.students} notices={data.notices} fees={data.fees} attendance={data.attendance} activities={data.activities} staff={data.staff} staffAttendance={data.staffAttendance} approvals={data.approvals} expenses={data.expenses} setPage={setPage} />,
    admissions: <Admissions students={data.students} enquiries={data.enquiries} onAddStudent={data.addStudent} onSaveEnquiry={data.saveEnquiry} />,
    students: <Students students={data.students} onAddStudent={data.addStudent} />,
    attendance: <Attendance students={data.students} attendance={data.attendance} onSaveAttendance={data.saveAttendance} />,
    fees: <Fees students={data.students} fees={data.fees} onRecordPayment={data.recordPayment} />,
    academics: <Academics timetableData={data.timetableData} onSavePeriod={data.savePeriod} />,
    notices: <Notices notices={data.notices} onAddNotice={data.addNotice} />,
  }
  return <div className="app-shell"><Sidebar page={page} setPage={setPage} open={menuOpen} close={() => setMenuOpen(false)} schoolName={data.workspace.schoolName} cloudMode={!data.developmentDemo} /><main className="main-area"><Header title={current.label} subtitle={`${data.workspace.schoolName} · 2026-27`} onMenu={() => setMenuOpen(true)} profile={profile} onSignOut={() => isFirebaseConfigured && signOut(auth)} /><div className="page-content page-enter" key={page}>{screens[page]}</div></main></div>
}

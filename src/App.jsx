import React, { useEffect, useState } from 'react'
import {
  Bell, BookOpen, CalendarCheck, Check, ChevronRight, IndianRupee,
  GraduationCap, LayoutDashboard, LogOut, Menu, MessageSquareText,
  MoreHorizontal, Plus, Search, Settings, ShieldCheck, Sparkles, Users, X
} from 'lucide-react'
import './app.css'
import AuthScreen from './AuthScreen'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import {
  get, push, ref, set, update
} from 'firebase/database'
import { auth, db, isFirebaseConfigured } from './lib/firebase'

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

const nav = [
  { id: 'dashboard', label: 'Command Center', icon: LayoutDashboard },
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

function Dashboard({ students, notices, setPage }) {
  const paid = students.filter(s => s.fee === 'Paid').length
  return (
    <>
      <div className="welcome-row">
        <div><span className="eyebrow">Saturday, 13 June</span><h2>Good afternoon, Ayush</h2><p>Here is what is happening across your school today.</p></div>
        <button className="primary-button" onClick={() => setPage('students')}><Plus size={17} /> Add student</button>
      </div>
      <section className="stat-grid">
        <Stat label="Total students" value={students.length + 1242} note="+28 this session" icon={Users} color="blue" trend />
        <Stat label="Present today" value="92.4%" note="1,154 of 1,248" icon={CalendarCheck} color="green" trend />
        <Stat label="Fee collected" value={`₹${(42.8 + paid * .08).toFixed(1)}L`} note="78% of monthly target" icon={IndianRupee} color="orange" />
        <Stat label="Teaching staff" value="84" note="6 on leave today" icon={GraduationCap} color="violet" />
      </section>
      <section className="dashboard-grid">
        <div className="panel attendance-panel">
          <div className="panel-header"><div><h3>Attendance overview</h3><p>Student attendance over the last 7 days</p></div><select><option>This week</option><option>Last week</option></select></div>
          <div className="chart-wrap">
            <div className="chart-y"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div>
            <div className="bar-chart">
              {[88, 92, 86, 95, 91, 78].map((height, i) => <div className="bar-column" key={i}><div className="bar-track"><div className="bar-fill" style={{ height: `${height}%` }} /></div><span>{['Mon','Tue','Wed','Thu','Fri','Sat'][i]}</span></div>)}
            </div>
          </div>
          <div className="chart-summary"><span><i className="dot green" />Present <strong>1,154</strong></span><span><i className="dot red" />Absent <strong>62</strong></span><span><i className="dot amber" />On leave <strong>32</strong></span></div>
        </div>
        <div className="panel collection-panel">
          <div className="panel-header"><div><h3>Fee collection</h3><p>June 2026</p></div><button className="text-button" onClick={() => setPage('fees')}>View details</button></div>
          <div className="donut-row">
            <div className="donut"><div><strong>78%</strong><span>Collected</span></div></div>
            <div className="fee-legend">
              <span><i className="dot blue" /><small>Collected</small><strong>₹42.8L</strong></span>
              <span><i className="dot gray" /><small>Pending</small><strong>₹12.1L</strong></span>
            </div>
          </div>
          <div className="target"><div><span>Monthly target</span><strong>₹54.9L</strong></div><div className="progress"><i style={{ width: '78%' }} /></div></div>
        </div>
        <div className="panel activity-panel">
          <div className="panel-header"><div><h3>Recent activity</h3><p>Latest updates from your team</p></div><MoreHorizontal size={18} /></div>
          <div className="activity-list">
            {[
              ['Fee payment received', '₹18,500 from Aarav Sharma', '8 min', '₹'],
              ['Attendance submitted', 'Class 10-A by Neha Ma’am', '24 min', '✓'],
              ['New admission created', 'Ishaan Mehta joined Class 4-B', '1 hr', '+'],
              ['Report cards published', 'Term I results for Class 8', '2 hr', 'R'],
            ].map((a, i) => <div className="activity" key={a[0]}><span className={`activity-icon a${i}`}>{a[3]}</span><div><strong>{a[0]}</strong><p>{a[1]}</p></div><time>{a[2]}</time></div>)}
          </div>
        </div>
        <div className="panel notice-panel">
          <div className="panel-header"><div><h3>Upcoming & notices</h3><p>What needs your attention</p></div><button className="text-button" onClick={() => setPage('notices')}>View all</button></div>
          <div className="notice-list">
            {notices.slice(0, 3).map(n => <div className="notice-item" key={n.id}><div className="date-box"><strong>{n.date.split(' ')[0]}</strong><span>{n.date.split(' ')[1]}</span></div><div><strong>{n.title}</strong><p>{n.detail}</p></div>{n.priority === 'High' && <span className="priority">Important</span>}</div>)}
          </div>
        </div>
      </section>
    </>
  )
}

function StudentModal({ close, addStudent }) {
  const [form, setForm] = useState({ name: '', className: '1-A', guardian: '', phone: '' })
  const submit = e => {
    e.preventDefault()
    const parts = form.name.trim().split(/\s+/)
    addStudent({ ...form, initials: parts.map(p => p[0]).slice(0, 2).join('').toUpperCase(), attendance: 100, fee: 'Pending' })
    close()
  }
  return <div className="modal-backdrop"><form className="modal" onSubmit={submit}>
    <div className="modal-header"><div><h3>Add new student</h3><p>Create a student profile and admission record.</p></div><button type="button" className="icon-button" onClick={close}><X size={19} /></button></div>
    <div className="form-grid">
      <label className="full">Student name<input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Full name" /></label>
      <label>Class & section<select value={form.className} onChange={e => setForm({...form, className: e.target.value})}>{['1-A','2-A','3-A','4-B','5-A','6-A','7-B','8-B','9-C','10-A'].map(c => <option key={c}>{c}</option>)}</select></label>
      <label>Guardian name<input required value={form.guardian} onChange={e => setForm({...form, guardian: e.target.value})} placeholder="Parent / guardian" /></label>
      <label className="full">Phone number<input required value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="10-digit mobile number" /></label>
    </div>
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={close}>Cancel</button><button className="primary-button"><Plus size={16} /> Add student</button></div>
  </form></div>
}

function Students({ students, onAddStudent }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All classes')
  const [modal, setModal] = useState(false)
  const filtered = students.filter(s => (filter === 'All classes' || s.className.startsWith(filter)) && `${s.name} ${s.roll} ${s.phone}`.toLowerCase().includes(search.toLowerCase()))
  const addStudent = student => onAddStudent({ ...student, roll: `2026-${String(students.length + 41).padStart(3, '0')}` })
  return <>
    <div className="section-actions"><div><h2>Student directory</h2><p>Manage profiles, guardians, attendance and fee status.</p></div><button className="primary-button" onClick={() => setModal(true)}><Plus size={17} /> Add student</button></div>
    <div className="mini-stats"><div><span>All students</span><strong>{students.length + 1242}</strong></div><div><span>New admissions</span><strong>28</strong></div><div><span>Avg. attendance</span><strong>91.2%</strong></div><div><span>Fee defaulters</span><strong>{students.filter(s => s.fee !== 'Paid').length + 43}</strong></div></div>
    <div className="panel table-panel">
      <div className="table-toolbar"><div className="table-search"><Search size={16} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student, roll no. or phone" /></div><select value={filter} onChange={e => setFilter(e.target.value)}><option>All classes</option>{['5','6','7','8','9','10'].map(c => <option key={c}>{c}</option>)}</select></div>
      <div className="table-scroll"><table><thead><tr><th>Student</th><th>Class</th><th>Guardian</th><th>Attendance</th><th>Fee status</th><th /></tr></thead><tbody>
        {filtered.map(s => <tr key={s.id}><td><div className="student-cell"><span className={`avatar tone-${s.tone}`}>{s.initials}</span><div><strong>{s.name}</strong><small>{s.roll}</small></div></div></td><td><span className="class-pill">{s.className}</span></td><td><strong className="regular">{s.guardian}</strong><small className="cell-sub">{s.phone}</small></td><td><div className="attendance-cell"><span>{s.attendance}%</span><div><i style={{width: `${s.attendance}%`}} /></div></div></td><td><span className={`status ${s.fee.toLowerCase()}`}>{s.fee}</span></td><td><button className="icon-button"><MoreHorizontal size={18} /></button></td></tr>)}
      </tbody></table></div>
    </div>
    {modal && <StudentModal close={() => setModal(false)} addStudent={addStudent} />}
  </>
}

function Attendance({ students, onSaveAttendance }) {
  const [marks, setMarks] = useStoredState('northstar-attendance', {})
  const [saved, setSaved] = useState(false)
  const present = students.filter(s => marks[s.id] === 'P').length
  const absent = students.filter(s => marks[s.id] === 'A').length
  const updateAll = status => setMarks(Object.fromEntries(students.map(s => [s.id, status])))
  return <>
    <div className="section-actions"><div><h2>Daily attendance</h2><p>Saturday, 13 June 2026 · All classes</p></div><button className="primary-button" onClick={async () => { await onSaveAttendance(marks); setSaved(true); setTimeout(() => setSaved(false), 1800) }}>{saved ? <Check size={17} /> : <CalendarCheck size={17} />}{saved ? 'Attendance saved' : 'Save attendance'}</button></div>
    <div className="attendance-summary"><div><strong>{students.length}</strong><span>Students</span></div><div className="present"><strong>{present}</strong><span>Present</span></div><div className="absent"><strong>{absent}</strong><span>Absent</span></div><div><strong>{Math.round(present / students.length * 100)}%</strong><span>Attendance rate</span></div></div>
    <div className="panel table-panel">
      <div className="table-toolbar"><div><strong>Class 10-A</strong><small>{students.length} students</small></div><div className="toolbar-actions"><button className="secondary-button" onClick={() => updateAll('P')}>Mark all present</button><button className="secondary-button" onClick={() => updateAll('A')}>Mark all absent</button></div></div>
      <div className="attendance-list">{students.map(s => <div className="attendance-row" key={s.id}><div className="student-cell"><span className={`avatar tone-${s.tone}`}>{s.initials}</span><div><strong>{s.name}</strong><small>{s.roll} · {s.className}</small></div></div><div className="mark-control">{['P','A','L'].map(mark => <button key={mark} className={marks[s.id] === mark ? `selected ${mark}` : ''} onClick={() => setMarks({...marks, [s.id]: mark})}>{mark === 'P' ? 'Present' : mark === 'A' ? 'Absent' : 'Leave'}</button>)}</div></div>)}</div>
    </div>
  </>
}

function Fees({ students, onMarkPaid }) {
  const total = students.length * 18500
  const collected = students.filter(s => s.fee === 'Paid').length * 18500
  return <>
    <div className="section-actions"><div><h2>Fee management</h2><p>Track collections, pending dues and receipts.</p></div><button className="primary-button"><Plus size={17} /> Record payment</button></div>
    <section className="stat-grid fee-stats"><Stat label="Total billed" value={`₹${total.toLocaleString('en-IN')}`} note="June 2026" icon={IndianRupee} color="blue" /><Stat label="Collected" value={`₹${collected.toLocaleString('en-IN')}`} note={`${Math.round(collected/total*100)}% collection rate`} icon={Check} color="green" trend /><Stat label="Pending" value={`₹${(total-collected).toLocaleString('en-IN')}`} note={`${students.filter(s => s.fee !== 'Paid').length} student accounts`} icon={Bell} color="orange" /></section>
    <div className="panel table-panel"><div className="table-toolbar"><div><strong>Student fee ledger</strong><small>Monthly tuition fee · June</small></div><div className="table-search"><Search size={16} /><input placeholder="Search ledger" /></div></div><div className="table-scroll"><table><thead><tr><th>Student</th><th>Invoice</th><th>Amount</th><th>Due date</th><th>Status</th><th>Action</th></tr></thead><tbody>
      {students.map(s => <tr key={s.id}><td><div className="student-cell"><span className={`avatar tone-${s.tone}`}>{s.initials}</span><div><strong>{s.name}</strong><small>{s.className}</small></div></div></td><td>INV-{s.roll.slice(-3)}-06</td><td><strong>₹18,500</strong></td><td>10 Jun 2026</td><td><span className={`status ${s.fee.toLowerCase()}`}>{s.fee}</span></td><td>{s.fee !== 'Paid' ? <button className="text-button" onClick={() => onMarkPaid(s.id)}>Mark paid</button> : <button className="text-button muted">Receipt</button>}</td></tr>)}
    </tbody></table></div></div>
  </>
}

function Academics() {
  return <>
    <div className="section-actions"><div><h2>Academic planner</h2><p>Class timetable and teaching schedule for this week.</p></div><button className="primary-button"><Plus size={17} /> Add period</button></div>
    <div className="academic-banner"><div><span className="eyebrow">Current term</span><h3>Term I · 2026-27</h3><p>72 instructional days · 4 assessments planned</p></div><div className="term-progress"><span>Term progress <strong>38%</strong></span><div className="progress"><i style={{width:'38%'}} /></div></div></div>
    <div className="panel timetable-panel"><div className="panel-header"><div><h3>Weekly timetable</h3><p>Class 10-A · Room 204</p></div><select><option>Class 10-A</option><option>Class 9-C</option></select></div><div className="table-scroll"><table className="timetable"><thead><tr><th>Time</th>{['Monday','Tuesday','Wednesday','Thursday','Friday'].map(d => <th key={d}>{d}</th>)}</tr></thead><tbody>{timetable.map(row => <tr key={row[0]}><td><strong>{row[0]}</strong></td>{row.slice(1).map((subject, i) => <td key={i}><span className={`subject s${i}`}>{subject}</span><small>{['NK','RS','AM','PK','SJ'][i]} · R{204+i}</small></td>)}</tr>)}</tbody></table></div></div>
  </>
}

function Notices({ notices, onAddNotice }) {
  const [title, setTitle] = useState('')
  const add = async e => { e.preventDefault(); if (!title.trim()) return; await onAddNotice({ title, detail:'New school announcement', date:'13 Jun', type:'Notice', priority:'Normal' }); setTitle('') }
  return <>
    <div className="section-actions"><div><h2>Notices & communication</h2><p>Publish announcements for students, parents and staff.</p></div></div>
    <div className="notice-layout">
      <form className="panel compose-panel" onSubmit={add}><div className="panel-header"><div><h3>Create announcement</h3><p>Share an update with your school community.</p></div></div><label>Announcement title<input value={title} onChange={e => setTitle(e.target.value)} placeholder="What would you like to announce?" /></label><label>Audience<select><option>Entire school</option><option>Students only</option><option>Staff only</option></select></label><label>Message<textarea placeholder="Write the announcement details..." /></label><button className="primary-button"><MessageSquareText size={16} /> Publish notice</button></form>
      <div className="panel notice-feed"><div className="panel-header"><div><h3>Published notices</h3><p>{notices.length} active announcements</p></div></div>{notices.map(n => <article key={n.id}><div className="notice-meta"><span className="class-pill">{n.type}</span><time>{n.date}</time></div><h4>{n.title}</h4><p>{n.detail}</p><div className="notice-footer"><span>Entire school</span><button className="icon-button"><MoreHorizontal size={17} /></button></div></article>)}</div>
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
  }
}

function useSchoolWorkspace(session) {
  const developmentDemo = !isFirebaseConfigured && import.meta.env.VITE_APP_ENV !== 'production'
  const [students, setStudents] = useStoredState('northstar-students', seedStudents)
  const [notices, setNotices] = useStoredState('northstar-notices', seedNotices)
  const [workspace, setWorkspace] = useState({
    loading: Boolean(session && isFirebaseConfigured),
    schoolId: null,
    schoolName: 'Northstar Public School',
    role: 'Administrator',
    error: '',
  })

  useEffect(() => {
    if (!session || !isFirebaseConfigured) return
    let active = true

    async function load() {
      setWorkspace(current => ({ ...current, loading: true, error: '' }))
      try {
        const userRef = ref(db, `users/${session.uid}`)
        let userSnapshot = await get(userRef)

        if (!userSnapshot.exists()) {
          const schoolRef = push(ref(db, 'schools'))
          const schoolId = schoolRef.key
          const createdAt = Date.now()
          await set(schoolRef, {
            name: 'NXT OpenERP School',
            academicYear: '2026-27',
            createdBy: session.uid,
            createdAt,
          })
          await update(ref(db), {
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
          })
          userSnapshot = { val: () => ({
            schoolId,
            fullName: session.displayName || session.email.split('@')[0],
            role: 'owner',
          }) }
        }

        const userData = userSnapshot.val()
        const schoolId = userData.schoolId
        const [schoolSnapshot, studentsSnapshot, noticesSnapshot] = await Promise.all([
          get(ref(db, `schools/${schoolId}`)),
          get(ref(db, `students/${schoolId}`)),
          get(ref(db, `notices/${schoolId}`)),
        ])
        if (!active) return
        const studentRows = Object.entries(studentsSnapshot.val() || {})
          .map(([id, row]) => ({ id, ...row }))
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        const noticeRows = Object.entries(noticesSnapshot.val() || {})
          .map(([id, row]) => ({ id, ...row }))
          .sort((a, b) => (b.publishAt || 0) - (a.publishAt || 0))
        setStudents(studentRows.map(studentFromRow))
        setNotices(noticeRows.map(noticeFromRow))
        setWorkspace({
          loading: false,
          schoolId,
          schoolName: schoolSnapshot.val()?.name || 'NXT OpenERP School',
          role: userData.role === 'owner' ? 'Owner' : userData.role === 'admin' ? 'Administrator' : 'Staff',
          error: '',
        })
      } catch (error) {
        if (active) setWorkspace(current => ({ ...current, loading: false, error: error.message }))
      }
    }

    load()
    return () => { active = false }
  }, [session, setNotices, setStudents])

  const addStudent = async student => {
    if (developmentDemo) {
      setStudents(current => [{ ...student, id: Date.now(), attendance: 100, fee: 'Pending', initials: student.name.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase(), tone: tones[current.length % tones.length] }, ...current])
      return
    }
    const [className, section = 'A'] = student.className.split('-')
    const studentRef = push(ref(db, `students/${workspace.schoolId}`))
    const row = {
      full_name: student.name,
      admission_number: student.roll,
      class_name: className,
      section,
      guardian_name: student.guardian,
      guardian_phone: student.phone,
      attendance_rate: 100,
      fee_status: 'Pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await set(studentRef, row)
    setStudents(current => [studentFromRow({ id: studentRef.key, ...row }, current.length), ...current])
  }

  const markPaid = async studentId => {
    if (!developmentDemo) {
      await update(ref(db), {
        [`fees/${workspace.schoolId}/${studentId}_2026-06`]: {
        studentId,
        billingMonth: '2026-06',
        amount: 18500,
        status: 'paid',
        paidAt: Date.now(),
        updatedAt: Date.now(),
        },
        [`students/${workspace.schoolId}/${studentId}/fee_status`]: 'Paid',
        [`students/${workspace.schoolId}/${studentId}/updatedAt`]: Date.now(),
      })
    }
    setStudents(current => current.map(student => student.id === studentId ? { ...student, fee: 'Paid' } : student))
  }

  const addNotice = async notice => {
    if (developmentDemo) {
      setNotices(current => [{ ...notice, id: Date.now() }, ...current])
      return
    }
    const noticeRef = push(ref(db, `notices/${workspace.schoolId}`))
    const row = {
      title: notice.title,
      body: notice.detail,
      category: notice.type,
      priority: notice.priority,
      audience: 'all',
      publishAt: Date.now(),
      createdBy: session.uid,
    }
    await set(noticeRef, row)
    setNotices(current => [{ ...notice, id: noticeRef.key }, ...current])
  }

  const saveAttendance = async marks => {
    if (developmentDemo) return
    const date = new Date().toISOString().slice(0, 10)
    const changes = {}
    students.forEach(student => {
      changes[`attendance/${workspace.schoolId}/${date}_${student.id}`] = {
        studentId: student.id,
        date,
        status: marks[student.id] || 'P',
        markedBy: session.uid,
        updatedAt: Date.now(),
      }
    })
    await update(ref(db), changes)
  }

  return { students, notices, workspace, addStudent, markPaid, addNotice, saveAttendance, developmentDemo }
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
    dashboard: <Dashboard students={data.students} notices={data.notices} setPage={setPage} />,
    students: <Students students={data.students} onAddStudent={data.addStudent} />,
    attendance: <Attendance students={data.students} onSaveAttendance={data.saveAttendance} />,
    fees: <Fees students={data.students} onMarkPaid={data.markPaid} />,
    academics: <Academics />,
    notices: <Notices notices={data.notices} onAddNotice={data.addNotice} />,
  }
  return <div className="app-shell"><Sidebar page={page} setPage={setPage} open={menuOpen} close={() => setMenuOpen(false)} schoolName={data.workspace.schoolName} cloudMode={!data.developmentDemo} /><main className="main-area"><Header title={current.label} subtitle={`${data.workspace.schoolName} · 2026-27`} onMenu={() => setMenuOpen(true)} profile={profile} onSignOut={() => isFirebaseConfigured && signOut(auth)} /><div className="page-content">{screens[page]}</div></main></div>
}

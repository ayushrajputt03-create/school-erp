import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpen, CalendarCheck, ChevronRight, ClipboardList, FileText, GraduationCap,
  Home, LayoutDashboard, LoaderCircle, LogOut, Menu, MessageSquareText, Pencil,
  Search, User, X, Eye, EyeOff, Mail, Check, Clock3, Users, Bell, Save, Camera
} from 'lucide-react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'
import { auth } from './lib/firebase'
import DatePicker from './DatePicker'
import './teacher-app.css'

const databaseUrl = import.meta.env.VITE_FIREBASE_DATABASE_URL?.replace(/\/$/, '')

async function dbRequest(path, token, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  const url = `${databaseUrl}/${path}.json?auth=${token}`
  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: options.body ? { 'Content-Type': 'application/json' } : {},
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!response.ok) throw new Error(`Firebase ${response.status}`)
    const data = await response.json()
    return data
  } catch (error) {
    clearTimeout(timeout)
    throw error
  }
}

const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10) }
const longDate = v => v ? new Date(`${v}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'
const shortDate = v => v ? new Date(`${v}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
const classParts = v => { const m = String(v || '').match(/^(.+?)\s*[-/]\s*([A-Za-z0-9]+)$/); return m ? { className: m[1].trim(), section: m[2].trim() } : { className: String(v || '').trim(), section: '' } }

function TeacherLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const submit = async e => {
    e.preventDefault()
    setError(''); setMessage(''); setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
    } catch (err) {
      const messages = {
        'auth/user-not-found': 'No teacher account found with this email.',
        'auth/wrong-password': 'Incorrect password. Try again.',
        'auth/invalid-credential': 'Invalid email or password.',
        'auth/too-many-requests': 'Too many attempts. Try again later.',
      }
      setError(messages[err?.code] || err?.message?.replace('Firebase: ', '') || 'Login failed.')
    } finally { setLoading(false) }
  }

  const forgot = async () => {
    if (!email.trim()) { setError('Enter your email first.'); return }
    try {
      await sendPasswordResetEmail(auth, email.trim())
      setMessage('Password reset link sent to your email.')
    } catch (err) { setError(err?.message?.replace('Firebase: ', '') || 'Reset failed.') }
  }

  return <main className="teacher-login-page">
    <div className="teacher-login-card">
      <div className="teacher-login-header">
        <div className="teacher-login-icon"><GraduationCap size={28} /></div>
        <h1>Teacher Login</h1>
        <p>Sign in to your teacher account</p>
      </div>
      <form onSubmit={submit}>
        <label>Email<input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="teacher@school.com" autoComplete="email" /></label>
        <label>Password
          <span className="teacher-pw-field">
            <input required type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" autoComplete="current-password" />
            <button type="button" onClick={() => setShowPw(p => !p)}>{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
          </span>
        </label>
        <button type="button" className="teacher-forgot" onClick={forgot}>Forgot Password?</button>
        {error && <div className="teacher-alert error">{error}</div>}
        {message && <div className="teacher-alert success">{message}</div>}
        <button className="teacher-submit" disabled={loading}>
          {loading && <LoaderCircle className="spin" size={16} />} Sign In
        </button>
      </form>
      <a href="/" className="teacher-back">Back to Home</a>
    </div>
  </main>
}

function TeacherDashboard({ teacher, schoolProfile, students, attendance, homework, notices, token, schoolId, onLogout, onNavigate }) {
  const myStudents = useMemo(() => {
    if (!students || !teacher.classes?.length) return []
    return Object.values(students).filter(s => {
      const { className } = classParts(s.class_name || s.className || s.class || '')
      return teacher.classes.includes(className) && (!teacher.sections?.length || teacher.sections.includes(s.section || 'A'))
    })
  }, [students, teacher])

  const todayStr = today()
  const todayAttendance = attendance?.[todayStr]
  const attendanceMarked = !!todayAttendance

  const myHomework = useMemo(() => {
    return Object.values(homework || {}).filter(h => h.postedBy === teacher.uid || h.teacherId === teacher.uid).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  }, [homework, teacher])

  const recentNotices = useMemo(() => {
    return Object.values(notices || {}).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 5)
  }, [notices])

  const hwThisWeek = myHomework.filter(h => {
    const diff = (Date.now() - (h.createdAt || 0)) / 86400000
    return diff <= 7
  }).length

  return <div className="teacher-page">
    <h2>Dashboard</h2>
    <p className="teacher-subtitle">Welcome back, {teacher.name || teacher.firstName || 'Teacher'}</p>

    <div className="teacher-stats">
      <div className="teacher-stat"><Users size={20} /><div><strong>{myStudents.length}</strong><span>My Students</span></div></div>
      <div className="teacher-stat"><CalendarCheck size={20} /><div><strong>{attendanceMarked ? 'Done' : 'Pending'}</strong><span>Today's Attendance</span></div></div>
      <div className="teacher-stat"><BookOpen size={20} /><div><strong>{hwThisWeek}</strong><span>HW This Week</span></div></div>
      <div className="teacher-stat"><ClipboardList size={20} /><div><strong>{teacher.classes?.length || 0}</strong><span>My Classes</span></div></div>
    </div>

    {!attendanceMarked && <div className="teacher-action-card" onClick={() => onNavigate('attendance')}>
      <CalendarCheck size={22} />
      <div><strong>Mark Today's Attendance</strong><span>Attendance not marked yet for {longDate(todayStr)}</span></div>
      <ChevronRight size={18} />
    </div>}

    {recentNotices.length > 0 && <section className="teacher-section">
      <h3>Recent Notices</h3>
      <div className="teacher-notice-list">
        {recentNotices.map(n => <div key={n.id || n.createdAt} className="teacher-notice-item">
          <MessageSquareText size={16} />
          <div><strong>{n.title || 'Notice'}</strong><span>{shortDate(n.date || new Date(n.createdAt).toISOString().slice(0, 10))}</span></div>
        </div>)}
      </div>
    </section>}

    {myHomework.length > 0 && <section className="teacher-section">
      <h3>Recent Homework</h3>
      <div className="teacher-notice-list">
        {myHomework.slice(0, 5).map(h => <div key={h.id || h.createdAt} className="teacher-notice-item">
          <BookOpen size={16} />
          <div><strong>{h.title || 'Homework'}</strong><span>{h.className || ''} — Due: {shortDate(h.dueDate)}</span></div>
        </div>)}
      </div>
    </section>}
  </div>
}

function TeacherAttendance({ teacher, students, attendance, token, schoolId, onSaved }) {
  const [selectedClass, setSelectedClass] = useState('')
  const [date, setDate] = useState(today())
  const [marks, setMarks] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const assignedClasses = useMemo(() => {
    if (!teacher.classes?.length) return []
    const list = []
    for (const cls of teacher.classes) {
      const sections = teacher.sections?.length ? teacher.sections : ['A']
      for (const sec of sections) list.push(`${cls}-${sec}`)
    }
    return list
  }, [teacher])

  useEffect(() => { if (assignedClasses.length && !selectedClass) setSelectedClass(assignedClasses[0]) }, [assignedClasses])

  const classStudents = useMemo(() => {
    if (!selectedClass || !students) return []
    const { className, section } = classParts(selectedClass)
    return Object.entries(students).filter(([, s]) => {
      const sc = classParts(s.class_name || s.className || s.class || '')
      return sc.className === className && (s.section || 'A') === section
    }).map(([id, s]) => ({ id, name: s.full_name || s.name || s.fullName || '', roll: s.admission_number || s.admissionNo || s.roll || '' }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [students, selectedClass])

  useEffect(() => {
    if (!attendance?.[date]?.[selectedClass]) {
      const fresh = {}
      classStudents.forEach(s => { fresh[s.id] = 'P' })
      setMarks(fresh)
    } else {
      setMarks(attendance[date][selectedClass] || {})
    }
    setSaved(false)
  }, [date, selectedClass, classStudents])

  const isPast = date !== today()

  const save = async () => {
    if (isPast) return
    setSaving(true)
    try {
      const tok = await auth.currentUser.getIdToken()
      const payload = { ...marks, markedBy: teacher.uid, markedAt: Date.now(), className: selectedClass }
      await dbRequest(`schools/${schoolId}/attendance/${date}/${selectedClass}`, tok, { method: 'PUT', body: payload })
      setSaved(true)
      if (onSaved) onSaved(date, selectedClass, payload)
    } catch (err) {
      alert('Error saving attendance: ' + err.message)
    } finally { setSaving(false) }
  }

  const markAll = status => {
    const updated = { ...marks }
    classStudents.forEach(s => { updated[s.id] = status })
    setMarks(updated)
  }

  const presentCount = classStudents.filter(s => marks[s.id] === 'P').length
  const absentCount = classStudents.filter(s => marks[s.id] === 'A').length

  return <div className="teacher-page">
    <h2>Mark Attendance</h2>
    <p className="teacher-subtitle">Mark daily attendance for your classes</p>

    <div className="teacher-toolbar">
      <label>Class<select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
        {assignedClasses.map(c => <option key={c}>{c}</option>)}
      </select></label>
      <label>Date<DatePicker value={date} onChange={setDate} max={today()} /></label>
      {!isPast && <button className="teacher-btn secondary" onClick={() => markAll('P')}>All Present</button>}
      {!isPast && <button className="teacher-btn primary" onClick={save} disabled={saving || !classStudents.length}>
        {saving ? 'Saving...' : 'Save Attendance'}
      </button>}
    </div>

    {isPast && <div className="teacher-info-banner"><Clock3 size={14} /> Viewing past attendance (read only)</div>}
    {saved && <div className="teacher-success-banner"><Check size={14} /> Attendance saved for {selectedClass} on {shortDate(date)}</div>}

    <div className="teacher-att-summary">
      <span className="present">Present: {presentCount}</span>
      <span className="absent">Absent: {absentCount}</span>
      <span>Total: {classStudents.length}</span>
    </div>

    <div className="teacher-att-list">
      {classStudents.map((s, i) => <div key={s.id} className="teacher-att-row">
        <span className="att-num">{i + 1}</span>
        <div className="att-info"><strong>{s.name}</strong><small>{s.roll}</small></div>
        <div className="att-buttons">
          {['P', 'A', 'L'].map(code => <button key={code} className={`att-mark ${marks[s.id] === code ? `active ${code}` : ''}`}
            onClick={() => !isPast && setMarks(m => ({ ...m, [s.id]: code }))} disabled={isPast}>{code === 'P' ? 'Present' : code === 'A' ? 'Absent' : 'Leave'}</button>)}
        </div>
      </div>)}
      {!classStudents.length && <div className="teacher-empty">No students found in {selectedClass}</div>}
    </div>
  </div>
}

function TeacherClasses({ teacher, students }) {
  const classData = useMemo(() => {
    if (!teacher.classes?.length || !students) return []
    const sections = teacher.sections?.length ? teacher.sections : ['A']
    return teacher.classes.flatMap(cls =>
      sections.map(sec => {
        const count = Object.values(students).filter(s => {
          const { className } = classParts(s.class_name || s.className || s.class || '')
          return className === cls && (s.section || 'A') === sec
        }).length
        return { className: cls, section: sec, count, subject: teacher.subject || '' }
      })
    )
  }, [teacher, students])

  return <div className="teacher-page">
    <h2>My Classes</h2>
    <p className="teacher-subtitle">Classes assigned to you</p>
    <div className="teacher-class-grid">
      {classData.map(c => <div key={`${c.className}-${c.section}`} className="teacher-class-card">
        <div className="class-card-header"><GraduationCap size={20} /><strong>Class {c.className} - {c.section}</strong></div>
        <div className="class-card-body">
          <span><Users size={14} /> {c.count} Students</span>
          {c.subject && <span><BookOpen size={14} /> {c.subject}</span>}
        </div>
      </div>)}
      {!classData.length && <div className="teacher-empty">No classes assigned yet. Contact your admin.</div>}
    </div>
  </div>
}

function TeacherHomework({ teacher, homework, students, token, schoolId }) {
  const [form, setForm] = useState({ title: '', description: '', className: '', dueDate: '', priority: 'Normal' })
  const [posting, setPosting] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const assignedClasses = useMemo(() => {
    if (!teacher.classes?.length) return []
    const sections = teacher.sections?.length ? teacher.sections : ['A']
    return teacher.classes.flatMap(cls => sections.map(sec => `${cls}-${sec}`))
  }, [teacher])

  useEffect(() => { if (assignedClasses.length && !form.className) setForm(f => ({ ...f, className: assignedClasses[0] })) }, [assignedClasses])

  const myHomework = useMemo(() => {
    return Object.entries(homework || {}).filter(([, h]) => h.postedBy === teacher.uid || h.teacherId === teacher.uid)
      .map(([id, h]) => ({ id, ...h })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  }, [homework, teacher])

  const post = async e => {
    e.preventDefault()
    if (!form.title.trim() || !form.className) return
    setPosting(true)
    try {
      const tok = await auth.currentUser.getIdToken()
      const id = `hw_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      const row = {
        id, title: form.title.trim(), description: form.description.trim(), className: form.className,
        subject: teacher.subject || '', dueDate: form.dueDate, priority: form.priority,
        postedBy: teacher.uid, teacherName: teacher.name || teacher.firstName || '',
        teacherId: teacher.uid, createdAt: Date.now(),
      }
      await dbRequest(`schools/${schoolId}/homework/${id}`, tok, { method: 'PUT', body: row })
      setForm({ title: '', description: '', className: assignedClasses[0] || '', dueDate: '', priority: 'Normal' })
      setShowForm(false)
      alert('Homework posted!')
    } catch (err) { alert('Error: ' + err.message) }
    finally { setPosting(false) }
  }

  const deleteHw = async id => {
    if (!confirm('Delete this homework?')) return
    try {
      const tok = await auth.currentUser.getIdToken()
      await dbRequest(`schools/${schoolId}/homework/${id}`, tok, { method: 'DELETE' })
    } catch (err) { alert('Error: ' + err.message) }
  }

  return <div className="teacher-page">
    <div className="teacher-page-header">
      <div><h2>Homework</h2><p className="teacher-subtitle">Post and manage homework for your classes</p></div>
      <button className="teacher-btn primary" onClick={() => setShowForm(s => !s)}>{showForm ? 'Cancel' : '+ Post Homework'}</button>
    </div>

    {showForm && <form className="teacher-hw-form" onSubmit={post}>
      <label>Class<select value={form.className} onChange={e => setForm({ ...form, className: e.target.value })}>
        {assignedClasses.map(c => <option key={c}>{c}</option>)}
      </select></label>
      <label>Subject<input readOnly value={teacher.subject || 'Not set'} className="readonly-input" /></label>
      <label>Title<input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Homework title" /></label>
      <label className="full">Description<textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Instructions..." rows={3} /></label>
      <label>Due Date<DatePicker value={form.dueDate} onChange={v => setForm({ ...form, dueDate: v })} /></label>
      <label>Priority<select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}><option>Normal</option><option>Important</option><option>Urgent</option></select></label>
      <div className="teacher-form-actions"><button className="teacher-btn primary" disabled={posting}>{posting ? 'Posting...' : 'Post Homework'}</button></div>
    </form>}

    <div className="teacher-hw-list">
      {myHomework.map(h => <div key={h.id} className="teacher-hw-card">
        <div className="hw-card-top">
          <strong>{h.title}</strong>
          <span className={`hw-priority ${h.priority?.toLowerCase()}`}>{h.priority || 'Normal'}</span>
        </div>
        <p>{h.description || 'No description'}</p>
        <div className="hw-card-meta">
          <span>{h.className}</span>
          <span>{h.subject}</span>
          <span>Due: {shortDate(h.dueDate)}</span>
          <button className="hw-delete" onClick={() => deleteHw(h.id)}>Delete</button>
        </div>
      </div>)}
      {!myHomework.length && <div className="teacher-empty">No homework posted yet.</div>}
    </div>
  </div>
}

function TeacherNotices({ notices }) {
  const sorted = useMemo(() => Object.values(notices || {}).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), [notices])
  return <div className="teacher-page">
    <h2>Notices</h2>
    <p className="teacher-subtitle">School notices and announcements</p>
    <div className="teacher-notice-full-list">
      {sorted.map(n => <div key={n.id || n.createdAt} className="teacher-notice-full">
        <div className="notice-full-header"><strong>{n.title || 'Notice'}</strong><span>{shortDate(n.date || new Date(n.createdAt || 0).toISOString().slice(0, 10))}</span></div>
        <p>{n.body || n.content || n.message || ''}</p>
        {n.priority && <span className={`hw-priority ${n.priority?.toLowerCase()}`}>{n.priority}</span>}
      </div>)}
      {!sorted.length && <div className="teacher-empty">No notices yet.</div>}
    </div>
  </div>
}

function TeacherProfile({ teacher, schoolProfile }) {
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' })
  const [changing, setChanging] = useState(false)
  const [pwMsg, setPwMsg] = useState('')

  const changePw = async e => {
    e.preventDefault()
    if (pwForm.newPw !== pwForm.confirm) { setPwMsg('Passwords do not match.'); return }
    if (pwForm.newPw.length < 8) { setPwMsg('Password must be at least 8 characters.'); return }
    setChanging(true); setPwMsg('')
    try {
      const user = auth.currentUser
      const credential = EmailAuthProvider.credential(user.email, pwForm.current)
      await reauthenticateWithCredential(user, credential)
      await updatePassword(user, pwForm.newPw)
      setPwMsg('Password changed successfully!')
      setPwForm({ current: '', newPw: '', confirm: '' })
    } catch (err) {
      setPwMsg(err?.message?.replace('Firebase: ', '') || 'Failed to change password.')
    } finally { setChanging(false) }
  }

  return <div className="teacher-page">
    <h2>My Profile</h2>
    <p className="teacher-subtitle">Your teacher profile information</p>

    <div className="teacher-profile-card">
      <div className="teacher-profile-avatar">
        {teacher.photoUrl ? <img src={teacher.photoUrl} alt="" /> :
          <span>{(teacher.name || teacher.firstName || 'T')[0].toUpperCase()}</span>}
      </div>
      <div className="teacher-profile-info">
        <h3>{teacher.name || `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim() || 'Teacher'}</h3>
        <p>{teacher.subject || 'Subject not set'} — {teacher.designation || 'Teacher'}</p>
      </div>
    </div>

    <div className="teacher-profile-grid">
      <div><span>Email</span><strong>{teacher.email || '-'}</strong></div>
      <div><span>Phone</span><strong>{teacher.phone || '-'}</strong></div>
      <div><span>Employee Code</span><strong>{teacher.employeeCode || '-'}</strong></div>
      <div><span>Department</span><strong>{teacher.department || '-'}</strong></div>
      <div><span>Classes</span><strong>{teacher.classes?.join(', ') || '-'}</strong></div>
      <div><span>Sections</span><strong>{teacher.sections?.join(', ') || '-'}</strong></div>
      <div><span>School</span><strong>{schoolProfile?.schoolName || '-'}</strong></div>
      <div><span>Joining Date</span><strong>{shortDate(teacher.joiningDate || teacher.joinDate)}</strong></div>
    </div>

    <section className="teacher-section">
      <h3>Change Password</h3>
      <form className="teacher-pw-change" onSubmit={changePw}>
        <label>Current Password<input required type="password" value={pwForm.current} onChange={e => setPwForm({ ...pwForm, current: e.target.value })} /></label>
        <label>New Password<input required type="password" minLength={8} value={pwForm.newPw} onChange={e => setPwForm({ ...pwForm, newPw: e.target.value })} /></label>
        <label>Confirm Password<input required type="password" value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} /></label>
        {pwMsg && <div className={`teacher-alert ${pwMsg.includes('success') ? 'success' : 'error'}`}>{pwMsg}</div>}
        <button className="teacher-btn primary" disabled={changing}>{changing ? 'Changing...' : 'Update Password'}</button>
      </form>
    </section>
  </div>
}

const teacherNav = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'attendance', label: 'My Attendance', icon: CalendarCheck },
  { id: 'classes', label: 'My Classes', icon: GraduationCap },
  { id: 'homework', label: 'Homework', icon: BookOpen },
  { id: 'notices', label: 'Notices', icon: MessageSquareText },
  { id: 'profile', label: 'My Profile', icon: User },
]

export default function TeacherApp() {
  const [authLoading, setAuthLoading] = useState(true)
  const [session, setSession] = useState(null)
  const [teacher, setTeacher] = useState(null)
  const [schoolId, setSchoolId] = useState(null)
  const [schoolProfile, setSchoolProfile] = useState(null)
  const [students, setStudents] = useState(null)
  const [attendance, setAttendance] = useState({})
  const [homework, setHomework] = useState({})
  const [notices, setNotices] = useState({})
  const [page, setPage] = useState('dashboard')
  const [loadError, setLoadError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      setSession(user)
      setAuthLoading(false)
    })
    return unsub
  }, [])

  useEffect(() => {
    if (!session) { setTeacher(null); setSchoolId(null); return }
    let active = true
    const load = async () => {
      try {
        const token = await session.getIdToken()
        const index = await dbRequest(`teachersIndex/${session.uid}`, token)
        if (!index || !index.schoolId) { setLoadError('No teacher account found. Contact your school admin.'); return }
        if (!active) return
        setSchoolId(index.schoolId)
        const [teacherData, profile, studentsData, hw, noticeData, attData] = await Promise.all([
          dbRequest(`schools/${index.schoolId}/teachers/${session.uid}`, token),
          dbRequest(`schools/${index.schoolId}/profile`, token),
          dbRequest(`schools/${index.schoolId}/students`, token),
          dbRequest(`schools/${index.schoolId}/homework`, token),
          dbRequest(`schools/${index.schoolId}/notices`, token),
          dbRequest(`schools/${index.schoolId}/attendance`, token),
        ])
        if (!active) return
        if (!teacherData) { setLoadError('Teacher profile not found in school data.'); return }
        setTeacher({ ...teacherData, uid: session.uid })
        setSchoolProfile(profile)
        setStudents(studentsData)
        setHomework(hw || {})
        setNotices(noticeData || {})
        setAttendance(attData || {})
      } catch (err) {
        if (active) setLoadError('Failed to load teacher data: ' + err.message)
      }
    }
    load()
    return () => { active = false }
  }, [session])

  const doLogout = async () => { await signOut(auth); window.location.href = '/' }

  if (window.location.pathname === '/teacher/login' || window.location.pathname === '/teacher/login/') {
    if (authLoading) return <div className="teacher-loading"><LoaderCircle className="spin" size={28} /> Loading...</div>
    if (!session) return <TeacherLogin />
    if (!teacher && !loadError) return <div className="teacher-loading"><LoaderCircle className="spin" size={28} /> Loading teacher data...</div>
    if (loadError) return <main className="teacher-login-page"><div className="teacher-login-card">
      <div className="teacher-login-header"><div className="teacher-login-icon"><GraduationCap size={28} /></div><h1>Access Error</h1><p>{loadError}</p></div>
      <button className="teacher-submit" onClick={doLogout}>Sign Out</button>
      <a href="/" className="teacher-back">Back to Home</a>
    </div></main>
  }

  if (!session || !teacher) {
    if (authLoading) return <div className="teacher-loading"><LoaderCircle className="spin" size={28} /> Loading...</div>
    if (!session) { window.location.href = '/teacher/login'; return null }
    if (!teacher && !loadError) return <div className="teacher-loading"><LoaderCircle className="spin" size={28} /> Loading teacher data...</div>
    if (loadError) return <main className="teacher-login-page"><div className="teacher-login-card">
      <div className="teacher-login-header"><div className="teacher-login-icon"><GraduationCap size={28} /></div><h1>Access Error</h1><p>{loadError}</p></div>
      <button className="teacher-submit" onClick={doLogout}>Sign Out</button>
    </div></main>
  }

  const teacherName = teacher.name || `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim() || 'Teacher'
  const teacherInitials = teacherName.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase()

  return <div className="teacher-shell">
    {sidebarOpen && <button className="teacher-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
    <aside className={`teacher-sidebar ${sidebarOpen ? 'open' : ''}`}>
      <div className="teacher-sidebar-brand">
        <div className="teacher-sidebar-logo"><GraduationCap size={20} /></div>
        <div><strong>{schoolProfile?.schoolName || 'School'}</strong><small>Teacher Panel</small></div>
        <button className="teacher-sidebar-close" onClick={() => setSidebarOpen(false)}><X size={18} /></button>
      </div>
      <nav>
        {teacherNav.map(item => <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => { setPage(item.id); setSidebarOpen(false) }}>
          <item.icon size={18} />{item.label}
        </button>)}
      </nav>
      <div className="teacher-sidebar-bottom">
        <button onClick={doLogout}><LogOut size={18} />Logout</button>
      </div>
    </aside>
    <main className="teacher-main">
      <header className="teacher-topbar">
        <button className="teacher-menu-btn" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
        <div className="teacher-topbar-title"><h1>{teacherNav.find(n => n.id === page)?.label || 'Dashboard'}</h1></div>
        <div className="teacher-topbar-profile">
          <div className="teacher-avatar">{teacher.photoUrl ? <img src={teacher.photoUrl} alt="" /> : <span>{teacherInitials}</span>}</div>
        </div>
      </header>
      <div className="teacher-content">
        {page === 'dashboard' && <TeacherDashboard teacher={teacher} schoolProfile={schoolProfile} students={students} attendance={attendance} homework={homework} notices={notices} token={null} schoolId={schoolId} onLogout={doLogout} onNavigate={setPage} />}
        {page === 'attendance' && <TeacherAttendance teacher={teacher} students={students} attendance={attendance} token={null} schoolId={schoolId} onSaved={(d, c, data) => setAttendance(a => ({ ...a, [d]: { ...(a[d] || {}), [c]: data } }))} />}
        {page === 'classes' && <TeacherClasses teacher={teacher} students={students} />}
        {page === 'homework' && <TeacherHomework teacher={teacher} homework={homework} students={students} token={null} schoolId={schoolId} />}
        {page === 'notices' && <TeacherNotices notices={notices} />}
        {page === 'profile' && <TeacherProfile teacher={teacher} schoolProfile={schoolProfile} />}
      </div>
    </main>
  </div>
}

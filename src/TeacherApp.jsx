import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpen, CalendarCheck, ChevronRight, ClipboardList, FileText, GraduationCap,
  Home, LayoutDashboard, LoaderCircle, LogOut, Menu, MessageSquareText, Pencil,
  Search, User, X, Eye, EyeOff, Check, Clock3, Users, Bell, Save, Camera, Umbrella
} from 'lucide-react'
import { onAuthStateChanged, signInWithCustomToken, signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'
import { ref, onValue, query, orderByChild, startAt, equalTo } from 'firebase/database'
import { auth, rtdb } from './lib/firebase'
import DatePicker from './DatePicker'
import './teacher-app.css'

const databaseUrl = import.meta.env.VITE_FIREBASE_DATABASE_URL?.replace(/\/$/, '')

async function dbRequest(path, token, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  const url = `${databaseUrl}/${path}.json?auth=${encodeURIComponent(token)}${options.query ? `&${options.query}` : ''}`
  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: options.body ? { 'Content-Type': 'application/json' } : {},
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!response.ok) throw new Error(`${path}: Firebase ${response.status}`)
    const data = await response.json()
    return data
  } catch (error) {
    clearTimeout(timeout)
    throw error
  }
}

async function loadTeacherSessionFromApi(token) {
  const response = await fetch('/api/teacher-session', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || `Teacher API ${response.status}`)
  return data
}

const splitCsv = value => Array.isArray(value) ? value.filter(Boolean) : String(value || '').split(',').map(s => s.trim()).filter(Boolean)
// Normalise a raw employee record (from the unified staff collection) into the shape the
// staff dashboard expects — CSV class lists become arrays, department drives the view.
function buildStaffProfile(id, e) {
  return {
    ...e,
    uid: id,
    name: e.name || `${e.firstName || ''} ${e.lastName || ''}`.trim() || 'Staff',
    department: e.department || 'Staff',
    designation: e.designation || e.employeeRole || '',
    classes: splitCsv(e.assignedClasses || e.classes),
    sections: splitCsv(e.assignedSections || e.sections),
  }
}

function parseAttendanceToTeacherFormat(raw, studentsData) {
  const result = {}
  Object.entries(raw || {}).forEach(([key, record]) => {
    if (record && typeof record === 'object' && (record.studentId || record.student_id) && record.date) {
      const studentId = record.studentId || record.student_id
      const date = record.date
      const status = record.mark || record.status || 'P'
      const cls = record.class || ''
      const sec = record.section || 'A'
      const className = cls ? `${cls}-${sec}` : ''
      if (!className || !studentId) return
      result[date] = result[date] || {}
      result[date][className] = result[date][className] || {}
      result[date][className][studentId] = status
    } else if (record && typeof record === 'object' && !record.studentId && !record.student_id) {
      Object.entries(record).forEach(([cls, classData]) => {
        if (typeof classData !== 'object') return
        result[key] = result[key] || {}
        result[key][cls] = result[key][cls] || {}
        Object.entries(classData).forEach(([sid, val]) => {
          if (typeof val === 'string' && sid !== 'markedBy' && sid !== 'className') result[key][cls][sid] = val
        })
      })
    }
  })
  return result
}

async function loadTeacherSession(token, uid) {
  try {
    const index = await dbRequest(`teachersIndex/${uid}`, token)
    if (!index || !index.schoolId) throw new Error('No staff account found. Contact your school admin.')
    // Only pull the current month's attendance — the full history can be tens of thousands of
    // records. Requires "attendance": { ".indexOn": ["date"] } in the database rules.
    const md = new Date()
    const monthStart = `${md.getFullYear()}-${String(md.getMonth() + 1).padStart(2, '0')}-01`
    const attQuery = `orderBy=${encodeURIComponent('"date"')}&startAt=${encodeURIComponent(`"${monthStart}"`)}`
    const [staffData, teacherData, profile, studentsData, hw, noticeData, attData] = await Promise.all([
      dbRequest(`schools/${index.schoolId}/staff/${uid}`, token).catch(() => null),
      dbRequest(`schools/${index.schoolId}/teachers/${uid}`, token).catch(() => null),
      dbRequest(`schools/${index.schoolId}/profile`, token),
      dbRequest(`schools/${index.schoolId}/students`, token),
      dbRequest(`schools/${index.schoolId}/homework`, token),
      dbRequest(`schools/${index.schoolId}/notices`, token),
      dbRequest(`schools/${index.schoolId}/attendance`, token, { query: attQuery }),
    ])
    const record = staffData || teacherData
    if (!record) throw new Error('Staff profile not found in school data.')
    return {
      schoolId: index.schoolId,
      teacher: buildStaffProfile(uid, record),
      profile,
      students: studentsData || {},
      homework: hw || {},
      notices: noticeData || {},
      attendance: parseAttendanceToTeacherFormat(attData, studentsData),
    }
  } catch (error) {
    if (/Firebase 401|Firebase 403|teachersIndex|schools\//i.test(error.message || '')) {
      return loadTeacherSessionFromApi(token)
    }
    throw error
  }
}

const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10) }
const longDate = v => v ? new Date(`${v}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'
const shortDate = v => v ? new Date(`${v}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
// Safe YYYY-MM-DD from a timestamp — never throws on missing/invalid values (some
// records have no createdAt, which previously crashed the dashboard with RangeError).
const dayFrom = ts => { const d = new Date(Number(ts) || 0); return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10) }
const classParts = v => { const m = String(v || '').match(/^(.+?)\s*[-/]\s*([A-Za-z0-9]+)$/); return m ? { className: m[1].trim(), section: m[2].trim() } : { className: String(v || '').trim(), section: '' } }

const CLASS_ORDER = ['Playway', 'Nursery', 'PG', 'Prep', 'LKG', 'UKG', 'KG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
const classRank = name => { const i = CLASS_ORDER.indexOf(String(name || '').trim()); return i < 0 ? 500 : i }
// Guard against corrupt student records (some rows carry binary garbage in class_name):
// only accept short, printable class names so the dropdown never fills with junk.
const isValidClassName = name => /^[A-Za-z0-9][A-Za-z0-9 .+/-]{0,11}$/.test(String(name || '').trim())
const isValidSection = sec => sec === '' || /^[A-Za-z0-9]{1,4}$/.test(String(sec || '').trim())
// Class-section options a staff member can work with. Uses explicit assignment when the admin
// set it; otherwise falls back to every class-section that actually has students in the school,
// so the panel still works when no classes were assigned (the empty-dropdown bug).
function classSectionOptions(teacher, students) {
  const all = new Set()
  Object.values(students || {}).forEach(s => {
    const { className, section } = classParts(s.class_name || s.className || s.class || '')
    if (className && isValidClassName(className) && isValidSection(section)) all.add(`${className}-${section || 'A'}`)
  })
  let list = [...all]
  if (teacher?.classes?.length) {
    const allowed = new Set(teacher.classes.map(c => String(c).trim()))
    const filtered = list.filter(cs => allowed.has(classParts(cs).className))
    list = filtered.length ? filtered : teacher.classes.flatMap(cls => ['A', 'B', 'C', 'D'].map(sec => `${cls}-${sec}`))
    if (teacher.sections?.length) {
      const secs = new Set(teacher.sections.map(x => String(x).trim()))
      const secFiltered = list.filter(cs => secs.has(classParts(cs).section))
      if (secFiltered.length) list = secFiltered
    }
  }
  return list.sort((a, b) => classRank(classParts(a).className) - classRank(classParts(b).className) || classParts(a).section.localeCompare(classParts(b).section))
}

function TeacherLogin() {
  const [schoolCode, setSchoolCode] = useState('')
  const [mobile, setMobile] = useState('')
  const [dob, setDob] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async e => {
    e.preventDefault()
    setError(''); setLoading(true)
    const code = schoolCode.trim()
    const phone = mobile.replace(/\D/g, '')
    if (!code) { setError('Enter your school code.'); setLoading(false); return }
    if (phone.length < 10) { setError('Enter a valid 10-digit mobile number.'); setLoading(false); return }
    if (!dob.trim()) { setError('Enter your date of birth.'); setLoading(false); return }
    try {
      const response = await fetch('/api/teacher-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolCode: code, phone, password: dob.trim() }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.token) throw new Error(data.error || 'Login failed.')
      await signInWithCustomToken(auth, data.token)
    } catch (err) {
      setError(err?.message?.replace('Firebase: ', '') || 'Login failed.')
    } finally { setLoading(false) }
  }

  return <main className="teacher-login-page">
    <div className="teacher-login-card">
      <div className="teacher-login-header">
        <div className="teacher-login-icon"><GraduationCap size={28} /></div>
        <h1>Staff Login</h1>
        <p>All staff — teacher, accountant, office &amp; more. Sign in with school code, mobile &amp; date of birth</p>
      </div>
      <form onSubmit={submit}>
        <label>School Code<input required value={schoolCode} onChange={e => setSchoolCode(e.target.value.toUpperCase())} placeholder="e.g. NORPUB637" autoComplete="off" style={{textTransform:'uppercase'}} /></label>
        <label>Mobile Number (Username)<input required type="tel" name="teacher-mobile" value={mobile} onChange={e => setMobile(e.target.value.replace(/\D/g, ''))} placeholder="9876543210" autoComplete="off" inputMode="numeric" maxLength={10} /></label>
        <label>Date of Birth (Password)
          <input required value={dob} onChange={e => setDob(e.target.value)} placeholder="DD/MM/YYYY" inputMode="numeric" autoComplete="off" />
        </label>
        {error && <div className="teacher-alert error">{error}</div>}
        <button className="teacher-submit" disabled={loading}>
          {loading && <LoaderCircle className="spin" size={16} />} Sign In
        </button>
      </form>
      <p style={{textAlign:'center',fontSize:'.82rem',color:'#7DA0CA',marginTop:12}}>Password = your date of birth, any format works (15/03/1995 or 15031995)</p>
      <a href="/" className="teacher-back">Back to Home</a>
    </div>
  </main>
}

function TeacherDashboard({ teacher, schoolProfile, students, attendance, homework, notices, token, schoolId, onLogout, onNavigate }) {
  const myClassSet = useMemo(() => new Set(classSectionOptions(teacher, students)), [teacher, students])
  const myStudents = useMemo(() => {
    if (!students) return []
    return Object.values(students).filter(s => {
      const p = classParts(s.class_name || s.className || s.class || '')
      return myClassSet.has(`${p.className}-${p.section || 'A'}`)
    })
  }, [students, myClassSet])

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
      <div className="teacher-stat"><ClipboardList size={20} /><div><strong>{myClassSet.size}</strong><span>My Classes</span></div></div>
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
          <div><strong>{n.title || 'Notice'}</strong><span>{shortDate(n.date || dayFrom(n.createdAt))}</span></div>
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

  const assignedClasses = useMemo(() => classSectionOptions(teacher, students), [teacher, students])

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
      const { className, section } = classParts(selectedClass)
      const now = Date.now()
      const changes = {}
      Object.entries(marks).forEach(([studentId, status]) => {
        const id = `${date}_${studentId}`
        changes[`schools/${schoolId}/attendance/${id}`] = {
          id, studentId, student_id: studentId,
          class: className, section: section || 'A',
          date, status, mark: status,
          statusText: status === 'P' ? 'Present' : status === 'A' ? 'Absent' : status === 'L' ? 'Leave' : status,
          markedBy: teacher.uid, marked_by: teacher.uid,
          created_at: now, updated_at: now, updatedAt: now,
        }
      })
      await dbRequest('', tok, { method: 'PATCH', body: changes })
      setSaved(true)
      if (onSaved) onSaved(date, selectedClass, marks)
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
    return classSectionOptions(teacher, students).map(cs => {
      const { className, section } = classParts(cs)
      const count = Object.values(students || {}).filter(s => {
        const p = classParts(s.class_name || s.className || s.class || '')
        return p.className === className && (s.section || 'A') === (section || 'A')
      }).length
      return { className, section: section || 'A', count, subject: teacher.subject || '' }
    })
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

  const assignedClasses = useMemo(() => classSectionOptions(teacher, students), [teacher, students])

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
        <div className="notice-full-header"><strong>{n.title || 'Notice'}</strong><span>{shortDate(n.date || dayFrom(n.createdAt))}</span></div>
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

// Read-only by design. Teachers see why a student is marked "Leave" instead of "Absent" without
// having to ask the admin, but cannot decide anything - there are no action buttons here, and the
// database rules do not grant teachers write access to leaveRequests either.
function TeacherLeaveRequests({ leaveRequests, classSections }) {
  const [status, setStatus] = useState('all')
  const rows = useMemo(() => Object.values(leaveRequests || {})
    .flatMap(byClass => Object.entries(byClass || {}).map(([id, row]) => ({ ...row, id })))
    .sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0)), [leaveRequests])
  const counts = useMemo(() => rows.reduce((all, row) => ({ ...all, [row.status]: (all[row.status] || 0) + 1 }), {}), [rows])
  const filtered = status === 'all' ? rows : rows.filter(row => row.status === status)
  const showTabs = rows.length > 10
  const dayText = value => {
    if (!value) return '-'
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
  }
  const range = row => (row.fromDate === row.toDate ? dayText(row.fromDate) : `${dayText(row.fromDate)} - ${dayText(row.toDate)}`)

  return <div className="teacher-page">
    <h2>Leave Requests</h2>
    <p className="teacher-subtitle">Leave applied by parents for your classes{classSections.length ? ` (${classSections.join(', ')})` : ''} · view only</p>
    {showTabs && <div className="teacher-leave-tabs">
      {[['all', 'All'], ['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']].map(([id, label]) => (
        <button key={id} className={status === id ? 'active' : ''} onClick={() => setStatus(id)}>
          {label}{id !== 'all' && counts[id] ? ` (${counts[id]})` : ''}
        </button>
      ))}
    </div>}
    <div className="teacher-leave-list">
      {filtered.map(row => <div key={row.id} className="teacher-leave-card">
        <div className="teacher-leave-head">
          <div><strong>{row.studentName || 'Student'}</strong><small>{row.classSection}{row.admissionNo ? ` · Adm ${row.admissionNo}` : ''}</small></div>
          <span className={`teacher-leave-status ${row.status || 'pending'}`}>{row.status || 'pending'}</span>
        </div>
        <div className="teacher-leave-dates"><Umbrella size={13} /> {range(row)}</div>
        <p>{row.reason || '-'}</p>
        {row.reviewedByName && <small className="teacher-leave-review">
          {row.status === 'rejected' ? 'Rejected' : 'Approved'} by {row.reviewedByName}{row.reviewNote ? ` — ${row.reviewNote}` : ''}
        </small>}
      </div>)}
      {!filtered.length && <div className="teacher-empty">No {status === 'all' ? '' : status} leave requests yet.</div>}
    </div>
  </div>
}

const teacherNav = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'attendance', label: 'My Attendance', icon: CalendarCheck },
  { id: 'classes', label: 'My Classes', icon: GraduationCap },
  { id: 'homework', label: 'Homework', icon: BookOpen },
  { id: 'leave-requests', label: 'Leave Requests', icon: Umbrella },
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
  // Keyed by classSection, since each assigned class has its own scoped listener.
  const [leaveRequests, setLeaveRequests] = useState({})
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
        const bundle = await loadTeacherSession(token, session.uid)
        if (!active) return
        setSchoolId(bundle.schoolId)
        setTeacher(bundle.teacher)
        setSchoolProfile(bundle.profile)
        setStudents(bundle.students || {})
        setHomework(bundle.homework || {})
        setNotices(bundle.notices || {})
        setAttendance(bundle.attendance || {})
      } catch (err) {
        if (active) setLoadError('Failed to load teacher data: ' + err.message)
      }
    }
    load()
    return () => { active = false }
  }, [session])

  // Real-time sync via scoped RTDB listeners. Firebase pushes only changed data over a
  // persistent connection, replacing the old 20s poll that re-downloaded the entire school
  // (students + homework + notices + full attendance history) every tick — a major bandwidth
  // cost fix. It also makes teacher-marked attendance appear in the admin panel and student
  // profile instantly, since both sides now read the same schools/{id}/attendance node live
  // instead of waiting for the next poll cycle.
  //
  // The attendance listener is safe to run on the attendance page: the marking UI keeps its
  // in-progress marks in its own local state (seeded only when date/class/students change),
  // so a live push never clobbers marks the teacher is entering.
  useEffect(() => {
    if (!session || !schoolId || !rtdb) return undefined
    let active = true
    const unsubs = []
    const sub = (path, handler) => {
      const node = ref(rtdb, `schools/${schoolId}/${path}`)
      const unsubscribe = onValue(node, snap => { if (active) handler(snap.val()) }, () => { /* permission/transient errors: keep initial snapshot */ })
      unsubs.push(unsubscribe)
    }
    sub('profile', val => { if (val) setSchoolProfile(val) })
    sub('students', val => setStudents(val || {}))
    sub('homework', val => setHomework(val || {}))
    sub('notices', val => setNotices(val || {}))
    sub(`staff/${session.uid}`, val => { if (val) setTeacher(buildStaffProfile(session.uid, val)) })
    // Attendance listener is bounded to the current month so the live subscription never streams
    // the whole year's history. Requires "attendance": { ".indexOn": ["date"] } in the rules.
    const md = new Date()
    const monthStart = `${md.getFullYear()}-${String(md.getMonth() + 1).padStart(2, '0')}-01`
    const attQuery = query(ref(rtdb, `schools/${schoolId}/attendance`), orderByChild('date'), startAt(monthStart))
    unsubs.push(onValue(attQuery, snap => { if (active) setAttendance(parseAttendanceToTeacherFormat(snap.val())) }, () => {}))
    return () => { active = false; unsubs.forEach(fn => fn()) }
  }, [session, schoolId])

  // Leave requests, scoped to this teacher's own classes. RTDB allows one equalTo per query, so
  // each assigned class gets its own listener and the results are merged by class. A teacher
  // therefore never receives a request belonging to a class they do not teach.
  const myClassSections = useMemo(() => classSectionOptions(teacher, students), [teacher, students])
  // `students` gets a new object identity on every push, so depend on the resolved class list as
  // a stable string - otherwise these listeners would tear down and resubscribe constantly.
  const myClassSectionsKey = myClassSections.join(',')
  useEffect(() => {
    if (!session || !schoolId || !rtdb || !myClassSectionsKey) { setLeaveRequests({}); return undefined }
    let active = true
    const unsubs = []
    myClassSectionsKey.split(',').forEach(classSection => {
      const scoped = query(ref(rtdb, `schools/${schoolId}/leaveRequests`), orderByChild('classSection'), equalTo(classSection))
      unsubs.push(onValue(scoped, snap => {
        if (!active) return
        setLeaveRequests(current => ({ ...current, [classSection]: snap.val() || {} }))
      }, () => { /* permission/transient errors: keep whatever we already have */ }))
    })
    return () => { active = false; unsubs.forEach(fn => fn()) }
  }, [session, schoolId, myClassSectionsKey])

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

  const teacherName = teacher.name || `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim() || 'Staff'
  const teacherInitials = teacherName.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase()
  const isTeacher = String(teacher.department || '').toLowerCase() === 'teacher'
  // Role-based sidebar: teachers get classes/attendance/homework; other staff see a
  // lean dashboard + notices + profile (broader per-department modules can be added later).
  const visibleNav = isTeacher ? teacherNav : teacherNav.filter(n => ['dashboard', 'notices', 'profile'].includes(n.id))

  return <div className="teacher-shell">
    {sidebarOpen && <button className="teacher-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
    <aside className={`teacher-sidebar ${sidebarOpen ? 'open' : ''}`}>
      <div className="teacher-sidebar-brand">
        <div className="teacher-sidebar-logo"><GraduationCap size={20} /></div>
        <div><strong>{schoolProfile?.schoolName || 'School'}</strong><small>{teacher.department || 'Staff'} Panel</small></div>
        <button className="teacher-sidebar-close" onClick={() => setSidebarOpen(false)}><X size={18} /></button>
      </div>
      <nav>
        {visibleNav.map(item => <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => { setPage(item.id); setSidebarOpen(false) }}>
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
        <div className="teacher-topbar-title"><h1>{visibleNav.find(n => n.id === page)?.label || 'Dashboard'}</h1></div>
        <div className="teacher-topbar-profile">
          <div className="teacher-avatar">{teacher.photoUrl ? <img src={teacher.photoUrl} alt="" /> : <span>{teacherInitials}</span>}</div>
        </div>
      </header>
      <div className="teacher-content">
        {page === 'dashboard' && <TeacherDashboard teacher={teacher} schoolProfile={schoolProfile} students={students} attendance={attendance} homework={homework} notices={notices} token={null} schoolId={schoolId} onLogout={doLogout} onNavigate={setPage} />}
        {page === 'attendance' && <TeacherAttendance teacher={teacher} students={students} attendance={attendance} token={null} schoolId={schoolId} onSaved={(d, c, data) => setAttendance(a => ({ ...a, [d]: { ...(a[d] || {}), [c]: data } }))} />}
        {page === 'classes' && <TeacherClasses teacher={teacher} students={students} />}
        {page === 'homework' && <TeacherHomework teacher={teacher} homework={homework} students={students} token={null} schoolId={schoolId} />}
        {page === 'leave-requests' && <TeacherLeaveRequests leaveRequests={leaveRequests} classSections={myClassSections} />}
        {page === 'notices' && <TeacherNotices notices={notices} />}
        {page === 'profile' && <TeacherProfile teacher={teacher} schoolProfile={schoolProfile} />}
      </div>
    </main>
  </div>
}

import React, { useEffect, useMemo, useState } from 'react'
import {
  Bell, BookOpen, BusFront, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight,
  Download, Eye, EyeOff, FileText, GraduationCap, Home, LogOut, Mail, Menu,
  MessageSquareText, Phone, Printer, RefreshCw, Save, ShieldCheck, UserRound,
  Umbrella, WalletCards, XCircle,
} from 'lucide-react'
import './ParentPortal.css'

const tabs = [
  ['dashboard', 'Home', Home],
  ['attendance', 'Attendance', CalendarDays],
  ['fees', 'Fees', WalletCards],
  ['marks', 'Marks', GraduationCap],
  ['notices', 'Notices', MessageSquareText],
  ['homework', 'Homework', BookOpen],
  ['transport', 'Transport', BusFront],
  ['timetable', 'Timetable', CalendarDays],
  ['certificates', 'Certificates', FileText],
  ['leave', 'Leave', Umbrella],
  ['contact', 'Contact', Phone],
  ['profile', 'Profile', UserRound],
]
const monthNames = ['April','May','June','July','August','September','October','November','December','January','February','March']
const hindi = {
  dashboard: 'होम', attendance: 'उपस्थिति', fees: 'शुल्क विवरण', marks: 'अंक',
  notices: 'सूचनाएं', homework: 'गृहकार्य', transport: 'ट्रांसपोर्ट', timetable: 'समय सारणी',
  certificates: 'प्रमाणपत्र', contact: 'संपर्क', profile: 'प्रोफाइल',
}
const digits = value => String(value || '').replace(/\D/g, '')
const dateKey = value => {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}/.test(String(value))) return String(value).slice(0, 10)
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}
const longDate = value => value ? new Date(`${dateKey(value)}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '-'
const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0))
const statusOf = value => {
  const raw = String(value || '').toLowerCase()
  if (raw === 'a' || raw === 'absent') return 'absent'
  if (raw === 'l' || raw === 'leave') return 'leave'
  return 'present'
}
const api = async body => {
  const response = await fetch('/api/parent-portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload.ok === false) throw new Error(payload.error || 'Request failed')
  return payload
}
const initials = value => String(value || 'S').split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()

function Login({ onLogin, mode, setMode }) {
  const [form, setForm] = useState({ schoolCode: '', phone: '', password: '' })
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const update = (key, value) => setForm(current => ({ ...current, [key]: key === 'schoolCode' ? value.toUpperCase() : value }))
  const submit = async event => {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      if (digits(form.phone).length !== 10) throw new Error('Phone number must be 10 digits.')
      if (mode === 'forgot') {
        const result = await api({ action: 'forgot', schoolCode: form.schoolCode, phone: form.phone })
        setMessage(result.message || "Password reset to child's date of birth.")
        setMode('login')
      } else {
        const result = await api({ action: 'login', schoolCode: form.schoolCode, phone: form.phone, password: form.password })
        onLogin(result)
      }
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }
  return <main className="parent-login-shell">
    <form className="parent-login-card" onSubmit={submit}>
      <div className="parent-login-brand"><img src="/nxt-logo-transparent.png" alt="" /><div><strong>NXT School ERP</strong><span>Parent Portal</span></div></div>
      <h1>{mode === 'forgot' ? 'Reset Password' : 'Parent Login'}</h1>
      <p>Use your school code, registered phone and child's DOB password.</p>
      <label>School Code<input required minLength={6} value={form.schoolCode} onChange={event => update('schoolCode', event.target.value)} placeholder="Enter school code (e.g., ABC123)" /></label>
      <label>Phone Number<div className="parent-phone-input"><span>+91</span><input required type="tel" value={form.phone} onChange={event => update('phone', digits(event.target.value).slice(0, 10))} placeholder="Enter registered phone number" /></div></label>
      {mode !== 'forgot' && <label>Password<div className="parent-password-input"><input required type={show ? 'text' : 'password'} value={form.password} onChange={event => update('password', event.target.value)} placeholder="Enter child's date of birth" /><button type="button" onClick={() => setShow(current => !current)}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button></div><small>Default password is DOB, e.g. 15032008</small></label>}
      {message && <div className={`parent-alert ${message.includes('reset') ? 'ok' : 'error'}`}>{message}</div>}
      <button className="parent-primary" disabled={loading}>{loading ? 'Please wait...' : mode === 'forgot' ? 'Reset Password' : 'Login'}</button>
      <button type="button" className="parent-link" onClick={() => { setMessage(''); setMode(mode === 'forgot' ? 'login' : 'forgot') }}>{mode === 'forgot' ? 'Back to login' : 'Forgot Password?'}</button>
      <small className="parent-help">Contact your school for login details.</small>
    </form>
  </main>
}

function SetPassword({ session, onDone }) {
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [show, setShow] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async event => {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      if (form.password !== form.confirm) throw new Error('Passwords do not match.')
      await api({ action: 'setPassword', ...session, password: form.password })
      onDone()
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }
  return <main className="parent-login-shell">
    <form className="parent-login-card" onSubmit={submit}>
      <div className="parent-lock"><ShieldCheck size={34} /></div>
      <h1>Set Your Password</h1>
      <p>For security, change your default DOB password.</p>
      <label>New Password<div className="parent-password-input"><input required type={show ? 'text' : 'password'} value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} placeholder="Min 8 chars, 1 capital, 1 number" /><button type="button" onClick={() => setShow(current => !current)}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
      <label>Confirm Password<input required type="password" value={form.confirm} onChange={event => setForm({ ...form, confirm: event.target.value })} /></label>
      {message && <div className="parent-alert error">{message}</div>}
      <button className="parent-primary" disabled={loading}>{loading ? 'Saving...' : 'Save & Continue'}</button>
    </form>
  </main>
}

function StudentPhoto({ student, large = false }) {
  return student?.photoURL ? <img className={`parent-student-photo ${large ? 'large' : ''}`} src={student.photoURL} alt="" /> : <span className={`parent-student-photo fallback ${large ? 'large' : ''}`}>{initials(student?.name)}</span>
}

function Topbar({ data, selectedStudentId, setSelectedStudentId, refresh, logout, online }) {
  const unread = (data.notifications || []).filter(item => !item.isRead).length
  return <header className="parent-topbar">
    <div className="parent-school-id">{data.school.logoURL ? <img src={data.school.logoURL} alt="" /> : <span>{initials(data.school.schoolName)}</span>}<div><strong>{data.school.schoolName}</strong><small><i className={online ? 'live' : 'offline'} /> {online ? 'Live connected' : 'Offline'} | Code {data.school.schoolCode}</small></div></div>
    {(data.students || []).length > 1 && <select value={selectedStudentId} onChange={event => setSelectedStudentId(event.target.value)}>{(data.students || []).map(student => <option key={student.id} value={student.id}>{student.name} - {student.className}</option>)}</select>}
    <button className="parent-icon"><Bell size={18} />{unread > 0 && <b>{unread}</b>}</button>
    <button className="parent-icon" onClick={refresh}><RefreshCw size={18} /></button>
    <button className="parent-icon" onClick={logout}><LogOut size={18} /></button>
  </header>
}

function Dashboard({ data, setTab }) {
  const stats = getStats(data)
  const todayAttendance = data.attendance.find(row => dateKey(row.date) === dateKey(new Date()))
  const latestNotice = data.notices[0]
  const pendingHomework = data.homework.filter(row => !row.completed && (!row.seenBy || !row.seenBy[data.selectedStudent?.id])).length
  return <div className="parent-stack">
    <section className="parent-student-card"><StudentPhoto student={data.selectedStudent} large /><div><h2>{data.selectedStudent.name}</h2><p>Class: {data.selectedStudent.className} | Adm No: {data.selectedStudent.admissionNo}</p><p>Father: {data.selectedStudent.fatherName || '-'}</p></div></section>
    <section className="parent-stat-grid">
      <button onClick={() => setTab('attendance')}><strong>{stats.attendancePct}%</strong><span>Attendance</span><small>Present {stats.present}/{stats.working}</small></button>
      <button onClick={() => setTab('fees')}><strong>{money(stats.pendingFees)}</strong><span>Fee Due</span><small>{stats.pendingFees ? 'Pending' : 'Clear'}</small></button>
      <button onClick={() => setTab('notices')}><strong>{data.notices.length}</strong><span>Notices</span><small>Latest updates</small></button>
      <button onClick={() => setTab('homework')}><strong>{pendingHomework}</strong><span>Homework</span><small>Pending</small></button>
    </section>
    <section className="parent-panel">
      <h3>Today&apos;s Info</h3>
      <div className="parent-today-list">
        <span>Attendance <b>{todayAttendance ? statusOf(todayAttendance.status || todayAttendance.mark) : 'Not marked'}</b></span>
        <span>Homework <b>{pendingHomework} pending</b></span>
        <span>Latest Notice <b>{latestNotice?.title || 'No notice'}</b></span>
        <span>Bus <b>{data.transport.today?.[0] ? 'Updated today' : 'No live update'}</b></span>
      </div>
    </section>
    <section className="parent-quick-grid">{tabs.slice(1, 10).map(([id, label, Icon]) => <button key={id} onClick={() => setTab(id)}><Icon size={22} /><span>{label}</span></button>)}</section>
  </div>
}

function getStats(data) {
  const statuses = data.attendance.map(row => statusOf(row.status || row.mark))
  const working = statuses.length
  const present = statuses.filter(status => status === 'present').length
  const paid = data.fees.filter(row => String(row.status || '').toLowerCase() === 'paid').reduce((sum, row) => sum + Number(row.amount || row.paidAmount || 0), 0)
  const total = data.fees.reduce((sum, row) => sum + Number(row.amount || row.totalDue || row.monthlyFee || 0), 0)
  return { working, present, absent: statuses.filter(status => status === 'absent').length, leave: statuses.filter(status => status === 'leave').length, attendancePct: working ? Math.round((present / working) * 100) : 0, paidFees: paid, totalFees: total, pendingFees: Math.max(0, total - paid) }
}

function AttendancePage({ data }) {
  const [month, setMonth] = useState(dateKey(new Date()).slice(0, 7))
  const first = new Date(`${month}-01T00:00:00`)
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const offset = first.getDay()
  const byDate = Object.fromEntries(data.attendance.map(row => [dateKey(row.date), statusOf(row.status || row.mark)]))
  const cells = Array.from({ length: offset + days }, (_, index) => index < offset ? '' : `${month}-${String(index - offset + 1).padStart(2, '0')}`)
  const stats = getStats(data)
  return <div className="parent-stack">
    <div className="parent-month-nav"><button onClick={() => { const d = new Date(`${month}-01`); d.setMonth(d.getMonth() - 1); setMonth(dateKey(d).slice(0, 7)) }}><ChevronLeft /></button><strong>{first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</strong><button onClick={() => { const d = new Date(`${month}-01`); d.setMonth(d.getMonth() + 1); setMonth(dateKey(d).slice(0, 7)) }}><ChevronRight /></button></div>
    <section className="parent-calendar"><div className="weekdays">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day => <span key={day}>{day}</span>)}</div><div className="days">{cells.map((day, index) => <div key={`${day}-${index}`} className={day ? byDate[day] || 'empty' : 'blank'}>{day && <><b>{Number(day.slice(-2))}</b><span>{byDate[day] === 'present' ? 'P' : byDate[day] === 'absent' ? 'A' : byDate[day] === 'leave' ? 'L' : ''}</span></>}</div>)}</div></section>
    <section className="parent-panel summary-table"><h3>Attendance Summary</h3>{[['Total Working Days', stats.working], ['Present', stats.present], ['Absent', stats.absent], ['Leave', stats.leave], ['Attendance %', `${stats.attendancePct}%`]].map(([a, b]) => <div key={a}><span>{a}</span><strong>{b}</strong></div>)}</section>
  </div>
}

function FeesPage({ data }) {
  const stats = getStats(data)
  return <div className="parent-stack">
    <section className="parent-panel fee-summary"><h3>Fee Summary</h3>{[['Total Fee', stats.totalFees], ['Total Paid', stats.paidFees], ['Total Pending', stats.pendingFees], ['Overdue', 0]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{money(value)}</strong></div>)}</section>
    <section className="parent-panel"><h3>Month-wise Fee</h3><div className="parent-table-wrap"><table><thead><tr><th>Month</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead><tbody>{monthNames.map(month => {
      const row = data.fees.find(item => String(item.billingMonth || item.month || '').toLowerCase().includes(month.toLowerCase()))
      const paid = row && String(row.status || '').toLowerCase() === 'paid'
      return <tr key={month}><td>{month}</td><td>{money(row?.amount || row?.monthlyFee || 0)}</td><td><span className={`parent-status ${paid ? 'paid' : row ? 'due' : 'upcoming'}`}>{paid ? 'Paid' : row ? 'Due' : 'Upcoming'}</span></td><td>{paid ? <button onClick={() => window.print()}>Receipt</button> : row ? <button onClick={() => alertPayment(data.school, row)}>Pay Now</button> : '-'}</td></tr>
    })}</tbody></table></div></section>
  </div>
}

function alertPayment(school, row) {
  alert(`Amount Due: ${money(row.amount || row.balance || 0)}\nUPI: ${school.upi || 'Contact school'}\nBank: ${school.bankName || '-'}\nAccount: ${school.bankAccount || '-'}\nIFSC: ${school.bankIfsc || '-'}\nPhone: ${school.phone || '-'}`)
}

function MarksPage({ data }) {
  return <div className="parent-stack">{data.reportCards.map(card => <section className="parent-panel" key={card.id}><h3>{card.examName || card.name || 'Report Card'}</h3><div className="parent-table-wrap"><table><thead><tr><th>Subject</th><th>Max</th><th>Obt</th><th>Grade</th><th>Remarks</th></tr></thead><tbody>{(card.subjects || card.data?.subjects || []).map((row, index) => <tr key={index}><td>{row.subject}</td><td>{row.maxMarks}</td><td>{row.obtained}</td><td><span className="parent-grade">{row.grade}</span></td><td>{row.remarks || '-'}</td></tr>)}</tbody></table></div><div className="parent-result-box"><strong>{card.summary?.percentage || card.percentage || 0}%</strong><span>Grade {card.summary?.grade || card.grade || '-'}</span><span>{card.summary?.status || card.status || 'Published'}</span></div><button className="parent-secondary" onClick={() => window.print()}><Printer size={15} /> Print / Download</button></section>)}{!data.reportCards.length && <Empty title="No published result yet" />}</div>
}

function NoticesPage({ data }) {
  return <div className="parent-card-list">{data.notices.map(row => <article key={row.id} className={`parent-notice ${String(row.priority || row.category || '').toLowerCase()}`}><span>{row.priority || row.category || 'Notice'}</span><h3>{row.title}</h3><small>{longDate(row.createdAt || row.publishAt)} | For: {row.audience || 'All'}</small><p>{row.body || row.description || row.message}</p>{row.attachmentURL && <a href={row.attachmentURL} target="_blank" rel="noreferrer"><Download size={15} /> Download Attachment</a>}</article>)}{!data.notices.length && <Empty title="No notices yet" />}</div>
}

function HomeworkPage({ data }) {
  const today = dateKey(new Date())
  return <div className="parent-card-list">{data.homework.map(row => <article key={row.id} className={`parent-homework-card ${row.dueDate < today && !row.completed ? 'overdue' : ''}`}><span>{row.subject} | {row.priority || 'Normal'}</span><h3>{row.title}</h3><p>{row.description}</p>{row.attachmentURL && <a href={row.attachmentURL} target="_blank" rel="noreferrer"><Download size={15} /> {row.attachmentName || 'Attachment'}</a>}<small>Due: {longDate(row.dueDate)}</small></article>)}{!data.homework.length && <Empty title="No homework posted yet" />}</div>
}

function TransportPage({ data }) {
  const t = data.transport || {}
  if (!data.selectedStudent.transportRequired && !t.allocation?.routeId) return <Empty title="Transport not allocated" />
  return <div className="parent-stack"><section className="parent-panel transport-card"><h3>Transport Details</h3><p><b>Route:</b> {t.route?.routeName || data.selectedStudent.routeName || '-'}</p><p><b>Vehicle:</b> {t.vehicle?.vehicleNumber || t.allocation?.vehicleNumber || '-'}</p><p><b>Driver:</b> {t.driver?.name || '-'} {t.driver?.phone && <a href={`https://wa.me/91${digits(t.driver.phone)}`}>WhatsApp</a>}</p><p><b>Pickup:</b> {t.allocation?.stopName || data.selectedStudent.stopName} at {t.allocation?.pickupTime || data.selectedStudent.pickupTime}</p><p><b>Drop:</b> {t.allocation?.dropTime || data.selectedStudent.dropTime || '-'}</p></section><section className="parent-panel"><h3>Today&apos;s Status</h3>{t.today?.length ? t.today.map((row, index) => <p key={index}>{row.type}: {(row.records || []).find(item => item.studentId === data.selectedStudent.id)?.status || 'Updated'}</p>) : <p>No pickup/drop update yet.</p>}</section></div>
}

function TimetablePage({ data }) {
  const table = data.timetable || {}
  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const periods = Array.from({ length: 8 }, (_, index) => index + 1)
  return <section className="parent-panel"><h3>Weekly Timetable</h3><div className="parent-table-wrap"><table><thead><tr><th>Period</th>{days.map(day => <th key={day}>{day.slice(0, 3)}</th>)}</tr></thead><tbody>{periods.map(period => <tr key={period}><td>{period}</td>{days.map(day => <td key={day}>{table?.[day]?.[period]?.subject || table?.[day]?.[`period${period}`]?.subject || '-'}</td>)}</tr>)}</tbody></table></div></section>
}

function CertificatesPage({ data, session, reload }) {
  const [request, setRequest] = useState({ certificateType: 'Bonafide', purpose: '' })
  const submit = async event => {
    event.preventDefault()
    await api({ action: 'certificateRequest', ...session, studentId: data.selectedStudent.id, ...request })
    setRequest({ certificateType: 'Bonafide', purpose: '' })
    await reload()
  }
  return <div className="parent-stack"><div className="parent-card-list">{data.certificates.map(row => <article key={row.id}><span>{row.certificateNumber || row.certNo}</span><h3>{row.certificateType || row.type}</h3><small>{longDate(row.issueDate || row.createdAt)}</small><button onClick={() => window.print()}>View / Print</button></article>)}{!data.certificates.length && <Empty title="No certificates issued yet" />}</div><form className="parent-panel" onSubmit={submit}><h3>Request Certificate</h3><label>Type<select value={request.certificateType} onChange={event => setRequest({ ...request, certificateType: event.target.value })}>{['Transfer Certificate','Bonafide','Character','Study','Sports'].map(item => <option key={item}>{item}</option>)}</select></label><label>Purpose<textarea required value={request.purpose} onChange={event => setRequest({ ...request, purpose: event.target.value })} /></label><button className="parent-primary">Submit Request</button></form></div>
}

function LeavePage({ data, session, reload }) {
  const today = new Date().toISOString().slice(0, 10)
  const empty = { fromDate: today, toDate: today, reason: '' }
  const [form, setForm] = useState(empty)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async event => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await api({ action: 'leaveRequest', ...session, studentId: data.selectedStudent.id, ...form })
      setForm({ ...empty })
      await reload()
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setBusy(false)
    }
  }
  const requests = data.leaveRequests || []
  return <div className="parent-stack">
    <form className="parent-panel" onSubmit={submit}>
      <h3>Apply for Leave</h3>
      <label>From<input type="date" required value={form.fromDate} onChange={event => setForm({ ...form, fromDate: event.target.value })} /></label>
      <label>To<input type="date" required value={form.toDate} min={form.fromDate} onChange={event => setForm({ ...form, toDate: event.target.value })} /></label>
      <label>Reason<textarea required value={form.reason} onChange={event => setForm({ ...form, reason: event.target.value })} placeholder="e.g. Fever, family function" /></label>
      {error && <p className="parent-error">{error}</p>}
      <button className="parent-primary" disabled={busy}>{busy ? 'Submitting...' : 'Submit Request'}</button>
    </form>
    <section className="parent-panel">
      <h3>My Requests</h3>
      <div className="parent-table-wrap"><table>
        <thead><tr><th>Dates</th><th>Reason</th><th>Status</th></tr></thead>
        <tbody>
          {requests.map(row => <tr key={row.id}>
            <td>{row.fromDate === row.toDate ? longDate(row.fromDate) : `${longDate(row.fromDate)} - ${longDate(row.toDate)}`}</td>
            <td>{row.reason}{row.reviewNote ? <small style={{ display: 'block', opacity: 0.7 }}>{row.reviewNote}</small> : null}</td>
            <td><span className={`parent-status ${row.status === 'approved' ? 'paid' : row.status === 'rejected' ? 'due' : 'upcoming'}`}>{row.status}</span></td>
          </tr>)}
          {!requests.length && <tr><td colSpan="3">No leave requests yet.</td></tr>}
        </tbody>
      </table></div>
    </section>
  </div>
}

function ContactPage({ data, session, reload }) {
  const [form, setForm] = useState({ subject: '', message: '' })
  const submit = async event => {
    event.preventDefault()
    await api({ action: 'message', ...session, studentId: data.selectedStudent.id, ...form })
    setForm({ subject: '', message: '' })
    await reload()
  }
  return <div className="parent-stack"><section className="parent-panel"><h3>{data.school.schoolName}</h3><p>{data.school.address}</p><p><Phone size={15} /> {data.school.phone} {data.school.phone && <a href={`https://wa.me/91${digits(data.school.phone)}`}>WhatsApp</a>}</p><p><Mail size={15} /> {data.school.email}</p></section><form className="parent-panel" onSubmit={submit}><h3>Send Message</h3><label>Subject<input required value={form.subject} onChange={event => setForm({ ...form, subject: event.target.value })} /></label><label>Message<textarea required value={form.message} onChange={event => setForm({ ...form, message: event.target.value })} /></label><button className="parent-primary">Send Message</button></form><section className="parent-card-list">{data.messages.map(row => <article key={row.id}><h3>{row.subject}</h3><p>{row.message}</p><small>Status: {row.status}</small>{row.reply && <p><b>Reply:</b> {row.reply}</p>}</article>)}</section></div>
}

function ProfilePage({ data, session, updateLocal }) {
  const [form, setForm] = useState({ name: data.parent.name, email: data.parent.email, address: data.parent.address, language: data.parent.language })
  const [message, setMessage] = useState('')
  const save = async event => {
    event.preventDefault()
    await api({ action: 'updateProfile', ...session, ...form })
    setMessage('Profile saved.')
    updateLocal(current => ({ ...current, parent: { ...current.parent, ...form } }))
  }
  return <div className="parent-stack"><form className="parent-panel" onSubmit={save}><h3>Parent Info</h3><label>Name<input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label><label>Email<input value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></label><label>Address<textarea value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} /></label><label>Language<select value={form.language} onChange={event => setForm({ ...form, language: event.target.value })}><option value="english">English</option><option value="hindi">Hindi</option></select></label><p>Phone: {data.parent.phone}</p>{message && <div className="parent-alert ok">{message}</div>}<button className="parent-primary"><Save size={15} /> Save</button></form><section className="parent-student-card"><StudentPhoto student={data.selectedStudent} large /><div><h2>{data.selectedStudent.name}</h2><p>Adm No: {data.selectedStudent.admissionNo}</p><p>Class: {data.selectedStudent.className}</p><p>DOB: {data.selectedStudent.dob}</p></div></section></div>
}

function Empty({ title }) {
  return <div className="parent-empty"><FileText size={34} /><strong>{title}</strong><p>Data will appear here when school updates it.</p></div>
}

export default function ParentPortal() {
  const [session, setSession] = useState(() => JSON.parse(localStorage.getItem('parent-session') || 'null'))
  const [data, setData] = useState(() => JSON.parse(localStorage.getItem('parent-data') || 'null'))
  const [tab, setTab] = useState('dashboard')
  const [mode, setMode] = useState(window.location.pathname.includes('forgot') ? 'forgot' : 'login')
  const [selectedStudentId, setSelectedStudentId] = useState(() => data?.selectedStudent?.id || '')
  const [online, setOnline] = useState(navigator.onLine)
  const [loading, setLoading] = useState(false)
  const selectedData = useMemo(() => data ? { ...data, selectedStudent: (data.students || []).find(student => student.id === selectedStudentId) || data.selectedStudent } : null, [data, selectedStudentId])
  const language = data?.parent?.language || 'english'

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])

  const saveSession = result => {
    const nextSession = { schoolId: result.schoolId, parentId: result.parentId, sessionToken: result.sessionToken }
    localStorage.setItem('parent-session', JSON.stringify(nextSession))
    localStorage.setItem('parent-data', JSON.stringify(result.data))
    setSession(nextSession)
    setData(result.data)
    setSelectedStudentId(result.data.selectedStudent?.id || '')
  }
  const refresh = async (studentId = selectedStudentId) => {
    if (!session) return
    setLoading(true)
    try {
      const result = await api({ action: 'data', ...session, studentId })
      localStorage.setItem('parent-data', JSON.stringify(result.data))
      setData(result.data)
      setSelectedStudentId(result.data.selectedStudent?.id || studentId)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    if (!session) return undefined
    // Attendance, fees and notices change a few times a day, not four times a minute. Poll once a
    // minute, and only while the tab is actually visible — a portal left open in a background tab
    // used to keep pulling every 15s all day. A visibility change refreshes immediately.
    const tick = () => { if (!document.hidden) refresh(selectedStudentId).catch(() => {}) }
    const timer = setInterval(tick, 60000)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick) }
  }, [session, selectedStudentId])
  useEffect(() => {
    if (session && selectedStudentId) refresh(selectedStudentId).catch(() => {})
  }, [selectedStudentId])
  const logout = () => {
    localStorage.removeItem('parent-session')
    localStorage.removeItem('parent-data')
    setSession(null)
    setData(null)
    setTab('dashboard')
  }

  if (!session || !data) return <Login mode={mode} setMode={setMode} onLogin={saveSession} />
  if (data.parent.mustChangePassword) return <SetPassword session={session} onDone={() => refresh().then(() => setData(current => ({ ...current, parent: { ...current.parent, mustChangePassword: false } })))} />
  const pages = {
    dashboard: <Dashboard data={selectedData} setTab={setTab} />,
    attendance: <AttendancePage data={selectedData} />,
    fees: <FeesPage data={selectedData} />,
    marks: <MarksPage data={selectedData} />,
    notices: <NoticesPage data={selectedData} />,
    homework: <HomeworkPage data={selectedData} />,
    transport: <TransportPage data={selectedData} />,
    timetable: <TimetablePage data={selectedData} />,
    certificates: <CertificatesPage data={selectedData} session={session} reload={refresh} />,
    leave: <LeavePage data={selectedData} session={session} reload={refresh} />,
    contact: <ContactPage data={selectedData} session={session} reload={refresh} />,
    profile: <ProfilePage data={selectedData} session={session} updateLocal={setData} />,
  }
  return <main className="parent-app">
    <Topbar data={selectedData} selectedStudentId={selectedStudentId} setSelectedStudentId={setSelectedStudentId} refresh={() => refresh()} logout={logout} online={online} />
    {!online && <div className="parent-offline">You are offline. Showing cached data.</div>}
    {loading && <div className="parent-sync">Syncing latest data...</div>}
    <div className="parent-layout">
      <aside className="parent-sidebar">{tabs.map(([id, label, Icon]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><Icon size={18} /> {language === 'hindi' ? hindi[id] : label}</button>)}</aside>
      <section className="parent-content"><div className="parent-page-title"><h1>{language === 'hindi' ? hindi[tab] : tabs.find(item => item[0] === tab)?.[1]}</h1><button className="parent-secondary" onClick={() => refresh()}><RefreshCw size={15} /> Refresh</button></div>{pages[tab]}</section>
    </div>
    <nav className="parent-bottom-nav">{tabs.slice(0, 5).map(([id, label, Icon]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><Icon size={18} /><span>{label}</span></button>)}<button onClick={() => setTab('profile')}><Menu size={18} /><span>More</span></button></nav>
  </main>
}

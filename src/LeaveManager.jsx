import React, { useMemo, useState } from 'react'
import {
  CalendarCheck, Check, Download, FileText, Plus, Printer, Search,
  Trash2, Umbrella, UserCheck,
} from 'lucide-react'
import imageCompression from 'browser-image-compression'
import DatePicker from './DatePicker'

const today = () => {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}
const values = object => Object.values(object || {}).filter(Boolean).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
const employeeName = employee => `${employee?.firstName || ''} ${employee?.lastName || ''}`.trim() || employee?.name || employee?.employeeCode || 'Employee'
const dateLabel = value => value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
const rangeDates = (from, to) => {
  const dates = []
  const cursor = new Date(`${from || today()}T00:00:00`)
  const end = new Date(`${to || from || today()}T00:00:00`)
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}
const durationDays = (from, to, session) => {
  if (!from || !to) return 0
  if (from === to && session !== 'full') return 0.5
  return rangeDates(from, to).filter(date => ![0].includes(new Date(`${date}T00:00:00`).getDay())).length
}
const fileToDataUrl = file => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(new Error('Could not read file.'))
  reader.readAsDataURL(file)
})
const uploadCertificate = async file => {
  if (!file) return null
  if (file.type.startsWith('image/')) {
    const compressed = await imageCompression(file, { maxSizeMB: 0.4, maxWidthOrHeight: 1200, useWebWorker: true, initialQuality: 0.75 })
    return { name: file.name, url: await fileToDataUrl(compressed), size: compressed.size }
  }
  return { name: file.name, url: await fileToDataUrl(file), size: file.size }
}

const defaultTypes = [
  { id: 'CL', name: 'Casual Leave', days: 12, color: 'cl', carryForward: false, maxCarry: 0, encash: false, enabled: true },
  { id: 'SL', name: 'Sick Leave', days: 15, color: 'sl', carryForward: false, maxCarry: 0, encash: false, enabled: true },
  { id: 'EL', name: 'Earned Leave', days: 15, color: 'el', carryForward: true, maxCarry: 3, encash: true, enabled: true },
  { id: 'ML', name: 'Maternity Leave', days: 180, color: 'ml', carryForward: false, maxCarry: 0, encash: false, enabled: true },
  { id: 'HALF', name: 'Half Day Leave', days: 0, color: 'half', carryForward: false, maxCarry: 0, encash: false, enabled: true },
  { id: 'LWP', name: 'Leave Without Pay', days: 0, color: 'lwp', carryForward: false, maxCarry: 0, encash: false, enabled: true },
  { id: 'CO', name: 'Comp Off', days: 0, color: 'co', carryForward: false, maxCarry: 0, encash: true, enabled: true },
  { id: 'DL', name: 'Duty Leave', days: 0, color: 'dl', carryForward: false, maxCarry: 0, encash: false, enabled: true },
  { id: 'STUDY', name: 'Study Leave', days: 0, color: 'study', carryForward: false, maxCarry: 0, encash: false, enabled: true },
]
const defaultSettings = {
    leaveTypes: defaultTypes,
    sandwichRule: 'relaxed',
    medicalCertDays: 3,
    approvalHierarchy: ['principal'],
    halfDayAllowed: true,
    maxHalfDaysPerMonth: 4,
    blockDuringExam: false,
    notifyAdmin: true,
    notifySubstitute: true,
    whatsapp: true,
    email: false,
    departmentRules: {},
}
const normalizeLeave = leave => ({
  applications: {},
  balance: {},
  substitutes: {},
  notifications: {},
  ...leave,
  settings: { ...defaultSettings, ...(leave?.settings || {}) },
})
const typeById = (leave, id) => (leave.settings.leaveTypes || defaultTypes).find(type => type.id === id) || defaultTypes[0]
const employeeMeta = (employee, config) => ({
  department: config?.departments?.[employee?.departmentId]?.name || employee?.department || '-',
  designation: config?.designations?.[employee?.designationId]?.name || employee?.designation || '-',
})
const calcBalances = (leave, employeeId) => {
  const apps = values(leave.applications).filter(row => row.employeeId === employeeId && row.status !== 'cancelled')
  return (leave.settings.leaveTypes || defaultTypes).filter(type => type.enabled !== false).map(type => {
    const approved = apps.filter(row => row.leaveType === type.id && row.status === 'approved').reduce((sum, row) => sum + Number(row.totalDays || 0), 0)
    const pending = apps.filter(row => row.leaveType === type.id && row.status === 'pending').reduce((sum, row) => sum + Number(row.totalDays || 0), 0)
    const total = Number(type.days || 0) + Number(type.maxCarry || 0)
    return { ...type, total, used: approved, pending, balance: type.id === 'LWP' ? '-' : Math.max(0, total - approved - pending), carryForward: Number(type.maxCarry || 0) }
  })
}
const monthShort = date => new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { month: 'short' })
const statusClass = status => status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : status === 'cancelled' ? 'cancelled' : 'pending'
const printRows = (title, headers, rows) => {
  const win = window.open('', '_blank', 'width=900,height=900')
  if (!win) return alert('Please allow popups to print.')
  win.document.write(`<html><head><title>${title}</title><style>body{font-family:Arial;margin:24px;color:#021024}.head{text-align:center;margin-bottom:18px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #111;padding:7px;font-size:12px;text-align:left}th{background:#052659;color:white}.sign{display:flex;justify-content:space-between;margin-top:42px}.line{border-top:1px solid #111;width:180px;text-align:center;padding-top:6px}@media print{@page{size:A4;margin:12mm}}</style></head><body><div class="head"><h2>Leave Management Report</h2><p>${title} - Generated ${dateLabel(today())}</p></div><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table><div class="sign"><div class="line">Prepared By</div><div class="line">Principal</div></div><script>window.onload=()=>window.print()</script></body></html>`)
  win.document.close()
}
const exportCsv = (headers, rows, filename) => {
  const escape = value => `"${String(value ?? '').replace(/"/g, '""')}"`
  const csv = [headers.map(escape).join(','), ...rows.map(row => row.map(escape).join(','))].join('\n')
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  link.download = `${filename}.csv`
  link.click()
}

function ApplyLeave({ leave, staffRows, config, saveLeaveItem }) {
  const firstEmployee = staffRows[0] || {}
  const [form, setForm] = useState({ employeeId: firstEmployee.id || '', leaveType: 'CL', fromDate: today(), toDate: today(), session: 'full', reason: '', contactDuringLeave: '', emergencyContact: '', substituteId: '', handoverNotes: '', status: 'pending' })
  const [cert, setCert] = useState(null)
  const [saving, setSaving] = useState(false)
  const employee = staffRows.find(row => row.id === form.employeeId) || firstEmployee
  const meta = employeeMeta(employee, config)
  const days = durationDays(form.fromDate, form.toDate, form.session)
  const balances = calcBalances(leave, form.employeeId)
  const type = typeById(leave, form.leaveType)
  const balance = balances.find(row => row.id === form.leaveType)
  const duplicate = values(leave.applications).some(row => row.employeeId === form.employeeId && row.status !== 'cancelled' && rangeDates(row.fromDate, row.toDate).some(date => rangeDates(form.fromDate, form.toDate).includes(date)))
  const sandwich = form.leaveType === 'CL' && [1, 5].includes(new Date(`${form.fromDate}T00:00:00`).getDay())
  const submit = async status => {
    if (!form.employeeId) return alert('Please select employee.')
    if (form.fromDate < today()) return alert('From date cannot be in the past.')
    if (form.toDate < form.fromDate) return alert('To date cannot be before from date.')
    if (duplicate) return alert('Leave already applied for selected date range.')
    if (form.leaveType === 'SL' && days > Number(leave.settings.medicalCertDays || 3) && !cert) return alert('Medical certificate is required for sick leave above configured days.')
    if (balance && balance.balance !== '-' && Number(balance.balance) < days) {
      if (!window.confirm('Leave balance is low. Submit anyway?')) return
    }
    setSaving(true)
    try {
      const substitute = staffRows.find(row => row.id === form.substituteId)
      await saveLeaveItem('applications', { ...form, employeeName: employeeName(employee), employeeCode: employee.employeeCode, department: meta.department, designation: meta.designation, leaveTypeName: type.name, totalDays: days, medicalCertURL: cert?.url || '', medicalCertName: cert?.name || '', substituteName: substitute ? employeeName(substitute) : '', status })
      alert(status === 'draft' ? 'Leave saved as draft.' : 'Leave applied! Awaiting approval.')
      setForm(current => ({ ...current, reason: '', handoverNotes: '', contactDuringLeave: '', emergencyContact: '', status: 'pending' }))
      setCert(null)
    } finally {
      setSaving(false)
    }
  }
  return <section className="panel leave-form-panel"><div className="panel-header"><div><h3>Apply Leave</h3><p>Submit leave request with substitute and handover notes.</p></div></div><div className="form-grid">
    <label>Employee Name*<select value={form.employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })}>{staffRows.map(row => <option key={row.id} value={row.id}>{employeeName(row)} - {row.employeeCode}</option>)}</select></label>
    <label>Employee ID<input readOnly value={employee.employeeCode || ''} /></label>
    <label>Department<input readOnly value={meta.department} /></label>
    <label>Designation<input readOnly value={meta.designation} /></label>
    <label>Leave Type*<select value={form.leaveType} onChange={e => setForm({ ...form, leaveType: e.target.value })}>{(leave.settings.leaveTypes || defaultTypes).filter(type => type.enabled !== false).map(type => { const bal = balances.find(row => row.id === type.id); return <option key={type.id} value={type.id}>{type.id} - {type.name} ({bal?.balance ?? type.days} remaining)</option> })}</select></label>
    <label>From Date*<DatePicker value={form.fromDate} onChange={value => setForm({ ...form, fromDate: value, toDate: form.toDate < value ? value : form.toDate })} /></label>
    <label>To Date*<DatePicker value={form.toDate} onChange={value => setForm({ ...form, toDate: value })} /></label>
    <label>Duration<input readOnly value={`${days} day${days === 1 ? '' : 's'}`} /></label>
    <label>Session<select value={form.session} onChange={e => setForm({ ...form, session: e.target.value })}><option value="full">Full Day</option><option value="first_half">First Half</option><option value="second_half">Second Half</option></select></label>
    <label>Substitute Teacher<select value={form.substituteId} onChange={e => setForm({ ...form, substituteId: e.target.value })}><option value="">Select substitute</option>{staffRows.filter(row => row.id !== form.employeeId).map(row => <option key={row.id} value={row.id}>{employeeName(row)}</option>)}</select></label>
    <label>Contact During Leave<input value={form.contactDuringLeave} onChange={e => setForm({ ...form, contactDuringLeave: e.target.value })} /></label>
    <label>Emergency Contact<input value={form.emergencyContact} onChange={e => setForm({ ...form, emergencyContact: e.target.value })} /></label>
    <label className="full">Reason*<textarea required value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Enter reason for leave..." /></label>
    <label className="full">Handover Notes<textarea value={form.handoverNotes} onChange={e => setForm({ ...form, handoverNotes: e.target.value })} placeholder="Pending work or class instructions..." /></label>
    <label className="leave-upload">Medical Certificate<input type="file" accept="image/*,.pdf" onChange={async e => setCert(await uploadCertificate(e.target.files?.[0]))} /><span>{cert ? `${cert.name} - ${Math.round(cert.size / 1024)} KB` : 'Upload photo/PDF'}</span></label>
  </div>{sandwich && <div className="leave-warning">Sandwich leave warning: CL on Monday/Friday may include nearby holiday depending on settings.</div>}{duplicate && <div className="leave-warning danger">Duplicate leave exists in this date range.</div>}<div className="modal-actions"><button className="secondary-button" disabled={saving} onClick={() => submit('draft')}>Save as Draft</button><button className="primary-button" disabled={saving} onClick={() => submit('pending')}><Check size={15} /> {saving ? 'Submitting...' : 'Submit Leave'}</button></div></section>
}

function MyLeaves({ leave, employeeId, saveLeaveItem }) {
  const [filters, setFilters] = useState({ type: 'All', status: 'All' })
  const rows = values(leave.applications).filter(row => (!employeeId || row.employeeId === employeeId) && (filters.type === 'All' || row.leaveType === filters.type) && (filters.status === 'All' || row.status === filters.status))
  const summary = values(leave.applications).filter(row => !employeeId || row.employeeId === employeeId)
  const cancel = row => {
    if (window.confirm('Cancel this pending leave?')) saveLeaveItem('applications', { ...row, status: 'cancelled', cancelledAt: Date.now() })
  }
  return <div className="leave-page"><SummaryStrip items={[['Total Applied', `${summary.reduce((s, r) => s + Number(r.totalDays || 0), 0)} days`], ['Approved', `${summary.filter(r => r.status === 'approved').reduce((s, r) => s + Number(r.totalDays || 0), 0)} days`], ['Pending', `${summary.filter(r => r.status === 'pending').reduce((s, r) => s + Number(r.totalDays || 0), 0)} days`], ['Rejected', `${summary.filter(r => r.status === 'rejected').reduce((s, r) => s + Number(r.totalDays || 0), 0)} days`], ['Cancelled', `${summary.filter(r => r.status === 'cancelled').reduce((s, r) => s + Number(r.totalDays || 0), 0)} days`], ['LWP Days', `${summary.filter(r => r.leaveType === 'LWP' && r.status === 'approved').reduce((s, r) => s + Number(r.totalDays || 0), 0)}`]]} /><section className="panel leave-filters"><select value={filters.type} onChange={e => setFilters({ ...filters, type: e.target.value })}><option>All</option>{(leave.settings.leaveTypes || defaultTypes).map(type => <option key={type.id}>{type.id}</option>)}</select><select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}><option>All</option><option>pending</option><option>approved</option><option>rejected</option><option>cancelled</option></select><button className="secondary-button" onClick={() => exportCsv(['Type','From','To','Days','Status'], rows.map(row => [row.leaveType, row.fromDate, row.toDate, row.totalDays, row.status]), 'my-leaves')}><Download size={14} /> Export</button></section><SimpleTable headers={['#','Type','From','To','Days','Status','Action']} rows={rows.map((row, index) => [index + 1, <TypeBadge leave={leave} typeId={row.leaveType} />, dateLabel(row.fromDate), dateLabel(row.toDate), row.totalDays, <StatusBadge status={row.status} />, row.status === 'pending' ? <button className="secondary-button danger" onClick={() => cancel(row)}>Cancel</button> : <button className="secondary-button" onClick={() => printRows('Leave Application', ['Field','Value'], Object.entries(row).map(([k, v]) => [k, v]))}>View</button>])} /></div>
}

function LeaveBalance({ leave, staffRows }) {
  const [employeeId, setEmployeeId] = useState(staffRows[0]?.id || '')
  const balances = calcBalances(leave, employeeId)
  const rows = balances.map(row => [<TypeBadge leave={leave} typeId={row.id} />, row.total || '-', row.used, row.pending, row.balance, row.carryForward, <Progress used={row.used} total={row.total} />])
  const monthly = values(leave.applications).filter(row => row.employeeId === employeeId && row.status === 'approved').reduce((map, row) => {
    const month = monthShort(row.fromDate)
    map[month] ||= { CL: 0, SL: 0, EL: 0, LWP: 0 }
    if (map[month][row.leaveType] !== undefined) map[month][row.leaveType] += Number(row.totalDays || 0)
    return map
  }, {})
  return <div className="leave-page"><section className="panel leave-filters"><label>Employee<select value={employeeId} onChange={e => setEmployeeId(e.target.value)}>{staffRows.map(row => <option key={row.id} value={row.id}>{employeeName(row)} - {row.employeeCode}</option>)}</select></label></section><SimpleTable headers={['Leave Type','Total','Used','Pending','Balance','Carry Fwd','Usage']} rows={rows} /><SimpleTable headers={['Month','CL','SL','EL','LWP']} rows={Object.entries(monthly).map(([month, row]) => [month, row.CL || 0, row.SL || 0, row.EL || 0, row.LWP || 0])} empty="No monthly leave usage." /></div>
}

function Approvals({ leave, staffRows, config, saveLeaveItem, saveStaffAttendance }) {
  const [filter, setFilter] = useState('pending')
  const [query, setQuery] = useState('')
  const rows = values(leave.applications).filter(row => (filter === 'all' || row.status === filter) && `${row.employeeName} ${row.department} ${row.leaveType}`.toLowerCase().includes(query.toLowerCase()))
  const decide = async (row, status) => {
    const remarks = status === 'approved' ? window.prompt('Approval remarks (optional):') || '' : window.prompt('Reason for rejection:') || ''
    if (status === 'rejected' && !remarks) return
    const updated = { ...row, status, approvalRemarks: status === 'approved' ? remarks : '', rejectedReason: status === 'rejected' ? remarks : '', approvedBy: status === 'approved' ? 'Admin' : row.approvedBy || '', approvedAt: status === 'approved' ? Date.now() : row.approvedAt || '', rejectedAt: status === 'rejected' ? Date.now() : row.rejectedAt || '' }
    await saveLeaveItem('applications', updated)
    if (status === 'approved') {
      await Promise.all(rangeDates(row.fromDate, row.toDate).map(date => saveStaffAttendance(date, { [row.employeeId]: 'L' })))
      if (row.substituteId) await saveLeaveItem('substitutes', { leaveId: row.id, absentEmployeeId: row.employeeId, absentEmployeeName: row.employeeName, substituteEmployeeId: row.substituteId, substituteEmployeeName: row.substituteName, date: row.fromDate, classes: [], handoverNotes: row.handoverNotes || '', status: 'assigned' })
    }
    alert(`Leave ${status}.`)
  }
  const departmentRows = Object.values(config.departments || {}).map(dept => {
    const deptLeaves = values(leave.applications).filter(row => row.department === dept.name)
    return [dept.name, deptLeaves.length, deptLeaves.filter(row => row.status === 'approved').length, deptLeaves.filter(row => row.status === 'pending').length, deptLeaves.filter(row => row.status === 'rejected').length]
  })
  return <div className="leave-page"><section className="panel leave-filters"><div className="table-search"><Search size={14} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search employee, department, leave type" /></div><select value={filter} onChange={e => setFilter(e.target.value)}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="all">All</option></select></section><SimpleTable headers={['#','Employee','Type','Dates','Days','Substitute','Action']} rows={rows.map((row, index) => [index + 1, `${row.employeeName} (${row.department})`, <TypeBadge leave={leave} typeId={row.leaveType} />, `${dateLabel(row.fromDate)} - ${dateLabel(row.toDate)}`, row.totalDays, row.substituteName || '-', row.status === 'pending' ? <div className="transport-row-actions"><button className="secondary-button approve" onClick={() => decide(row, 'approved')}>Approve</button><button className="secondary-button reject" onClick={() => decide(row, 'rejected')}>Reject</button></div> : <StatusBadge status={row.status} />])} /><SimpleTable headers={['Department','Total','Approved','Pending','Rejected']} rows={departmentRows} /></div>
}

function LeaveCalendar({ leave }) {
  const [month, setMonth] = useState(today().slice(0, 7))
  const [selected, setSelected] = useState(today())
  const date = new Date(`${month}-01T00:00:00`)
  const startDay = date.getDay()
  const days = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const cells = [...Array(startDay).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)]
  const leavesOn = day => values(leave.applications).filter(row => row.status !== 'cancelled' && day && rangeDates(row.fromDate, row.toDate).includes(day))
  const selectedLeaves = leavesOn(selected)
  return <div className="leave-page"><section className="panel leave-filters"><input type="month" value={month} onChange={e => setMonth(e.target.value)} /></section><section className="panel leave-calendar"><div className="leave-calendar-head">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day => <span key={day}>{day}</span>)}</div><div className="leave-calendar-grid">{cells.map((day, index) => <button key={index} className={day === selected ? 'active' : ''} onClick={() => day && setSelected(day)}><strong>{day ? Number(day.slice(-2)) : ''}</strong>{leavesOn(day).slice(0, 3).map(row => <small key={row.id} className={statusClass(row.status)}>{row.leaveType} {row.employeeName?.split(' ')[0]}</small>)}</button>)}</div></section><section className="panel"><div className="panel-header"><div><h3>{dateLabel(selected)} - Leave Details</h3><p>Available today: {Math.max(0, 20 - selectedLeaves.length)} staff. On leave: {selectedLeaves.length}</p></div></div>{selectedLeaves.map(row => <div className="leave-detail-line" key={row.id}><StatusBadge status={row.status} /><strong>{row.employeeName}</strong><span>{row.leaveType} - {row.totalDays} day(s)</span></div>)}{!selectedLeaves.length && <div className="empty-state">No leaves on this date.</div>}</section></div>
}

function SubstitutePage({ leave, staffRows, saveLeaveItem }) {
  const rows = values(leave.applications).filter(row => row.status === 'approved')
  const assign = async row => {
    const id = window.prompt('Enter substitute employee code/name:')
    if (!id) return
    const substitute = staffRows.find(emp => employeeName(emp).toLowerCase().includes(id.toLowerCase()) || emp.employeeCode === id)
    if (!substitute) return alert('Substitute not found.')
    await saveLeaveItem('applications', { ...row, substituteId: substitute.id, substituteName: employeeName(substitute) })
    await saveLeaveItem('substitutes', { leaveId: row.id, absentEmployeeId: row.employeeId, absentEmployeeName: row.employeeName, substituteEmployeeId: substitute.id, substituteEmployeeName: employeeName(substitute), date: row.fromDate, classes: [], handoverNotes: row.handoverNotes || '', status: 'assigned' })
  }
  const acknowledge = sub => saveLeaveItem('substitutes', { ...sub, status: 'acknowledged' })
  return <div className="leave-page"><SimpleTable headers={['#','Absent','Leave','Date','Classes','Substitute','Action']} rows={rows.map((row, index) => [index + 1, row.employeeName, row.leaveType, `${dateLabel(row.fromDate)} - ${dateLabel(row.toDate)}`, row.classes?.length || '-', row.substituteName || 'Pending', <button className="secondary-button" onClick={() => assign(row)}>{row.substituteName ? 'Change' : 'Assign'}</button>])} /><SimpleTable headers={['Substitute','Replacing','Date','Notes','Status','Action']} rows={values(leave.substitutes).map(row => [row.substituteEmployeeName, row.absentEmployeeName, dateLabel(row.date), row.handoverNotes || '-', row.status, row.status === 'assigned' ? <button className="primary-button" onClick={() => acknowledge(row)}>Acknowledge</button> : 'Done'])} /></div>
}

function LeaveSettings({ leave, saveLeaveItem }) {
  const [settings, setSettings] = useState(leave.settings)
  const updateType = (index, changes) => setSettings(current => ({ ...current, leaveTypes: current.leaveTypes.map((type, i) => i === index ? { ...type, ...changes } : type) }))
  const addCustom = () => setSettings(current => ({ ...current, leaveTypes: [...current.leaveTypes, { id: `CUSTOM${current.leaveTypes.length + 1}`, name: 'Custom Leave', days: 0, color: 'custom', carryForward: false, maxCarry: 0, encash: false, enabled: true }] }))
  const save = async () => {
    await saveLeaveItem('settings', settings)
    alert('Leave settings saved.')
  }
  return <div className="leave-page"><section className="panel table-panel"><div className="panel-header"><div><h3>Leave Types Configuration</h3><p>Edit yearly limits, carry forward and status.</p></div><button className="secondary-button" onClick={addCustom}><Plus size={14} /> Add Custom</button></div><div className="table-scroll"><table><thead><tr><th>Type</th><th>Name</th><th>Days/Year</th><th>Carry Fwd</th><th>Max Carry</th><th>Encash</th><th>Status</th></tr></thead><tbody>{settings.leaveTypes.map((type, index) => <tr key={type.id}><td><input value={type.id} onChange={e => updateType(index, { id: e.target.value })} /></td><td><input value={type.name} onChange={e => updateType(index, { name: e.target.value })} /></td><td><input type="number" value={type.days} onChange={e => updateType(index, { days: Number(e.target.value) })} /></td><td><select value={type.carryForward ? 'Yes' : 'No'} onChange={e => updateType(index, { carryForward: e.target.value === 'Yes' })}><option>No</option><option>Yes</option></select></td><td><input type="number" value={type.maxCarry || 0} onChange={e => updateType(index, { maxCarry: Number(e.target.value) })} /></td><td><select value={type.encash ? 'Yes' : 'No'} onChange={e => updateType(index, { encash: e.target.value === 'Yes' })}><option>No</option><option>Yes</option></select></td><td><select value={type.enabled === false ? 'Off' : 'On'} onChange={e => updateType(index, { enabled: e.target.value === 'On' })}><option>On</option><option>Off</option></select></td></tr>)}</tbody></table></div></section><section className="panel leave-form-panel"><div className="form-grid"><label>Sandwich Leave Rule<select value={settings.sandwichRule} onChange={e => setSettings({ ...settings, sandwichRule: e.target.value })}><option value="relaxed">Relaxed</option><option value="strict">Strict</option></select></label><label>Medical Certificate Days<input type="number" value={settings.medicalCertDays} onChange={e => setSettings({ ...settings, medicalCertDays: Number(e.target.value) })} /></label><label>Half Day Allowed<select value={settings.halfDayAllowed ? 'Yes' : 'No'} onChange={e => setSettings({ ...settings, halfDayAllowed: e.target.value === 'Yes' })}><option>Yes</option><option>No</option></select></label><label>Max Half Days / Month<input type="number" value={settings.maxHalfDaysPerMonth} onChange={e => setSettings({ ...settings, maxHalfDaysPerMonth: Number(e.target.value) })} /></label><label>Block During Exam<select value={settings.blockDuringExam ? 'Yes' : 'No'} onChange={e => setSettings({ ...settings, blockDuringExam: e.target.value === 'Yes' })}><option>No</option><option>Yes</option></select></label><label>WhatsApp Notification<select value={settings.whatsapp ? 'Yes' : 'No'} onChange={e => setSettings({ ...settings, whatsapp: e.target.value === 'Yes' })}><option>Yes</option><option>No</option></select></label></div><button className="primary-button" onClick={save}><Check size={15} /> Save Settings</button></section></div>
}

function TypeBadge({ leave, typeId }) {
  const type = typeById(leave, typeId)
  return <span className={`leave-type ${type.color || type.id?.toLowerCase()}`}>{type.id}</span>
}
function StatusBadge({ status }) {
  return <span className={`leave-status ${statusClass(status)}`}>{status || 'pending'}</span>
}
function Progress({ used, total }) {
  const rate = total ? Math.min(100, Math.round(Number(used || 0) / Number(total || 1) * 100)) : 0
  return <div className={`leave-progress ${rate > 100 ? 'over' : rate >= 80 ? 'danger' : rate >= 50 ? 'warn' : ''}`}><i style={{ width: `${Math.min(100, rate)}%` }} /><span>{used}/{total || '-'}</span></div>
}
function SummaryStrip({ items }) {
  return <section className="leave-summary-strip">{items.map(([label, value]) => <span key={label}>{label}<strong>{value}</strong></span>)}</section>
}
function SimpleTable({ headers, rows = [], empty = 'No records found.' }) {
  return <section className="panel table-panel"><div className="table-scroll"><table><thead><tr>{headers.map(header => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}{!rows.length && <tr><td colSpan={headers.length}><div className="empty-state">{empty}</div></td></tr>}</tbody></table></div></section>
}

export default function LeaveManager({ staff = {}, config = {}, leave = {}, saveLeaveItem, deleteLeaveItem, saveStaffAttendance }) {
  const safeLeave = normalizeLeave(leave)
  const staffRows = values(staff)
  const [tab, setTab] = useState('apply')
  const tabs = [['apply','Apply Leave'], ['mine','My Leaves'], ['balance','Leave Balance'], ['approvals','Approve/Reject'], ['calendar','Leave Calendar'], ['substitute','Substitute'], ['settings','Leave Settings']]
  const pending = values(safeLeave.applications).filter(row => row.status === 'pending')
  const todayLeaves = values(safeLeave.applications).filter(row => row.status === 'approved' && rangeDates(row.fromDate, row.toDate).includes(today()))
  const monthLeaves = values(safeLeave.applications).filter(row => String(row.fromDate || '').startsWith(today().slice(0, 7)))
  return <div className="leave-module"><div className="section-actions"><div><h2>Leave Management</h2><p>Apply, approve, balance, substitute and calendar tracking.</p></div></div><section className="leave-dashboard"><div><Umbrella size={20} /><span>On Leave Today</span><strong>{todayLeaves.length}</strong></div><div><UserCheck size={20} /><span>Pending Approvals</span><strong>{pending.length}</strong></div><div><CalendarCheck size={20} /><span>This Month</span><strong>{monthLeaves.length}</strong></div><div><FileText size={20} /><span>Total Requests</span><strong>{values(safeLeave.applications).length}</strong></div></section><div className="leave-tabs">{tabs.map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}</div>{tab === 'apply' && <ApplyLeave leave={safeLeave} staffRows={staffRows} config={config} saveLeaveItem={saveLeaveItem} />}{tab === 'mine' && <MyLeaves leave={safeLeave} employeeId="" saveLeaveItem={saveLeaveItem} />}{tab === 'balance' && <LeaveBalance leave={safeLeave} staffRows={staffRows} />}{tab === 'approvals' && <Approvals leave={safeLeave} staffRows={staffRows} config={config} saveLeaveItem={saveLeaveItem} saveStaffAttendance={saveStaffAttendance} />}{tab === 'calendar' && <LeaveCalendar leave={safeLeave} />}{tab === 'substitute' && <SubstitutePage leave={safeLeave} staffRows={staffRows} saveLeaveItem={saveLeaveItem} />}{tab === 'settings' && <LeaveSettings leave={safeLeave} saveLeaveItem={saveLeaveItem} />}</div>
}

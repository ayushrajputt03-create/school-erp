import React, { useEffect, useMemo, useState } from 'react'
import {
  CalendarCheck, Download, FileSpreadsheet, GraduationCap, Key, Pencil, Plus, Printer,
  Search, Trash2, Upload, UserPlus, Users,
} from 'lucide-react'
import DatePicker from './DatePicker'
import { auth } from './lib/firebase'

const employeeDbUrl = import.meta.env.VITE_FIREBASE_DATABASE_URL?.replace(/\/$/, '')

const today = () => {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}

const employeeName = employee => `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.name || 'Employee'
const values = object => Object.values(object || {}).sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
const CLASS_OPTIONS = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
const SECTION_OPTIONS = ['A', 'B', 'C', 'D']
const splitCsv = value => String(value || '').split(',').map(item => item.trim()).filter(Boolean)
// Last-10 digits — same rule staff login uses, so the uniqueness check matches login behaviour.
const phone10 = value => { const d = String(value || '').replace(/\D/g, ''); return d.length > 10 ? d.slice(-10) : d }
const toggleCsv = (value, item) => {
  const list = splitCsv(value)
  const next = list.includes(item) ? list.filter(entry => entry !== item) : [...list, item]
  return next.join(',')
}
const defaultEmployeeConfig = {
  departments: {
    dept_teacher: { id: 'dept_teacher', name: 'Teacher', order: 1 },
    dept_staff: { id: 'dept_staff', name: 'Staff', order: 2 },
    dept_worker: { id: 'dept_worker', name: 'Worker', order: 3 },
    dept_admin: { id: 'dept_admin', name: 'Admin', order: 4 },
    dept_transport: { id: 'dept_transport', name: 'Transport', order: 5 },
  },
  designations: {
    des_teacher: { id: 'des_teacher', departmentId: 'dept_teacher', name: 'Teacher', order: 1 },
    des_class_teacher: { id: 'des_class_teacher', departmentId: 'dept_teacher', name: 'Class Teacher', order: 2 },
    des_principal: { id: 'des_principal', departmentId: 'dept_admin', name: 'Principal', order: 1 },
    des_accountant: { id: 'des_accountant', departmentId: 'dept_staff', name: 'Accountant', order: 1 },
    des_receptionist: { id: 'des_receptionist', departmentId: 'dept_staff', name: 'Receptionist', order: 2 },
    des_worker: { id: 'des_worker', departmentId: 'dept_worker', name: 'Worker', order: 1 },
    des_guard: { id: 'des_guard', departmentId: 'dept_worker', name: 'Security Guard', order: 2 },
    des_driver: { id: 'des_driver', departmentId: 'dept_transport', name: 'Driver', order: 1 },
    des_conductor: { id: 'des_conductor', departmentId: 'dept_transport', name: 'Conductor', order: 2 },
  },
  shifts: {},
}
const withDefaultEmployeeConfig = config => ({
  departments: { ...defaultEmployeeConfig.departments, ...(config?.departments || {}) },
  designations: { ...defaultEmployeeConfig.designations, ...(config?.designations || {}) },
  shifts: { ...defaultEmployeeConfig.shifts, ...(config?.shifts || {}) },
})

function ActionButtons({ edit, remove }) {
  return <div className="action-cell">
    <button className="icon-button" onClick={edit} title="Edit"><Pencil size={14} /></button>
    <button className="icon-button danger" onClick={remove} title="Delete"><Trash2 size={14} /></button>
  </div>
}

function MasterTable({ columns, rows, empty = 'No records found' }) {
  return <div className="panel table-panel"><div className="table-scroll"><table><thead><tr>
    <th>#</th><th>Actions</th>{columns.map(column => <th key={column.key}>{column.label}</th>)}
  </tr></thead><tbody>
    {rows.map((row, index) => <tr key={row.id}><td>{index + 1}</td><td>{row.actions}</td>{columns.map(column => <td key={column.key}>{column.render ? column.render(row) : row[column.key] || '—'}</td>)}</tr>)}
    {!rows.length && <tr><td colSpan={columns.length + 2}><div className="empty-state">{empty}</div></td></tr>}
  </tbody></table></div></div>
}

function DepartmentPage({ config, saveConfig, deleteConfig }) {
  const [tab, setTab] = useState('departments')
  const [editing, setEditing] = useState(null)
  const blank = tab === 'departments'
    ? { name: '', order: '' }
    : tab === 'designations'
      ? { departmentId: '', name: '', order: '' }
      : { title: '', fromTime: '', midTime: '', toTime: '' }
  const [form, setForm] = useState(blank)
  const departments = values(config.departments)
  const reset = nextTab => {
    const target = nextTab || tab
    setEditing(null)
    setForm(target === 'departments' ? { name: '', order: '' } : target === 'designations' ? { departmentId: '', name: '', order: '' } : { title: '', fromTime: '', midTime: '', toTime: '' })
  }
  const changeTab = next => { setTab(next); reset(next) }
  const submit = async event => {
    event.preventDefault()
    await saveConfig(tab, { ...form, id: editing?.id })
    reset()
  }
  const beginEdit = row => { setEditing(row); setForm({ ...row }) }
  const remove = async row => {
    if (window.confirm('Delete this record?')) await deleteConfig(tab, row.id)
  }
  const tabs = [['departments', 'Department'], ['designations', 'Designation'], ['shifts', 'Biometric Timing']]
  const currentRows = values(config[tab]).map(row => ({ ...row, actions: <ActionButtons edit={() => beginEdit(row)} remove={() => remove(row)} /> }))
  const departmentName = id => config.departments?.[id]?.name || '—'
  const designationNames = departmentId => values(config.designations).filter(item => item.departmentId === departmentId).map(item => item.name).join(', ') || '—'
  const columns = tab === 'departments'
    ? [{ key: 'name', label: 'Department' }, { key: 'designations', label: 'Included Designation', render: row => designationNames(row.id) }, { key: 'order', label: 'Order No' }]
    : tab === 'designations'
      ? [{ key: 'name', label: 'Designation' }, { key: 'department', label: 'Department', render: row => departmentName(row.departmentId) }, { key: 'order', label: 'Order No' }]
      : [{ key: 'title', label: 'Title' }, { key: 'fromTime', label: 'From Time' }, { key: 'midTime', label: 'Mid Time' }, { key: 'toTime', label: 'To Time' }]
  return <>
    <div className="sub-tabs employee-subtabs">{tabs.map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => changeTab(id)}>{label}</button>)}</div>
    <form className="panel employee-master-form" onSubmit={submit}>
      {tab === 'departments' && <>
        <label>Department Name*<input required value={form.name || ''} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
        <label>Order*<input required type="number" min="1" value={form.order || ''} onChange={event => setForm({ ...form, order: event.target.value })} /></label>
      </>}
      {tab === 'designations' && <>
        <label>Select Department*<select required value={form.departmentId || ''} onChange={event => setForm({ ...form, departmentId: event.target.value })}><option value="">Select department</option>{departments.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Designation*<input required value={form.name || ''} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
        <label>Order*<input required type="number" min="1" value={form.order || ''} onChange={event => setForm({ ...form, order: event.target.value })} /></label>
      </>}
      {tab === 'shifts' && <>
        <label>Title*<input required value={form.title || ''} onChange={event => setForm({ ...form, title: event.target.value })} /></label>
        <label>From Time*<input required type="time" value={form.fromTime || ''} onChange={event => setForm({ ...form, fromTime: event.target.value })} /></label>
        <label>Mid Time<input type="time" value={form.midTime || ''} onChange={event => setForm({ ...form, midTime: event.target.value })} /></label>
        <label>To Time*<input required type="time" value={form.toTime || ''} onChange={event => setForm({ ...form, toTime: event.target.value })} /></label>
      </>}
      <div className="employee-form-actions">
        {editing && <button type="button" className="secondary-button" onClick={() => reset()}>Cancel</button>}
        {tab === 'shifts' && <button type="button" className="secondary-button"><Users size={15} /> Bulk Assign Shift</button>}
        <button className="employee-add-button"><Plus size={15} /> {editing ? 'Update' : 'Add'}</button>
      </div>
    </form>
    <MasterTable columns={columns} rows={currentRows} />
  </>
}

function EmployeeForm({ staff, config, saveEmployee, initial, cancelEdit, onSaved }) {
  const nextCode = useMemo(() => {
    const highest = Math.max(0, ...values(staff).map(item => Number(String(item.employeeCode || '').match(/\d+/)?.[0] || 0)))
    return `EMP${String(highest + 1).padStart(3, '0')}`
  }, [staff])
  const departments = values(config.departments)
  const [form, setForm] = useState(initial || {
    employeeCode: nextCode, firstName: '', lastName: '', fatherName: '', motherName: '',
    gender: '', dob: '', phone: '', email: '', departmentId: '', designationId: '',
    joiningDate: today(), salary: '', address: '', aadhaar: '', photo: null,
  })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [photoPreview, setPhotoPreview] = useState(initial?.photoUrl || '')
  const designations = values(config.designations).filter(item => !form.departmentId || item.departmentId === form.departmentId)
  const isTeacherDept = (config.departments?.[form.departmentId]?.name || '').toLowerCase().includes('teacher')
    || (config.designations?.[form.designationId]?.name || '').toLowerCase().includes('teacher')
  const field = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const [teacherCreating, setTeacherCreating] = useState(false)
  const [teacherMsg, setTeacherMsg] = useState('')
  const createTeacherLogin = async () => {
    const phone = (form.phone || '').replace(/\D/g, '')
    if (phone.length < 10) { setTeacherMsg('Employee mobile number is required (min 10 digits).'); return }
    const dob = form.dob || form.dateOfBirth || ''
    if (!dob) { setTeacherMsg('Date of birth is required to create teacher login (used as password).'); return }
    const d = new Date(dob); if (isNaN(d)) { setTeacherMsg('Invalid date of birth.'); return }
    const dd = String(d.getDate()).padStart(2, '0'), mm = String(d.getMonth() + 1).padStart(2, '0'), yyyy = d.getFullYear()
    const password = `${dd}${mm}${yyyy}`
    setTeacherCreating(true); setTeacherMsg('')
    try {
      const token = await auth.currentUser.getIdToken()
      const schoolId = auth.currentUser.uid
      const codeResponse = await fetch(`${employeeDbUrl}/schools/${schoolId}/profile/schoolCode.json?auth=${token}`)
      const schoolCode = codeResponse.ok ? await codeResponse.json() : null
      if (!schoolCode) { setTeacherMsg('Error: School code not found in school profile. Open Settings and save the profile once.'); setTeacherCreating(false); return }
      const syntheticEmail = `${phone}@${String(schoolCode).trim().toLowerCase()}.teacher.schoolerp.app`
      const name = `${form.firstName || ''} ${form.lastName || ''}`.trim()
      const classes = (form.assignedClasses || '').split(',').map(c => c.trim()).filter(Boolean)
      const sections = (form.assignedSections || '').split(',').map(s => s.trim()).filter(Boolean)
      const res = await fetch('/api/create-teacher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ schoolId, email: syntheticEmail, password, teacherData: {
          name, firstName: form.firstName, lastName: form.lastName, phone: form.phone, email: form.email?.trim() || '',
          subject: form.subject || '', classes, sections, department: 'Teacher',
          designation: config.designations?.[form.designationId]?.name || 'Teacher',
          employeeCode: form.employeeCode || initial?.employeeCode || '', photoUrl: form.photoUrl || '',
          joiningDate: form.joiningDate || '', dob,
        } }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setTeacherMsg(`Teacher login created! School Code: ${schoolCode}, Mobile: ${phone}, Password: DOB (${dd}/${mm}/${yyyy}). Login at /teacher/login`)
    } catch (err) { setTeacherMsg('Error: ' + err.message) }
    finally { setTeacherCreating(false) }
  }
  useEffect(() => {
    if (!form.photo) {
      setPhotoPreview(form.photoUrl || '')
      return undefined
    }
    const previewUrl = URL.createObjectURL(form.photo)
    setPhotoPreview(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [form.photo, form.photoUrl])
  const choosePhoto = event => {
    const file = event.target.files?.[0] || null
    event.target.value = ''
    if (!file) return
    if (!/^image\/(jpe?g|png|webp)$/i.test(file.type || '')) {
      setError('Please choose a valid employee photo: JPG, PNG or WEBP.')
      return
    }
    setError('')
    field('photo', file)
  }
  const removePhoto = event => {
    event?.preventDefault()
    event?.stopPropagation()
    setForm(current => ({ ...current, photo: null, photoUrl: '', photoPath: '' }))
    setPhotoPreview('')
  }
  const submit = async event => {
    event.preventDefault()
    // Duplicate-phone guard: warn if another staff member already uses this mobile (last-10 match).
    const newPhone = phone10(form.phone)
    if (newPhone.length === 10) {
      const dup = Object.entries(staff || {}).find(([id, e]) => id !== (initial?.id || form.id) && phone10(e.phone) === newPhone)
      if (dup) {
        const dupName = `${dup[1].firstName || ''} ${dup[1].lastName || ''}`.trim() || dup[1].employeeCode || 'Existing employee'
        if (!window.confirm(`An employee with this phone number already exists: ${dupName}. Do you want to continue anyway?`)) return
      }
    }
    setSaving(true)
    setError('')
    try {
      const code = await saveEmployee({ ...form, id: initial?.id })
      setMessage(`${code} ${initial ? 'updated' : 'created'} successfully.`)
      if (initial) {
        cancelEdit()
        return
      }
      setForm({ employeeCode: `EMP${String(Number(code.replace(/\D/g, '')) + 1).padStart(3, '0')}`, firstName: '', lastName: '', fatherName: '', motherName: '', gender: '', dob: '', phone: '', email: '', departmentId: '', designationId: '', joiningDate: today(), salary: '', address: '', aadhaar: '', photo: null })
      setTimeout(() => onSaved?.(), 450)
    } catch (saveError) {
      console.error('Employee save failed', saveError)
      setError(saveError.message || 'Employee data could not be saved. Please retry.')
    } finally {
      setSaving(false)
    }
  }
  return <form className="panel employee-detail-form" onSubmit={submit}>
    <div className="panel-header"><div><h3>{initial ? 'Edit Employee' : 'Add Employee'}</h3><p>{initial ? 'Update employee profile and payroll details.' : 'Create an employee profile and payroll record.'}</p></div><UserPlus size={20} /></div>
    <div className="employee-fields">
      <label>Employee Code<input readOnly value={form.employeeCode} /></label>
      <label>First Name*<input required value={form.firstName} onChange={e => field('firstName', e.target.value)} /></label>
      <label>Last Name*<input required value={form.lastName} onChange={e => field('lastName', e.target.value)} /></label>
      <label>Father Name<input value={form.fatherName} onChange={e => field('fatherName', e.target.value)} /></label>
      <label>Mother Name<input value={form.motherName} onChange={e => field('motherName', e.target.value)} /></label>
      <label>Gender<select required value={form.gender} onChange={e => field('gender', e.target.value)}><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select></label>
      <label>Date of Birth<DatePicker value={form.dob} onChange={value => field('dob', value)} max={today()} /></label>
      <label>Phone*<input required inputMode="tel" value={form.phone} onChange={e => field('phone', e.target.value)} /></label>
      <label>Email<input type="email" value={form.email} onChange={e => field('email', e.target.value)} /></label>
      <label>Department*<select required value={form.departmentId} onChange={e => setForm({ ...form, departmentId: e.target.value, designationId: '' })}><option value="">Select department</option>{departments.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Designation*<select required value={form.designationId} onChange={e => field('designationId', e.target.value)}><option value="">Select designation</option>{designations.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Joining Date*<DatePicker required value={form.joiningDate} onChange={value => field('joiningDate', value)} /></label>
      <label>Salary<input type="number" min="0" value={form.salary} onChange={e => field('salary', e.target.value)} /></label>
      <label>Aadhaar Card<input value={form.aadhaar} onChange={e => field('aadhaar', e.target.value)} /></label>
      <label className="employee-address">Address<textarea value={form.address} onChange={e => field('address', e.target.value)} /></label>
      <label className="employee-photo">Photo upload<input type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} /><span>{photoPreview ? <img src={photoPreview} alt="Employee preview" /> : <Upload size={17} />}{form.photo?.name || (photoPreview ? 'Change employee photo' : 'Choose employee photo')}</span>{photoPreview && <button type="button" onClick={removePhoto}>Remove photo</button>}</label>
      {isTeacherDept && <>
        <label>Subject<input value={form.subject || ''} onChange={e => field('subject', e.target.value)} placeholder="e.g. Mathematics" /></label>
        <div className="employee-allot-group">
          <span className="employee-allot-label">Allot Classes</span>
          <div className="employee-allot-chips">
            {CLASS_OPTIONS.map(cls => {
              const selected = splitCsv(form.assignedClasses).includes(cls)
              return <button type="button" key={cls} className={`allot-chip${selected ? ' selected' : ''}`}
                onClick={() => field('assignedClasses', toggleCsv(form.assignedClasses, cls))}>{cls}</button>
            })}
          </div>
        </div>
        <div className="employee-allot-group">
          <span className="employee-allot-label">Allot Sections</span>
          <div className="employee-allot-chips">
            {SECTION_OPTIONS.map(sec => {
              const selected = splitCsv(form.assignedSections).includes(sec)
              return <button type="button" key={sec} className={`allot-chip${selected ? ' selected' : ''}`}
                onClick={() => field('assignedSections', toggleCsv(form.assignedSections, sec))}>{sec}</button>
            })}
          </div>
        </div>
      </>}
    </div>
    {isTeacherDept && <div className="teacher-login-section">
      <button type="button" className="secondary-button" onClick={createTeacherLogin} disabled={teacherCreating}><Key size={14} /> {teacherCreating ? 'Creating...' : 'Create Teacher Login'}</button>
      {teacherMsg && <small className={teacherMsg.startsWith('Error') ? 'photo-error' : 'compression-info'}>{teacherMsg}</small>}
    </div>}
    {message && <div className="success-banner">{message}</div>}
    {error && <div className="form-error employee-save-error">{error}</div>}
    <div className="employee-submit">{initial && <button type="button" className="secondary-button" onClick={cancelEdit}>Cancel</button>}<button className="primary-button" disabled={saving}><UserPlus size={15} /> {saving ? 'Saving...' : initial ? 'Update Employee' : 'Submit Employee'}</button></div>
  </form>
}

function EmployeeRegister({ staff, config, deleteEmployee, openAdd, editEmployee }) {
  const [searchBy, setSearchBy] = useState('All')
  const [query, setQuery] = useState('')
  const departmentName = id => config.departments?.[id]?.name || '—'
  const designationName = id => config.designations?.[id]?.name || '—'
  const rows = values(staff).filter(employee => {
    if (!query.trim()) return true
    const fields = searchBy === 'By Name' ? employeeName(employee) : searchBy === 'By Employee Code' ? employee.employeeCode : searchBy === 'By Email' ? employee.email : searchBy === 'By Mobile' ? employee.phone : searchBy === 'By Department' ? departmentName(employee.departmentId) : Object.values(employee).join(' ')
    return String(fields || '').toLowerCase().includes(query.trim().toLowerCase())
  })
  return <>
    <div className="panel employee-toolbar">
      <label>Search By<select value={searchBy} onChange={e => setSearchBy(e.target.value)}>{['All','By Name','By Employee Code','By Email','By Mobile','By Department'].map(item => <option key={item}>{item}</option>)}</select></label>
      <div className="table-search"><Search size={15} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search employee" /></div>
      <button className="primary-button" onClick={openAdd}><Plus size={15} /> Add Employee</button>
    </div>
    <MasterTable columns={[
      { key: 'name', label: 'Name', render: row => <div className="employee-name-cell">{row.photoUrl ? <img src={row.photoUrl} alt="" /> : <span>{employeeName(row).split(/\s+/).map(part => part[0]).slice(0, 2).join('')}</span>}<div><strong>{employeeName(row)}</strong><small>{row.email || row.phone}</small></div></div> },
      { key: 'employeeCode', label: 'Emp Code' }, { key: 'joiningDate', label: 'Joining Date' },
      { key: 'role', label: 'Employee Role', render: row => designationName(row.designationId) },
      { key: 'classTeacher', label: 'Class Teacher', render: row => row.classTeacher || 'No' },
      { key: 'assignedClasses', label: 'Assigned Classes', render: row => row.assignedClasses || '—' },
    ]} rows={rows.map(row => ({ ...row, actions: <ActionButtons edit={() => editEmployee(row)} remove={() => window.confirm(`Delete ${employeeName(row)}?`) && deleteEmployee(row)} /> }))} empty="No employees found" />
  </>
}

function AttendancePage({ staff, attendance, saveAttendance }) {
  const [tab, setTab] = useState('manual')
  const [date, setDate] = useState(today())
  const [marks, setMarks] = useState(attendance[date] || {})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  const isPastDate = date < today()
  const currentDayRecord = attendance[date] || {}
  const auditInfo = currentDayRecord._editedAt
    ? `Last edited ${new Date(currentDayRecord._editedAt).toLocaleString('en-IN')}${currentDayRecord._editedBy ? ` by ${currentDayRecord._editedBy}` : ''}`
    : null

  const changeDate = value => {
    setDate(value)
    setMarks(attendance[value] || {})
    setSaved(false)
    setSaveError('')
  }

  useEffect(() => {
    setMarks(attendance[date] || {})
  }, [attendance, date])

  const employees = values(staff)

  const save = async () => {
    if (saving) return
    setSaving(true)
    setSaved(false)
    setSaveError('')
    try {
      await saveAttendance(date, marks, { isPastEdit: isPastDate })
      setSaved(true)
      setTimeout(() => setSaved(false), 4000)
    } catch (error) {
      setSaveError(error?.message || 'Failed to save attendance. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return <>
    <div className="sub-tabs employee-subtabs"><button className={tab === 'manual' ? 'active' : ''} onClick={() => setTab('manual')}>Manual Attendance</button><button className={tab === 'biometric' ? 'active' : ''} onClick={() => setTab('biometric')}>Biometric Attendance</button></div>
    {tab === 'biometric' ? <div className="panel biometric-empty"><CalendarCheck size={30} /><strong>Biometric attendance ready</strong><p>Attendance imported from configured biometric shifts will appear here.</p></div> : <>
      <div className="panel employee-toolbar attendance-toolbar">
        <label>Date<DatePicker value={date} onChange={changeDate} max={today()} /></label>
        <button className="secondary-button" onClick={() => setMarks(Object.fromEntries(employees.map(item => [item.id, 'P'])))}>Mark all present</button>
        <button className={`primary-button${saving ? ' disabled' : ''}`} onClick={save} disabled={saving}>
          {saving ? 'Saving...' : isPastDate ? '✎ Update Record' : 'Save Attendance'}
        </button>
      </div>
      {isPastDate && <div className="past-edit-banner"><CalendarCheck size={14} /><div><strong>Editing past attendance record — {date}</strong><span>Changes will update the existing record for this date.{auditInfo ? ` · ${auditInfo}` : ''}</span></div></div>}
      {saved && <div className="success-banner">✓ {isPastDate ? `Attendance record for ${date} updated successfully.` : `Employee attendance saved for ${date}.`}</div>}
      {saveError && <div className="error-banner">✕ {saveError}</div>}
      <div className="panel table-panel"><div className="table-scroll"><table><thead><tr><th>#</th><th>Name</th><th>Attendance Status</th><th>Emp Code</th><th>Present / Absent / Leave / Half Day</th></tr></thead><tbody>
        {employees.map((employee, index) => <tr key={employee.id}><td>{index + 1}</td><td><strong>{employeeName(employee)}</strong></td><td><span className={`employee-mark status-${marks[employee.id] || 'none'}`}>{marks[employee.id] || 'Not marked'}</span></td><td>{employee.employeeCode}</td><td><div className="employee-mark-control">{[['P','Present'],['A','Absent'],['L','Leave'],['HD','Half Day']].map(([code, label]) => <button key={code} className={marks[employee.id] === code ? `active ${code}` : ''} onClick={() => setMarks({ ...marks, [employee.id]: code })}>{label}</button>)}</div></td></tr>)}
        {!employees.length && <tr><td colSpan="5"><div className="empty-state">Add employees before marking attendance.</div></td></tr>}
      </tbody></table></div></div>
    </>}
  </>
}


function AttendanceReport({ staff, attendance }) {
  const [searchType, setSearchType] = useState('Month')
  const [month, setMonth] = useState(today().slice(0, 7))
  const [from, setFrom] = useState(today())
  const [to, setTo] = useState(today())
  const [order, setOrder] = useState('Employee Code')
  const dates = Object.keys(attendance).filter(date => searchType === 'Month' ? date.startsWith(month) : date >= from && date <= to).sort()
  const rows = values(staff).map(employee => {
    const marks = dates.map(date => attendance[date]?.[employee.id]).filter(Boolean)
    return { ...employee, present: marks.filter(mark => mark === 'P').length, absent: marks.filter(mark => mark === 'A').length, leave: marks.filter(mark => mark === 'L').length, halfDay: marks.filter(mark => mark === 'HD').length }
  }).sort((a, b) => order === 'Employee Name' ? employeeName(a).localeCompare(employeeName(b)) : String(a.employeeCode).localeCompare(String(b.employeeCode)))
  const exportCsv = () => {
    const lines = [['Employee Code','Employee Name','Present','Absent','Leave','Half Day'], ...rows.map(row => [row.employeeCode, employeeName(row), row.present, row.absent, row.leave, row.halfDay])]
    const blob = new Blob([lines.map(line => line.join(',')).join('\n')], { type: 'text/csv' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob); link.download = `employee-attendance-${searchType === 'Month' ? month : `${from}-${to}`}.csv`; link.click(); URL.revokeObjectURL(link.href)
  }
  return <>
    <div className="panel report-filters">
      <label>Type of Report<select><option>Employee Att. Report</option></select></label>
      <label>Search Type<select value={searchType} onChange={e => setSearchType(e.target.value)}><option>Month</option><option>Date Range</option></select></label>
      {searchType === 'Month' ? <label>Month<input type="month" value={month} onChange={e => setMonth(e.target.value)} /></label> : <><label>From Date<DatePicker value={from} onChange={setFrom} /></label><label>To Date<DatePicker min={from} value={to} onChange={setTo} /></label></>}
      <label>Order By<select value={order} onChange={e => setOrder(e.target.value)}><option>Employee Code</option><option>Employee Name</option></select></label>
      <div className="report-actions"><button className="secondary-button" onClick={() => window.print()}><Printer size={15} /> Print</button><button className="primary-button" onClick={exportCsv}><Download size={15} /> Export</button></div>
    </div>
    <MasterTable columns={[{ key: 'employeeCode', label: 'Emp Code' }, { key: 'name', label: 'Employee Name', render: employeeName }, { key: 'present', label: 'Present' }, { key: 'absent', label: 'Absent' }, { key: 'leave', label: 'Leave' }, { key: 'halfDay', label: 'Half Day' }]} rows={rows.map(row => ({ ...row, actions: <FileSpreadsheet size={15} /> }))} />
  </>
}

export default function EmployeeManager({ staff, attendance, config, saveConfig, deleteConfig, saveEmployee, deleteEmployee, saveAttendance }) {
  const [page, setPage] = useState('register')
  const [editingEmployee, setEditingEmployee] = useState(null)
  const effectiveConfig = withDefaultEmployeeConfig(config)
  const menu = [
    ['add', 'Add Employee', UserPlus], ['register', 'Employee Register', Users],
    ['department', 'Add Department', Plus], ['attendance', 'Attendance', CalendarCheck],
    ['report', 'Employee Attendance', FileSpreadsheet],
  ]
  return <>
    <div className="employee-page-tabs">{menu.map(([id, label, Icon]) => <button key={id} className={page === id ? 'active' : ''} onClick={() => setPage(id)}><Icon size={15} />{label}</button>)}</div>
    {page === 'add' && <EmployeeForm key={editingEmployee?.id || 'new'} staff={staff} config={effectiveConfig} saveEmployee={saveEmployee} initial={editingEmployee} cancelEdit={() => { setEditingEmployee(null); setPage('register') }} onSaved={() => { setEditingEmployee(null); setPage('register') }} />}
    {page === 'register' && <EmployeeRegister staff={staff} config={effectiveConfig} deleteEmployee={deleteEmployee} openAdd={() => { setEditingEmployee(null); setPage('add') }} editEmployee={employee => { setEditingEmployee(employee); setPage('add') }} />}
    {page === 'department' && <DepartmentPage config={effectiveConfig} saveConfig={saveConfig} deleteConfig={deleteConfig} />}
    {page === 'attendance' && <AttendancePage staff={staff} attendance={attendance} saveAttendance={saveAttendance} />}
    {page === 'report' && <AttendanceReport staff={staff} attendance={attendance} />}
  </>
}

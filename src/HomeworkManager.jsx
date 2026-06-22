import React, { useMemo, useState } from 'react'
import {
  CalendarDays, Check, Download, Edit3, Eye, FileText, Paperclip,
  Plus, Search, Trash2, Upload,
} from 'lucide-react'
import DatePicker from './DatePicker'

const subjects = ['Mathematics', 'Science', 'English', 'Hindi', 'Social Studies', 'Computer']
const priorities = ['Normal', 'Important', 'Urgent']
const today = () => {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}
const dateLabel = value => value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '-'
const classParts = value => {
  const raw = String(value || '').trim()
  const match = raw.match(/^(.+?)\s*[-/]\s*([A-Za-z0-9]+)$/)
  if (match) return { className: match[1].trim(), section: match[2].trim() }
  return { className: raw, section: '' }
}
const values = object => Object.values(object || {}).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
const subjectKey = subject => String(subject || '').toLowerCase().replace(/\s+/g, '-')
const statusOf = item => item.completed ? 'Completed' : 'Pending'
const isOverdue = item => !item.completed && item.dueDate && item.dueDate < today()

function classOptions(students) {
  return [...new Set(students.map(student => classParts(student.className).className).filter(Boolean))]
}

function sectionOptions(students) {
  return [...new Set(students.map(student => classParts(student.className).section).filter(Boolean))]
}

function emptyForm() {
  return {
    className: '',
    section: '',
    subject: 'Mathematics',
    title: '',
    description: '',
    dueDate: today(),
    priority: 'Normal',
    attachment: null,
  }
}

function HomeworkCard({ item, selected, onSelect, onEdit, onDelete, onDone, readOnly = false, onSeen }) {
  const overdue = isOverdue(item)
  return <article className={`homework-card subject-${subjectKey(item.subject)} ${overdue ? 'overdue' : ''}`}>
    {!readOnly && <label className="homework-select"><input type="checkbox" checked={selected} onChange={event => onSelect(item.id, event.target.checked)} /></label>}
    <div className="homework-card-head">
      <span className="subject-chip">{item.subject}</span>
      <span className={`priority-badge ${String(item.priority).toLowerCase()}`}>{overdue ? 'Overdue' : item.priority}</span>
    </div>
    <h3>{item.title}</h3>
    <p>{item.description}</p>
    {item.attachmentURL && <a className="homework-attachment" href={item.attachmentURL} target="_blank" rel="noreferrer"><Paperclip size={14} /> {item.attachmentName || 'Attachment'}</a>}
    <div className="homework-meta">
      <span>Class: {item.className}-{item.section}</span>
      <span>Due: {dateLabel(item.dueDate)}</span>
      <span>Posted by: {item.postedBy || 'Admin'}</span>
      <span>Status: {statusOf(item)}</span>
    </div>
    <div className="homework-actions">
      {readOnly ? <>
        {item.attachmentURL && <a className="secondary-button" href={item.attachmentURL} target="_blank" rel="noreferrer"><Download size={14} /> Download</a>}
        <button className="primary-button" onClick={() => onSeen(item)}><Eye size={14} /> Seen</button>
      </> : <>
        <button className="secondary-button" onClick={() => onEdit(item)}><Edit3 size={14} /> Edit</button>
        <button className="secondary-button danger" onClick={() => onDelete(item)}><Trash2 size={14} /> Delete</button>
        <button className="primary-button" onClick={() => onDone(item)}><Check size={14} /> {item.completed ? 'Mark Pending' : 'Mark Done'}</button>
      </>}
    </div>
  </article>
}

function CalendarView({ rows }) {
  const [month, setMonth] = useState(today().slice(0, 7))
  const [selectedDate, setSelectedDate] = useState(today())
  const first = new Date(`${month}-01T00:00:00`)
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const startOffset = first.getDay()
  const cells = Array.from({ length: startOffset + daysInMonth }, (_, index) => index < startOffset ? null : `${month}-${String(index - startOffset + 1).padStart(2, '0')}`)
  const byDate = rows.reduce((map, item) => {
    map[item.dueDate] ||= []
    map[item.dueDate].push(item)
    return map
  }, {})
  return <div className="homework-calendar-wrap">
    <div className="panel homework-calendar">
      <div className="calendar-toolbar">
        <button onClick={() => {
          const date = new Date(`${month}-01T00:00:00`)
          date.setMonth(date.getMonth() - 1)
          setMonth(date.toISOString().slice(0, 7))
        }}>‹</button>
        <strong>{first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</strong>
        <button onClick={() => {
          const date = new Date(`${month}-01T00:00:00`)
          date.setMonth(date.getMonth() + 1)
          setMonth(date.toISOString().slice(0, 7))
        }}>›</button>
      </div>
      <div className="calendar-weekdays">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day => <span key={day}>{day}</span>)}</div>
      <div className="calendar-grid">{cells.map((date, index) => <button key={`${date || 'empty'}-${index}`} className={date === selectedDate ? 'active' : ''} disabled={!date} onClick={() => setSelectedDate(date)}>
        {date && <><strong>{Number(date.slice(-2))}</strong><div>{(byDate[date] || []).slice(0, 4).map(item => <i key={item.id} className={`subject-${subjectKey(item.subject)}`} />)}</div></>}
      </button>)}</div>
    </div>
    <div className="panel homework-day-list">
      <h3>{dateLabel(selectedDate)}</h3>
      {(byDate[selectedDate] || []).map(item => <div key={item.id}><strong>{item.subject}</strong><span>{item.title}</span><small>{item.className}-{item.section}</small></div>)}
      {!byDate[selectedDate]?.length && <p>No homework due this day.</p>}
    </div>
  </div>
}

export default function HomeworkManager({ students = [], homework = {}, saveHomework, deleteHomework, markHomeworkDone, markHomeworkSeen, profile }) {
  const [tab, setTab] = useState('post')
  const [view, setView] = useState('list')
  const [form, setForm] = useState(emptyForm())
  const [editing, setEditing] = useState(null)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState({})
  const [filters, setFilters] = useState({ className: '', section: '', subject: '', from: '', to: '', status: 'All', query: '', studentId: '' })
  const rows = values(homework)
  const filteredRows = useMemo(() => rows.filter(item => {
    const query = filters.query.trim().toLowerCase()
    const statusOk = filters.status === 'All' || statusOf(item) === filters.status
    return (!filters.className || item.className === filters.className)
      && (!filters.section || item.section === filters.section)
      && (!filters.subject || item.subject === filters.subject)
      && (!filters.from || item.dueDate >= filters.from)
      && (!filters.to || item.dueDate <= filters.to)
      && statusOk
      && (!query || `${item.title} ${item.subject} ${item.description}`.toLowerCase().includes(query))
  }), [rows, filters])
  const selectedStudent = students.find(student => student.id === filters.studentId) || students[0]
  const parentRows = selectedStudent ? rows.filter(item => {
    const parts = classParts(selectedStudent.className)
    return item.className === parts.className && item.section === parts.section
  }).sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate))) : []
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - 7)
  const weekly = rows.filter(item => Number(item.createdAt || 0) >= weekStart.getTime())
  const subjectCounts = rows.reduce((map, item) => ({ ...map, [item.subject]: (map[item.subject] || 0) + 1 }), {})
  const mostActive = Object.entries(subjectCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '-'

  const submit = async event => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      await saveHomework({ ...form, id: editing?.id, createdAt: editing?.createdAt, postedBy: profile?.name || 'Admin' })
      setMessage(editing ? 'Homework updated successfully.' : 'Homework posted successfully.')
      setEditing(null)
      setForm(emptyForm())
      setTab('list')
    } catch (error) {
      setMessage(`Error: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }
  const edit = item => {
    setEditing(item)
    setForm({ ...item, attachment: null })
    setTab('post')
  }
  const bulkDelete = async () => {
    const ids = Object.entries(selected).filter(([, checked]) => checked).map(([id]) => id)
    if (!ids.length || !window.confirm(`Delete ${ids.length} homework item(s)?`)) return
    await Promise.all(ids.map(id => deleteHomework(rows.find(item => item.id === id))))
    setSelected({})
  }

  return <div className="homework-module">
    <div className="section-actions"><div><h2>Homework</h2><p>Post assignments, track completion and keep parents updated.</p></div><div className="homework-view-toggle"><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>List View</button><button className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}>Calendar View</button></div></div>
    <div className="homework-tabs">{[['post','Post Homework'], ['list','Homework List'], ['parent','Student / Parent View']].map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}</div>
    <section className="homework-stats">
      <div><span>This week</span><strong>{weekly.length}</strong></div>
      <div><span>Pending</span><strong>{rows.filter(item => !item.completed).length}</strong></div>
      <div><span>Completed</span><strong>{rows.filter(item => item.completed).length}</strong></div>
      <div><span>Most active</span><strong>{mostActive}</strong></div>
    </section>
    {tab === 'post' && <form className="panel homework-form" onSubmit={submit}>
      <div className="panel-header"><div><h3>{editing ? 'Edit Homework' : 'Post Homework'}</h3><p>Attachment supports PDF or image up to 5MB.</p></div></div>
      <div className="form-grid">
        <label>Select Class*<select required value={form.className} onChange={event => setForm({ ...form, className: event.target.value })}><option value="">Select Class</option>{classOptions(students).map(item => <option key={item}>{item}</option>)}</select></label>
        <label>Select Section*<select required value={form.section} onChange={event => setForm({ ...form, section: event.target.value })}><option value="">Select Section</option>{sectionOptions(students).map(item => <option key={item}>{item}</option>)}</select></label>
        <label>Subject*<select required value={form.subject} onChange={event => setForm({ ...form, subject: event.target.value })}>{subjects.map(item => <option key={item}>{item}</option>)}</select></label>
        <label>Due Date*<DatePicker value={form.dueDate} onChange={value => setForm({ ...form, dueDate: value })} /></label>
        <label>Priority<select value={form.priority} onChange={event => setForm({ ...form, priority: event.target.value })}>{priorities.map(item => <option key={item}>{item}</option>)}</select></label>
        <label className="full">Homework Title*<input required value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="Chapter 5 - Exercise 5.2" /></label>
        <label className="full">Description*<textarea required value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="Complete all questions and submit notebook tomorrow." /></label>
        <label className="homework-file full">Attachment<input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={event => setForm({ ...form, attachment: event.target.files?.[0] || null })} /><span><Upload size={16} /> {form.attachment?.name || form.attachmentName || 'Optional PDF/Image'}</span></label>
      </div>
      {message && <div className={message.startsWith('Error') ? 'form-error' : 'success-banner'}>{message}</div>}
      <div className="modal-actions">{editing && <button type="button" className="secondary-button" onClick={() => { setEditing(null); setForm(emptyForm()) }}>Cancel</button>}<button className="primary-button" disabled={saving}><Plus size={15} /> {saving ? 'Saving...' : editing ? 'Update Homework' : 'Post Homework'}</button></div>
    </form>}
    {tab === 'list' && <>
      <section className="panel homework-filters">
        <label>Select Class<select value={filters.className} onChange={event => setFilters({ ...filters, className: event.target.value })}><option value="">All</option>{classOptions(students).map(item => <option key={item}>{item}</option>)}</select></label>
        <label>Select Section<select value={filters.section} onChange={event => setFilters({ ...filters, section: event.target.value })}><option value="">All</option>{sectionOptions(students).map(item => <option key={item}>{item}</option>)}</select></label>
        <label>Subject<select value={filters.subject} onChange={event => setFilters({ ...filters, subject: event.target.value })}><option value="">All</option>{subjects.map(item => <option key={item}>{item}</option>)}</select></label>
        <label>From<DatePicker value={filters.from} onChange={value => setFilters({ ...filters, from: value })} /></label>
        <label>To<DatePicker value={filters.to} onChange={value => setFilters({ ...filters, to: value })} /></label>
        <label>Status<select value={filters.status} onChange={event => setFilters({ ...filters, status: event.target.value })}><option>All</option><option>Pending</option><option>Completed</option></select></label>
        <div className="table-search"><Search size={15} /><input value={filters.query} onChange={event => setFilters({ ...filters, query: event.target.value })} placeholder="Search by title or subject" /></div>
        <button className="secondary-button danger" disabled={!Object.values(selected).some(Boolean)} onClick={bulkDelete}><Trash2 size={15} /> Bulk Delete</button>
      </section>
      {view === 'calendar' ? <CalendarView rows={filteredRows} /> : <section className="homework-card-grid">
        {filteredRows.map(item => <HomeworkCard key={item.id} item={item} selected={Boolean(selected[item.id])} onSelect={(id, checked) => setSelected(current => ({ ...current, [id]: checked }))} onEdit={edit} onDelete={deleteHomework} onDone={markHomeworkDone} />)}
        {!filteredRows.length && <div className="empty-state homework-empty"><FileText size={34} /><strong>No homework posted yet</strong><p>Post homework to show it here.</p></div>}
      </section>}
    </>}
    {tab === 'parent' && <section className="panel parent-homework">
      <div className="panel-header"><div><h3>Student / Parent View</h3><p>Read-only homework list filtered by child class.</p></div></div>
      <label>Select Student<select value={filters.studentId} onChange={event => setFilters({ ...filters, studentId: event.target.value })}>{students.map(student => <option key={student.id} value={student.id}>{student.name} - {student.className}</option>)}</select></label>
      <div className="homework-card-grid parent-grid">{parentRows.map(item => <HomeworkCard key={item.id} item={item} readOnly onSeen={row => markHomeworkSeen(row, selectedStudent?.id)} />)}{!parentRows.length && <div className="empty-state homework-empty">No homework for this student yet.</div>}</div>
    </section>}
  </div>
}

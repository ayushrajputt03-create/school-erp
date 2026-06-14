import React, { useMemo, useState } from 'react'
import { Download, FileImage, FileText, Pencil, Plus, Search, Trash2, Upload, X } from 'lucide-react'

const today = () => {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}

function TimetableForm({ initial, classes, close, save }) {
  const [form, setForm] = useState(initial || { title: '', className: classes[0] || '1', section: 'A', startDate: today(), endDate: today(), file: null })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const submit = async event => {
    event.preventDefault()
    if (!initial?.fileUrl && !form.file) return setError('Please upload a PDF or image timetable.')
    setSaving(true)
    setError('')
    try {
      await save(form)
      close()
    } catch (cause) {
      setError(cause.message)
    } finally {
      setSaving(false)
    }
  }
  const chooseFile = event => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return setError('Only PDF, JPG, PNG or WebP files are allowed.')
    if (file.size > 10 * 1024 * 1024) return setError('File must be smaller than 10 MB.')
    setForm(current => ({ ...current, file }))
    setError('')
  }
  return <div className="modal-backdrop"><form className="modal timetable-upload-modal" onSubmit={submit}>
    <div className="modal-header"><div><h3>{initial ? 'Edit timetable' : 'Add new timetable'}</h3><p>Upload a class timetable as PDF or image.</p></div><button type="button" className="icon-button" onClick={close} aria-label="Close timetable form"><X size={19} /></button></div>
    <div className="form-grid">
      <label className="full">Title of timetable<input required value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="e.g. Term I Class Timetable" /></label>
      <label>Class<select value={form.className} onChange={event => setForm({ ...form, className: event.target.value })}>{classes.map(item => <option key={item}>{item}</option>)}</select></label>
      <label>Section<select value={form.section} onChange={event => setForm({ ...form, section: event.target.value })}>{['A','B','C','D'].map(item => <option key={item}>{item}</option>)}</select></label>
      <label>Start Date<input required type="date" value={form.startDate} onChange={event => setForm({ ...form, startDate: event.target.value })} /></label>
      <label>End Date<input required type="date" min={form.startDate} value={form.endDate} onChange={event => setForm({ ...form, endDate: event.target.value })} /></label>
      <label className="full timetable-file-field">
        Upload Timetable file
        <input type="file" accept=".pdf,image/jpeg,image/png,image/webp" onChange={chooseFile} />
        <span><Upload size={18} /><strong>{form.file?.name || initial?.fileName || 'Choose PDF or image'}</strong><small>Maximum file size 10 MB</small></span>
      </label>
      {error && <div className="form-error full">{error}</div>}
    </div>
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={close}>Cancel</button><button className="primary-button" disabled={saving}><Upload size={15} /> {saving ? 'Uploading...' : 'Submit'}</button></div>
  </form></div>
}

export default function TimetableManager({ records, students, saveRecord, deleteRecord }) {
  const [filterBy, setFilterBy] = useState('By Class')
  const [className, setClassName] = useState('All Classes')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const classes = useMemo(() => {
    const available = [...new Set(students.map(student => student.className.split('-')[0]).filter(Boolean))]
    const standard = ['Nursery','LKG','UKG','1','2','3','4','5','6','7','8','9','10','11','12']
    return [...new Set([...standard, ...available])]
  }, [students])
  const rows = Object.values(records || {}).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).filter(record => {
    const matchesSearch = `${record.title} ${record.className} ${record.section}`.toLowerCase().includes(search.trim().toLowerCase())
    if (!matchesSearch) return false
    if (filterBy === 'By Class') return className === 'All Classes' || record.className === className
    return (!fromDate || record.endDate >= fromDate) && (!toDate || record.startDate <= toDate)
  })
  const remove = async record => {
    if (!window.confirm(`Delete "${record.title}" timetable?`)) return
    await deleteRecord(record)
  }
  return <>
    <div className="timetable-filter-panel panel">
      <label>Filter By<select value={filterBy} onChange={event => setFilterBy(event.target.value)}><option>By Class</option><option>By Date</option></select></label>
      {filterBy === 'By Class'
        ? <label>Select Class<select value={className} onChange={event => setClassName(event.target.value)}><option>All Classes</option>{classes.map(item => <option key={item}>{item}</option>)}</select></label>
        : <><label>From Date<input type="date" value={fromDate} onChange={event => setFromDate(event.target.value)} /></label><label>To Date<input type="date" min={fromDate} value={toDate} onChange={event => setToDate(event.target.value)} /></label></>}
      <div className="table-search timetable-search"><Search size={15} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search timetable" /></div>
      <button className="primary-button timetable-add" onClick={() => setEditing({})} title="Add timetable"><Plus size={18} /></button>
    </div>
    <div className="panel table-panel"><div className="table-scroll"><table className="timetable-records"><thead><tr><th>#</th><th>Actions</th><th>Class</th><th>Section</th><th>Title</th><th>Download</th><th>Start Date</th><th>End Date</th></tr></thead><tbody>
      {rows.map((record, index) => <tr key={record.id}><td>{index + 1}</td><td><div className="action-cell"><button className="icon-button" title="Edit timetable" onClick={() => setEditing(record)}><Pencil size={14} /></button><button className="icon-button danger" title="Delete timetable" onClick={() => remove(record)}><Trash2 size={14} /></button></div></td><td><span className="class-pill">Class {record.className}</span></td><td>{record.section}</td><td><div className="timetable-title-cell">{record.fileType?.startsWith('image/') ? <FileImage size={17} /> : <FileText size={17} />}<div><strong>{record.title}</strong><small>{record.fileName}</small></div></div></td><td><a className="secondary-button download-link" href={record.fileUrl} target="_blank" rel="noreferrer" download={record.fileName}><Download size={14} /> Download</a></td><td>{record.startDate}</td><td>{record.endDate}</td></tr>)}
      {!rows.length && <tr><td colSpan="8"><div className="empty-state timetable-empty"><FileText size={28} /><strong>NO TIMETABLE FOUND</strong><p>Add a timetable or change the current filters.</p></div></td></tr>}
    </tbody></table></div></div>
    {editing && <TimetableForm initial={editing.id ? editing : null} classes={classes} close={() => setEditing(null)} save={saveRecord} />}
  </>
}

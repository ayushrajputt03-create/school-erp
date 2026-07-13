import React, { useEffect, useMemo, useState } from 'react'
import {
  BarChart3, CheckCircle2, Download, Edit2, Eye, FileText, Lock, Plus,
  Printer, Save, Search, Trash2, Trophy, Unlock, Users,
} from 'lucide-react'
import DatePicker from './DatePicker'
import './ReportCardManager.css'

const examPresets = [
  'Unit Test 1', 'Unit Test 2', 'Unit Test 3', 'Periodic Test 1 (PT-1)', 'Periodic Test 2 (PT-2)',
  'Half Yearly Examination', 'Annual Examination', 'Pre Board Examination', 'Board Pattern Examination', 'Monthly Test',
]
const defaultSubjects = ['English', 'Hindi', 'Mathematics', 'Science', 'Social Studies', 'Computer']
const today = () => {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}
const longDate = value => value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '-'
const classParts = value => {
  const raw = String(value || '').trim()
  const match = raw.match(/^(.+?)\s*[-/]\s*([A-Za-z0-9]+)$/)
  return match ? { className: match[1].trim(), section: match[2].trim() } : { className: raw || '-', section: '-' }
}
const numericClass = value => Number(String(value || '').match(/\d+/)?.[0] || 0)
const classOptions = students => [...new Set(students.map(student => classParts(student.className).className).filter(Boolean))].sort((a, b) => numericClass(a) - numericClass(b) || String(a).localeCompare(String(b)))
const sectionOptions = students => [...new Set(students.map(student => classParts(student.className).section).filter(Boolean))].sort()
const profilePhoto = student => student?.photoUrl || student?.photo || student?.photoURL || student?.imageUrl || ''
const reportKey = (examId, studentId) => `${examId}_${studentId}`
const gradeFor = percent => percent >= 91 ? 'A1' : percent >= 81 ? 'A2' : percent >= 71 ? 'B1' : percent >= 61 ? 'B2' : percent >= 51 ? 'C1' : percent >= 41 ? 'C2' : percent >= 33 ? 'D' : 'E'
const percentTone = percent => percent >= 91 ? 'gold' : percent >= 71 ? 'green' : percent >= 51 ? 'blue' : percent >= 33 ? 'yellow' : 'red'
const resultStatus = (subjects, passingMarks) => subjects.every(row => Number(row.obtained || 0) >= Number(row.passingMarks || passingMarks || 33)) ? 'Pass' : 'Fail'

function defaultExam(id = '') {
  return { id, name: 'Annual Examination', examDate: today(), session: '2026-27', maxMarks: 100, passingMarks: 33, enabled: true, subjects: defaultSubjects }
}

function safePrint(selector) {
  document.body.classList.add('report-printing')
  document.querySelectorAll('.report-print-target').forEach(node => node.classList.remove('report-print-target'))
  const target = document.querySelector(selector)
  target?.classList.add('report-print-target')
  const cleanup = () => {
    document.body.classList.remove('report-printing')
    target?.classList.remove('report-print-target')
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup, { once: true })
  setTimeout(() => {
    window.print()
    setTimeout(cleanup, 2500)
  }, 450)
}

async function downloadReportPdf(filename = 'report-card.pdf') {
  try {
    const target = document.querySelector('.report-card-paper')
    if (!target) throw new Error('Report card preview is not ready.')
    const html2canvas = (await import('html2canvas')).default
    const { jsPDF } = await import('jspdf')
    const canvas = await html2canvas(target, { scale: 2, backgroundColor: '#ffffff', useCORS: true })
    const image = canvas.toDataURL('image/jpeg', 0.95)
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    pdf.addImage(image, 'JPEG', 10, 10, 190, Math.min(277, (canvas.height * 190) / canvas.width))
    pdf.save(filename)
  } catch (error) {
    console.error('PDF download failed', error)
    alert(`PDF download failed: ${error.message}`)
  }
}

function calculateReport(exam, markRecord = {}, classRows = []) {
  const subjects = (markRecord.subjects || (exam.subjects || defaultSubjects).map(subject => ({ subject, maxMarks: exam.maxMarks, passingMarks: exam.passingMarks, obtained: 0, remarks: '' }))).map(row => {
    const maxMarks = Number(row.maxMarks || exam.maxMarks || 100)
    const obtained = Number(row.obtained || 0)
    const percent = maxMarks ? Math.round((obtained / maxMarks) * 100) : 0
    return { ...row, maxMarks, obtained, grade: gradeFor(percent), percent }
  })
  const totalMax = subjects.reduce((sum, row) => sum + Number(row.maxMarks || 0), 0)
  const obtained = subjects.reduce((sum, row) => sum + Number(row.obtained || 0), 0)
  const percentage = totalMax ? Number(((obtained / totalMax) * 100).toFixed(2)) : 0
  const peerScores = classRows.map(row => row.summary?.percentage).filter(value => Number.isFinite(Number(value))).map(Number).sort((a, b) => b - a)
  const rank = peerScores.length ? Math.max(1, peerScores.indexOf(percentage) + 1) : 1
  return {
    subjects,
    totalMax,
    obtained,
    percentage,
    grade: gradeFor(percentage),
    status: resultStatus(subjects, exam.passingMarks),
    rank,
    promotionStatus: percentage >= 33 ? 'Promoted' : 'Needs Improvement',
  }
}

function ExamSetup({ exams, onSave, onDelete }) {
  const [editing, setEditing] = useState(defaultExam())
  const [message, setMessage] = useState('')
  const savedExams = Object.values(exams || {})
  const merged = [
    ...examPresets.map((name, index) => savedExams.find(row => row.name === name) || { ...defaultExam(`preset_${index}`), name, preset: true }),
    ...savedExams.filter(row => !examPresets.includes(row.name)),
  ]
  const save = async event => {
    event.preventDefault()
    try {
      await onSave({ ...editing, subjects: String(Array.isArray(editing.subjects) ? editing.subjects.join(',') : editing.subjects || '').split(',').map(item => item.trim()).filter(Boolean) })
      setEditing(defaultExam())
      setMessage('Exam saved successfully.')
    } catch (error) {
      console.error('Exam save failed', error)
      setMessage(`Exam save failed: ${error.message}`)
    }
  }
  return <div className="report-two-column">
    <form className="panel report-form" onSubmit={save}>
      <div className="panel-header"><div><h3>Exam Setup</h3><p>Create, edit and manage exams.</p></div></div>
      <div className="form-grid">
        <label>Exam Name<input required value={editing.name} onChange={event => setEditing({ ...editing, name: event.target.value })} /></label>
        <label>Exam Date<DatePicker value={editing.examDate} onChange={value => setEditing({ ...editing, examDate: value })} /></label>
        <label>Academic Session<input value={editing.session} onChange={event => setEditing({ ...editing, session: event.target.value })} /></label>
        <label>Maximum Marks<input type="number" value={editing.maxMarks} onChange={event => setEditing({ ...editing, maxMarks: event.target.value })} /></label>
        <label>Passing Marks<input type="number" value={editing.passingMarks} onChange={event => setEditing({ ...editing, passingMarks: event.target.value })} /></label>
        <label>Status<select value={editing.enabled ? 'enabled' : 'disabled'} onChange={event => setEditing({ ...editing, enabled: event.target.value === 'enabled' })}><option value="enabled">Enabled</option><option value="disabled">Disabled</option></select></label>
        <label className="full">Subjects comma separated<textarea value={Array.isArray(editing.subjects) ? editing.subjects.join(', ') : editing.subjects} onChange={event => setEditing({ ...editing, subjects: event.target.value })} /></label>
      </div>
      {message && <div className={`report-message ${message.includes('failed') ? 'error' : 'ok'}`}>{message}</div>}
      <button className="primary-button"><Save size={15} /> Save Exam</button>
    </form>
    <section className="panel">
      <div className="panel-header"><div><h3>Exam Library</h3><p>Default and custom exams</p></div></div>
      <div className="report-list">{merged.map(exam => <article key={exam.id || exam.name}>
        <div><strong>{exam.name}</strong><small>{longDate(exam.examDate)} | Max {exam.maxMarks} | Pass {exam.passingMarks}</small></div>
        <span className={`status ${exam.enabled ? 'paid' : 'pending'}`}>{exam.enabled ? 'Enabled' : 'Disabled'}</span>
        <button className="icon-button" type="button" onClick={() => setEditing({ ...defaultExam(), ...exam })}><Edit2 size={14} /></button>
        {!exam.preset && <button className="icon-button danger" type="button" onClick={() => onDelete(exam.id)}><Trash2 size={14} /></button>}
      </article>)}</div>
    </section>
  </div>
}

function StudentPicker({ students, value, onSelect }) {
  const [query, setQuery] = useState('')
  const matches = query.trim() ? students.filter(student => `${student.roll} ${student.name} ${student.phone} ${student.className}`.toLowerCase().includes(query.toLowerCase())).slice(0, 8) : []
  return <div className="report-search">
    <Search size={15} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search admission no., student name or phone" />
    {matches.length > 0 && <div>{matches.map(student => <button key={student.id} type="button" onClick={() => { onSelect(student); setQuery(`${student.roll} - ${student.name}`) }}>
      {profilePhoto(student) ? <img src={profilePhoto(student)} alt="" /> : <span>{student.initials}</span>}
      <strong>{student.name}</strong><small>Adm {student.roll} | {student.className}</small>
    </button>)}</div>}
    {value && <small className="picked-student">Selected: {value.name} | {value.className}</small>}
  </div>
}

function MarksEntry({ students, reportData, onSaveMarks, onSaveReport }) {
  const enabledExams = Object.values(reportData.exams || {}).filter(exam => exam.enabled !== false)
  const [examId, setExamId] = useState(enabledExams[0]?.id || '')
  const [className, setClassName] = useState('')
  const [section, setSection] = useState('')
  const [student, setStudent] = useState(null)
  const [record, setRecord] = useState(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const exam = enabledExams.find(item => item.id === examId) || enabledExams[0] || defaultExam()
  const filtered = students.filter(item => (!className || classParts(item.className).className === className) && (!section || classParts(item.className).section === section))
  const classRecords = Object.values(reportData.marks || {}).filter(row => row.examId === exam.id && (!className || row.className === className) && (!section || row.section === section))
  useEffect(() => {
    if (!student || !exam.id) return
    const parts = classParts(student.className)
    const saved = reportData.marks?.[reportKey(exam.id, student.id)]
    setRecord(saved || {
      examId: exam.id,
      studentId: student.id,
      studentName: student.name,
      className: parts.className,
      section: parts.section,
      attendance: '',
      remarks: '',
      classTeacherRemark: '',
      principalRemark: '',
      status: 'draft',
      subjects: (exam.subjects || defaultSubjects).map(subject => ({ subject, maxMarks: exam.maxMarks, passingMarks: exam.passingMarks, obtained: '', remarks: '' })),
    })
  }, [student, exam.id, reportData.marks])
  const save = async status => {
    if (!student || !record) return
    setSaving(true)
    setMessage('')
    try {
      const summary = calculateReport(exam, record, classRecords)
      const row = { ...record, examId: exam.id, studentId: student.id, studentName: student.name, status, summary, updatedAt: Date.now() }
      await onSaveMarks(row)
      if (status === 'published') await onSaveReport({ ...row, id: reportKey(exam.id, student.id), reportNumber: `RC-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`, locked: false })
      setRecord(row)
      setMessage(status === 'published' ? 'Result published successfully.' : 'Marks draft saved successfully.')
    } catch (error) {
      console.error('Report marks save failed', error)
      setMessage(`Save failed: ${error.message}`)
      alert(`Marks save failed: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }
  return <div className="report-two-column">
    <section className="panel report-form">
      <div className="panel-header"><div><h3>Marks Entry</h3><p>Save draft or publish student results.</p></div></div>
      <div className="form-grid">
        <label>Select Exam<select value={examId} onChange={event => { setExamId(event.target.value); setStudent(null); setRecord(null) }}>{enabledExams.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Class<select value={className} onChange={event => { setClassName(event.target.value); setStudent(null); setRecord(null) }}><option value="">All</option>{classOptions(students).map(item => <option key={item}>{item}</option>)}</select></label>
        <label>Section<select value={section} onChange={event => { setSection(event.target.value); setStudent(null); setRecord(null) }}><option value="">All</option>{sectionOptions(students).map(item => <option key={item}>{item}</option>)}</select></label>
      </div>
      <StudentPicker students={filtered} value={student} onSelect={setStudent} />
      {!student && <div className="empty-state">Search and select a student to enter marks.</div>}
      {message && <div className={`report-message ${message.includes('failed') ? 'error' : 'ok'}`}>{message}</div>}
    </section>
    {student && record && <section className="panel report-marks-panel">
      <div className="panel-header"><div><h3>{student.name}</h3><p>{student.className} | {exam.name}</p></div><span className={`status ${record.status === 'published' ? 'paid' : 'partial'}`}>{record.status}</span></div>
      <div className="table-scroll"><table className="report-marks-table"><thead><tr><th>Subject</th><th>Max</th><th>Obtained</th><th>Grade</th><th>Remarks</th></tr></thead><tbody>{record.subjects.map((row, index) => {
        const percent = Number(row.maxMarks || exam.maxMarks) ? Math.round(Number(row.obtained || 0) / Number(row.maxMarks || exam.maxMarks) * 100) : 0
        return <tr key={`${row.subject}-${index}`}><td><input value={row.subject} onChange={event => setRecord(current => ({ ...current, subjects: current.subjects.map((item, i) => i === index ? { ...item, subject: event.target.value } : item) }))} /></td><td><input type="number" value={row.maxMarks} onChange={event => setRecord(current => ({ ...current, subjects: current.subjects.map((item, i) => i === index ? { ...item, maxMarks: event.target.value } : item) }))} /></td><td><input type="number" value={row.obtained} onChange={event => setRecord(current => ({ ...current, subjects: current.subjects.map((item, i) => i === index ? { ...item, obtained: event.target.value } : item) }))} /></td><td><span className={`grade-pill grade-${gradeFor(percent).replace('+', 'plus')}`}>{gradeFor(percent)}</span></td><td><input value={row.remarks || ''} onChange={event => setRecord(current => ({ ...current, subjects: current.subjects.map((item, i) => i === index ? { ...item, remarks: event.target.value } : item) }))} /></td></tr>
      })}</tbody></table></div>
      <div className="form-grid">
        <label>Attendance %<input type="number" value={record.attendance} onChange={event => setRecord({ ...record, attendance: event.target.value })} /></label>
        <label className="full">Class Teacher Remark<textarea value={record.classTeacherRemark || record.remarks || ''} onChange={event => setRecord({ ...record, classTeacherRemark: event.target.value })} /></label>
        <label className="full">Principal Remark<textarea value={record.principalRemark || ''} onChange={event => setRecord({ ...record, principalRemark: event.target.value })} /></label>
      </div>
      <div className="report-actions"><button className="secondary-button" disabled={saving} onClick={() => save('draft')}><Save size={15} /> {saving ? 'Saving...' : 'Save Draft'}</button><button className="primary-button" disabled={saving} onClick={() => save('published')}><CheckCircle2 size={15} /> {saving ? 'Publishing...' : 'Publish Result'}</button></div>
    </section>}
  </div>
}

function ReportCardPaper({ student, exam, record, school, classRecords }) {
  const summary = calculateReport(exam, record, classRecords)
  const photo = profilePhoto(student)
  const parts = classParts(student.className)
  const logo = school.logo || school.logoURL || ''
  const tone = percentTone(summary.percentage)
  const statusText = summary.status === 'Pass' ? (summary.percentage >= 75 ? 'PASSED WITH DISTINCTION' : 'PASSED') : 'NEEDS IMPROVEMENT'
  return <article className="report-card-paper">
    {logo && <img className="report-watermark" src={logo} alt="" />}
    <div className="report-outer-border"><div className="report-inner-border premium-report-inner">
      <header className="report-card-header premium-report-header">
        <div className="report-school-logo">{logo ? <img src={logo} alt="" /> : <FileText size={34} />}</div>
        <div><h1>{school.schoolName || 'School Name'}</h1><p>{school.address || 'School Address'} | {school.phone || ''} {school.email ? `| ${school.email}` : ''}</p></div>
        <div className="report-student-photo">{photo ? <img src={photo} alt="" /> : <span>Photo</span>}</div>
      </header>
      <section className="report-title-block"><h2>REPORT CARD</h2><p>{exam.name} | Session {exam.session || school.academicYear || '2026-27'}</p><i /></section>
      <section className="report-info-grid premium-info-grid">
        <div><span>Student Name</span><strong>{student.name}</strong></div>
        <div><span>Admission No.</span><strong>{student.roll}</strong></div>
        <div><span>Roll Number</span><strong>{student.rollNo || student.roll}</strong></div>
        <div><span>Class / Section</span><strong>{parts.className} / {parts.section}</strong></div>
        <div><span>Session</span><strong>{exam.session || school.academicYear || '2026-27'}</strong></div>
        <div><span>Attendance</span><strong>{record.attendance || '-'}%</strong></div>
      </section>
      <table className="report-card-table premium-marks-table"><thead><tr><th>Subject</th><th>Max Marks</th><th>Obtained</th><th>Grade</th><th>Remarks</th></tr></thead><tbody>{summary.subjects.map(row => <tr key={row.subject}><td>{row.subject}</td><td>{row.maxMarks}</td><td>{row.obtained}</td><td><span className={`grade-pill grade-${row.grade.replace('+', 'plus')}`}>{row.grade}</span></td><td>{row.remarks || '-'}</td></tr>)}</tbody></table>
      <section className="premium-result-box">
        <div className={`percent-ring ${tone}`} style={{ '--score': `${Math.min(100, summary.percentage)}%` }}><strong>{summary.percentage}%</strong><span>Overall</span></div>
        <div className="premium-summary-grid">
          <div><span>Total Marks</span><strong>{summary.totalMax}</strong></div>
          <div><span>Obtained</span><strong>{summary.obtained}</strong></div>
          <div><span>Grade</span><strong>{summary.grade}</strong></div>
          <div><span>Rank</span><strong>{summary.rank <= 3 ? <><Trophy size={14} /> {summary.rank}</> : summary.rank}</strong></div>
          <div><span>Status</span><strong>{summary.status}</strong></div>
          <div><span>Promotion</span><strong>{summary.promotionStatus}</strong></div>
        </div>
      </section>
      <section className={`result-banner ${summary.status === 'Pass' ? 'pass' : 'fail'}`}><CheckCircle2 size={18} /><strong>{statusText}</strong><span>{summary.status === 'Pass' ? 'Keep learning with consistency and confidence.' : 'Focused practice and teacher support recommended.'}</span></section>
      <section className="report-remarks"><p><strong>Class Teacher Remark:</strong> {record.classTeacherRemark || record.remarks || '-'}</p><p><strong>Principal Remark:</strong> {record.principalRemark || '-'}</p></section>
      <footer className="report-signatures premium-signatures"><div><i /><span>Class Teacher</span></div><div><i /><span>Exam Controller</span></div><div><i /><span>Principal</span><b>Official Seal</b></div></footer>
      <div className="report-footer-note"><span>This is a digitally generated report card</span><i>QR</i></div>
    </div></div>
  </article>
}

function ReportGenerator({ students, school, reportData, onSaveReport, onUpdateReport }) {
  const exams = Object.values(reportData.exams || {})
  const [examId, setExamId] = useState(exams[0]?.id || '')
  const [student, setStudent] = useState(null)
  const [generated, setGenerated] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const exam = exams.find(item => item.id === examId) || exams[0] || defaultExam()
  const key = student ? reportKey(exam.id, student.id) : ''
  const record = generated || (key ? reportData.reports?.[key] || reportData.marks?.[key] : null)
  const classRows = Object.values(reportData.marks || {}).filter(row => row.examId === exam.id && (!student || (row.className === classParts(student.className).className && row.section === classParts(student.className).section)))
  const generate = async () => {
    setMessage('')
    setLoading(true)
    try {
      if (!exam?.id) throw new Error('Please select a valid exam.')
      if (!student?.id) throw new Error('Please select a student first.')
      const marks = reportData.marks?.[key]
      if (!marks) throw new Error('No marks found. Enter marks in Marks Entry tab and save/publish first.')
      const summary = calculateReport(exam, marks, classRows)
      const report = { ...marks, id: key, examId: exam.id, studentId: student.id, studentName: student.name, summary, status: marks.status || 'generated', reportNumber: marks.reportNumber || `RC-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`, generatedAt: Date.now() }
      await onSaveReport(report)
      setGenerated(report)
      setMessage('Result generated successfully.')
    } catch (error) {
      console.error('Generate result failed', error)
      setMessage(`Generation failed: ${error.message}`)
      alert(`Generate Result failed: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }
  return <div className="report-two-column">
    <section className="panel report-form">
      <div className="panel-header"><div><h3>Report Card Generator</h3><p>Generate one student or bulk class-wise report cards.</p></div></div>
      <label>Select Exam<select value={examId} onChange={event => { setExamId(event.target.value); setStudent(null); setGenerated(null); setMessage('') }}>{exams.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <StudentPicker students={students} value={student} onSelect={value => { setStudent(value); setGenerated(null); setMessage('') }} />
      <button className="primary-button" disabled={loading || !student} onClick={generate}><FileText size={15} /> {loading ? 'Generating...' : 'Generate Result'}</button>
      {message && <div className={`report-message ${message.startsWith('Generation failed') ? 'error' : 'ok'}`}>{message}</div>}
      <div className="report-actions"><button className="secondary-button" disabled={!record} onClick={() => safePrint('.report-card-paper')}><Printer size={15} /> Print Report Card</button><button className="secondary-button" disabled={!record} onClick={() => downloadReportPdf(`${student?.name || 'student'}-report-card.pdf`)}><Download size={15} /> Download PDF</button><button className="secondary-button" disabled={!record} onClick={() => safePrint('.report-card-paper')}><Users size={15} /> Bulk Print Class</button><button className="secondary-button" disabled={!record} onClick={() => downloadReportPdf('bulk-report-cards.pdf')}><Download size={15} /> Bulk PDF</button></div>
      {record && <div className="report-admin-controls"><button onClick={() => onUpdateReport(key, { status: 'published' })}><Eye size={14} /> Publish</button><button onClick={() => onUpdateReport(key, { status: 'draft' })}><Unlock size={14} /> Unpublish</button><button onClick={() => onUpdateReport(key, { locked: true })}><Lock size={14} /> Lock</button><button onClick={() => onUpdateReport(key, { locked: false })}><Unlock size={14} /> Unlock</button></div>}
    </section>
    <section className="report-preview-wrap">{record && student ? <ReportCardPaper student={student} exam={exam} record={record} school={school} classRecords={classRows} /> : <div className="empty-state large"><FileText size={30} /><strong>No report selected</strong><p>First save marks, select student, then click Generate Result.</p></div>}</section>
  </div>
}

function Analytics({ students, reportData }) {
  const exams = Object.values(reportData.exams || {})
  const [examId, setExamId] = useState(exams[0]?.id || '')
  const rows = Object.values(reportData.marks || {}).filter(row => !examId || row.examId === examId)
  const scored = rows.map(row => ({ ...row, student: students.find(item => item.id === row.studentId), percentage: Number(row.summary?.percentage || 0), grade: row.summary?.grade || 'F' }))
  const average = scored.length ? Math.round(scored.reduce((sum, item) => sum + item.percentage, 0) / scored.length) : 0
  const highest = scored.reduce((best, item) => item.percentage > (best?.percentage || -1) ? item : best, null)
  const lowest = scored.reduce((low, item) => item.percentage < (low?.percentage ?? 101) ? item : low, null)
  const pass = scored.filter(row => (row.summary?.status || 'Pass') === 'Pass').length
  const top = [...scored].sort((a, b) => b.percentage - a.percentage).slice(0, 10)
  const subjects = defaultSubjects.map(subject => {
    const values = rows.flatMap(row => row.subjects || []).filter(row => row.subject === subject).map(row => Number(row.obtained || 0) / Number(row.maxMarks || 100) * 100)
    return { subject, value: values.length ? Math.round(values.reduce((sum, item) => sum + item, 0) / values.length) : 0 }
  })
  const grades = ['A+', 'A', 'B+', 'B', 'C', 'F'].map(grade => ({ grade, count: scored.filter(row => row.grade === grade).length }))
  return <div className="report-analytics">
    <section className="panel"><div className="panel-header"><div><h3>Result Analytics</h3><p>Performance dashboard for selected exam.</p></div><select value={examId} onChange={event => setExamId(event.target.value)}>{exams.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      <div className="report-stat-grid"><div><span>Class Average</span><strong>{average}%</strong></div><div><span>Highest Marks</span><strong>{highest ? `${highest.percentage}%` : '0%'}</strong><small>{highest?.student?.name || '-'}</small></div><div><span>Lowest Marks</span><strong>{lowest ? `${lowest.percentage}%` : '0%'}</strong><small>{lowest?.student?.name || '-'}</small></div><div><span>Pass Percentage</span><strong>{scored.length ? Math.round(pass / scored.length * 100) : 0}%</strong></div></div>
    </section>
    <section className="report-chart-grid">
      <div className="panel"><div className="panel-header"><div><h3>Subject-wise Performance</h3></div></div><div className="subject-bars">{subjects.map(row => <div key={row.subject}><span>{row.subject}</span><i style={{ width: `${row.value}%` }} /><strong>{row.value}%</strong></div>)}</div></div>
      <div className="panel"><div className="panel-header"><div><h3>Grade Distribution</h3></div></div><div className="grade-chart">{grades.map(row => <div key={row.grade}><span>{row.grade}</span><strong>{row.count}</strong></div>)}</div></div>
    </section>
    <section className="panel"><div className="panel-header"><div><h3>Top 10 Students</h3><p>Leaderboard by percentage</p></div></div><div className="table-scroll"><table><thead><tr><th>Rank</th><th>Student</th><th>Class</th><th>Percentage</th><th>Grade</th></tr></thead><tbody>{top.map((row, index) => <tr key={row.studentId}><td>{index + 1}</td><td>{row.student?.name || row.studentName}</td><td>{row.student?.className || `${row.className}-${row.section}`}</td><td>{row.percentage}%</td><td><span className={`grade-pill grade-${row.grade.replace('+', 'plus')}`}>{row.grade}</span></td></tr>)}</tbody></table></div></section>
  </div>
}

function ParentPortal({ students, school, reportData }) {
  const published = Object.values(reportData.reports || reportData.marks || {}).filter(row => row.status === 'published')
  const [student, setStudent] = useState(null)
  const rows = student ? published.filter(row => row.studentId === student.id) : published
  const current = rows[0]
  const exam = current ? reportData.exams?.[current.examId] || defaultExam() : null
  return <div className="report-two-column">
    <section className="panel report-form"><div className="panel-header"><div><h3>Student & Parent Portal</h3><p>View, download and print published results.</p></div></div><StudentPicker students={students} value={student} onSelect={setStudent} /><div className="report-list">{rows.map(row => <article key={`${row.examId}_${row.studentId}`}><div><strong>{reportData.exams?.[row.examId]?.name || 'Exam'}</strong><small>{row.summary?.percentage}% | {row.summary?.grade}</small></div><span className="status paid">Published</span></article>)}</div></section>
    <section className="report-preview-wrap">{current && student ? <ReportCardPaper student={student} exam={exam} record={current} school={school} classRecords={rows} /> : <div className="empty-state large">No published report selected.</div>}</section>
  </div>
}

export default function ReportCardManager({ students, school, reportData, onSaveExam, onDeleteExam, onSaveMarks, onSaveReport, onUpdateReport }) {
  const [tab, setTab] = useState('setup')
  const normalizedReportData = useMemo(() => {
    const saved = reportData.exams || {}
    const fallback = Object.fromEntries(examPresets.map((name, index) => [`preset_${index}`, { ...defaultExam(`preset_${index}`), name, preset: true }]))
    return { ...reportData, exams: Object.keys(saved).length ? saved : fallback, marks: reportData.marks || {}, reports: reportData.reports || {} }
  }, [reportData])
  return <div className="report-card-module">
    <div className="report-tabs">
      {[['setup','Exam Setup',Plus],['marks','Marks Entry',Edit2],['generator','Report Generator',FileText],['analytics','Analytics',BarChart3],['portal','Student Portal',Users]].map(([id, label, Icon]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><Icon size={15} /> {label}</button>)}
    </div>
    {tab === 'setup' && <ExamSetup exams={normalizedReportData.exams} onSave={onSaveExam} onDelete={onDeleteExam} />}
    {tab === 'marks' && <MarksEntry students={students} reportData={normalizedReportData} onSaveMarks={onSaveMarks} onSaveReport={onSaveReport} />}
    {tab === 'generator' && <ReportGenerator students={students} school={school} reportData={normalizedReportData} onSaveReport={onSaveReport} onUpdateReport={onUpdateReport} />}
    {tab === 'analytics' && <Analytics students={students} reportData={normalizedReportData} />}
    {tab === 'portal' && <ParentPortal students={students} school={school} reportData={normalizedReportData} />}
  </div>
}

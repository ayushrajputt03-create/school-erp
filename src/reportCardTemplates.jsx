// Selectable report card designs.
//
// Every template renders the SAME data the ERP already stores - the summary produced by
// calculateReport plus the exam, student and school records. The downloaded reference designs
// also showed co-scholastic grades, house names, working-day counts and term-wise splits; this
// app records none of those, so those sections are simply left out rather than filled with
// invented values. A report card is a document parents keep - a fabricated row on it is worse
// than a missing one.
//
// Themes are CSS variables, so nine designs come from two layouts. Every template keeps the
// outer .report-card-paper class because the existing print and PDF paths select on it.

import React, { useState } from 'react'
import { buildMarksTable } from './lib/reportColumns'
import './reportCardTemplates.css'

// Marks cell. Read-only by default; with onEdit it turns into an input on click.
//
// Deliberately renders plain text until clicked rather than always being an <input>: print and
// the html2canvas PDF path capture whatever is in the DOM, so a card that is editable on screen
// still prints identically to a read-only one. Nothing is focused while printing.
export function MarkCell({ value, max, onEdit }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const shown = <>{value === '' || value === undefined || value === null ? '—' : value}{max ? <i className="rt-mark-max"> / {max}</i> : null}</>

  if (!onEdit) return <span className="rt-mark">{shown}</span>

  if (!editing) {
    return <button
      type="button"
      className="rt-mark rt-mark-edit"
      title="Click to edit marks"
      onClick={() => { setDraft(value === undefined || value === null ? '' : String(value)); setEditing(true) }}
    >{shown}</button>
  }

  const commit = () => {
    setEditing(false)
    if (draft !== String(value ?? '')) onEdit(draft)
  }
  return <input
    className="rt-mark-input"
    type="number"
    autoFocus
    value={draft}
    onChange={event => setDraft(event.target.value)}
    onBlur={commit}
    onKeyDown={event => {
      if (event.key === 'Enter') { event.preventDefault(); commit() }
      if (event.key === 'Escape') setEditing(false)
    }}
  />
}

// The marks table, shared by every design.
//
// One column per exam that actually has marks for this student, in exam-date order, plus a
// weighted-average Overall column. A student with only one exam entered gets the exact table
// this module printed before: a single "Marks" column, no Overall, no totals row - because a
// second column that repeats the first is noise on a document a parent keeps.
//
// Only the selected exam's cells are editable. The other columns come from records this
// screen is not editing, and silently writing to them would be a surprise.
export function MarksTable({ className, subjectLabel = 'Subject', table, summary, exam, student, footer, onEditMark }) {
  const built = table || buildMarksTable({ activeExam: exam, activeSummary: summary, exams: null, marks: null, studentId: student?.id })
  const { multi, columns, rows } = built
  const showFoot = footer || multi

  const totalOf = pick => rows.reduce((sum, row) => sum + (pick(row) || 0), 0)
  const columnTotals = columns.map((column, index) => ({
    obtained: totalOf(row => row.cells[index].obtained),
    maxMarks: totalOf(row => row.cells[index].obtained === null ? 0 : row.cells[index].maxMarks),
  }))
  const overallTotal = { obtained: totalOf(row => row.overall?.obtained), maxMarks: totalOf(row => row.overall?.maxMarks) }

  return <table className={`${className}${multi ? ' rt-multi' : ''}`}>
    <thead><tr>
      <th>{subjectLabel}</th>
      {multi
        ? <>{columns.map(column => <th key={column.examId}>{column.name}</th>)}<th>Overall</th></>
        : <th>Marks</th>}
    </tr></thead>
    <tbody>{rows.map(row => <tr key={row.subject}>
      <td>{row.subject}</td>
      {row.cells.map((cell, index) => <td key={columns[index].examId} className="rt-total">
        <MarkCell
          value={cell.obtained}
          max={cell.maxMarks}
          onEdit={onEditMark && cell.editIndex !== null ? value => onEditMark(cell.editIndex, value) : undefined}
        />
      </td>)}
      {multi && <td className="rt-total rt-overall">{row.overall
        ? <><b>{row.overall.percent}%</b><i className="rt-mark-max"> {row.overall.obtained}/{row.overall.maxMarks}</i></>
        : <span className="rt-mark">—</span>}</td>}
    </tr>)}</tbody>
    {showFoot && <tfoot><tr>
      <td>Overall</td>
      {columnTotals.map((total, index) => <td key={columns[index].examId} className="rt-total">{total.obtained} / {total.maxMarks}</td>)}
      {multi && <td className="rt-total">{overallTotal.maxMarks ? `${Math.round((overallTotal.obtained / overallTotal.maxMarks) * 100)}%` : '—'}</td>}
    </tr></tfoot>}
  </table>
}

const stars = percent => {
  const filled = percent >= 85 ? 4 : percent >= 70 ? 3 : percent >= 50 ? 2 : 1
  return '★'.repeat(filled) + '☆'.repeat(4 - filled)
}

const progressWord = percent => percent >= 85 ? 'Excellent' : percent >= 70 ? 'Very Good' : percent >= 50 ? 'Good' : 'Developing'

const schoolLine = school => [school.address, school.phone, school.email].filter(Boolean).join(' · ')

// Shared header used by both layouts.
// The reference designs framed a drawn shield inside a circle. A real school logo is a
// rectangular image, and a circular frame crops its sides off, so the decorative circle is
// kept only for the initials fallback.
function Crest({ logo, fallback }) {
  return <div className={`rt-crest ${logo ? 'has-logo' : ''}`}>{logo ? <img src={logo} alt="" /> : <span>{fallback}</span>}</div>
}

function StudentPhoto({ photo, label }) {
  return <div className="rt-photo">{photo ? <img src={photo} alt="" /> : <span>{label}</span>}</div>
}

function Signatures() {
  return <div className="rt-signs"><div>Class Teacher</div><div>Parent / Guardian</div><div>Principal</div></div>
}

function Footer({ record, note }) {
  return <div className="rt-footer">
    <span>Issued: {record.generatedAt ? new Date(record.generatedAt).toLocaleDateString('en-IN') : '—'}</span>
    <span>{note}</span>
    <span>Report ID: {record.reportNumber || '—'}</span>
  </div>
}

// --- Formal layout: marks table, for senior classes -------------------------------------

function FormalTemplate({ theme, school, student, exam, record, summary, parts, photo, logo, onEditMark, marksTable }) {
  const session = exam.session || school.academicYear || ''
  return <article className={`report-card-paper rt rt-formal theme-${theme}`}>
    <div className="rt-inner">
      <header className="rt-head">
        <Crest logo={logo} fallback={(school.schoolName || 'S').slice(0, 1)} />
        <div className="rt-school">
          <h1>{school.schoolName || 'School Name'}</h1>
          {school.affiliatedTo && <p className="rt-tag">Affiliated to {school.affiliatedTo}</p>}
          <p className="rt-address">{schoolLine(school)}</p>
        </div>
        <div className="rt-session">Academic Session<strong>{session || '—'}</strong></div>
      </header>

      <div className="rt-title"><h2>Student Progress Report</h2><span>{exam.name}</span></div>

      <section className="rt-profile">
        <div className="rt-fields">
          <div className="rt-field rt-span2"><span className="rt-k">Student Name</span><span className="rt-v">{student.name}</span></div>
          <div className="rt-field"><span className="rt-k">Admission No.</span><span className="rt-v">{student.roll}</span></div>
          <div className="rt-field"><span className="rt-k">Class &amp; Section</span><span className="rt-v">{parts.className} – {parts.section}</span></div>
          <div className="rt-field"><span className="rt-k">Roll No.</span><span className="rt-v">{student.rollNo || student.roll}</span></div>
          <div className="rt-field"><span className="rt-k">Date of Birth</span><span className="rt-v">{student.dob || '—'}</span></div>
          <div className="rt-field rt-span2"><span className="rt-k">Father / Guardian</span><span className="rt-v">{student.fatherName || student.guardian || '—'}</span></div>
          <div className="rt-field"><span className="rt-k">Contact</span><span className="rt-v">{student.phone || '—'}</span></div>
        </div>
        <StudentPhoto photo={photo} label="STUDENT PHOTO" />
      </section>

      <div className="rt-heading"><h3>Scholastic Performance</h3><span>Maximum {summary.totalMax} marks</span></div>
      <MarksTable className="rt-table rt-table-marks" table={marksTable} summary={summary} exam={exam} student={student} footer onEditMark={onEditMark} />

      <div className="rt-lower">
        <section className="rt-box">
          <div className="rt-box-title">Result Summary</div>
          <div className="rt-box-body"><div className="rt-stats">
            <span>Total Marks</span><b>{summary.totalMax}</b>
            <span>Marks Obtained</span><b>{summary.obtained}</b>
            <span>Percentage</span><b>{summary.percentage}%</b>
            <span>Overall Grade</span><b>{summary.grade}</b>
            <span>Class Rank</span><b>{summary.rank}</b>
          </div></div>
        </section>
        <section className="rt-box">
          <div className="rt-box-title">Attendance &amp; Result</div>
          <div className="rt-box-body">
            <div className="rt-stats"><span>Attendance</span><b>{record.attendance ? `${record.attendance}%` : '—'}</b><span>Status</span><b>{summary.status}</b></div>
            <div className="rt-result">Final Result<strong>{summary.promotionStatus}</strong></div>
          </div>
        </section>
      </div>

      <div className="rt-remark">
        <b>Class Teacher&apos;s Remarks</b>
        <span>{record.classTeacherRemark || record.remarks || '—'}</span>
      </div>
      {record.principalRemark && <div className="rt-remark"><b>Principal&apos;s Remarks</b><span>{record.principalRemark}</span></div>}

      <Signatures />
      <div className="rt-scale">{['A1 91–100', 'A2 81–90', 'B1 71–80', 'B2 61–70', 'C1 51–60', 'C2 41–50', 'D 33–40', 'E Below 33'].map(item => <span key={item}>{item}</span>)}</div>
      <Footer record={record} note="Computer-generated progress report" />
    </div>
  </article>
}

// --- Kids layout: same marks, shown as stars and progress words --------------------------

const KID_COPY = {
  happy: { icon: '🦉', title: 'My Happy Learning Report', sub: 'Celebrating every little achievement', journey: 'My Learning Journey', remark: 'A Special Note From My Teacher', sticker: '😊', foot: 'Keep learning, growing and smiling!' },
  space: { icon: '🚀', title: 'My Space Explorer Report', sub: 'A mission full of learning and discovery', journey: 'My Learning Missions', remark: 'Message From Mission Control', sticker: '🌟', foot: 'Keep exploring — the universe is yours!' },
  jungle: { icon: '🦁', title: 'My Jungle Adventure Report', sub: 'Growing brave, curious and kind every day', journey: 'My Learning Trail', remark: 'A Note From My Jungle Guide', sticker: '🦋', foot: 'Stay curious, kind and courageous!' },
  candy: { icon: '🍭', title: 'My Colourful Learning Report', sub: 'A sweet celebration of every achievement', journey: 'My Rainbow Learning', remark: 'A Sweet Note From My Teacher', sticker: '🌈', foot: 'Keep learning, smiling and sparkling!' },
  rainbow: { icon: '🌈', title: 'My Colourful Progress Report', sub: 'Celebrating learning, creativity and happy achievements', journey: 'Learning & Academic Development', remark: 'A Special Message From My Teacher', sticker: '⭐', foot: 'Keep learning, creating and shining!' },
}

function KidsTemplate({ theme, school, student, exam, record, summary, parts, photo, logo, onEditMark, marksTable }) {
  const copy = KID_COPY[theme] || KID_COPY.happy
  const session = exam.session || school.academicYear || ''
  return <article className={`report-card-paper rt rt-kids theme-${theme}`}>
    <div className="rt-inner">
      <header className="rt-head">
        {logo ? <Crest logo={logo} fallback={copy.icon} /> : <div className="rt-hero-icon">{copy.icon}</div>}
        <div className="rt-school">
          <h1>{school.schoolName || 'School Name'}</h1>
          <div className="rt-motto">{copy.sub}</div>
          <p className="rt-address">{schoolLine(school)}</p>
        </div>
        <div className="rt-session">Session<strong>{session || '—'}</strong></div>
      </header>

      <div className="rt-kid-title"><h2>{copy.title}</h2><small>{exam.name}</small></div>

      <section className="rt-profile">
        <div className="rt-fields">
          <div className="rt-field rt-span2"><span className="rt-k">My Name</span><span className="rt-v">{student.name}</span></div>
          <div className="rt-field"><span className="rt-k">Admission No.</span><span className="rt-v">{student.roll}</span></div>
          <div className="rt-field"><span className="rt-k">Class &amp; Section</span><span className="rt-v">{parts.className} – {parts.section}</span></div>
          <div className="rt-field"><span className="rt-k">Roll No.</span><span className="rt-v">{student.rollNo || student.roll}</span></div>
          <div className="rt-field"><span className="rt-k">Birthday</span><span className="rt-v">{student.dob || '—'}</span></div>
          <div className="rt-field rt-span2"><span className="rt-k">Parent / Guardian</span><span className="rt-v">{student.fatherName || student.guardian || '—'}</span></div>
        </div>
        <StudentPhoto photo={photo} label="MY HAPPY PHOTO" />
      </section>

      <div className="rt-heading"><div className="rt-bubble">📚</div><h3>{copy.journey}</h3><span>Out of {summary.totalMax} marks</span></div>
      <MarksTable className="rt-table rt-table-marks" subjectLabel="Learning Area" table={marksTable} summary={summary} exam={exam} student={student} onEditMark={onEditMark} />

      <div className="rt-lower">
        <section className="rt-box">
          <div className="rt-box-title">🌈 How I Did</div>
          <div className="rt-box-body"><div className="rt-stats">
            <span>Marks Obtained</span><b>{summary.obtained} / {summary.totalMax}</b>
            <span>Percentage</span><b>{summary.percentage}%</b>
            <span>Overall Grade</span><b>{summary.grade}</b>
            <span>Overall Stars</span><b className="rt-stars">{stars(summary.percentage)}</b>
          </div></div>
        </section>
        <section className="rt-box">
          <div className="rt-box-title">⭐ Attendance &amp; Result</div>
          <div className="rt-box-body">
            <div className="rt-stats"><span>Attendance</span><b>{record.attendance ? `${record.attendance}%` : '—'}</b><span>Class Rank</span><b>{summary.rank}</b></div>
            <div className="rt-award">This term I am<strong>{progressWord(summary.percentage).toUpperCase()}</strong></div>
          </div>
        </section>
      </div>

      <div className="rt-remark">
        <b>{copy.remark}</b>
        <span>{record.classTeacherRemark || record.remarks || '—'}</span>
        <span className="rt-sticker">{copy.sticker}</span>
      </div>

      <Signatures />
      <div className="rt-legend">{['★★★★ Excellent', '★★★ Very Good', '★★ Good', '★ Developing'].map(item => <span key={item}>{item}</span>)}</div>
      <Footer record={record} note={copy.foot} />
    </div>
  </article>
}

// --- Registry ---------------------------------------------------------------------------
// "classic" is the design this module has always shipped. It stays the default so an existing
// school's report cards look exactly the same until somebody deliberately picks another.

export const REPORT_TEMPLATES = [
  { id: 'classic', label: 'Classic Navy', family: 'Formal', Component: null },
  { id: 'navy', label: 'Professional Navy & Gold', family: 'Formal', Component: props => <FormalTemplate theme="navy" {...props} /> },
  { id: 'emerald', label: 'Emerald Modern', family: 'Formal', Component: props => <FormalTemplate theme="emerald" {...props} /> },
  { id: 'royal', label: 'Royal Academic', family: 'Formal', Component: props => <FormalTemplate theme="royal" {...props} /> },
  { id: 'minimal', label: 'Minimal Premium', family: 'Formal', Component: props => <FormalTemplate theme="minimal" {...props} /> },
  { id: 'happy', label: 'Happy Learning', family: 'Kids', Component: props => <KidsTemplate theme="happy" {...props} /> },
  { id: 'space', label: 'Space Explorer', family: 'Kids', Component: props => <KidsTemplate theme="space" {...props} /> },
  { id: 'jungle', label: 'Jungle Adventure', family: 'Kids', Component: props => <KidsTemplate theme="jungle" {...props} /> },
  { id: 'candy', label: 'Candy Pop', family: 'Kids', Component: props => <KidsTemplate theme="candy" {...props} /> },
  { id: 'rainbow', label: 'Full Colour Rainbow', family: 'Kids', Component: props => <KidsTemplate theme="rainbow" {...props} /> },
]

export const templateById = id => REPORT_TEMPLATES.find(item => item.id === id) || REPORT_TEMPLATES[0]

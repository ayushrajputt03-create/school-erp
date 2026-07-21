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

import React from 'react'
import './reportCardTemplates.css'

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

function FormalTemplate({ theme, school, student, exam, record, summary, parts, photo, logo }) {
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
      <table className="rt-table">
        <thead><tr><th>Subject</th><th>Max</th><th>Obtained</th><th>%</th><th>Grade</th><th>Remark</th></tr></thead>
        <tbody>{summary.subjects.map(row => <tr key={row.subject}>
          <td>{row.subject}</td><td>{row.maxMarks}</td><td className="rt-total">{row.obtained}</td>
          <td>{row.percent}%</td><td className="rt-grade">{row.grade}</td><td>{row.remarks || '—'}</td>
        </tr>)}</tbody>
        <tfoot><tr><td>Overall</td><td>{summary.totalMax}</td><td className="rt-total">{summary.obtained}</td><td>{summary.percentage}%</td><td className="rt-grade">{summary.grade}</td><td>{summary.promotionStatus}</td></tr></tfoot>
      </table>

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

function KidsTemplate({ theme, school, student, exam, record, summary, parts, photo, logo }) {
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
      <table className="rt-table">
        <thead><tr><th>Learning Area</th><th>Marks</th><th>Grade</th><th>Stars</th><th>Progress</th><th>Teacher&apos;s Note</th></tr></thead>
        <tbody>{summary.subjects.map(row => <tr key={row.subject}>
          <td>{row.subject}</td><td>{row.obtained} / {row.maxMarks}</td>
          <td className="rt-grade">{row.grade}</td><td className="rt-stars">{stars(row.percent)}</td>
          <td><span className="rt-pill">{progressWord(row.percent)}</span></td><td>{row.remarks || '—'}</td>
        </tr>)}</tbody>
      </table>

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

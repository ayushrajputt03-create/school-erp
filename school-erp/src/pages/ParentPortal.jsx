import { useState } from 'react'
import { supabase } from '../lib/supabase'

// Parent portal — phone number se login, read-only access
export default function ParentPortal() {
  const [phone, setPhone] = useState('')
  const [student, setStudent] = useState(null)
  const [fees, setFees] = useState([])
  const [attendance, setAttendance] = useState([])
  const [notices, setNotices] = useState([])
  const [marks, setMarks] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('overview')

  async function searchByPhone(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setStudent(null)

    const { data: students } = await supabase
      .from('students').select('*').eq('phone', phone.trim())

    if (!students || students.length === 0) {
      setError('Is phone number se koi student nahi mila. School se sampark karein.')
      setLoading(false)
      return
    }

    const s = students[0]
    setStudent(s)

    // Fetch all data in parallel
    const [{ data: feesData }, { data: attData }, { data: noticeData }, { data: marksData }] = await Promise.all([
      supabase.from('fees').select('*').eq('student_id', s.id).order('created_at', { ascending: false }),
      supabase.from('attendance').select('*').eq('student_id', s.id).order('date', { ascending: false }).limit(30),
      supabase.from('notices').select('*').in('class_target', ['All', s.class]).order('created_at', { ascending: false }).limit(10),
      supabase.from('marks').select('*').eq('student_id', s.id).order('created_at', { ascending: false }),
    ])

    if (feesData) setFees(feesData)
    if (attData) setAttendance(attData)
    if (noticeData) setNotices(noticeData)
    if (marksData) setMarks(marksData)
    setLoading(false)
  }

  const presentDays = attendance.filter(a => a.status === 'P').length
  const attendancePct = attendance.length > 0 ? Math.round(presentDays / attendance.length * 100) : 0
  const pendingFees = fees.filter(f => f.status !== 'Paid').reduce((a, f) => a + f.amount, 0)

  const tabs = ['overview', 'fees', 'attendance', 'marks', 'notices']

  if (!student) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', fontFamily: 'system-ui, sans-serif', padding: '1rem' }}>
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: '2rem', width: '100%', maxWidth: 400 }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <p style={{ fontSize: 40 }}>🏫</p>
            <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Parent Portal</h1>
            <p style={{ fontSize: 13, color: '#6b7280' }}>Apne child ki details dekhne ke liye registered phone number enter karo</p>
          </div>
          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 12px', marginBottom: '1rem', fontSize: 13, color: '#DC2626' }}>
              {error}
            </div>
          )}
          <form onSubmit={searchByPhone}>
            <label style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 4 }}>Registered Mobile Number</label>
            <input
              type="tel" value={phone} onChange={e => setPhone(e.target.value)} required
              placeholder="10-digit mobile number"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: 10, fontSize: 14, boxSizing: 'border-box', marginBottom: '1rem' }}
            />
            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: '10px', background: '#1D4ED8', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Searching...' : 'View Details →'}
            </button>
          </form>
          <p style={{ textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginTop: '1rem' }}>
            Sirf read-only access · Data safe hai
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#1D4ED8', padding: '1.25rem 1.5rem', color: '#fff' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 2 }}>🏫 Parent Portal</p>
              <h2 style={{ fontSize: 18, fontWeight: 600 }}>{student.name}</h2>
              <p style={{ fontSize: 13, opacity: 0.8 }}>Class {student.class}-{student.section} · Admission: {student.admission_date}</p>
            </div>
            <button onClick={() => { setStudent(null); setPhone('') }}
              style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
              Logout
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '1.5rem' }}>
        {/* Quick stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: '1.5rem' }}>
          {[
            { label: 'Attendance', value: `${attendancePct}%`, sub: `${presentDays}/${attendance.length} days`, color: attendancePct >= 75 ? '#166534' : '#DC2626', bg: attendancePct >= 75 ? '#DCFCE7' : '#FEF2F2' },
            { label: 'Fees Pending', value: `₹${pendingFees.toLocaleString('en-IN')}`, sub: `${fees.filter(f => f.status !== 'Paid').length} months`, color: pendingFees > 0 ? '#854D0E' : '#166534', bg: pendingFees > 0 ? '#FEF9C3' : '#DCFCE7' },
            { label: 'Notices', value: notices.length, sub: 'New updates', color: '#1D4ED8', bg: '#EFF6FF' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '0.75rem 1rem' }}>
              <p style={{ fontSize: 11, color: s.color, opacity: 0.8, marginBottom: 2 }}>{s.label}</p>
              <p style={{ fontSize: 20, fontWeight: 600, color: s.color }}>{s.value}</p>
              <p style={{ fontSize: 11, color: s.color, opacity: 0.7 }}>{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: '1rem', background: '#F3F4F6', borderRadius: 10, padding: 4 }}>
          {tabs.map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              style={{ flex: 1, padding: '7px 4px', borderRadius: 7, fontSize: 12, border: 'none', cursor: 'pointer', textTransform: 'capitalize',
              background: activeTab === t ? '#fff' : 'transparent',
              color: activeTab === t ? '#1D4ED8' : '#6b7280',
              fontWeight: activeTab === t ? 500 : 400,
              boxShadow: activeTab === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '1.25rem' }}>

          {activeTab === 'overview' && (
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: '1rem' }}>Student Info</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
                {[
                  ['Name', student.name], ['Class', `${student.class}-${student.section}`],
                  ['Date of Birth', student.dob || '—'], ['Admission Date', student.admission_date],
                  ['Guardian', student.guardian_name || '—'], ['Phone', student.phone],
                  ['Address', student.address || '—'], ['Status', student.status || 'Active'],
                ].map(([label, value]) => (
                  <div key={label} style={{ background: '#F9FAFB', borderRadius: 8, padding: '10px 12px' }}>
                    <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>{label}</p>
                    <p style={{ fontWeight: 500, color: '#374151' }}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'fees' && (
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: '1rem' }}>Fee Status</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  {['Month', 'Amount', 'Paid On', 'Status'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, color: '#6b7280', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {fees.map(f => (
                    <tr key={f.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '10px 10px' }}>{f.month}</td>
                      <td style={{ padding: '10px 10px' }}>₹{f.amount?.toLocaleString('en-IN')}</td>
                      <td style={{ padding: '10px 10px', color: '#6b7280' }}>{f.paid_on || '—'}</td>
                      <td style={{ padding: '10px 10px' }}>
                        <span style={{
                          background: f.status === 'Paid' ? '#DCFCE7' : f.status === 'Pending' ? '#FEF9C3' : '#FEF2F2',
                          color: f.status === 'Paid' ? '#166534' : f.status === 'Pending' ? '#854D0E' : '#DC2626',
                          padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500
                        }}>{f.status}</span>
                      </td>
                    </tr>
                  ))}
                  {fees.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#9CA3AF' }}>Koi fee record nahi</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'attendance' && (
            <div>
              <div style={{ display: 'flex', gap: 16, marginBottom: '1rem' }}>
                <span style={{ fontSize: 13, background: '#DCFCE7', color: '#166534', padding: '4px 12px', borderRadius: 20 }}>Present: {presentDays}</span>
                <span style={{ fontSize: 13, background: '#FEF2F2', color: '#DC2626', padding: '4px 12px', borderRadius: 20 }}>Absent: {attendance.length - presentDays}</span>
                <span style={{ fontSize: 13, background: '#EFF6FF', color: '#1D4ED8', padding: '4px 12px', borderRadius: 20 }}>{attendancePct}%</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px,1fr))', gap: 6 }}>
                {attendance.map(a => (
                  <div key={a.id} style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 8, background: a.status === 'P' ? '#DCFCE7' : '#FEF2F2', border: `1px solid ${a.status === 'P' ? '#BBF7D0' : '#FECACA'}` }}>
                    <p style={{ fontSize: 16 }}>{a.status === 'P' ? '✅' : '❌'}</p>
                    <p style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>{new Date(a.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'marks' && (
            <div>
              {['Final Exam', 'Mid Term', 'Unit Test 1', 'Unit Test 2'].map(exam => {
                const examMarks = marks.filter(m => m.exam === exam)
                if (examMarks.length === 0) return null
                const total = examMarks.reduce((a, m) => a + m.marks, 0)
                const max = examMarks.reduce((a, m) => a + (m.max_marks || 100), 0)
                const pct = Math.round(total / max * 100)
                return (
                  <div key={exam} style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <h4 style={{ fontSize: 14, fontWeight: 500 }}>{exam}</h4>
                      <span style={{ fontSize: 13, fontWeight: 600, background: pct >= 60 ? '#DCFCE7' : '#FEF2F2', color: pct >= 60 ? '#166534' : '#DC2626', padding: '3px 10px', borderRadius: 20 }}>{pct}%</span>
                    </div>
                    {examMarks.map(m => (
                      <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#F9FAFB', borderRadius: 8, marginBottom: 4, fontSize: 13 }}>
                        <span>{m.subject}</span>
                        <span style={{ fontWeight: 500 }}>{m.marks}/{m.max_marks || 100}</span>
                      </div>
                    ))}
                  </div>
                )
              })}
              {marks.length === 0 && <p style={{ textAlign: 'center', color: '#9CA3AF', padding: '2rem' }}>Koi marks available nahi</p>}
            </div>
          )}

          {activeTab === 'notices' && (
            <div>
              {notices.map(n => (
                <div key={n.id} style={{ padding: '1rem', borderRadius: 8, background: '#F9FAFB', marginBottom: 8, borderLeft: '3px solid #1D4ED8' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, background: '#EFF6FF', color: '#1D4ED8', padding: '2px 8px', borderRadius: 20, fontWeight: 500 }}>{n.type}</span>
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>{new Date(n.created_at).toLocaleDateString('en-IN')}</span>
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{n.title}</p>
                  {n.description && <p style={{ fontSize: 12, color: '#6b7280' }}>{n.description}</p>}
                  {n.due_date && <p style={{ fontSize: 11, color: '#854D0E', marginTop: 4 }}>📅 Due: {n.due_date}</p>}
                </div>
              ))}
              {notices.length === 0 && <p style={{ textAlign: 'center', color: '#9CA3AF', padding: '2rem' }}>Koi notice nahi</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

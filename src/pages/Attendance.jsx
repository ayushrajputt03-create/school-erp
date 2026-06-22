import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import DatePicker from '../DatePicker'

export default function Attendance() {
  const [students, setStudents] = useState([])
  const [attendance, setAttendance] = useState({})
  const [filterClass, setFilterClass] = useState('All')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState([])

  useEffect(() => { fetchStudents(); fetchHistory() }, [])
  useEffect(() => { fetchAttendanceForDate() }, [date])

  async function fetchStudents() {
    const { data } = await supabase.from('students').select('id,name,class,section').order('name')
    if (data) setStudents(data)
  }

  async function fetchAttendanceForDate() {
    const { data } = await supabase.from('attendance').select('student_id,status').eq('date', date)
    if (data) {
      const map = {}
      data.forEach(r => map[r.student_id] = r.status)
      setAttendance(map)
    }
  }

  async function fetchHistory() {
    const { data } = await supabase.from('attendance').select('date,status').order('date', { ascending: false }).limit(100)
    if (data) {
      const grouped = {}
      data.forEach(r => {
        if (!grouped[r.date]) grouped[r.date] = { P: 0, A: 0 }
        grouped[r.date][r.status] = (grouped[r.date][r.status] || 0) + 1
      })
      setHistory(Object.entries(grouped).slice(0, 10))
    }
  }

  async function saveAttendance() {
    setSaving(true)
    const records = students.map(s => ({
      student_id: s.id,
      date,
      status: attendance[s.id] || 'A'
    }))
    const { error } = await supabase.from('attendance').upsert(records, { onConflict: 'student_id,date' })
    setSaving(false)
    if (!error) { alert('Attendance save ho gayi!'); fetchHistory() }
    else alert('Error: ' + error.message)
  }

  const filtered = students.filter(s => filterClass === 'All' || s.class === filterClass)
  const classes = [...new Set(students.map(s => s.class))].sort((a,b) => parseInt(a)-parseInt(b))

  const markAll = (status) => {
    const updated = { ...attendance }
    filtered.forEach(s => updated[s.id] = status)
    setAttendance(updated)
  }

  const toggle = (id, status) => setAttendance(prev => ({ ...prev, [id]: status }))

  const presentCount = filtered.filter(s => attendance[s.id] === 'P').length
  const absentCount = filtered.filter(s => attendance[s.id] === 'A').length

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Attendance</h2>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>Roz ki haziri mark karo</p>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '1.25rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 2 }}>Date</label>
      <DatePicker value={date} onChange={setDate}
              style={{ padding: '7px 10px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13 }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 2 }}>Class</label>
            <select value={filterClass} onChange={e=>setFilterClass(e.target.value)}
              style={{ padding: '7px 10px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13 }}>
              <option>All</option>
              {classes.map(c => <option key={c}>Class {c}</option>)}
            </select>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <button onClick={() => markAll('P')} style={{ padding: '7px 12px', background: '#DCFCE7', color: '#166534', border: '1px solid #BBF7D0', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
              Sab Present
            </button>
            <button onClick={() => markAll('A')} style={{ padding: '7px 12px', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
              Sab Absent
            </button>
            <button onClick={saveAttendance} disabled={saving}
              style={{ padding: '7px 14px', background: '#1D4ED8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: saving?'not-allowed':'pointer', opacity: saving?0.7:1 }}>
              {saving ? 'Saving...' : '✓ Save Attendance'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, marginBottom: '1rem' }}>
          <span style={{ fontSize: 13, color: '#166534', background: '#DCFCE7', padding: '4px 12px', borderRadius: 20 }}>✓ Present: {presentCount}</span>
          <span style={{ fontSize: 13, color: '#DC2626', background: '#FEF2F2', padding: '4px 12px', borderRadius: 20 }}>✗ Absent: {absentCount}</span>
          <span style={{ fontSize: 13, color: '#6b7280', background: '#F3F4F6', padding: '4px 12px', borderRadius: 20 }}>— Not marked: {filtered.length - presentCount - absentCount}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
          {filtered.map(s => (
            <div key={s.id} style={{
              background: '#F9FAFB', borderRadius: 8, padding: '10px 12px',
              border: attendance[s.id] === 'P' ? '1px solid #BBF7D0' : attendance[s.id] === 'A' ? '1px solid #FECACA' : '1px solid #e5e7eb'
            }}>
              <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>{s.name.split(' ')[0]}</p>
              <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>Cl.{s.class}-{s.section}</p>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => toggle(s.id, 'P')}
                  style={{ flex: 1, padding: '3px 0', fontSize: 12, borderRadius: 4, cursor: 'pointer', border: '1px solid #BBF7D0',
                  background: attendance[s.id] === 'P' ? '#16A34A' : '#fff', color: attendance[s.id] === 'P' ? '#fff' : '#166534' }}>P</button>
                <button onClick={() => toggle(s.id, 'A')}
                  style={{ flex: 1, padding: '3px 0', fontSize: 12, borderRadius: 4, cursor: 'pointer', border: '1px solid #FECACA',
                  background: attendance[s.id] === 'A' ? '#DC2626' : '#fff', color: attendance[s.id] === 'A' ? '#fff' : '#DC2626' }}>A</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '1.25rem' }}>
        <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: '1rem' }}>Attendance History</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              {['Date','Present','Absent','Percentage'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: '#6b7280', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.map(([d, rec]) => {
              const p = rec.P || 0; const a = rec.A || 0; const pct = p+a > 0 ? Math.round(p/(p+a)*100) : 0
              return (
                <tr key={d} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '10px 12px' }}>{d}</td>
                  <td style={{ padding: '10px 12px', color: '#166534' }}>{p}</td>
                  <td style={{ padding: '10px 12px', color: '#DC2626' }}>{a}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ background: pct>=75?'#DCFCE7':'#FEF2F2', color: pct>=75?'#166534':'#DC2626', padding:'2px 8px', borderRadius: 20, fontSize: 11 }}>
                      {pct}%
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const PERIODS = ['8:00-8:45','8:45-9:30','9:30-10:15','10:15-10:30 (Break)','10:30-11:15','11:15-12:00','12:00-12:45','12:45-1:15 (Lunch)','1:15-2:00','2:00-2:45']
const SUBJECTS = ['Mathematics','Science','English','Hindi','Social Studies','Computer','Physical Education','Art','Break','Lunch','Free Period']
const CLASSES = ['1','2','3','4','5','6','7','8','9','10']
const SUBJECT_COLORS = {
  'Mathematics':'#EFF6FF','Science':'#F0FDF4','English':'#FFF7ED','Hindi':'#FDF4FF',
  'Social Studies':'#FFFBEB','Computer':'#F0F9FF','Physical Education':'#FFF1F2',
  'Art':'#FAF5FF','Break':'#F3F4F6','Lunch':'#FEF9C3','Free Period':'#F9FAFB'
}
const SUBJECT_TEXT = {
  'Mathematics':'#1D4ED8','Science':'#166534','English':'#C2410C','Hindi':'#7E22CE',
  'Social Studies':'#854D0E','Computer':'#0369A1','Physical Education':'#BE123C',
  'Art':'#6D28D9','Break':'#4B5563','Lunch':'#854D0E','Free Period':'#9CA3AF'
}

export default function Timetable() {
  const [selectedClass, setSelectedClass] = useState('6')
  const [timetable, setTimetable] = useState({})
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchTimetable() }, [selectedClass])

  async function fetchTimetable() {
    const { data } = await supabase.from('timetable').select('*').eq('class', selectedClass)
    const map = {}
    if (data) data.forEach(r => { if (!map[r.day]) map[r.day] = {}; map[r.day][r.period] = r.subject })
    setTimetable(map)
  }

  async function saveTimetable() {
    setSaving(true)
    const records = []
    DAYS.forEach(day => PERIODS.forEach(period => {
      const sub = timetable[day]?.[period]
      if (sub) records.push({ class: selectedClass, day, period, subject: sub })
    }))
    await supabase.from('timetable').delete().eq('class', selectedClass)
    if (records.length) await supabase.from('timetable').insert(records)
    setSaving(false)
    setEditMode(false)
    alert('Timetable save ho gaya!')
  }

  const updateCell = (day, period, value) => {
    setTimetable(prev => ({ ...prev, [day]: { ...(prev[day]||{}), [period]: value } }))
  }

  const isBreak = (period) => period.includes('Break') || period.includes('Lunch')

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1.5rem' }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:600 }}>Class Timetable</h2>
          <p style={{ fontSize:13, color:'#6b7280', marginTop:2 }}>Har class ka schedule manage karo</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {editMode ? (
            <>
              <button onClick={()=>setEditMode(false)} style={{ padding:'7px 14px', border:'1px solid #D1D5DB', borderRadius:8, fontSize:13, cursor:'pointer', background:'#fff' }}>Cancel</button>
              <button onClick={saveTimetable} disabled={saving}
                style={{ padding:'7px 14px', background:'#1D4ED8', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' }}>
                {saving?'Saving...':'✓ Save'}
              </button>
            </>
          ) : (
            <>
              <button onClick={()=>window.print()} style={{ padding:'7px 14px', border:'1px solid #D1D5DB', borderRadius:8, fontSize:13, cursor:'pointer', background:'#fff' }}>🖨️ Print</button>
              <button onClick={()=>setEditMode(true)} style={{ padding:'7px 14px', background:'#1D4ED8', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' }}>✏️ Edit</button>
            </>
          )}
        </div>
      </div>

      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:'1.25rem' }}>
        <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:'1rem' }}>
          <label style={{ fontSize:13, color:'#374151', fontWeight:500 }}>Class:</label>
          <div style={{ display:'flex', gap:6 }}>
            {CLASSES.map(c => (
              <button key={c} onClick={()=>setSelectedClass(c)}
                style={{ padding:'5px 12px', borderRadius:20, fontSize:12, cursor:'pointer', border:'1px solid',
                borderColor: selectedClass===c?'#1D4ED8':'#D1D5DB',
                background: selectedClass===c?'#1D4ED8':'#fff',
                color: selectedClass===c?'#fff':'#374151',
                fontWeight: selectedClass===c?500:400 }}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr>
                <th style={{ padding:'10px 12px', textAlign:'left', background:'#1D4ED8', color:'#fff', borderRadius:'8px 0 0 0', fontSize:12, fontWeight:500 }}>Period / Time</th>
                {DAYS.map((d,i) => (
                  <th key={d} style={{ padding:'10px 12px', textAlign:'center', background:'#1D4ED8', color:'#fff', fontSize:12, fontWeight:500, borderRadius: i===DAYS.length-1?'0 8px 0 0':0 }}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERIODS.map((period, pi) => (
                <tr key={period} style={{ background: isBreak(period)?'#F9FAFB':'#fff' }}>
                  <td style={{ padding:'8px 12px', borderBottom:'1px solid #F3F4F6', fontSize:11, color:'#6b7280', whiteSpace:'nowrap', fontWeight: isBreak(period)?600:400 }}>
                    {period}
                  </td>
                  {DAYS.map(day => {
                    const sub = timetable[day]?.[period] || ''
                    if (isBreak(period)) {
                      return <td key={day} style={{ padding:'8px 12px', textAlign:'center', borderBottom:'1px solid #F3F4F6', fontSize:11, color:'#9CA3AF', background:'#F9FAFB' }}>{period.includes('Break')?'Break':'Lunch'}</td>
                    }
                    return (
                      <td key={day} style={{ padding:'6px 8px', borderBottom:'1px solid #F3F4F6', textAlign:'center' }}>
                        {editMode ? (
                          <select value={sub} onChange={e=>updateCell(day,period,e.target.value)}
                            style={{ width:'100%', padding:'4px 6px', border:'1px solid #D1D5DB', borderRadius:6, fontSize:11, background:'#fff', cursor:'pointer' }}>
                            <option value="">—</option>
                            {SUBJECTS.filter(s=>!s.includes('Break')&&!s.includes('Lunch')).map(s=><option key={s}>{s}</option>)}
                          </select>
                        ) : (
                          sub ? (
                            <span style={{ display:'inline-block', padding:'4px 8px', borderRadius:6, fontSize:11, fontWeight:500,
                              background: SUBJECT_COLORS[sub]||'#F3F4F6', color: SUBJECT_TEXT[sub]||'#374151' }}>
                              {sub}
                            </span>
                          ) : <span style={{ color:'#D1D5DB', fontSize:11 }}>—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {editMode && (
          <div style={{ marginTop:'1rem', padding:'10px 12px', background:'#FFFBEB', borderRadius:8, border:'1px solid #FCD34D', fontSize:12, color:'#854D0E' }}>
            💡 Har cell mein subject select karo, phir Save karo
          </div>
        )}
      </div>
    </div>
  )
}

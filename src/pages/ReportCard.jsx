import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const SUBJECTS = ['Mathematics','Science','English','Hindi','Social Studies','Computer']
const EXAMS = ['Unit Test 1','Mid Term','Unit Test 2','Final Exam']

export default function ReportCard() {
  const [students, setStudents] = useState([])
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [selectedExam, setSelectedExam] = useState('Final Exam')
  const [marks, setMarks] = useState({})
  const [maxMarks, setMaxMarks] = useState({})
  const [saving, setSaving] = useState(false)
  const [allReports, setAllReports] = useState([])
  const printRef = useRef()

  useEffect(() => { fetchStudents() }, [])
  useEffect(() => { if (selectedStudent) fetchMarks() }, [selectedStudent, selectedExam])

  async function fetchStudents() {
    const { data } = await supabase.from('students').select('id,name,class,section').order('name')
    if (data) setStudents(data)
  }

  async function fetchMarks() {
    const { data } = await supabase.from('marks').select('*')
      .eq('student_id', selectedStudent.id).eq('exam', selectedExam)
    const m = {}, mx = {}
    SUBJECTS.forEach(s => { m[s] = ''; mx[s] = 100 })
    if (data) data.forEach(r => { m[r.subject] = r.marks; mx[r.subject] = r.max_marks || 100 })
    setMarks(m); setMaxMarks(mx)
  }

  async function saveMarks() {
    setSaving(true)
    const records = SUBJECTS.map(s => ({
      student_id: selectedStudent.id,
      exam: selectedExam,
      subject: s,
      marks: parseInt(marks[s]) || 0,
      max_marks: parseInt(maxMarks[s]) || 100
    }))
    const { error } = await supabase.from('marks').upsert(records, { onConflict: 'student_id,exam,subject' })
    setSaving(false)
    if (!error) alert('Marks save ho gaye!')
    else alert('Error: ' + error.message)
  }

  const totalObtained = SUBJECTS.reduce((a,s) => a + (parseInt(marks[s])||0), 0)
  const totalMax = SUBJECTS.reduce((a,s) => a + (parseInt(maxMarks[s])||100), 0)
  const percentage = totalMax > 0 ? Math.round(totalObtained/totalMax*100) : 0
  const grade = percentage>=90?'A+':percentage>=80?'A':percentage>=70?'B+':percentage>=60?'B':percentage>=50?'C':'F'
  const gradeColor = percentage>=60?'#166534':percentage>=50?'#854D0E':'#DC2626'
  const gradeBg = percentage>=60?'#DCFCE7':percentage>=50?'#FEF9C3':'#FEF2F2'

  const handlePrint = () => window.print()

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1.5rem' }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:600 }}>Report Card</h2>
          <p style={{ fontSize:13, color:'#6b7280', marginTop:2 }}>Marks enter karo aur report card banao</p>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:'1rem' }}>
        {/* Student list */}
        <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:'1rem', height:'fit-content' }}>
          <p style={{ fontSize:13, fontWeight:500, marginBottom:'0.75rem' }}>Student select karo</p>
          <select value={selectedExam} onChange={e=>setSelectedExam(e.target.value)}
            style={{ width:'100%', padding:'7px 10px', border:'1px solid #D1D5DB', borderRadius:8, fontSize:13, marginBottom:'0.75rem' }}>
            {EXAMS.map(e=><option key={e}>{e}</option>)}
          </select>
          <div style={{ maxHeight:400, overflowY:'auto' }}>
            {students.map(s => (
              <div key={s.id} onClick={() => setSelectedStudent(s)}
                style={{ padding:'8px 10px', borderRadius:8, cursor:'pointer', marginBottom:4, fontSize:13,
                background: selectedStudent?.id===s.id ? '#EFF6FF' : '#F9FAFB',
                color: selectedStudent?.id===s.id ? '#1D4ED8' : '#374151',
                border: selectedStudent?.id===s.id ? '1px solid #BFDBFE' : '1px solid transparent',
                fontWeight: selectedStudent?.id===s.id ? 500 : 400 }}>
                {s.name}
                <span style={{ fontSize:11, color:'#9CA3AF', marginLeft:6 }}>Cl.{s.class}-{s.section}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Marks entry + report card */}
        {selectedStudent ? (
          <div>
            <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:'1.25rem', marginBottom:'1rem' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
                <div>
                  <p style={{ fontSize:15, fontWeight:500 }}>{selectedStudent.name}</p>
                  <p style={{ fontSize:12, color:'#6b7280' }}>Class {selectedStudent.class}-{selectedStudent.section} · {selectedExam}</p>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={handlePrint} style={{ padding:'7px 14px', border:'1px solid #D1D5DB', borderRadius:8, fontSize:13, cursor:'pointer', background:'#fff' }}>🖨️ Print</button>
                  <button onClick={saveMarks} disabled={saving}
                    style={{ padding:'7px 14px', background:'#1D4ED8', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' }}>
                    {saving?'Saving...':'Save Marks'}
                  </button>
                </div>
              </div>

              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ borderBottom:'1px solid #e5e7eb' }}>
                    {['Subject','Max Marks','Marks Obtained','%','Grade'].map(h=>(
                      <th key={h} style={{ textAlign:'left', padding:'8px 12px', fontSize:12, color:'#6b7280', fontWeight:500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SUBJECTS.map(sub => {
                    const m = parseInt(marks[sub])||0
                    const mx = parseInt(maxMarks[sub])||100
                    const pct = Math.round(m/mx*100)
                    const g = pct>=90?'A+':pct>=80?'A':pct>=70?'B+':pct>=60?'B':pct>=50?'C':'F'
                    return (
                      <tr key={sub} style={{ borderBottom:'1px solid #F3F4F6' }}>
                        <td style={{ padding:'8px 12px', fontWeight:500 }}>{sub}</td>
                        <td style={{ padding:'8px 12px' }}>
                          <input type="number" value={maxMarks[sub]} onChange={e=>setMaxMarks({...maxMarks,[sub]:e.target.value})}
                            style={{ width:60, padding:'4px 6px', border:'1px solid #D1D5DB', borderRadius:6, fontSize:13, textAlign:'center' }} />
                        </td>
                        <td style={{ padding:'8px 12px' }}>
                          <input type="number" value={marks[sub]} onChange={e=>setMarks({...marks,[sub]:e.target.value})}
                            min={0} max={maxMarks[sub]}
                            style={{ width:70, padding:'4px 6px', border:'1px solid #D1D5DB', borderRadius:6, fontSize:13, textAlign:'center' }} />
                        </td>
                        <td style={{ padding:'8px 12px', color:'#6b7280' }}>{marks[sub]?`${pct}%`:'—'}</td>
                        <td style={{ padding:'8px 12px' }}>
                          {marks[sub] ? <span style={{ background: pct>=60?'#DCFCE7':pct>=50?'#FEF9C3':'#FEF2F2', color: pct>=60?'#166534':pct>=50?'#854D0E':'#DC2626', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:500 }}>{g}</span> : '—'}
                        </td>
                      </tr>
                    )
                  })}
                  <tr style={{ borderTop:'2px solid #e5e7eb', background:'#F9FAFB' }}>
                    <td style={{ padding:'10px 12px', fontWeight:600 }}>Total</td>
                    <td style={{ padding:'10px 12px', fontWeight:600 }}>{totalMax}</td>
                    <td style={{ padding:'10px 12px', fontWeight:600 }}>{totalObtained}</td>
                    <td style={{ padding:'10px 12px', fontWeight:600 }}>{percentage}%</td>
                    <td style={{ padding:'10px 12px' }}>
                      <span style={{ background:gradeBg, color:gradeColor, padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:600 }}>{grade}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Printable Report Card */}
            <div ref={printRef} id="printable-report" style={{ background:'#fff', borderRadius:12, border:'2px solid #1D4ED8', padding:'1.5rem' }}>
              <div style={{ textAlign:'center', borderBottom:'2px solid #1D4ED8', paddingBottom:'1rem', marginBottom:'1rem' }}>
                <h2 style={{ fontSize:20, fontWeight:700, color:'#1D4ED8' }}>🏫 School Name ERP</h2>
                <p style={{ fontSize:13, color:'#6b7280' }}>Progress Report Card</p>
                <p style={{ fontSize:12, color:'#9CA3AF' }}>{selectedExam} · Academic Year 2025-26</p>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1rem', fontSize:13 }}>
                <div><strong>Student:</strong> {selectedStudent.name}</div>
                <div><strong>Class:</strong> {selectedStudent.class}-{selectedStudent.section}</div>
                <div><strong>Exam:</strong> {selectedExam}</div>
                <div><strong>Date:</strong> {new Date().toLocaleDateString('en-IN')}</div>
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, marginBottom:'1rem' }}>
                <thead>
                  <tr style={{ background:'#EFF6FF' }}>
                    {['Subject','Max Marks','Obtained','%','Grade'].map(h=>(
                      <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:12, fontWeight:600, color:'#1D4ED8', border:'1px solid #BFDBFE' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SUBJECTS.map(sub => {
                    const m = parseInt(marks[sub])||0; const mx = parseInt(maxMarks[sub])||100
                    const pct = Math.round(m/mx*100)
                    const g = pct>=90?'A+':pct>=80?'A':pct>=70?'B+':pct>=60?'B':pct>=50?'C':'F'
                    return (
                      <tr key={sub}>
                        <td style={{ padding:'8px 12px', border:'1px solid #e5e7eb' }}>{sub}</td>
                        <td style={{ padding:'8px 12px', border:'1px solid #e5e7eb', textAlign:'center' }}>{mx}</td>
                        <td style={{ padding:'8px 12px', border:'1px solid #e5e7eb', textAlign:'center' }}>{m}</td>
                        <td style={{ padding:'8px 12px', border:'1px solid #e5e7eb', textAlign:'center' }}>{pct}%</td>
                        <td style={{ padding:'8px 12px', border:'1px solid #e5e7eb', textAlign:'center', fontWeight:600 }}>{g}</td>
                      </tr>
                    )
                  })}
                  <tr style={{ background:'#F9FAFB', fontWeight:600 }}>
                    <td style={{ padding:'8px 12px', border:'1px solid #e5e7eb' }}>Total</td>
                    <td style={{ padding:'8px 12px', border:'1px solid #e5e7eb', textAlign:'center' }}>{totalMax}</td>
                    <td style={{ padding:'8px 12px', border:'1px solid #e5e7eb', textAlign:'center' }}>{totalObtained}</td>
                    <td style={{ padding:'8px 12px', border:'1px solid #e5e7eb', textAlign:'center' }}>{percentage}%</td>
                    <td style={{ padding:'8px 12px', border:'1px solid #e5e7eb', textAlign:'center' }}>
                      <span style={{ background:gradeBg, color:gradeColor, padding:'2px 8px', borderRadius:20 }}>{grade}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, textAlign:'center', paddingTop:'1rem', borderTop:'1px solid #e5e7eb' }}>
                <div><p style={{ fontSize:11, color:'#9CA3AF' }}>Class Teacher</p><div style={{ marginTop:30, borderTop:'1px solid #374151', paddingTop:4, fontSize:12 }}>Signature</div></div>
                <div><p style={{ fontSize:11, color:'#9CA3AF' }}>Principal</p><div style={{ marginTop:30, borderTop:'1px solid #374151', paddingTop:4, fontSize:12 }}>Signature</div></div>
                <div><p style={{ fontSize:11, color:'#9CA3AF' }}>Parent/Guardian</p><div style={{ marginTop:30, borderTop:'1px solid #374151', paddingTop:4, fontSize:12 }}>Signature</div></div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:'3rem', textAlign:'center', color:'#9CA3AF' }}>
            <p style={{ fontSize:40, marginBottom:12 }}>📋</p>
            <p style={{ fontSize:15, fontWeight:500, color:'#374151', marginBottom:4 }}>Student select karo</p>
            <p style={{ fontSize:13 }}>Left side se student choose karo marks enter karne ke liye</p>
          </div>
        )}
      </div>

      <style>{`@media print { body > *:not(#printable-report) { display: none; } #printable-report { border: 2px solid #1D4ED8 !important; } }`}</style>
    </div>
  )
}

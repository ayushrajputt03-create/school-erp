import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import DatePicker from '../DatePicker'

const SUBJECTS = ['Mathematics','Science','English','Hindi','Social Studies','Computer','Physical Education','Art']
const CLASSES = ['1','2','3','4','5','6','7','8','9','10','11','12']

export default function Teachers() {
  const [teachers, setTeachers] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ name:'', email:'', phone:'', subject:'Mathematics', classes:[], qualification:'', joining_date: new Date().toISOString().split('T')[0], salary:'' })

  useEffect(() => { fetchTeachers() }, [])

  async function fetchTeachers() {
    const { data } = await supabase.from('teachers').select('*').order('created_at', { ascending: false })
    if (data) setTeachers(data)
  }

  async function addTeacher(e) {
    e.preventDefault()
    const { error } = await supabase.from('teachers').insert([{ ...form, classes: form.classes.join(',') }])
    if (!error) { setShowModal(false); setForm({ name:'', email:'', phone:'', subject:'Mathematics', classes:[], qualification:'', joining_date: new Date().toISOString().split('T')[0], salary:'' }); fetchTeachers() }
    else alert('Error: ' + error.message)
  }

  async function deleteTeacher(id) {
    if (!confirm('Is teacher ko delete karo?')) return
    await supabase.from('teachers').delete().eq('id', id)
    fetchTeachers()
  }

  const toggleClass = (cls) => {
    setForm(prev => ({
      ...prev,
      classes: prev.classes.includes(cls) ? prev.classes.filter(c=>c!==cls) : [...prev.classes, cls]
    }))
  }

  const filtered = teachers.filter(t => t.name.toLowerCase().includes(search.toLowerCase()) || t.subject?.toLowerCase().includes(search.toLowerCase()))

  const inputStyle = { width:'100%', padding:'8px 10px', border:'1px solid #D1D5DB', borderRadius:8, fontSize:13, boxSizing:'border-box', fontFamily:'inherit' }
  const labelStyle = { fontSize:12, color:'#374151', display:'block', marginBottom:4 }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1.5rem' }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:600 }}>Teachers</h2>
          <p style={{ fontSize:13, color:'#6b7280', marginTop:2 }}>Staff management</p>
        </div>
        <button onClick={() => setShowModal(true)} style={{ padding:'8px 16px', background:'#1D4ED8', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' }}>
          + Add Teacher
        </button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:'1.5rem' }}>
        {[
          { label:'Total Staff', value: teachers.length },
          { label:'Active', value: teachers.filter(t=>t.status!=='Inactive').length },
          { label:'Total Salary/Month', value:`₹${teachers.reduce((a,t)=>a+(parseInt(t.salary)||0),0).toLocaleString('en-IN')}` },
        ].map(s => (
          <div key={s.label} style={{ background:'#F3F4F6', borderRadius:10, padding:'1rem' }}>
            <p style={{ fontSize:12, color:'#6b7280', marginBottom:4 }}>{s.label}</p>
            <p style={{ fontSize:24, fontWeight:600 }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:'1.25rem' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Naam ya subject se dhundo..."
          style={{ width:'100%', padding:'8px 10px', border:'1px solid #D1D5DB', borderRadius:8, fontSize:13, marginBottom:'1rem', boxSizing:'border-box' }} />
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px,1fr))', gap:12 }}>
          {filtered.map(t => (
            <div key={t.id} style={{ background:'#F9FAFB', borderRadius:10, border:'1px solid #e5e7eb', padding:'1rem' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                  <div style={{ width:40, height:40, borderRadius:'50%', background:'#EFF6FF', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:600, color:'#1D4ED8' }}>
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p style={{ fontWeight:500, fontSize:14 }}>{t.name}</p>
                    <p style={{ fontSize:12, color:'#6b7280' }}>{t.subject}</p>
                  </div>
                </div>
                <button onClick={() => deleteTeacher(t.id)} style={{ padding:'3px 8px', background:'#FEF2F2', color:'#DC2626', border:'1px solid #FECACA', borderRadius:6, fontSize:11, cursor:'pointer' }}>✕</button>
              </div>
              <div style={{ marginTop:12, display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, fontSize:12 }}>
                <div><span style={{ color:'#9CA3AF' }}>Phone: </span>{t.phone||'—'}</div>
                <div><span style={{ color:'#9CA3AF' }}>Salary: </span>₹{parseInt(t.salary||0).toLocaleString('en-IN')}</div>
                <div><span style={{ color:'#9CA3AF' }}>Joined: </span>{t.joining_date||'—'}</div>
                <div><span style={{ color:'#9CA3AF' }}>Classes: </span>{t.classes||'—'}</div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p style={{ color:'#9CA3AF', fontSize:13, textAlign:'center', padding:'2rem', gridColumn:'1/-1' }}>Koi teacher nahi mili</p>}
        </div>
      </div>

      {showModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#fff', borderRadius:12, padding:'1.5rem', width:500, maxHeight:'90vh', overflowY:'auto' }}>
            <h3 style={{ fontSize:16, fontWeight:600, marginBottom:'1.25rem' }}>Naya Teacher Add Karo</h3>
            <form onSubmit={addTeacher}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={labelStyle}>Full Name *</label>
                  <input required style={inputStyle} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Teacher ka naam" />
                </div>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input type="email" style={inputStyle} value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="teacher@school.com" />
                </div>
                <div>
                  <label style={labelStyle}>Phone *</label>
                  <input required style={inputStyle} value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="10-digit" />
                </div>
                <div>
                  <label style={labelStyle}>Subject</label>
                  <select style={inputStyle} value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})}>
                    {SUBJECTS.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Qualification</label>
                  <input style={inputStyle} value={form.qualification} onChange={e=>setForm({...form,qualification:e.target.value})} placeholder="B.Ed, M.A. etc." />
                </div>
                <div>
                  <label style={labelStyle}>Joining Date</label>
          <DatePicker value={form.joining_date} onChange={value=>setForm({...form,joining_date:value})} />
                </div>
                <div>
                  <label style={labelStyle}>Monthly Salary (₹)</label>
                  <input type="number" style={inputStyle} value={form.salary} onChange={e=>setForm({...form,salary:e.target.value})} placeholder="15000" />
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={labelStyle}>Classes Assigned</label>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                    {CLASSES.map(c => (
                      <button key={c} type="button" onClick={() => toggleClass(c)}
                        style={{ padding:'4px 10px', borderRadius:6, fontSize:12, cursor:'pointer', border:'1px solid',
                        borderColor: form.classes.includes(c)?'#1D4ED8':'#D1D5DB',
                        background: form.classes.includes(c)?'#EFF6FF':'#fff',
                        color: form.classes.includes(c)?'#1D4ED8':'#374151' }}>
                        Cl.{c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:'1.25rem', paddingTop:'1rem', borderTop:'1px solid #e5e7eb' }}>
                <button type="button" onClick={()=>setShowModal(false)} style={{ padding:'8px 16px', border:'1px solid #D1D5DB', borderRadius:8, fontSize:13, cursor:'pointer', background:'#fff' }}>Cancel</button>
                <button type="submit" style={{ padding:'8px 16px', background:'#1D4ED8', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' }}>Add Teacher</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

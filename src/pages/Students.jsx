import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const CLASSES = ['1','2','3','4','5','6','7','8','9','10','11','12']
const SECTIONS = ['A','B','C','D']

export default function Students() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')
  const [filterClass, setFilterClass] = useState('All')
  const [form, setForm] = useState({ name:'', class:'1', section:'A', dob:'', guardian_name:'', phone:'', address:'' })

  useEffect(() => { fetchStudents() }, [])

  async function fetchStudents() {
    setLoading(true)
    const { data, error } = await supabase.from('students').select('*').order('created_at', { ascending: false })
    if (!error) setStudents(data)
    setLoading(false)
  }

  async function addStudent(e) {
    e.preventDefault()
    const { error } = await supabase.from('students').insert([form])
    if (!error) { setShowModal(false); setForm({ name:'', class:'1', section:'A', dob:'', guardian_name:'', phone:'', address:'' }); fetchStudents() }
    else alert('Error: ' + error.message)
  }

  async function deleteStudent(id) {
    if (!confirm('Is student ko delete karo?')) return
    const { error } = await supabase.from('students').delete().eq('id', id)
    if (!error) fetchStudents()
  }

  const filtered = students.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.phone?.includes(search)
    const matchClass = filterClass === 'All' || s.class === filterClass
    return matchSearch && matchClass
  })

  const inputStyle = { width: '100%', padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }
  const labelStyle = { fontSize: 12, color: '#374151', display: 'block', marginBottom: 4 }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>Students</h2>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>Saare students manage karo</p>
        </div>
        <button onClick={() => setShowModal(true)} style={{ padding: '8px 16px', background: '#1D4ED8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
          + Add Student
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Students', value: students.length },
          { label: 'Active', value: students.filter(s=>s.status==='Active').length },
          { label: 'Class 1-5', value: students.filter(s=>parseInt(s.class)<=5).length },
          { label: 'Class 6-12', value: students.filter(s=>parseInt(s.class)>5).length },
        ].map(stat => (
          <div key={stat.label} style={{ background: '#F3F4F6', borderRadius: 10, padding: '1rem' }}>
            <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{stat.label}</p>
            <p style={{ fontSize: 24, fontWeight: 600 }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '1.25rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: '1rem' }}>
          <input
            value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Name ya phone se dhundo..."
            style={{ flex: 1, padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13 }}
          />
          <select value={filterClass} onChange={e=>setFilterClass(e.target.value)}
            style={{ padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13 }}>
            <option>All</option>
            {CLASSES.map(c => <option key={c}>Class {c}</option>)}
          </select>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: '#6b7280', padding: '2rem' }}>Loading...</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                {['Naam', 'Class', 'Guardian', 'Phone', 'Admission', 'Status', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: '#6b7280', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 500 }}>{s.name}</td>
                  <td style={{ padding: '10px 12px' }}>Class {s.class}-{s.section}</td>
                  <td style={{ padding: '10px 12px' }}>{s.guardian_name}</td>
                  <td style={{ padding: '10px 12px' }}>{s.phone}</td>
                  <td style={{ padding: '10px 12px', color: '#6b7280' }}>{s.admission_date}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ background: '#DCFCE7', color: '#166534', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 500 }}>
                      {s.status || 'Active'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <button onClick={() => deleteStudent(s.id)}
                      style={{ padding: '4px 8px', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#9CA3AF' }}>Koi student nahi mila</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Student Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', width: 500, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: '1.25rem' }}>Naya Student Add Karo</h3>
            <form onSubmit={addStudent}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>Full Name *</label>
                  <input required style={inputStyle} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Student ka poora naam" />
                </div>
                <div>
                  <label style={labelStyle}>Class *</label>
                  <select required style={inputStyle} value={form.class} onChange={e=>setForm({...form,class:e.target.value})}>
                    {CLASSES.map(c=><option key={c} value={c}>Class {c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Section</label>
                  <select style={inputStyle} value={form.section} onChange={e=>setForm({...form,section:e.target.value})}>
                    {SECTIONS.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Date of Birth</label>
                  <input type="date" style={inputStyle} value={form.dob} onChange={e=>setForm({...form,dob:e.target.value})} />
                </div>
                <div>
                  <label style={labelStyle}>Guardian Name</label>
                  <input style={inputStyle} value={form.guardian_name} onChange={e=>setForm({...form,guardian_name:e.target.value})} placeholder="Mata / Pita ka naam" />
                </div>
                <div>
                  <label style={labelStyle}>Phone Number</label>
                  <input type="tel" style={inputStyle} value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="10-digit number" />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>Address</label>
                  <input style={inputStyle} value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder="Ghar ka pata" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '8px 16px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, cursor: 'pointer', background: '#fff' }}>
                  Cancel
                </button>
                <button type="submit" style={{ padding: '8px 16px', background: '#1D4ED8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                  Add Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

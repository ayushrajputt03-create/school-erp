import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import DatePicker from '../DatePicker'

const MONTHS = ['April','May','June','July','August','September','October','November','December','January','February','March']

export default function Fees() {
  const [fees, setFees] = useState([])
  const [students, setStudents] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [filterStatus, setFilterStatus] = useState('All')
  const [form, setForm] = useState({ student_id: '', amount: '', month: 'June', paid_on: new Date().toISOString().split('T')[0], status: 'Paid' })

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [{ data: s }, { data: f }] = await Promise.all([
      supabase.from('students').select('id,name,class').order('name'),
      supabase.from('fees').select('*,students(name,class)').order('created_at', { ascending: false })
    ])
    if (s) { setStudents(s); setForm(prev => ({ ...prev, student_id: s[0]?.id || '' })) }
    if (f) setFees(f)
  }

  async function addFee(e) {
    e.preventDefault()
    const { error } = await supabase.from('fees').insert([{ ...form, amount: parseInt(form.amount) }])
    if (!error) { setShowModal(false); fetchAll() }
    else alert('Error: ' + error.message)
  }

  async function updateStatus(id, status) {
    await supabase.from('fees').update({ status }).eq('id', id)
    fetchAll()
  }

  async function deleteFee(id) {
    if (!confirm('Is record ko delete karo?')) return
    await supabase.from('fees').delete().eq('id', id)
    fetchAll()
  }

  const filtered = filterStatus === 'All' ? fees : fees.filter(f => f.status === filterStatus)
  const totalPaid = fees.filter(f=>f.status==='Paid').reduce((a,f)=>a+f.amount, 0)
  const totalPending = fees.filter(f=>f.status==='Pending').reduce((a,f)=>a+f.amount, 0)
  const totalOverdue = fees.filter(f=>f.status==='Overdue').reduce((a,f)=>a+f.amount, 0)

  const badgeStyle = (status) => {
    const map = { Paid: {bg:'#DCFCE7',color:'#166534'}, Pending: {bg:'#FEF9C3',color:'#854D0E'}, Overdue: {bg:'#FEF2F2',color:'#DC2626'} }
    return { ...map[status], padding:'2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500 }
  }

  const inputStyle = { width: '100%', padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }
  const labelStyle = { fontSize: 12, color: '#374151', display: 'block', marginBottom: 4 }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>Fee Management</h2>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>Fees track aur collect karo</p>
        </div>
        <button onClick={() => setShowModal(true)} style={{ padding: '8px 16px', background: '#1D4ED8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
          + Record Payment
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: '1.5rem' }}>
        {[
          { label: 'Fees Collected', value: `₹${totalPaid.toLocaleString('en-IN')}`, color: '#166534', bg: '#DCFCE7' },
          { label: 'Pending', value: `₹${totalPending.toLocaleString('en-IN')}`, color: '#854D0E', bg: '#FEF9C3' },
          { label: 'Overdue', value: `₹${totalOverdue.toLocaleString('en-IN')}`, color: '#DC2626', bg: '#FEF2F2' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '1rem' }}>
            <p style={{ fontSize: 12, color: s.color, marginBottom: 4, opacity: 0.8 }}>{s.label}</p>
            <p style={{ fontSize: 24, fontWeight: 600, color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '1.25rem' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
          {['All','Paid','Pending','Overdue'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: '1px solid',
              borderColor: filterStatus===s ? '#1D4ED8' : '#D1D5DB',
              background: filterStatus===s ? '#EFF6FF' : '#fff',
              color: filterStatus===s ? '#1D4ED8' : '#374151' }}>
              {s}
            </button>
          ))}
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              {['Student','Class','Amount','Month','Paid On','Status','Action'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: '#6b7280', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(f => (
              <tr key={f.id} style={{ borderBottom: '1px solid #F3F4F6', borderLeft: `3px solid ${f.status==='Paid'?'#16A34A':f.status==='Pending'?'#CA8A04':'#DC2626'}` }}>
                <td style={{ padding: '10px 12px', fontWeight: 500 }}>{f.students?.name || 'Unknown'}</td>
                <td style={{ padding: '10px 12px' }}>Class {f.students?.class}</td>
                <td style={{ padding: '10px 12px' }}>₹{f.amount?.toLocaleString('en-IN')}</td>
                <td style={{ padding: '10px 12px' }}>{f.month}</td>
                <td style={{ padding: '10px 12px', color: '#6b7280' }}>{f.paid_on || '—'}</td>
                <td style={{ padding: '10px 12px' }}>
                  <select value={f.status} onChange={e => updateStatus(f.id, e.target.value)}
                    style={{ ...badgeStyle(f.status), border: 'none', cursor: 'pointer', fontSize: 11 }}>
                    <option>Paid</option><option>Pending</option><option>Overdue</option>
                  </select>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <button onClick={() => deleteFee(f.id)}
                    style={{ padding: '4px 8px', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#9CA3AF' }}>Koi record nahi</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', width: 440 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: '1.25rem' }}>Fee Payment Record</h3>
            <form onSubmit={addFee}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Student *</label>
                <select required style={inputStyle} value={form.student_id} onChange={e=>setForm({...form,student_id:e.target.value})}>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name} (Cl.{s.class})</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Amount (₹) *</label>
                  <input required type="number" style={inputStyle} value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder="2500" />
                </div>
                <div>
                  <label style={labelStyle}>Month *</label>
                  <select required style={inputStyle} value={form.month} onChange={e=>setForm({...form,month:e.target.value})}>
                    {MONTHS.map(m=><option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Payment Date</label>
          <DatePicker value={form.paid_on} onChange={value=>setForm({...form,paid_on:value})} />
                </div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select style={inputStyle} value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
                    <option>Paid</option><option>Pending</option><option>Overdue</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '8px 16px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, cursor: 'pointer', background: '#fff' }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 16px', background: '#1D4ED8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

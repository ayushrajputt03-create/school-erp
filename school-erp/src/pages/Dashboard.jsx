import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
  const [stats, setStats] = useState({ students: 0, presentToday: 0, feesCollected: 0, feesPending: 0 })
  const [recentStudents, setRecentStudents] = useState([])
  const [recentFees, setRecentFees] = useState([])

  useEffect(() => { fetchStats() }, [])

  async function fetchStats() {
    const today = new Date().toISOString().split('T')[0]
    const [{ count: studentCount }, { data: attData }, { data: feesData }, { data: recentS }, { data: recentF }] = await Promise.all([
      supabase.from('students').select('*', { count: 'exact', head: true }),
      supabase.from('attendance').select('status').eq('date', today),
      supabase.from('fees').select('amount,status'),
      supabase.from('students').select('name,class,section,admission_date').order('created_at', { ascending: false }).limit(5),
      supabase.from('fees').select('amount,status,month,students(name)').order('created_at', { ascending: false }).limit(5),
    ])
    const presentToday = attData?.filter(a => a.status === 'P').length || 0
    const feesCollected = feesData?.filter(f=>f.status==='Paid').reduce((a,f)=>a+f.amount,0) || 0
    const feesPending = feesData?.filter(f=>f.status!=='Paid').reduce((a,f)=>a+f.amount,0) || 0
    setStats({ students: studentCount||0, presentToday, feesCollected, feesPending })
    if (recentS) setRecentStudents(recentS)
    if (recentF) setRecentFees(recentF)
  }

  const statCards = [
    { label: 'Total Students', value: stats.students, sub: 'Enrolled', icon: '👥' },
    { label: "Today's Attendance", value: stats.presentToday || '—', sub: 'Present today', icon: '📅' },
    { label: 'Fees Collected', value: `₹${stats.feesCollected.toLocaleString('en-IN')}`, sub: 'Total paid', icon: '✅' },
    { label: 'Fees Pending', value: `₹${stats.feesPending.toLocaleString('en-IN')}`, sub: 'Outstanding', icon: '⚠️' },
  ]

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Dashboard</h2>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>School overview — {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: '1.5rem' }}>
        {statCards.map(s => (
          <div key={s.label} style={{ background: '#F3F4F6', borderRadius: 10, padding: '1rem' }}>
            <p style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</p>
            <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{s.label}</p>
            <p style={{ fontSize: 24, fontWeight: 600 }}>{s.value}</p>
            <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{s.sub}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '1.25rem' }}>
          <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: '1rem' }}>Recent Admissions</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                {['Name','Class','Date'].map(h => <th key={h} style={{ textAlign:'left', padding:'6px 8px', fontSize:11, color:'#6b7280', fontWeight:500 }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {recentStudents.map((s,i) => (
                <tr key={i} style={{ borderBottom: '1px solid #F9FAFB' }}>
                  <td style={{ padding:'8px 8px', fontWeight:500 }}>{s.name}</td>
                  <td style={{ padding:'8px 8px', color:'#6b7280' }}>Cl.{s.class}-{s.section}</td>
                  <td style={{ padding:'8px 8px', color:'#6b7280', fontSize:12 }}>{s.admission_date}</td>
                </tr>
              ))}
              {recentStudents.length === 0 && <tr><td colSpan={3} style={{ textAlign:'center', padding:'1.5rem', color:'#9CA3AF', fontSize:13 }}>Koi data nahi</td></tr>}
            </tbody>
          </table>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '1.25rem' }}>
          <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: '1rem' }}>Recent Fee Transactions</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                {['Student','Amount','Status'].map(h => <th key={h} style={{ textAlign:'left', padding:'6px 8px', fontSize:11, color:'#6b7280', fontWeight:500 }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {recentFees.map((f,i) => (
                <tr key={i} style={{ borderBottom: '1px solid #F9FAFB' }}>
                  <td style={{ padding:'8px 8px', fontWeight:500 }}>{f.students?.name}</td>
                  <td style={{ padding:'8px 8px' }}>₹{f.amount?.toLocaleString('en-IN')}</td>
                  <td style={{ padding:'8px 8px' }}>
                    <span style={{
                      background: f.status==='Paid'?'#DCFCE7':f.status==='Pending'?'#FEF9C3':'#FEF2F2',
                      color: f.status==='Paid'?'#166534':f.status==='Pending'?'#854D0E':'#DC2626',
                      padding:'2px 8px', borderRadius:20, fontSize:11
                    }}>{f.status}</span>
                  </td>
                </tr>
              ))}
              {recentFees.length === 0 && <tr><td colSpan={3} style={{ textAlign:'center', padding:'1.5rem', color:'#9CA3AF', fontSize:13 }}>Koi data nahi</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

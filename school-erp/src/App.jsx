import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Students from './pages/Students'
import Attendance from './pages/Attendance'
import Fees from './pages/Fees'
import Teachers from './pages/Teachers'
import ReportCard from './pages/ReportCard'
import WhatsAppReminders from './pages/WhatsAppReminders'
import ParentPortal from './pages/ParentPortal'
import Timetable from './pages/Timetable'
import NoticeBoard from './pages/NoticeBoard'
import IDCards from './pages/IDCards'

const NAV = [
  { id: 'dashboard',   label: 'Dashboard',         icon: '🏠' },
  { id: 'students',    label: 'Students',           icon: '👥' },
  { id: 'teachers',    label: 'Teachers',           icon: '👨‍🏫' },
  { id: 'attendance',  label: 'Attendance',         icon: '📅' },
  { id: 'fees',        label: 'Fee Management',     icon: '💰' },
  { id: 'whatsapp',    label: 'WhatsApp Reminders', icon: '📱' },
  { id: 'reportcard',  label: 'Report Cards',       icon: '📋' },
  { id: 'timetable',   label: 'Timetable',          icon: '🕐' },
  { id: 'notices',     label: 'Notice Board',       icon: '📌' },
  { id: 'idcards',     label: 'ID Cards',           icon: '🪪' },
  { id: 'parent',      label: 'Parent Portal',      icon: '👨‍👩‍👦' },
]

const PAGES = {
  dashboard: Dashboard, students: Students, teachers: Teachers,
  attendance: Attendance, fees: Fees, whatsapp: WhatsAppReminders,
  reportcard: ReportCard, timetable: Timetable, notices: NoticeBoard,
  idcards: IDCards, parent: ParentPortal,
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState('dashboard')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session); setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#6b7280' }}>
      Loading...
    </div>
  )

  if (!session) return <Login />

  // Parent portal has its own full-screen layout
  if (currentPage === 'parent') {
    return (
      <div>
        <div style={{ padding: '8px 16px', background: '#1D4ED8', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setCurrentPage('dashboard')}
            style={{ color: '#fff', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>
            ← Admin Panel
          </button>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Parent Portal Preview</span>
        </div>
        <ParentPortal />
      </div>
    )
  }

  const PageComponent = PAGES[currentPage] || Dashboard

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      {/* Sidebar */}
      <aside style={{ width: 220, background: '#fff', borderRight: '1px solid #e5e7eb', padding: '1rem 0', display: 'flex', flexDirection: 'column', position: 'fixed', height: '100vh', overflowY: 'auto' }}>
        <div style={{ padding: '0 1rem 1rem', borderBottom: '1px solid #e5e7eb', marginBottom: '0.5rem' }}>
          <h1 style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>🏫 School ERP</h1>
          <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>Admin Panel</p>
        </div>

        {NAV.map(item => (
          <button key={item.id} onClick={() => setCurrentPage(item.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 1rem', fontSize: 13,
              cursor: 'pointer', border: 'none', textAlign: 'left', width: '100%',
              background: currentPage === item.id ? '#EFF6FF' : 'transparent',
              color: currentPage === item.id ? '#1D4ED8' : '#374151',
              fontWeight: currentPage === item.id ? 500 : 400,
              borderLeft: currentPage === item.id ? '3px solid #1D4ED8' : '3px solid transparent' }}>
            <span style={{ fontSize: 15 }}>{item.icon}</span>
            {item.label}
          </button>
        ))}

        <div style={{ marginTop: 'auto', padding: '1rem', borderTop: '1px solid #e5e7eb' }}>
          <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.user.email}</p>
          <button onClick={() => supabase.auth.signOut()}
            style={{ fontSize: 11, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ marginLeft: 220, flex: 1, padding: '1.75rem', background: '#F9FAFB', minHeight: '100vh' }}>
        <PageComponent />
      </main>
    </div>
  )
}

import React, { useState, useEffect, useRef } from 'react'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDate() {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })
}

function timeAgo(ts) {
  if (!ts) return ''
  const date = ts.toDate ? ts.toDate() : new Date(ts)
  const diff = (Date.now() - date.getTime()) / 1000
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

const categoryIcons = {
  exam: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg>,
  event: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  urgent: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  general: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
}

export default function ParentTopbar({ parentName, notices = [], onLogout }) {
  const [notifOpen, setNotifOpen] = useState(false)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const notifRef = useRef(null)
  const avatarRef = useRef(null)

  useEffect(() => {
    const handler = e => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
      if (avatarRef.current && !avatarRef.current.contains(e.target)) setAvatarOpen(false)
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [])

  const hasUnread = notices.some(n => !n.read)
  const recentNotices = notices.slice(0, 5)

  return <div className="pd-topbar">
    <div className="pd-topbar-left">
      <h2>{getGreeting()}, {parentName?.split(' ')[0] || 'Parent'}</h2>
      <p>{formatDate()}</p>
    </div>

    <div className="pd-topbar-right">
      <button className="pd-topbar-btn" aria-label="Search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </button>

      <div ref={notifRef} style={{ position: 'relative' }}>
        <button className="pd-topbar-btn" onClick={() => { setNotifOpen(v => !v); setAvatarOpen(false) }} aria-label="Notifications">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          {hasUnread && <span className="pd-notification-dot" />}
        </button>

        {notifOpen && <div className="pd-dropdown" style={{ minWidth: 300 }}>
          <div style={{ padding: '12px 14px 8px', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14 }}>Notifications</div>
          {recentNotices.length === 0
            ? <div style={{ padding: '16px 14px', fontSize: 13, color: 'var(--color-text-muted)' }}>No notifications yet</div>
            : recentNotices.map(n => <button key={n.id} className="pd-dropdown-item" onClick={() => setNotifOpen(false)}>
                <span className={`pd-notice-icon ${n.category || 'general'}`} style={{ width: 28, height: 28, borderRadius: 6, flexShrink: 0 }}>
                  {categoryIcons[n.category] || categoryIcons.general}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ fontSize: 12.5 }}>{n.title}</strong>
                  <small style={{ display: 'block' }}>{timeAgo(n.createdAt)}</small>
                </div>
              </button>)
          }
          {notices.length > 5 && <>
            <div className="pd-dropdown-separator" />
            <button className="pd-dropdown-action" style={{ justifyContent: 'center', color: 'var(--color-accent)', fontWeight: 600 }}>
              View all notices
            </button>
          </>}
        </div>}
      </div>

      <div ref={avatarRef} style={{ position: 'relative' }}>
        <button className="pd-avatar-btn" onClick={() => { setAvatarOpen(v => !v); setNotifOpen(false) }}>
          {getInitials(parentName)}
        </button>

        {avatarOpen && <div className="pd-dropdown" style={{ minWidth: 180 }}>
          <button className="pd-dropdown-action" onClick={() => setAvatarOpen(false)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Profile
          </button>
          <button className="pd-dropdown-action" onClick={() => setAvatarOpen(false)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
            Settings
          </button>
          <div className="pd-dropdown-separator" />
          <button className="pd-dropdown-action danger" onClick={onLogout}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Logout
          </button>
        </div>}
      </div>
    </div>
  </div>
}

import React, { useState } from 'react'

function timeAgo(ts) {
  if (!ts) return ''
  const date = ts.toDate ? ts.toDate() : new Date(ts)
  const diff = (Date.now() - date.getTime()) / 1000
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

const icons = {
  exam: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg>,
  event: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  urgent: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  general: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
}

function SkeletonNotices() {
  return <div className="pd-card">
    <div className="pd-card-header">
      <div className="pd-skeleton pd-skeleton-title" style={{ width: 100 }} />
    </div>
    <div className="pd-card-body">
      {[1, 2, 3].map(i =>
        <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <div className="pd-skeleton pd-skeleton-circle" style={{ width: 34, height: 34, borderRadius: 8 }} />
          <div style={{ flex: 1 }}>
            <div className="pd-skeleton pd-skeleton-text" style={{ width: '70%' }} />
            <div className="pd-skeleton pd-skeleton-text" style={{ width: '90%' }} />
          </div>
        </div>
      )}
    </div>
  </div>
}

export default function NoticesFeed({ data = [], loading, error }) {
  const [expandedId, setExpandedId] = useState(null)

  if (loading) return <SkeletonNotices />

  if (error) {
    return <div className="pd-card">
      <div className="pd-card-body">
        <div className="pd-error">
          <p className="pd-error-text">Failed to load notices</p>
          <button className="pd-error-retry">Retry</button>
        </div>
      </div>
    </div>
  }

  const visible = data.slice(0, 6)

  return <div className="pd-card">
    <div className="pd-card-header">
      <div>
        <div className="pd-card-title">Notices</div>
        <div className="pd-card-subtitle">{data.length} notices</div>
      </div>
      {data.length > 6 && <button className="pd-card-link">View all</button>}
    </div>

    <div className="pd-card-body">
      {visible.length === 0
        ? <div className="pd-empty">
            <div className="pd-empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </div>
            <p className="pd-empty-text">No notices for your class</p>
          </div>
        : <div className="pd-notice-list">
            {visible.map(notice => {
              const cat = notice.category || 'general'
              const isExpanded = expandedId === notice.id

              return <div key={notice.id}>
                <button
                  className={`pd-notice-item${!notice.read ? ' unread' : ''}`}
                  onClick={() => setExpandedId(isExpanded ? null : notice.id)}
                >
                  <span className={`pd-notice-icon ${cat}`}>
                    {icons[cat] || icons.general}
                  </span>
                  <div className="pd-notice-content">
                    <div className="pd-notice-title">{notice.title}</div>
                    {!isExpanded && <div className="pd-notice-preview">{notice.body}</div>}
                  </div>
                  <span className="pd-notice-time">{timeAgo(notice.createdAt)}</span>
                </button>
                {isExpanded && <div className="pd-notice-expanded">{notice.body}</div>}
              </div>
            })}
          </div>
      }
    </div>
  </div>
}

import React from 'react'

const actions = [
  {
    id: 'idcard',
    title: 'Download ID Card',
    subtitle: 'Generate QR-coded student ID',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="12" r="2"/><path d="M14 10h4M14 14h2"/></svg>
  },
  {
    id: 'message',
    title: 'Message Class Teacher',
    subtitle: 'Send a direct message',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
  },
  {
    id: 'receipts',
    title: 'Download Fee Receipts',
    subtitle: 'PDF receipts for paid fees',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
  },
]

const arrowIcon = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18"/></svg>

export default function QuickActions({ studentId, studentName }) {
  function handleAction(id) {
    switch (id) {
      case 'idcard':
        alert(`ID Card generation for ${studentName || 'student'} coming soon.`)
        break
      case 'message':
        alert('Message panel coming soon.')
        break
      case 'receipts':
        alert('Receipt downloads coming soon.')
        break
      default:
        break
    }
  }

  return <div className="pd-card">
    <div className="pd-card-header">
      <div className="pd-card-title">Quick Actions</div>
    </div>
    <div className="pd-card-body">
      <div className="pd-actions-list">
        {actions.map(action => <button
          key={action.id}
          className="pd-action-item"
          onClick={() => handleAction(action.id)}
        >
          <span className="pd-action-icon">{action.icon}</span>
          <div className="pd-action-text">
            <div className="pd-action-title">{action.title}</div>
            <div className="pd-action-subtitle">{action.subtitle}</div>
          </div>
          <span className="pd-action-arrow">{arrowIcon}</span>
        </button>)}
      </div>
    </div>
  </div>
}

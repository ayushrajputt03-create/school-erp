import React, { useState, useEffect, useRef } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../../lib/firebase'

const AVATAR_COLORS = [
  { bg: '#ECFDF5', text: '#059669' },
  { bg: '#EFF6FF', text: '#2563EB' },
  { bg: '#FEF3C7', text: '#B45309' },
  { bg: '#FDF2F8', text: '#DB2777' },
]

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export default function ChildSwitcher({ studentIds = [], currentId, onChange, demoChildren }) {
  const [open, setOpen] = useState(false)
  const [students, setStudents] = useState({})
  const ref = useRef(null)

  useEffect(() => {
    const handler = e => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [])

  useEffect(() => {
    if (demoChildren || !db || studentIds.length === 0) return
    const unsubs = studentIds.map(id =>
      onSnapshot(doc(db, 'students', id), snap => {
        if (snap.exists()) {
          setStudents(prev => ({ ...prev, [id]: { id: snap.id, ...snap.data() } }))
        }
      })
    )
    return () => unsubs.forEach(u => u())
  }, [studentIds.join(','), demoChildren])

  const children = (demoChildren || studentIds.map((id) => students[id])).map((data, i) => ({
    id: data?.id || studentIds[i],
    name: data?.name || 'Loading...',
    className: data ? `Class ${data.className || ''}-${data.section || ''}` : '',
    initials: getInitials(data?.name),
    color: AVATAR_COLORS[i % AVATAR_COLORS.length],
  }))

  const current = children.find(c => c.id === currentId) || children[0]
  if (!current) return null

  const hasMultiple = children.length > 1

  return <div ref={ref} style={{ position: 'relative' }}>
    <button className="pd-child-switcher" onClick={() => hasMultiple && setOpen(v => !v)}>
      <div className="pd-child-avatar" style={{ background: current.color?.bg, color: current.color?.text }}>
        {current.initials}
      </div>
      <div className="pd-child-info">
        <div className="pd-child-name">{current.name}</div>
        <div className="pd-child-class">{current.className}</div>
      </div>
      {hasMultiple && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <polyline points="6 9 12 15 18 9"/>
      </svg>}
    </button>

    {open && <div className="pd-child-dropdown">
      {children.map(child =>
        <button
          key={child.id}
          className={`pd-child-option${child.id === currentId ? ' active' : ''}`}
          onClick={() => { onChange(child.id); setOpen(false) }}
        >
          <div className="pd-child-avatar" style={{ background: child.color?.bg, color: child.color?.text, width: 28, height: 28, fontSize: 11 }}>
            {child.initials}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{child.name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>{child.className}</div>
          </div>
          {child.id === currentId && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto' }}>
            <polyline points="20 6 9 17 4 12"/>
          </svg>}
        </button>
      )}
    </div>}
  </div>
}

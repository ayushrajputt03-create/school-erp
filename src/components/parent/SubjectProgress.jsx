import React, { useState, useEffect } from 'react'

const SUBJECT_COLORS = [
  { bg: '#ECFDF5', text: '#059669' },
  { bg: '#EFF6FF', text: '#2563EB' },
  { bg: '#FEF3C7', text: '#B45309' },
  { bg: '#FDF2F8', text: '#DB2777' },
  { bg: '#F5F3FF', text: '#7C3AED' },
  { bg: '#ECFEFF', text: '#0891B2' },
  { bg: '#FFF7ED', text: '#C2410C' },
  { bg: '#F0FDF4', text: '#15803D' },
]

function barColor(pct) {
  if (pct >= 75) return 'green'
  if (pct >= 50) return 'amber'
  return 'red'
}

function SkeletonProgress() {
  return <div className="pd-card">
    <div className="pd-card-header">
      <div className="pd-skeleton pd-skeleton-title" style={{ width: 140 }} />
    </div>
    <div className="pd-card-body">
      {[1, 2, 3, 4].map(i =>
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div className="pd-skeleton pd-skeleton-circle" style={{ width: 32, height: 32 }} />
          <div style={{ flex: 1 }}>
            <div className="pd-skeleton pd-skeleton-text" style={{ width: '40%' }} />
            <div className="pd-skeleton pd-skeleton-bar" />
          </div>
          <div className="pd-skeleton" style={{ width: 40, height: 14 }} />
        </div>
      )}
    </div>
  </div>
}

export default function SubjectProgress({ data = [], loading, error }) {
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    if (data.length > 0 && !loading) {
      const timer = setTimeout(() => setAnimated(true), 50)
      return () => clearTimeout(timer)
    }
  }, [data, loading])

  if (loading) return <SkeletonProgress />

  if (error) {
    return <div className="pd-card">
      <div className="pd-card-body">
        <div className="pd-error">
          <p className="pd-error-text">Failed to load marks</p>
          <button className="pd-error-retry">Retry</button>
        </div>
      </div>
    </div>
  }

  if (data.length === 0) {
    return <div className="pd-card">
      <div className="pd-card-header">
        <div className="pd-card-title">Subject Progress</div>
      </div>
      <div className="pd-card-body">
        <div className="pd-empty">
          <div className="pd-empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5"/>
            </svg>
          </div>
          <p className="pd-empty-text">No exam results yet</p>
        </div>
      </div>
    </div>
  }

  const totalObtained = data.reduce((s, m) => s + (m.marksObtained || 0), 0)
  const totalMax = data.reduce((s, m) => s + (m.totalMarks || 0), 0)
  const average = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0

  return <div className="pd-card">
    <div className="pd-card-header">
      <div>
        <div className="pd-card-title">Subject Progress</div>
        <div className="pd-card-subtitle">Last exam performance</div>
      </div>
    </div>

    <div className="pd-card-body">
      <div className="pd-subject-list">
        {data.map((subject, index) => {
          const pct = subject.totalMarks > 0 ? Math.round((subject.marksObtained / subject.totalMarks) * 100) : 0
          const color = SUBJECT_COLORS[index % SUBJECT_COLORS.length]

          return <div key={subject.id} className="pd-subject-row">
            <div className="pd-subject-icon" style={{ background: color.bg, color: color.text }}>
              {(subject.subjectName || '?')[0].toUpperCase()}
            </div>
            <div className="pd-subject-details">
              <div className="pd-subject-name">{subject.subjectName}</div>
              <div className="pd-subject-bar">
                <div
                  className={`pd-subject-bar-fill ${barColor(pct)}`}
                  style={{ width: animated ? `${pct}%` : '0%' }}
                />
              </div>
            </div>
            <span className="pd-subject-marks">{subject.marksObtained}/{subject.totalMarks}</span>
          </div>
        })}
      </div>

      <div className="pd-subject-avg">
        <span>Overall Average</span>
        <span className="pd-subject-avg-value" style={{ color: barColor(average) === 'green' ? 'var(--color-accent)' : barColor(average) === 'amber' ? 'var(--color-warning)' : 'var(--color-danger)' }}>
          {average}%
        </span>
      </div>
    </div>
  </div>
}

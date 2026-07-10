import React, { useState, useEffect, useRef } from 'react'

function useAnimatedValue(target, duration = 800) {
  const [value, setValue] = useState(0)
  const frameRef = useRef(null)
  const startRef = useRef(null)

  useEffect(() => {
    if (target === 0) { setValue(0); return }
    startRef.current = null

    function tick(now) {
      if (startRef.current === null) startRef.current = now
      const elapsed = now - startRef.current
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(target * eased))
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick)
      }
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [target, duration])

  return value
}

function attendanceColor(pct) {
  if (pct >= 85) return 'green'
  if (pct >= 75) return 'amber'
  return 'red'
}

export default function KPICards({ attendance = 0, feesDue = 0, lastExamAvg = 0, homeworkPending = 0, subjectNames = [] }) {
  const animAttendance = useAnimatedValue(attendance)
  const animFees = useAnimatedValue(feesDue, 1000)
  const animExam = useAnimatedValue(lastExamAvg)
  const animHomework = useAnimatedValue(homeworkPending, 500)

  const feeColor = feesDue > 0 ? 'red' : 'green'
  const examColor = lastExamAvg >= 75 ? 'green' : lastExamAvg >= 50 ? 'amber' : 'red'
  const attColor = attendanceColor(attendance)

  return <div className="pd-kpi-grid">
    <div className="pd-kpi-card">
      <div className="pd-kpi-icon" style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent)' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M9 16l2 2 4-4"/>
        </svg>
      </div>
      <span className="pd-kpi-label">Attendance</span>
      <span className="pd-kpi-value">{animAttendance}%</span>
      <div className="pd-kpi-sub">
        <span className={`pd-kpi-pill ${attColor}`}>
          {attColor === 'green' ? 'Excellent' : attColor === 'amber' ? 'Average' : 'Low'}
        </span>
      </div>
    </div>

    <div className="pd-kpi-card">
      <div className="pd-kpi-icon" style={{ background: feesDue > 0 ? 'var(--color-danger-light)' : 'var(--color-accent-light)', color: feesDue > 0 ? 'var(--color-danger)' : 'var(--color-accent)' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
      </div>
      <span className="pd-kpi-label">Fees Due</span>
      <span className="pd-kpi-value" style={{ color: feesDue > 0 ? 'var(--color-danger)' : 'var(--color-accent)' }}>
        {feesDue > 0 ? `₹${animFees.toLocaleString('en-IN')}` : '₹0'}
      </span>
      <div className="pd-kpi-sub">
        <span className={`pd-kpi-pill ${feeColor}`}>
          {feesDue > 0 ? 'Payment due' : 'All clear'}
        </span>
      </div>
    </div>

    <div className="pd-kpi-card">
      <div className="pd-kpi-icon" style={{ background: 'var(--color-info-light)', color: 'var(--color-info)' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5"/>
        </svg>
      </div>
      <span className="pd-kpi-label">Last Exam Avg</span>
      <span className="pd-kpi-value">{animExam}/100</span>
      <div className="pd-kpi-sub">
        <span className={`pd-kpi-pill ${examColor}`}>
          {examColor === 'green' ? 'Above average' : examColor === 'amber' ? 'Average' : 'Needs improvement'}
        </span>
      </div>
    </div>

    <div className="pd-kpi-card">
      <div className="pd-kpi-icon" style={{ background: 'var(--color-warning-light)', color: 'var(--color-warning)' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
        </svg>
      </div>
      <span className="pd-kpi-label">Homework Pending</span>
      <span className="pd-kpi-value">{animHomework}</span>
      <div className="pd-kpi-sub">
        {subjectNames.length > 0
          ? <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{subjectNames.slice(0, 3).join(', ')}</span>
          : <span className="pd-kpi-pill green">All done</span>
        }
      </div>
    </div>
  </div>
}

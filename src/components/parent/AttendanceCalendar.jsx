import React from 'react'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function pad(n) { return String(n).padStart(2, '0') }

function isToday(year, month, day) {
  const now = new Date()
  return now.getFullYear() === year && now.getMonth() + 1 === month && now.getDate() === day
}

function isFuture(year, month, day) {
  const date = new Date(year, month - 1, day)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date > today
}

function isWeekend(year, month, day) {
  const d = new Date(year, month - 1, day).getDay()
  return d === 0 || d === 6
}

function getCalendarDays(month, year) {
  const firstDay = new Date(year, month - 1, 1).getDay()
  const offset = firstDay === 0 ? 6 : firstDay - 1
  const totalDays = new Date(year, month, 0).getDate()
  const cells = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) cells.push(d)
  return cells
}

function SkeletonCalendar() {
  return <div className="pd-card">
    <div className="pd-card-header">
      <div className="pd-skeleton pd-skeleton-title" style={{ width: 140 }} />
    </div>
    <div className="pd-card-body">
      <div className="pd-calendar-grid">
        {WEEKDAYS.map(d => <div key={d} className="pd-calendar-header">{d}</div>)}
        {Array.from({ length: 35 }, (_, i) =>
          <div key={i} className="pd-skeleton pd-skeleton-circle" style={{ width: 32, height: 32, margin: '2px auto' }} />
        )}
      </div>
    </div>
  </div>
}

export default function AttendanceCalendar({ month, year, data = {}, loading, error, onMonthChange }) {
  if (loading) return <SkeletonCalendar />

  if (error) {
    return <div className="pd-card">
      <div className="pd-card-body">
        <div className="pd-error">
          <p className="pd-error-text">Failed to load attendance</p>
          <button className="pd-error-retry" onClick={() => onMonthChange(month, year)}>Retry</button>
        </div>
      </div>
    </div>
  }

  const cells = getCalendarDays(month, year)
  const statuses = Object.values(data)
  const present = statuses.filter(s => s === 'present').length
  const absent = statuses.filter(s => s === 'absent').length
  const late = statuses.filter(s => s === 'late').length
  const total = present + absent + late
  const rate = total > 0 ? Math.round((present / total) * 100) : 0

  function prevMonth() {
    let m = month - 1, y = year
    if (m < 1) { m = 12; y-- }
    onMonthChange(m, y)
  }

  function nextMonth() {
    let m = month + 1, y = year
    if (m > 12) { m = 1; y++ }
    onMonthChange(m, y)
  }

  return <div className="pd-card">
    <div className="pd-card-header">
      <div>
        <div className="pd-card-title">Attendance</div>
        <div className="pd-card-subtitle">{MONTH_NAMES[month - 1]} {year}</div>
      </div>
      <div className="pd-calendar-nav">
        <button className="pd-calendar-nav-btn" onClick={prevMonth} aria-label="Previous month">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <button className="pd-calendar-nav-btn" onClick={nextMonth} aria-label="Next month">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18"/></svg>
        </button>
      </div>
    </div>

    <div className="pd-card-body">
      <div className="pd-calendar-grid">
        {WEEKDAYS.map(d => <div key={d} className="pd-calendar-header">{d}</div>)}
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} className="pd-calendar-day empty" />

          const dateStr = `${year}-${pad(month)}-${pad(day)}`
          const status = data[dateStr]
          const today = isToday(year, month, day)
          const future = isFuture(year, month, day)
          const weekend = isWeekend(year, month, day)

          let cls = 'pd-calendar-day'
          if (today) cls += ' today'
          else if (future) cls += ' future'
          else if (status === 'present') cls += ' present'
          else if (status === 'absent') cls += ' absent'
          else if (status === 'late') cls += ' late'
          else if (status === 'holiday' || weekend) cls += ' holiday'

          return <div key={dateStr} className={cls}>{day}</div>
        })}
      </div>

      <div className="pd-calendar-summary">
        <div className="pd-calendar-stat">
          <span className="pd-calendar-stat-dot" style={{ background: 'var(--color-accent)' }} />
          Present <strong>{present}</strong>
        </div>
        <div className="pd-calendar-stat">
          <span className="pd-calendar-stat-dot" style={{ background: 'var(--color-danger)' }} />
          Absent <strong>{absent}</strong>
        </div>
        <div className="pd-calendar-stat">
          <span className="pd-calendar-stat-dot" style={{ background: 'var(--color-warning)' }} />
          Late <strong>{late}</strong>
        </div>
        <div className="pd-calendar-stat" style={{ marginLeft: 'auto' }}>
          Rate <strong>{rate}%</strong>
        </div>
      </div>
    </div>
  </div>
}

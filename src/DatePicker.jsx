import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import './DatePicker.css'

const pad = value => String(value).padStart(2, '0')
const toValue = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const fromValue = value => {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}
const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

export default function DatePicker({ value, onChange, required = false, min, max, placeholder = 'Select date', className = '', disabled = false }) {
  const selected = fromValue(value)
  const minDate = fromValue(min)
  const maxDate = fromValue(max)
  const [open, setOpen] = useState(false)
  const [yearMode, setYearMode] = useState(false)
  const [view, setView] = useState(() => selected || new Date())
  const rootRef = useRef(null)
  const yearGridRef = useRef(null)
  const popoverRef = useRef(null)
  const [popoverStyle, setPopoverStyle] = useState({})

  useEffect(() => {
    if (selected) setView(selected)
  }, [value])

  useEffect(() => {
    const close = event => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false)
        setYearMode(false)
      }
    }
    const escape = event => {
      if (event.key === 'Escape') {
        setOpen(false)
        setYearMode(false)
      }
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', escape)
    }
  }, [])

  const cells = useMemo(() => {
    const year = view.getFullYear()
    const month = view.getMonth()
    const firstWeekday = new Date(year, month, 1).getDay()
    const days = new Date(year, month + 1, 0).getDate()
    return [
      ...Array.from({ length: firstWeekday }, () => null),
      ...Array.from({ length: days }, (_, index) => new Date(year, month, index + 1)),
    ]
  }, [view])
  const years = useMemo(() => {
    const thisYear = new Date().getFullYear()
    const start = minDate ? minDate.getFullYear() : thisYear - 100
    const end = maxDate ? maxDate.getFullYear() : thisYear + 20
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  }, [minDate, maxDate])
  const isDisabled = date => {
    const candidate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    return (minDate && candidate < minDate) || (maxDate && candidate > maxDate)
  }
  useLayoutEffect(() => {
    if (!open || !rootRef.current) return
    if (window.innerWidth <= 600) { setPopoverStyle({}); return }
    const rect = rootRef.current.getBoundingClientRect()
    const popoverHeight = 370, popoverWidth = 310, gap = 8
    const spaceBelow = window.innerHeight - rect.bottom
    const goUp = spaceBelow < popoverHeight + gap && rect.top > popoverHeight + gap
    let left = rect.left
    if (left + popoverWidth > window.innerWidth - 12) left = window.innerWidth - popoverWidth - 12
    if (left < 12) left = 12
    setPopoverStyle({
      position: 'fixed',
      top: goUp ? undefined : rect.bottom + gap,
      bottom: goUp ? window.innerHeight - rect.top + gap : undefined,
      left,
      transformOrigin: goUp ? 'bottom left' : 'top left',
      animation: goUp ? 'calendar-open-up .18s ease-out' : 'calendar-open .18s ease-out',
    })
  }, [open])

  useEffect(() => {
    if (!yearMode || !yearGridRef.current) return
    const active = yearGridRef.current.querySelector('button.selected')
    if (active) active.scrollIntoView({ block: 'center', behavior: 'instant' })
  }, [yearMode])

  const display = selected?.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) || ''

  const changeMonth = amount => {
    setView(current => new Date(current.getFullYear(), current.getMonth() + amount, 1))
    setYearMode(false)
  }

  return <div className={`modern-date-picker ${className}`} ref={rootRef}>
    <button type="button" className="modern-date-trigger" disabled={disabled} onClick={() => setOpen(current => !current)}>
      <span className={display ? '' : 'placeholder'}>{display || placeholder}</span>
      <CalendarDays size={16} />
    </button>
    {required && <input className="date-required-proxy" tabIndex="-1" aria-hidden="true" required value={value || ''} onChange={() => {}} />}
    {open && <div className="modern-date-backdrop" onClick={() => { setOpen(false); setYearMode(false) }} />}
    {open && <div className="modern-date-popover" ref={popoverRef} style={popoverStyle}>
      <header>
        <button type="button" className="calendar-arrow" onClick={() => changeMonth(-1)} aria-label="Previous month"><ChevronLeft size={18} /></button>
        <button type="button" className="calendar-title-button" onClick={() => setYearMode(current => !current)}>
          {view.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}<span>▾</span>
        </button>
        <button type="button" className="calendar-arrow" onClick={() => changeMonth(1)} aria-label="Next month"><ChevronRight size={18} /></button>
      </header>
      {yearMode ? <div className="calendar-year-grid" ref={yearGridRef}>
        {years.map(year => <button type="button" key={year} className={year === view.getFullYear() ? 'selected' : ''} onClick={() => { setView(current => new Date(year, current.getMonth(), 1)); setYearMode(false) }}>{year}</button>)}
      </div> : <>
        <div className="calendar-weekdays">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => <span className={index === 0 || index === 6 ? 'weekend' : ''} key={day}>{day}</span>)}</div>
        <div className="calendar-days">
          {cells.map((date, index) => date
            ? <button
                type="button"
                key={toValue(date)}
                disabled={isDisabled(date)}
                className={`${sameDay(date, new Date()) ? 'today' : ''} ${sameDay(date, selected) ? 'selected' : ''} ${date.getDay() === 0 || date.getDay() === 6 ? 'weekend' : ''}`}
                onClick={() => {
                  onChange(toValue(date))
                  setOpen(false)
                }}
              >{date.getDate()}</button>
            : <i key={`blank-${index}`} />)}
        </div>
        <footer>
          <button type="button" onClick={() => { onChange(''); setOpen(false) }}>Clear</button>
          <button type="button" onClick={() => { const current = new Date(); if (!isDisabled(current)) onChange(toValue(current)); setOpen(false) }}>Today</button>
        </footer>
      </>}
    </div>}
  </div>
}

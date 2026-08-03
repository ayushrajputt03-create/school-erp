import React, { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarRange, Loader2, Printer, Save } from 'lucide-react'
import { classOptions, sectionOptions } from '../schoolOptions'
import { buildGrid, dayName, findAllClashes, periodLabel } from '../lib/timetable'
import {
  loadClassTimetable, loadPeriods, loadSlotsForTeachers, loadTeachers, saveClassTimetable,
} from '../lib/timetableStore'
import { safePrint } from '../print-utils'
import TimetableGrid from './TimetableGrid'

/**
 * Timetable Builder — ek class-section ka poora hafta.
 *
 * Edit hone wali cheez `draft` me rehti hai: `${day}|${periodId}` -> slot.
 * Grid se seedhe bind karne par har keystroke poore grid ko dobara banata, aur
 * bade grid me typing me lag dikhne lagta.
 *
 * `readOnly` par yahi component class ka read-only view ban jaata hai — dono
 * ek hi jagah se aate hain isliye kabhi alag nahi dikhte.
 */

const cellKey = (day, periodId) => `${day}|${periodId}`

export default function TimetableBuilder({ schoolId, readOnly = false, schoolName = '' }) {
  const [className, setClassName] = useState(classOptions[9] || classOptions[0])
  const [section, setSection] = useState(sectionOptions[0])
  const [periods, setPeriods] = useState([])
  const [draft, setDraft] = useState({})
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [clashes, setClashes] = useState([])

  const teacherById = useMemo(() => new Map(teachers.map(t => [t.id, t])), [teachers])

  // Periods aur teachers school bhar ke hain — class badalne par dobara laane
  // ka koi matlab nahi.
  useEffect(() => {
    let cancelled = false
    Promise.all([loadPeriods(schoolId), loadTeachers(schoolId)])
      .then(([periodRows, teacherRows]) => {
        if (cancelled) return
        setPeriods(periodRows)
        setTeachers(teacherRows)
      })
      .catch(cause => { if (!cancelled) setError(cause.message) })
    return () => { cancelled = true }
  }, [schoolId])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setNotice('')
    setClashes([])
    loadClassTimetable(schoolId, className, section)
      .then(slots => {
        if (cancelled) return
        const next = {}
        for (const slot of slots) next[cellKey(slot.day_of_week, slot.period_id)] = slot
        setDraft(next)
        setError('')
      })
      .catch(cause => { if (!cancelled) setError(cause.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [schoolId, className, section])

  const slots = useMemo(() => Object.values(draft), [draft])

  const patchCell = (day, periodId, changes) => setDraft(current => {
    const key = cellKey(day, periodId)
    const existing = current[key] || { day_of_week: day, period_id: periodId, subject: '', teacher_id: null, teacher_name: '' }
    return { ...current, [key]: { ...existing, ...changes } }
  })

  const pickTeacher = (day, periodId, teacherId) => {
    const teacher = teacherById.get(teacherId)
    // Naam bhi saath save hota hai — staff record hatne par cell khaali na dikhe.
    patchCell(day, periodId, { teacher_id: teacherId || null, teacher_name: teacher?.name || '' })
  }

  const submit = async () => {
    setError('')
    setNotice('')
    const pending = slots.filter(slot => slot.subject?.trim())

    // Clash sirf un teachers se ho sakta hai jo is grid me lage hain — poore
    // school ke slots laane ki zarurat nahi.
    try {
      const existing = await loadSlotsForTeachers(schoolId, pending.map(slot => slot.teacher_id))
      const found = findAllClashes(
        pending.map(slot => ({ ...slot, class_name: className, section })),
        existing,
        { className, section },
      )
      setClashes(found)
      if (found.length) return
    } catch (cause) {
      setError(cause.message)
      return
    }

    setSaving(true)
    try {
      const saved = await saveClassTimetable(schoolId, className, section, slots)
      const next = {}
      for (const slot of saved) next[cellKey(slot.day_of_week, slot.period_id)] = slot
      setDraft(next)
      setNotice(`Timetable saved for Class ${className}-${section} (${saved.length} period${saved.length === 1 ? '' : 's'}).`)
    } catch (cause) {
      // Database ki clash rok bhi yahin aakar girti hai — do admin ek saath
      // save karein to UI ki jaanch dono ki paas ho jaati hai.
      setError(cause.message)
    } finally {
      setSaving(false)
    }
  }

  const clashKeys = useMemo(
    () => new Set(clashes.map(item => cellKey(item.slot.day_of_week, item.slot.period_id))),
    [clashes],
  )

  const renderCell = ({ period, day }) => {
    const key = cellKey(day.value, period.id)
    const slot = draft[key]
    return <div className={`timetable-edit-cell ${clashKeys.has(key) ? 'has-clash' : ''}`}>
      <input
        value={slot?.subject || ''} placeholder="Subject"
        onChange={event => patchCell(day.value, period.id, { subject: event.target.value })}
      />
      <select value={slot?.teacher_id || ''} onChange={event => pickTeacher(day.value, period.id, event.target.value)}>
        <option value="">Teacher —</option>
        {teachers.map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
      </select>
    </div>
  }

  const heading = `Class ${className} - ${section} — Weekly Timetable`

  return <div className="timetable-builder">
    <div className="panel">
      <div className="timetable-panel-head">
        <div>
          <h3><CalendarRange size={17} /> {readOnly ? 'Class Timetable' : 'Timetable Builder'}</h3>
          <p>{readOnly
            ? 'Select a class and section to view its full week. Print or save as PDF from here.'
            : 'Type a subject and pick a teacher in each cell. Teacher clashes are checked on save.'}</p>
        </div>
      </div>

      {/* Class/section apni alag patti me hain, heading ke bagal me nahi. Wahan
          ye chhoti screen par heading ke neeche khisak kar nazar se chhoot jaate
          the — aur inhe chune bina poora grid hi galat class ka hota hai. */}
      <div className="timetable-toolbar">
        <label>Class
          <select value={className} onChange={event => setClassName(event.target.value)}>
            {classOptions.map(item => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>Section
          <select value={section} onChange={event => setSection(event.target.value)}>
            {sectionOptions.map(item => <option key={item}>{item}</option>)}
          </select>
        </label>
        <span className="timetable-toolbar-current">Showing <strong>Class {className} - {section}</strong></span>
        <button type="button" className="secondary-button" onClick={() => safePrint('.timetable-print-area', { orientation: 'landscape' })}>
          <Printer size={15} /> Print
        </button>
      </div>

      {loading
        ? <div className="timetable-loading"><Loader2 size={18} className="spin" /> Loading timetable...</div>
        : <div className="table-scroll timetable-print-area">
            <TimetableGrid
              periods={periods}
              slots={slots}
              renderCell={readOnly ? undefined : renderCell}
              heading={heading}
              subheading={schoolName}
            />
          </div>}

      {clashes.length > 0 && <div className="form-error timetable-clash-list">
        <AlertTriangle size={15} />
        <div>
          <strong>Teacher clash — nothing was saved:</strong>
          <ul>
            {clashes.map((item, index) => <li key={index}>
              {item.slot.teacher_name || 'Teacher'} pehle se {dayName(item.slot.day_of_week)} ko{' '}
              {periodLabel(periods.find(p => p.id === item.slot.period_id))} me{' '}
              Class {item.clash.class_name}-{item.clash.section} le rahe hain.
            </li>)}
          </ul>
        </div>
      </div>}
      {error && <div className="form-error">{error}</div>}
      {notice && <div className="timetable-notice">{notice}</div>}

      {!readOnly && <div className="modal-actions timetable-actions">
        <button type="button" className="primary-button" onClick={submit} disabled={saving || !periods.length}>
          <Save size={15} /> {saving ? 'Saving...' : 'Save timetable'}
        </button>
      </div>}
    </div>
  </div>
}

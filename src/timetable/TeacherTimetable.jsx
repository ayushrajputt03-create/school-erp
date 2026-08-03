import React, { useEffect, useMemo, useState } from 'react'
import { CalendarRange, Loader2, Printer } from 'lucide-react'
import { TIMETABLE_DAYS, formatRange, teacherWeek } from '../lib/timetable'
import { loadPeriods, loadTeacherTimetable, staffUuidOf } from '../lib/timetableStore'
import { safePrint } from '../print-utils'

/**
 * Teacher ka apna hafta — "Monday 9:00 AM · Class 10-A · Maths".
 *
 * Grid ke bajaye din-wise list jaan-boojh kar: teacher ko ye jaanna hota hai
 * ki "ab kahan jaana hai", aur uske liye samay ke kram me padhi jaane wali
 * list grid se kahin tez hai. Phone par bhi yahi theek baithti hai.
 *
 * `teacherLegacyId` teacher portal ka purana uid hai; database uuid se kaam
 * karta hai, isliye pehle wo badla jaata hai.
 */
export default function TeacherTimetable({ schoolId, teacherLegacyId, teacherName }) {
  const [periods, setPeriods] = useState([])
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    staffUuidOf(schoolId, teacherLegacyId)
      .then(async uuid => {
        if (!uuid) return [[], []]
        return Promise.all([loadPeriods(schoolId), loadTeacherTimetable(schoolId, uuid)])
      })
      .then(([periodRows, slotRows]) => {
        if (cancelled) return
        setPeriods(periodRows || [])
        setSlots(slotRows || [])
        setError('')
      })
      .catch(cause => { if (!cancelled) setError(cause.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [schoolId, teacherLegacyId])

  // teacherWeek slot ke teacher_id se filter karta hai; yahan sab slots pehle
  // se isi teacher ke hain, isliye pehle wale ka id de dete hain.
  const week = useMemo(
    () => teacherWeek(slots, periods, slots[0]?.teacher_id),
    [slots, periods],
  )

  const byDay = useMemo(() => {
    const map = new Map(TIMETABLE_DAYS.map(day => [day.value, []]))
    for (const entry of week) map.get(entry.day)?.push(entry)
    return map
  }, [week])

  if (loading) {
    return <div className="timetable-loading"><Loader2 size={18} className="spin" /> Timetable load ho raha hai...</div>
  }

  return <div className="timetable-teacher">
    <div className="timetable-panel-head">
      <div>
        <h3><CalendarRange size={17} /> Mera Timetable</h3>
        <p>{week.length ? `Hafte me kul ${week.length} periods.` : 'Abhi koi period assign nahi hua hai.'}</p>
      </div>
      {week.length > 0 && <button type="button" className="secondary-button" onClick={() => safePrint('.timetable-teacher-print')}>
        <Printer size={15} /> Print
      </button>}
    </div>

    {error && <div className="form-error">{error}</div>}

    <div className="timetable-teacher-print">
      <div className="timetable-doc-head">
        <h3>{teacherName || 'Teacher'} — Weekly Timetable</h3>
      </div>

      {TIMETABLE_DAYS.map(day => {
        const rows = byDay.get(day.value) || []
        return <section className="timetable-day-block" key={day.value}>
          <h4>{day.name}</h4>
          {rows.length
            ? <ul>
                {rows.map((entry, index) => <li key={index}>
                  <span className="timetable-day-time">
                    {entry.time || formatRange(entry.period?.start_time, entry.period?.end_time) || '—'}
                  </span>
                  <span className="timetable-day-class">Class {entry.className}</span>
                  <span className="timetable-day-subject">{entry.slot.subject}</span>
                  {entry.slot.room && <span className="timetable-day-room">Room {entry.slot.room}</span>}
                </li>)}
              </ul>
            : <p className="timetable-day-free">Is din koi period nahi.</p>}
        </section>
      })}
    </div>
  </div>
}

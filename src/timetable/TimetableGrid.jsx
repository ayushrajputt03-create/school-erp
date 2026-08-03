import React from 'react'
import { TIMETABLE_DAYS, buildGrid, formatRange, isEmptySlot } from '../lib/timetable'

/**
 * Weekly grid — rows = periods (time ke saath), columns = Mon..Sat.
 *
 * Ek hi grid Builder aur read-only view dono jagah chalta hai. Do alag grid
 * likhne par dono kabhi na kabhi alag dikhne lagte hain (yahi purane
 * WeeklyPlanner ke saath hua tha), aur print sirf ek ko sahi milta hai.
 *
 * `renderCell` na ho to grid read-only hai — wahi shakal print par jaati hai.
 */
export default function TimetableGrid({ periods, slots, renderCell, heading, subheading, footer }) {
  const grid = buildGrid(slots)

  return <div className="timetable-grid-wrap">
    {heading && <div className="timetable-doc-head">
      <h3>{heading}</h3>
      {subheading && <p>{subheading}</p>}
    </div>}

    <table className="timetable-grid">
      <thead>
        <tr>
          <th className="timetable-period-col">Period / Time</th>
          {TIMETABLE_DAYS.map(day => <th key={day.value}>{day.name}</th>)}
        </tr>
      </thead>
      <tbody>
        {periods.map(period => {
          // Break ki row me har din ek jaisa hai — chhe khaali cell dikhane ke
          // bajaye ek hi patti, taaki grid me break turant pehchana jaaye.
          if (period.is_break) {
            return <tr key={period.id} className="timetable-break-row">
              <td className="timetable-period-col">
                <strong>{period.label || 'Break'}</strong>
                <small>{formatRange(period.start_time, period.end_time)}</small>
              </td>
              <td colSpan={TIMETABLE_DAYS.length}>{period.label || 'Break'}</td>
            </tr>
          }
          return <tr key={period.id}>
            <td className="timetable-period-col">
              <strong>{period.label || `Period ${period.period_number}`}</strong>
              <small>{formatRange(period.start_time, period.end_time)}</small>
            </td>
            {TIMETABLE_DAYS.map(day => {
              const slot = grid[period.id]?.[day.value] || null
              return <td key={day.value} className="timetable-cell">
                {renderCell
                  ? renderCell({ period, day, slot })
                  : (slot && !isEmptySlot(slot)
                      ? <span className="timetable-chip">
                          <strong>{slot.subject}</strong>
                          {slot.teacher_name && <small>{slot.teacher_name}</small>}
                          {slot.room && <small>Room {slot.room}</small>}
                        </span>
                      // Naam "timetable-empty" nahi ho sakta — app.css me wo
                      // pehle se purane module ka bada empty-state hai
                      // (min-height 220px), aur har khaali cell utni lambi ho
                      // jaati thi.
                      : <span className="timetable-cell-blank">—</span>)}
              </td>
            })}
          </tr>
        })}
        {!periods.length && <tr><td colSpan={TIMETABLE_DAYS.length + 1}>
          <div className="empty-state">
            <strong>No periods yet</strong>
            <p>Set up the bell schedule in the "Periods" tab first — the grid is built from it.</p>
          </div>
        </td></tr>}
      </tbody>
    </table>

    {footer && <div className="timetable-doc-foot">{footer}</div>}
  </div>
}

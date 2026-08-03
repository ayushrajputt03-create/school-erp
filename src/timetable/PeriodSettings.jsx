import React, { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Clock3, Coffee, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { periodLabel, sortPeriods, toInputTime, validatePeriods } from '../lib/timetable'
import { countSlotsForPeriods, loadPeriods, savePeriods } from '../lib/timetableStore'

/**
 * Period Settings — school ka ghanti-schedule.
 *
 * Yahi poore timetable ki buniyaad hai: Builder ki har row ek period hai, aur
 * teacher clash bhi period ke hisaab se hi naapa jaata hai. Isliye ye screen
 * pehle bharni padti hai, warna Builder ke paas dikhane ko rows hi nahi hoti.
 *
 * Saari rows ek saath save hoti hain (jo form me hai wahi sach hai), isliye row
 * hataana matlab database se hataana — aur uske saare slots bhi cascade me
 * jaate hain. Us nuksaan ko chupaya nahi jaata: save se pehle ginti dikhti hai.
 */

// Naya period jodte waqt pichhle ke khatam hone se shuru — school ke periods
// aam taur par ek doosre se jude hote hain, aur isse overlap ki galti apne aap
// nahi hoti. Admin chahe to badal sakta hai.
const nextRowFrom = rows => {
  const last = sortPeriods(rows).at(-1)
  const start = toInputTime(last?.end_time) || '09:00'
  const [hours, minutes] = start.split(':').map(Number)
  const endMinutes = hours * 60 + minutes + 45
  const end = `${String(Math.floor(endMinutes / 60) % 24).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`
  const highest = rows.reduce((max, row) => Math.max(max, Number(row.period_number) || 0), 0)
  return { key: crypto.randomUUID(), period_number: highest + 1, start_time: start, end_time: end, is_break: false, label: '' }
}

// Har row ko ek sthir `key` chahiye. Nayi rows ke paas id nahi hoti aur array
// index se key banane par delete karte hi React galat row ka input state
// dobara istemal karta hai — typed hua time doosri row me kood jaata hai.
const withKeys = rows => rows.map(row => ({ ...row, key: row.id || crypto.randomUUID(), start_time: toInputTime(row.start_time), end_time: toInputTime(row.end_time) }))

export default function PeriodSettings({ schoolId, onSaved }) {
  const [rows, setRows] = useState([])
  const [loaded, setLoaded] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadPeriods(schoolId)
      .then(periods => {
        if (cancelled) return
        setRows(withKeys(periods))
        setLoaded(periods)
        setError('')
      })
      .catch(cause => { if (!cancelled) setError(cause.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [schoolId])

  const errors = useMemo(() => validatePeriods(rows), [rows])
  const errorFor = index => errors.find(item => item.index === index)?.message || ''

  const patch = (index, changes) =>
    setRows(current => current.map((row, i) => (i === index ? { ...row, ...changes } : row)))

  const removeRow = index => setRows(current => current.filter((_, i) => i !== index))

  const submit = async event => {
    event.preventDefault()
    if (errors.length) return
    setError('')
    setNotice('')

    // Jo rows form se hata di gayi hain unke slots bhi jaayenge. Admin ko wahi
    // sankhya dikhakar poochte hain — save ke baad bataane ka koi matlab nahi.
    const keptIds = new Set(rows.filter(row => row.id).map(row => row.id))
    const removedIds = (loaded || []).map(period => period.id).filter(id => !keptIds.has(id))
    if (removedIds.length) {
      let affected = 0
      try {
        affected = await countSlotsForPeriods(schoolId, removedIds)
      } catch (cause) {
        setError(cause.message)
        return
      }
      const removedLabels = (loaded || []).filter(period => removedIds.includes(period.id)).map(periodLabel).join(', ')
      const warning = affected
        ? `Removing ${removedLabels}. This will also delete ${affected} timetable entr${affected === 1 ? 'y' : 'ies'} using them. Continue?`
        : `Removing ${removedLabels}. Continue?`
      if (!window.confirm(warning)) return
    }

    setSaving(true)
    try {
      const saved = await savePeriods(schoolId, rows.map(row => ({
        id: row.id,
        period_number: row.period_number,
        start_time: row.start_time,
        end_time: row.end_time,
        is_break: row.is_break,
        label: row.label,
      })))
      setRows(withKeys(saved))
      setLoaded(saved)
      setNotice(`${saved.length} period${saved.length === 1 ? '' : 's'} saved.`)
      onSaved?.(saved)
    } catch (cause) {
      setError(cause.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="panel timetable-loading"><Loader2 size={18} className="spin" /> Loading periods...</div>
  }

  return <form className="timetable-periods" onSubmit={submit}>
    <div className="panel">
      <div className="timetable-panel-head">
        <div>
          <h3><Clock3 size={17} /> Period Settings</h3>
          <p>Define every period and its timing. The builder uses this list to draw the weekly grid.</p>
        </div>
        <button type="button" className="secondary-button" onClick={() => setRows(current => [...current, nextRowFrom(current)])}>
          <Plus size={15} /> Add period
        </button>
      </div>

      <div className="table-scroll">
        <table className="timetable-periods-table">
          <thead><tr><th>#</th><th>Start</th><th>End</th><th>Break</th><th>Label (optional)</th><th></th></tr></thead>
          <tbody>
            {rows.map((row, index) => {
              const rowError = errorFor(index)
              return <tr key={row.key} className={rowError ? 'has-error' : ''}>
                <td>
                  <input type="number" min="1" max="20" required value={row.period_number}
                    onChange={event => patch(index, { period_number: event.target.value })} />
                </td>
                <td>
                  <input type="time" required value={row.start_time}
                    onChange={event => patch(index, { start_time: event.target.value })} />
                </td>
                <td>
                  <input type="time" required value={row.end_time}
                    onChange={event => patch(index, { end_time: event.target.value })} />
                </td>
                <td className="timetable-break-cell">
                  <label title="Break or lunch — no subject is assigned in this period">
                    <input type="checkbox" checked={Boolean(row.is_break)}
                      onChange={event => patch(index, { is_break: event.target.checked })} />
                    {row.is_break ? <Coffee size={14} /> : null}
                  </label>
                </td>
                <td>
                  <input value={row.label || ''} placeholder={row.is_break ? 'Lunch' : `Period ${row.period_number}`}
                    onChange={event => patch(index, { label: event.target.value })} />
                </td>
                <td>
                  <button type="button" className="icon-button danger" title="Remove this period" onClick={() => removeRow(index)}>
                    <Trash2 size={14} />
                  </button>
                  {rowError && <span className="timetable-row-error">{rowError}</span>}
                </td>
              </tr>
            })}
            {!rows.length && <tr><td colSpan="6">
              <div className="empty-state">
                <Clock3 size={26} />
                <strong>No periods yet</strong>
                <p>Click "Add period" to set up the school bell schedule — for example Period 1 from 9:00 to 9:45.</p>
              </div>
            </td></tr>}
          </tbody>
        </table>
      </div>

      {errors.length > 0 && <div className="form-error timetable-error-list">
        <AlertTriangle size={15} />
        <span>{errors[0].message}{errors.length > 1 ? ` (+${errors.length - 1} aur)` : ''}</span>
      </div>}
      {error && <div className="form-error">{error}</div>}
      {notice && <div className="timetable-notice">{notice}</div>}

      <div className="modal-actions timetable-actions">
        <button className="primary-button" disabled={saving || errors.length > 0}>
          <Save size={15} /> {saving ? 'Saving...' : 'Save periods'}
        </button>
      </div>
    </div>
  </form>
}

import React, { useMemo, useState } from 'react'
import { Check, Search, X } from 'lucide-react'

// Reuses the existing status pill palette: approved reads as paid (green), pending as pending
// (amber), rejected as overdue (red), so this screen matches the rest of the ERP without new CSS.
const PILL = { approved: 'paid', pending: 'pending', rejected: 'overdue' }
const TABS = [['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['all', 'All']]

const dayText = value => {
  if (!value) return '-'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const rangeText = row => (row.fromDate === row.toDate ? dayText(row.fromDate) : `${dayText(row.fromDate)} - ${dayText(row.toDate)}`)

const dayCount = row => {
  const from = new Date(row.fromDate)
  const to = new Date(row.toDate || row.fromDate)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return ''
  return `${Math.max(1, Math.round((to - from) / 86400000) + 1)} day(s)`
}

function DecisionModal({ request, decision, onCancel, onConfirm }) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const rejecting = decision === 'rejected'
  const submit = async event => {
    event.preventDefault()
    if (saving) return
    if (rejecting && !note.trim()) {
      setError('Please add a short reason so the parent knows why.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onConfirm(note)
    } catch (decisionError) {
      setError(decisionError.message)
      setSaving(false)
    }
  }
  return <div className="modal-backdrop"><form className="modal" onSubmit={submit}>
    <div className="modal-header">
      <div>
        <h3>{rejecting ? 'Reject' : 'Approve'} leave request</h3>
        <p>{request.studentName} · {rangeText(request)}</p>
      </div>
      <button type="button" className="icon-button" onClick={onCancel}><X size={19} /></button>
    </div>
    <div className="form-grid" style={{ padding: '0 20px' }}>
      <label className="full">Reason given by parent<input readOnly className="readonly-input" value={request.reason || '-'} /></label>
      <label className="full">
        {rejecting ? 'Reason for rejecting' : 'Note for the parent (optional)'}
        <input autoFocus value={note} onChange={event => setNote(event.target.value)} placeholder={rejecting ? 'e.g. Exams are on these dates' : 'Optional message'} />
      </label>
    </div>
    {error && <div className="form-error">{error}</div>}
    <div className="modal-actions">
      <button type="button" className="secondary-button" onClick={onCancel} disabled={saving}>Cancel</button>
      <button className="primary-button" disabled={saving} style={rejecting ? { background: '#c0392b', borderColor: '#a93226' } : undefined}>
        {saving ? 'Saving...' : rejecting ? 'Reject request' : 'Approve request'}
      </button>
    </div>
  </form></div>
}

export default function StudentLeaveManager({ leaveRequests, onDecide, role }) {
  const [tab, setTab] = useState('pending')
  const [query, setQuery] = useState('')
  const [target, setTarget] = useState(null)
  const [message, setMessage] = useState('')
  const canDecide = role === 'Owner' || role === 'Administrator'

  const rows = useMemo(() => Object.entries(leaveRequests || {})
    .map(([id, row]) => ({ ...row, id }))
    .sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0)), [leaveRequests])

  const counts = useMemo(() => rows.reduce((all, row) => ({ ...all, [row.status]: (all[row.status] || 0) + 1 }), {}), [rows])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return rows
      .filter(row => tab === 'all' || row.status === tab)
      .filter(row => !term || `${row.studentName || ''} ${row.admissionNo || ''} ${row.classSection || ''} ${row.reason || ''}`.toLowerCase().includes(term))
  }, [rows, tab, query])

  const decide = async note => {
    const result = await onDecide(target.request.id, target.decision, note)
    const marked = result?.markedDates || 0
    setMessage(target.decision === 'approved'
      ? `${target.request.studentName} approved${marked ? ` · ${marked} day(s) marked as Leave in attendance` : ''}.`
      : `${target.request.studentName}'s request was rejected.`)
    setTarget(null)
  }

  return <>
    <div className="section-actions">
      <div><h2>Student Leave Requests</h2><p>Leave applications submitted by parents from the Parent Portal.</p></div>
    </div>

    {!canDecide && <div className="backup-warning">Only Owner and Administrator accounts can approve or reject leave requests.</div>}
    {message && <div className="backup-message"><Check size={15} /> {message}</div>}

    <section className="backup-stats">
      <div><span>Pending</span><strong>{counts.pending || 0}</strong></div>
      <div><span>Approved</span><strong>{counts.approved || 0}</strong></div>
      <div><span>Rejected</span><strong>{counts.rejected || 0}</strong></div>
      <div><span>Total</span><strong>{rows.length}</strong></div>
    </section>

    <div className="panel table-panel">
      <div className="table-toolbar" style={{ flexWrap: 'wrap' }}>
        <div className="table-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search student, class or reason" /></div>
      </div>
      <div className="profile-tabs">
        {TABS.map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
          {label}{id !== 'all' && counts[id] ? ` (${counts[id]})` : ''}
        </button>)}
      </div>
      <div className="table-scroll"><table>
        <thead><tr><th>Student</th><th>Class</th><th>Dates</th><th>Reason</th><th>Status</th><th>Reviewed by</th><th /></tr></thead>
        <tbody>
          {filtered.map(row => <tr key={row.id}>
            <td><strong className="regular">{row.studentName || 'Student'}</strong><small className="cell-sub">{row.admissionNo ? `Adm ${row.admissionNo}` : ''}</small></td>
            <td><span className="class-pill">{row.classSection || '-'}</span></td>
            <td>{rangeText(row)}<small className="cell-sub">{dayCount(row)}</small></td>
            <td>{row.reason || '-'}</td>
            <td><span className={`status ${PILL[row.status] || 'pending'}`}>{row.status || 'pending'}</span></td>
            <td>
              {row.reviewedByName ? <>{row.reviewedByName}<small className="cell-sub">{dayText(row.reviewedAt ? new Date(row.reviewedAt).toISOString().slice(0, 10) : '')}{row.reviewNote ? ` · ${row.reviewNote}` : ''}</small></> : <span className="cell-sub">-</span>}
            </td>
            <td>
              {canDecide && row.status === 'pending' && <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button type="button" className="secondary-button" onClick={() => setTarget({ request: row, decision: 'approved' })}><Check size={14} /> Approve</button>
                <button type="button" className="secondary-button" onClick={() => setTarget({ request: row, decision: 'rejected' })}><X size={14} /> Reject</button>
              </div>}
            </td>
          </tr>)}
          {!filtered.length && <tr><td colSpan="7"><div className="empty-state">
            No {tab === 'all' ? '' : tab} leave requests yet. Requests submitted by parents from the Parent Portal appear here.
          </div></td></tr>}
        </tbody>
      </table></div>
    </div>

    {target && <DecisionModal request={target.request} decision={target.decision} onCancel={() => setTarget(null)} onConfirm={decide} />}
  </>
}

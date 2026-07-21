import React, { useEffect, useMemo, useState } from 'react'
import { Check, Download, QrCode, X } from 'lucide-react'

const PUBLIC_ORIGIN = 'https://northstar-school-os.vercel.app'
const TABS = [['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']]

const dayText = value => {
  if (!value) return '-'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
const timeText = stamp => (stamp ? new Date(stamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-')

// The qrcode package is only needed on this screen, so it is loaded when the screen is.
function AdmissionQR({ schoolId, schoolName }) {
  const [dataUrl, setDataUrl] = useState('')
  const [failed, setFailed] = useState(false)
  const url = `${PUBLIC_ORIGIN}/admission/${schoolId}`

  useEffect(() => {
    let active = true
    if (!schoolId) return undefined
    import('qrcode')
      .then(({ default: QRCode }) => QRCode.toDataURL(url, { width: 640, margin: 2, errorCorrectionLevel: 'M' }))
      .then(result => { if (active) setDataUrl(result) })
      .catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [url, schoolId])

  const download = () => {
    const anchor = document.createElement('a')
    anchor.href = dataUrl
    anchor.download = `admission-qr-${(schoolName || 'school').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`
    anchor.click()
  }

  return <section className="panel admission-qr-panel">
    <div className="admission-qr-copy">
      <h3><QrCode size={17} /> Admission QR Code</h3>
      <p>Print this and put it up at the school gate or office. Parents scan it to open the admission form - no app or login needed.</p>
      <div className="admission-qr-url">{url}</div>
      <button type="button" className="secondary-button" disabled={!dataUrl} onClick={download}><Download size={15} /> Download PNG</button>
    </div>
    <div className="admission-qr-image">
      {dataUrl ? <img src={dataUrl} alt={`Admission QR code for ${schoolName || 'school'}`} />
        : <span className="admission-qr-placeholder">
          {!schoolId ? 'Available once the school workspace has loaded' : failed ? 'QR could not be generated' : 'Generating...'}
        </span>}
    </div>
  </section>
}

function RejectModal({ request, onCancel, onConfirm }) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const submit = async event => {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError('')
    try {
      await onConfirm(note)
    } catch (rejectError) {
      setError(rejectError.message)
      setSaving(false)
    }
  }
  return <div className="modal-backdrop"><form className="modal" onSubmit={submit}>
    <div className="modal-header">
      <div><h3>Reject application</h3><p>{request.studentName} · Class {request.classAppliedFor}</p></div>
      <button type="button" className="icon-button" onClick={onCancel}><X size={19} /></button>
    </div>
    <div className="form-grid" style={{ padding: '0 20px' }}>
      <label className="full">Note (optional)<input autoFocus value={note} onChange={event => setNote(event.target.value)} placeholder="Kept for your records" /></label>
    </div>
    {error && <div className="form-error">{error}</div>}
    <div className="modal-actions">
      <button type="button" className="secondary-button" onClick={onCancel} disabled={saving}>Cancel</button>
      <button className="primary-button" disabled={saving} style={{ background: '#c0392b', borderColor: '#a93226' }}>{saving ? 'Saving...' : 'Reject application'}</button>
    </div>
  </form></div>
}

export default function AdmissionRequestsManager({ schoolId, schoolName, pendingRequests, onApprove, onReject, onLoadHistory, role }) {
  const [tab, setTab] = useState('pending')
  const [history, setHistory] = useState({})
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [busyId, setBusyId] = useState('')
  const [message, setMessage] = useState('')
  const canDecide = role === 'Owner' || role === 'Administrator'

  const pending = useMemo(() => Object.entries(pendingRequests || {})
    .map(([id, row]) => ({ ...row, id }))
    .sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0)), [pendingRequests])

  useEffect(() => {
    if (tab === 'pending' || history[tab]) return undefined
    let active = true
    setLoadingHistory(true)
    onLoadHistory(tab)
      .then(result => { if (active) setHistory(current => ({ ...current, [tab]: result || {} })) })
      .finally(() => { if (active) setLoadingHistory(false) })
    return () => { active = false }
  }, [tab])

  const historyRows = useMemo(() => Object.entries(history[tab] || {})
    .map(([id, row]) => ({ ...row, id }))
    .sort((a, b) => (b.reviewedAt || 0) - (a.reviewedAt || 0)), [history, tab])

  const approve = async request => {
    setBusyId(request.id)
    setMessage('')
    try {
      const admissionNumber = await onApprove(request.id)
      setMessage(`${request.studentName} admitted with admission number ${admissionNumber}.`)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusyId('')
    }
  }

  const reject = async note => {
    await onReject(rejectTarget.id, note)
    setRejectTarget(null)
    setMessage('Application rejected.')
  }

  return <>
    <div className="section-actions">
      <div><h2>Admission Requests</h2><p>Applications submitted by parents through the school's admission QR code.</p></div>
    </div>

    <AdmissionQR schoolId={schoolId} schoolName={schoolName} />

    {!canDecide && <div className="backup-warning">Only Owner and Administrator accounts can approve or reject applications.</div>}
    {message && <div className="backup-message"><Check size={15} /> {message}</div>}

    <div className="panel table-panel">
      <div className="profile-tabs">
        {TABS.map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
          {label}{id === 'pending' && pending.length ? ` (${pending.length})` : ''}
        </button>)}
      </div>

      {tab === 'pending' ? <div className="admission-request-list">
        {pending.map(row => <article key={row.id} className="admission-request-card">
          <div className="admission-request-head">
            <div>
              <strong>{row.studentName}</strong>
              <small>Class {row.classAppliedFor} · DOB {dayText(row.dob)}{row.gender ? ` · ${row.gender}` : ''}</small>
            </div>
            <small className="admission-request-time">{timeText(row.submittedAt)}</small>
          </div>
          <div className="admission-request-meta">
            <span><b>Parent:</b> {row.fatherName || row.motherName || '-'}</span>
            <span><b>Phone:</b> {row.parentPhone || '-'}</span>
            {row.parentEmail && <span><b>Email:</b> {row.parentEmail}</span>}
            {row.previousSchool && <span><b>Previous school:</b> {row.previousSchool}</span>}
            {row.address && <span><b>Address:</b> {row.address}</span>}
          </div>
          {canDecide && <div className="admission-request-actions">
            <button type="button" className="primary-button" disabled={busyId === row.id} onClick={() => approve(row)}>
              <Check size={15} /> {busyId === row.id ? 'Admitting...' : 'Approve & Admit'}
            </button>
            <button type="button" className="secondary-button" disabled={busyId === row.id} onClick={() => setRejectTarget(row)}><X size={15} /> Reject</button>
          </div>}
        </article>)}
        {!pending.length && <div className="empty-state">No pending applications. New submissions appear here in real time.</div>}
      </div> : <div className="table-scroll"><table>
        <thead><tr><th>Student</th><th>Class</th><th>Parent</th><th>Reviewed</th><th>{tab === 'approved' ? 'Admission No.' : 'Note'}</th></tr></thead>
        <tbody>
          {historyRows.map(row => <tr key={row.id}>
            <td><strong className="regular">{row.studentName}</strong><small className="cell-sub">DOB {dayText(row.dob)}</small></td>
            <td><span className="class-pill">{row.classAppliedFor}</span></td>
            <td>{row.fatherName || row.motherName || '-'}<small className="cell-sub">{row.parentPhone}</small></td>
            <td>{row.reviewedByName || '-'}<small className="cell-sub">{timeText(row.reviewedAt)}</small></td>
            <td>{tab === 'approved' ? (row.admissionNumber || '-') : (row.rejectionNote || '-')}</td>
          </tr>)}
          {!historyRows.length && <tr><td colSpan="5"><div className="empty-state">{loadingHistory ? 'Loading...' : `No ${tab} applications yet.`}</div></td></tr>}
        </tbody>
      </table></div>}
    </div>

    {rejectTarget && <RejectModal request={rejectTarget} onCancel={() => setRejectTarget(null)} onConfirm={reject} />}
  </>
}

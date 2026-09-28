import React, { useEffect, useState } from 'react'
import { Bell, HeartPulse, LoaderCircle, MapPin, Search, UserRound, WalletCards } from 'lucide-react'
import { supabase, useSupabase } from './lib/supabaseClient'
import { databaseRequest } from './lib/dataAdapter'
import useRole from './hooks/useRole'

const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0))
const cleanSearch = value => String(value || '').replace(/[,%()]/g, ' ').trim()
const photoOf = student => student?.photo_url || student?.photoURL || student?.photoUrl || student?.photo || student?.source?.photo_url || student?.source?.photoURL || student?.source?.photoUrl || ''
const valueOf = (student, ...keys) => {
  for (const key of keys) {
    const value = student?.[key] ?? student?.source?.[key]
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value)
  }
  return '—'
}
const yesNo = value => value === true || String(value).toLowerCase() === 'yes' ? 'Yes' : 'No'

function StudentDetailGroup({ title, icon, children }) {
  return <section className="receptionist-detail-group">
    <h4>{icon}{title}</h4>
    <dl className="receptionist-detail-grid">{children}</dl>
  </section>
}

function Detail({ label, value }) {
  if (!value || value === '—') return null
  return <div><dt>{label}</dt><dd>{value}</dd></div>
}

export default function ReceptionistDesk({ session, schoolId }) {
  const role = useRole(session)
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState([])
  const [selected, setSelected] = useState(null)
  const [selectedPhoto, setSelectedPhoto] = useState('')
  const [fees, setFees] = useState([])
  const [templates, setTemplates] = useState([])
  const [template, setTemplate] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!useSupabase || role !== 'receptionist') return
    supabase.from('notification_templates').select('code,title,body').eq('active', true).order('title')
      .then(({ data, error }) => { if (!error) { setTemplates(data || []); setTemplate(data?.[0]?.code || '') } })
  }, [role])

  useEffect(() => {
    if (!useSupabase || role !== 'receptionist') return
    const term = cleanSearch(query)
    if (term.length < 2) { setRows([]); return }
    const timer = setTimeout(async () => {
      setLoading(true); setMessage('')
      const like = `%${term}%`
      const { data, error } = await supabase.from('students')
        .select('*')
        .or(`full_name.ilike.${like},father_name.ilike.${like},mother_name.ilike.${like},guardian_name.ilike.${like},father_phone.ilike.${like},mother_phone.ilike.${like},guardian_phone.ilike.${like}`)
        .limit(25)
      setRows(error ? [] : data || []); setLoading(false)
      if (error) setMessage(`Search failed: ${error.message}`)
    }, 280)
    return () => clearTimeout(timer)
  }, [query, role])

  useEffect(() => {
    let active = true
    const loadPhoto = async () => {
      const direct = photoOf(selected)
      if (direct || !selected?.legacy_id || !schoolId) {
        if (active) setSelectedPhoto(direct)
        return
      }
      // Students' uploads live in a private Storage bucket. The data adapter
      // creates a school-scoped signed URL; receptionist never receives write access.
      const signed = await databaseRequest(`studentPhotos/${schoolId}/${selected.legacy_id}`).catch(() => '')
      if (active) setSelectedPhoto(signed || '')
    }
    loadPhoto()
    return () => { active = false }
  }, [selected, schoolId])

  const selectStudent = async student => {
    setSelected(student); setFees([]); setMessage('Loading fee history...')
    const [{ data, error }, audit] = await Promise.all([
      supabase.from('fee_receipts').select('*').eq('student_id', student.id).order('receipt_date', { ascending: false }),
      supabase.rpc('log_receptionist_fee_view', { p_student_id: student.id }),
    ])
    setFees(error ? [] : data || [])
    setMessage(error ? `Fee history failed: ${error.message}` : audit.error ? `Fee history loaded. Audit warning: ${audit.error.message}` : '')
  }

  const sendNotification = async () => {
    if (!selected || !template) return
    setLoading(true); setMessage('')
    const { error } = await supabase.rpc('send_receptionist_notification', { p_student_id: selected.id, p_template_code: template })
    setLoading(false); setMessage(error ? `Notification failed: ${error.message}` : 'Approved notification sent and logged.')
  }

  if (!useSupabase || role !== 'receptionist') return <div className="teacher-empty">Reception desk is available only to receptionist accounts.</div>
  const due = fees.reduce((total, item) => total + Math.max(0, Number(item.balance ?? item.total_due ?? 0)), 0)
  return <div className="teacher-page receptionist-desk">
    <div className="teacher-page-header"><div><h2>Reception Desk</h2><p className="teacher-subtitle">Search students, view fee history, and send approved parent reminders.</p></div></div>
    <section className="teacher-section">
      <label className="teacher-search"><Search size={17} /><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Student, parent name or phone" /></label>
      {loading && !selected && <div className="teacher-empty"><LoaderCircle className="spin" size={18} /> Searching...</div>}
      {!!rows.length && <div className="teacher-notice-list">{rows.map(student => <button className="teacher-notice-full" key={student.id} onClick={() => selectStudent(student)}><strong>{student.full_name}</strong><span>Adm. {student.admission_number || '-'} · {student.class_name || '-'}-{student.section || '-'}</span><small>{student.father_name || student.mother_name || student.guardian_name || 'Parent'} · {student.father_phone || student.mother_phone || student.guardian_phone || '-'}</small></button>)}</div>}
    </section>
    {selected && <section className="teacher-section">
      <div className="teacher-page-header"><div><h3>{selected.full_name}</h3><p className="teacher-subtitle">Admission {selected.admission_number || '-'} · {selected.class_name || '-'}-{selected.section || '-'}</p></div><div className="teacher-stat"><WalletCards size={18} /><div><strong>{money(due)}</strong><span>Outstanding</span></div></div></div>
      <div className="receptionist-student-card">
        <div className="receptionist-student-summary">
          <div className="receptionist-student-photo">{selectedPhoto ? <img src={selectedPhoto} alt={selected.full_name} onError={() => setSelectedPhoto('')} /> : <UserRound size={34} />}</div>
          <div><h3>{valueOf(selected, 'full_name', 'name')}</h3><p>{valueOf(selected, 'class_name', 'class')} - {valueOf(selected, 'section')} · Admission No. {valueOf(selected, 'admission_number', 'admissionNo')}</p><span className={selected.active === false ? 'receptionist-inactive' : 'receptionist-active'}>{selected.active === false ? 'Inactive' : 'Active student'}</span></div>
        </div>
        <div className="receptionist-detail-groups">
          <StudentDetailGroup title="Admission & Academic" icon={<UserRound size={15} />}>
            <Detail label="Admission No." value={valueOf(selected, 'admission_number', 'admissionNo')} /><Detail label="Roll No." value={valueOf(selected, 'roll_number', 'rollNumber')} />
            <Detail label="Class / Section" value={`${valueOf(selected, 'class_name', 'class')} - ${valueOf(selected, 'section')}`} /><Detail label="Session" value={valueOf(selected, 'academic_session', 'academicSession')} />
            <Detail label="Admission Date" value={valueOf(selected, 'admission_date', 'admissionDate')} /><Detail label="Fee Group" value={valueOf(selected, 'fee_group', 'feeGroup')} />
          </StudentDetailGroup>
          <StudentDetailGroup title="Student Information" icon={<HeartPulse size={15} />}>
            <Detail label="Date of Birth" value={valueOf(selected, 'date_of_birth', 'dob', 'dateOfBirth')} /><Detail label="Gender" value={valueOf(selected, 'gender')} />
            <Detail label="Blood Group" value={valueOf(selected, 'blood_group', 'bloodGroup')} /><Detail label="Nationality" value={valueOf(selected, 'nationality')} />
            <Detail label="Aadhaar No." value={valueOf(selected, 'aadhaar', 'aadhaarNo')} /><Detail label="PEN / APAAR ID" value={[valueOf(selected, 'pen_id', 'penNo'), valueOf(selected, 'apaar_id', 'apaarId')].filter(v => v !== '—').join(' · ')} />
            <Detail label="Religion / Caste" value={[valueOf(selected, 'religion'), valueOf(selected, 'caste')].filter(v => v !== '—').join(' / ')} /><Detail label="Category" value={valueOf(selected, 'category')} />
          </StudentDetailGroup>
          <StudentDetailGroup title="Family & Contact" icon={<UserRound size={15} />}>
            <Detail label="Father's Name" value={valueOf(selected, 'father_name', 'fatherName')} /><Detail label="Father's Phone" value={valueOf(selected, 'father_phone', 'fatherPhone', 'phone')} />
            <Detail label="Father's Occupation" value={valueOf(selected, 'father_occupation', 'fatherOccupation')} /><Detail label="Mother's Name" value={valueOf(selected, 'mother_name', 'motherName')} />
            <Detail label="Mother's Phone" value={valueOf(selected, 'mother_phone', 'motherPhone')} /><Detail label="Guardian" value={valueOf(selected, 'guardian_name', 'guardian')} />
            <Detail label="Guardian Phone" value={valueOf(selected, 'guardian_phone', 'guardianPhone')} /><Detail label="Parent Email" value={valueOf(selected, 'father_email', 'fatherEmail', 'email')} />
          </StudentDetailGroup>
          <StudentDetailGroup title="Address & Transport" icon={<MapPin size={15} />}>
            <Detail label="Address" value={valueOf(selected, 'address')} /><Detail label="City / District" value={[valueOf(selected, 'city'), valueOf(selected, 'district')].filter(v => v !== '—').join(' / ')} />
            <Detail label="State / Pincode" value={[valueOf(selected, 'state'), valueOf(selected, 'pincode')].filter(v => v !== '—').join(' - ')} /><Detail label="Transport Required" value={yesNo(selected.transport_required ?? selected.transportRequired)} />
            <Detail label="Route" value={valueOf(selected, 'route_name', 'routeName')} /><Detail label="Stop" value={valueOf(selected, 'stop_name', 'stopName')} />
            <Detail label="Pickup / Drop" value={[valueOf(selected, 'pickup_time', 'pickupTime'), valueOf(selected, 'drop_time', 'dropTime')].filter(v => v !== '—').join(' / ')} />
          </StudentDetailGroup>
          {(selected.is_disabled || selected.disability_percentage || selected.disability_remarks || selected.source?.isDisabled) && <StudentDetailGroup title="Special Needs" icon={<HeartPulse size={15} />}>
            <Detail label="Differently-abled" value="Yes" /><Detail label="Disability %" value={valueOf(selected, 'disability_percentage', 'disabilityPercentage')} />
            <Detail label="UDID No." value={valueOf(selected, 'udid_no', 'udidNo')} /><Detail label="Scribe Required" value={yesNo(selected.scribe_required ?? selected.source?.scribeRequired)} />
            <Detail label="Special Instructions" value={valueOf(selected, 'disability_remarks', 'disabilityRemarks', 'special_equipment', 'specialEquipment')} />
          </StudentDetailGroup>}
        </div>
      </div>
      <div className="table-scroll"><table><thead><tr><th>Receipt</th><th>Month</th><th>Paid</th><th>Balance</th><th>Status</th><th>Date</th></tr></thead><tbody>{fees.map((fee, index) => <tr key={`${fee.receipt_number}-${index}`}><td>{fee.receipt_number || '-'}</td><td>{fee.billing_month || '-'}</td><td>{money(fee.paid_amount)}</td><td>{money(fee.balance)}</td><td>{fee.payment_status || fee.status || '-'}</td><td>{fee.receipt_date || '-'}</td></tr>)}{!fees.length && <tr><td colSpan="6">No fee history found.</td></tr>}</tbody></table></div>
      <div className="teacher-hw-form"><label>Approved notification template<select value={template} onChange={event => setTemplate(event.target.value)}>{templates.map(item => <option key={item.code} value={item.code}>{item.title}</option>)}</select></label><button className="teacher-btn primary" disabled={!template || loading} onClick={sendNotification}><Bell size={15} /> Send approved template</button></div>
    </section>}
    {message && <div className={message.includes('failed') ? 'teacher-alert error' : 'teacher-success-banner'}>{message}</div>}
  </div>
}

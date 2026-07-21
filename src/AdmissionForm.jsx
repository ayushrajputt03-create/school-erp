import React, { useEffect, useState } from 'react'
import { CheckCircle2, GraduationCap, Loader2, ShieldCheck } from 'lucide-react'
import { CLASS_LIST } from './schoolOptions'
import './admission-form.css'

// Public page - no login. Everything it needs comes from /api/admission, which exposes only the
// school's display identity and accepts submissions with server-side validation and rate limits.
// The database is never touched directly from here, so this page adds no public write surface.
const api = async payload => {
  const response = await fetch('/api/admission', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const result = await response.json().catch(() => null)
  if (!result?.ok) throw new Error(result?.error || 'Something went wrong. Please try again.')
  return result
}

const todayKey = () => new Date().toISOString().slice(0, 10)

const EMPTY = {
  studentName: '', dob: '', gender: '', classAppliedFor: '',
  fatherName: '', motherName: '', parentPhone: '', parentEmail: '',
  address: '', previousSchool: '',
  // Honeypot. Named so no browser autofill profile maps to it - the first version called this
  // "website" with a matching label, which Chrome happily autofills from a saved profile even
  // when hidden, silently dropping a real parent's application.
  applicantRef: '',
}

export default function AdmissionForm() {
  const schoolId = decodeURIComponent(window.location.pathname.split('/admission/')[1] || '').replace(/\/$/, '')
  const [school, setSchool] = useState({ loading: true })
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let active = true
    if (!schoolId) { setSchool({ loading: false, found: false }); return undefined }
    api({ action: 'school', schoolId })
      .then(result => { if (active) setSchool({ loading: false, ...result }) })
      .catch(() => { if (active) setSchool({ loading: false, found: false }) })
    return () => { active = false }
  }, [schoolId])

  const set = (key, value) => setForm(current => ({ ...current, [key]: value }))

  const submit = async event => {
    event.preventDefault()
    if (saving) return
    const phone = form.parentPhone.replace(/\D/g, '')
    if (form.studentName.trim().length < 2) return setError('Please enter the student\'s full name.')
    if (!form.dob) return setError('Please choose the date of birth.')
    if (form.dob > todayKey()) return setError('Date of birth cannot be in the future.')
    if (!form.classAppliedFor) return setError('Please select the class being applied for.')
    if (phone.length !== 10) return setError('Please enter a valid 10 digit mobile number.')
    setSaving(true)
    setError('')
    try {
      await api({ action: 'submit', schoolId, ...form, parentPhone: phone })
      setDone(true)
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSaving(false)
    }
  }

  if (school.loading) {
    return <main className="padm-shell"><div className="padm-card padm-state"><Loader2 className="padm-spin" size={26} /><p>Loading...</p></div></main>
  }

  if (!school.found || !school.open) {
    return <main className="padm-shell"><div className="padm-card padm-state">
      <ShieldCheck size={30} />
      <h1>Admissions currently closed</h1>
      <p>{school.found ? 'This school is not accepting online applications right now.' : 'This admission link is not valid.'} Please contact the school directly.</p>
    </div></main>
  }

  if (done) {
    return <main className="padm-shell"><div className="padm-card padm-state">
      <CheckCircle2 size={34} className="padm-ok" />
      <h1>Application submitted</h1>
      <p>Thank you. {school.schoolName} has received the application and will contact you on the number provided.</p>
    </div></main>
  }

  return <main className="padm-shell">
    <form className="padm-card" onSubmit={submit}>
      <header className="padm-head">
        {school.logo ? <img src={school.logo} alt="" onError={event => { event.target.style.display = 'none' }} /> : <span className="padm-mark"><GraduationCap size={22} /></span>}
        <div>
          <small>Admission Form</small>
          <h1>{school.schoolName}</h1>
        </div>
      </header>

      <div className="padm-grid">
        <label className="full">Student's full name *<input required value={form.studentName} onChange={event => set('studentName', event.target.value)} placeholder="Full name as per birth certificate" /></label>
        <label>Date of birth *<input required type="date" max={todayKey()} value={form.dob} onChange={event => set('dob', event.target.value)} /></label>
        <label>Gender<select value={form.gender} onChange={event => set('gender', event.target.value)}><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select></label>
        <label>Class applying for *<select required value={form.classAppliedFor} onChange={event => set('classAppliedFor', event.target.value)}><option value="">Select class</option>{CLASS_LIST.map(cls => <option key={cls}>{cls}</option>)}</select></label>
        <label>Parent mobile number *<input required inputMode="numeric" value={form.parentPhone} onChange={event => set('parentPhone', event.target.value)} placeholder="10 digit mobile number" /></label>
        <label>Father's name<input value={form.fatherName} onChange={event => set('fatherName', event.target.value)} /></label>
        <label>Mother's name<input value={form.motherName} onChange={event => set('motherName', event.target.value)} /></label>
        <label>Email (optional)<input type="email" value={form.parentEmail} onChange={event => set('parentEmail', event.target.value)} /></label>
        <label>Previous school (optional)<input value={form.previousSchool} onChange={event => set('previousSchool', event.target.value)} /></label>
        <label className="full">Address<textarea rows="2" value={form.address} onChange={event => set('address', event.target.value)} /></label>

        {/* Honeypot: hidden from people, tempting to bots. Filled means the submission is dropped.
            The name and label carry no meaning a browser can autofill against. */}
        <div className="padm-hp" aria-hidden="true">
          <input name="applicantRef" tabIndex="-1" autoComplete="off" value={form.applicantRef} onChange={event => set('applicantRef', event.target.value)} />
        </div>
      </div>

      {error && <p className="padm-error">{error}</p>}
      <button className="padm-submit" disabled={saving}>{saving ? 'Submitting...' : 'Submit Application'}</button>
      <p className="padm-note">Your details are sent only to {school.schoolName} for review.</p>
    </form>
  </main>
}

import React, { useMemo, useState } from 'react'
import { LoaderCircle, School } from 'lucide-react'
import { academicYears, boardOptions, classOptions, generateSchoolCode, indianStates, recognitionOptions } from './schoolOptions'

export default function SchoolSetup({ user, onSubmit }) {
  const [form, setForm] = useState({ schoolName: '', phone: '', address: '', city: '', state: '', pincode: '', affiliatedTo: 'Affiliated to CBSE (New Delhi)', customAffiliation: '', affiliationNo: '', udiseNo: '', board: 'CBSE', academicYear: '2026-27', classesOffered: ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5'], logo: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async event => {
    event.preventDefault()
    const name = form.schoolName.trim()
    if (name.length < 2 || !form.city.trim() || !form.state || !form.pincode.trim()) {
      setError('Please complete school name, city, state and pincode.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await onSubmit({ ...form, schoolName: name, affiliatedTo: form.affiliatedTo === 'Write Custom...' ? form.customAffiliation : form.affiliatedTo })
    } catch (setupError) {
      setError(setupError.message)
      setLoading(false)
    }
  }
  const codePreview = useMemo(() => form.schoolName.trim() ? generateSchoolCode(form.schoolName).replace(/\d{3}$/, '###') : 'AUTO', [form.schoolName])
  const toggleClass = className => setForm(current => ({ ...current, classesOffered: current.classesOffered.includes(className) ? current.classesOffered.filter(item => item !== className) : [...current.classesOffered, className] }))

  return (
    <main className="school-setup-page">
      <section className="school-setup-card">
        {user.photoURL
          ? <img className="setup-photo" src={user.photoURL} alt="" referrerPolicy="no-referrer" />
          : <div className="setup-icon"><School size={24} /></div>}
        <span className="eyebrow">Welcome, {user.displayName || 'Administrator'}</span>
        <h1>Enter your school name to continue</h1>
        <p>This creates your secure school workspace. You can update the name later.</p>
        <form onSubmit={submit}>
          <label>School name<input autoFocus required value={form.schoolName} onChange={event => setForm({ ...form, schoolName: event.target.value })} placeholder="e.g. Northstar Public School" /></label>
          <label>School code<input readOnly className="readonly-input" value={codePreview} /></label>
          <label>Phone number<input required inputMode="tel" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} /></label>
          <label>School address<input required value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} /></label>
          <label>City<input required value={form.city} onChange={event => setForm({ ...form, city: event.target.value })} /></label>
          <label>State<select required value={form.state} onChange={event => setForm({ ...form, state: event.target.value })}><option value="">Select state</option>{indianStates.map(item => <option key={item}>{item}</option>)}</select></label>
          <label>Pincode<input required inputMode="numeric" value={form.pincode} onChange={event => setForm({ ...form, pincode: event.target.value.replace(/\D/g, '').slice(0, 6) })} /></label>
          <label>Affiliated To<select value={form.affiliatedTo} onChange={event => setForm({ ...form, affiliatedTo: event.target.value })}>{recognitionOptions.map(item => <option key={item}>{item}</option>)}</select></label>
          {form.affiliatedTo === 'Write Custom...' && <label>Custom<input value={form.customAffiliation} onChange={event => setForm({ ...form, customAffiliation: event.target.value })} /></label>}
          <label>Affiliation No<input value={form.affiliationNo} onChange={event => setForm({ ...form, affiliationNo: event.target.value })} /></label>
          <label>UDISE No<input value={form.udiseNo} onChange={event => setForm({ ...form, udiseNo: event.target.value })} /></label>
          <label>Board<select value={form.board} onChange={event => setForm({ ...form, board: event.target.value })}>{boardOptions.map(item => <option key={item}>{item}</option>)}</select></label>
          <label>Academic Year<select value={form.academicYear} onChange={event => setForm({ ...form, academicYear: event.target.value })}>{academicYears.map(item => <option key={item}>{item}</option>)}</select></label>
          <label>Logo URL <span className="optional-label">(optional)</span><input type="url" value={form.logo} onChange={event => setForm({ ...form, logo: event.target.value })} placeholder="https://..." /></label>
          <label>Classes Offered<div className="auth-check-grid">{classOptions.map(item => <span key={item}><input type="checkbox" checked={form.classesOffered.includes(item)} onChange={() => toggleClass(item)} /> {item}</span>)}</div></label>
          {error && <div className="auth-alert error">{error}</div>}
          <button className="primary-button" disabled={loading}>
            {loading && <LoaderCircle className="spin" size={16} />}
            Create school workspace
          </button>
        </form>
      </section>
    </main>
  )
}

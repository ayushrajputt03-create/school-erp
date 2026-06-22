import React, { useMemo, useState } from 'react'
import { Eye, EyeOff, LoaderCircle, Mail } from 'lucide-react'
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth'
import { auth } from './lib/firebase'
import { academicYears, boardOptions, classOptions, generateSchoolCode, indianStates, recognitionOptions } from './schoolOptions'

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4.3h5.4a4.6 4.6 0 0 1-2 3v2.8h3.3c1.9-1.8 2.9-4.4 2.9-7.9Z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.8c-.9.6-2.1 1-3.4 1a5.9 5.9 0 0 1-5.5-4.1H3.1v2.9A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.5 13.7a6 6 0 0 1 0-3.8V7H3.1a10 10 0 0 0 0 9.6l3.4-2.9Z" />
      <path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.9 1.5l2.9-2.9A9.8 9.8 0 0 0 3.1 7l3.4 2.9A5.9 5.9 0 0 1 12 5.9Z" />
    </svg>
  )
}

export default function AuthScreen() {
  const [mode, setMode] = useState('signin')
  const [form, setForm] = useState({
    schoolName: '', email: '', phone: '', address: '', city: '', state: '', pincode: '',
    affiliatedTo: 'Affiliated to CBSE (New Delhi)', customAffiliation: '', affiliationNo: '',
    udiseNo: '', board: 'CBSE', academicYear: '2026-27', classesOffered: ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5'],
    password: '', logo: '',
  })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const schoolCodePreview = useMemo(() => form.schoolName.trim() ? generateSchoolCode(form.schoolName).replace(/\d{3}$/, '###') : 'AUTO', [form.schoolName])
  const toggleClass = className => setForm(current => ({
    ...current,
    classesOffered: current.classesOffered.includes(className)
      ? current.classesOffered.filter(item => item !== className)
      : [...current.classesOffered, className],
  }))
  const readLogo = file => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Logo image could not be read.'))
    reader.readAsDataURL(file)
  })

  const googleSignIn = async () => {
    setError('')
    setMessage('')
    setGoogleLoading(true)
    try {
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)
      if (!result.user) throw new Error('Google did not return a user account.')
    } catch (authError) {
      setError(readableAuthError(authError))
    } finally {
      setGoogleLoading(false)
    }
  }

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      if (mode === 'signup') {
        if (!form.city.trim() || !form.state || !form.pincode.trim() || !form.board || !form.classesOffered.length) throw new Error('Please complete city, state, pincode, board and classes offered.')
        localStorage.setItem('northstar-pending-school-profile', JSON.stringify({
          schoolName: form.schoolName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          city: form.city.trim(),
          state: form.state,
          pincode: form.pincode.trim(),
          affiliatedTo: form.affiliatedTo === 'Write Custom...' ? form.customAffiliation.trim() : form.affiliatedTo,
          customAffiliation: form.customAffiliation.trim(),
          affiliationNo: form.affiliationNo.trim(),
          udiseNo: form.udiseNo.trim(),
          board: form.board,
          academicYear: form.academicYear,
          classesOffered: form.classesOffered,
          logo: form.logo,
        }))
        const credential = await createUserWithEmailAndPassword(auth, form.email, form.password)
        await updateProfile(credential.user, { displayName: form.schoolName })
      } else {
        await signInWithEmailAndPassword(auth, form.email, form.password)
      }
    } catch (authError) {
      if (mode === 'signup') localStorage.removeItem('northstar-pending-school-profile')
      setError(authError.message.replace('Firebase: ', ''))
    } finally {
      setLoading(false)
    }
  }

  const resetPassword = async () => {
    setError('')
    setMessage('')
    if (!form.email.trim()) {
      setError('Enter your email address first.')
      return
    }
    try {
      await sendPasswordResetEmail(auth, form.email.trim())
      setMessage('Password reset link sent to your email.')
    } catch (authError) {
      setError(authError.message.replace('Firebase: ', ''))
    }
  }

  const switchMode = nextMode => {
    setMode(nextMode)
    setError('')
    setMessage('')
    setShowPassword(false)
  }
  const steps = mode === 'signup'
    ? ['Sign up your account', 'Set up your school', 'Set up your profile']
    : ['Enter your credentials', 'Access your dashboard', 'Manage your school']

  return (
    <main className="auth-page">
      <section className="auth-brand">
        <div className="auth-brand-inner">
          <div className="auth-app">
            <img className="auth-logo" src="/nxt-logo-transparent.png" alt="NXT School ERP" />
            <strong>NXT School ERP</strong>
          </div>
          <div className="auth-brand-copy">
            <h1>Get Started with Us</h1>
            <p>{mode === 'signup' ? 'Complete these easy steps to register your account.' : 'Sign in and continue managing your school workspace.'}</p>
          </div>
          <ol className="auth-steps">
            {steps.map((step, index) => <li key={step} className={index === 0 ? 'active' : ''}><span>{index + 1}</span><strong>{step}</strong></li>)}
          </ol>
        </div>
      </section>
      <section className="auth-form-side">
        <div className="auth-card">
          <header>
            <h2>{mode === 'signin' ? 'Welcome Back' : 'Sign Up Account'}{mode === 'signin' && <span className="auth-wave"> 👋</span>}</h2>
            <p>{mode === 'signin' ? 'Sign in to your school account' : 'Enter your school data to create your account.'}</p>
          </header>
          {mode === 'signup' && <div className="auth-provider-row">
            <button type="button" className="google-button" onClick={googleSignIn} disabled={googleLoading || loading}>
              {googleLoading ? <LoaderCircle className="spin" size={18} /> : <GoogleLogo />}
              <span>{googleLoading ? 'Connecting...' : 'Google'}</span>
            </button>
            <button type="button" className="email-auth-button" onClick={() => document.getElementById('school-name')?.focus()}><Mail size={17} /> Register with Email</button>
          </div>}
          {mode === 'signup' && <div className="auth-divider"><span>Or</span></div>}
          <form onSubmit={submit}>
            {mode === 'signup' && <>
              <label>School Name<input id="school-name" required value={form.schoolName} onChange={e => setForm({...form, schoolName: e.target.value})} autoComplete="organization" placeholder="eg. ABC Public School" /></label>
              <label>School Code<input readOnly className="readonly-input" value={schoolCodePreview} /></label>
            </>}
            <label>Email<input required type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} autoComplete="email" placeholder="eg. school@gmail.com" /></label>
            {mode === 'signup' && <>
              <label>Phone<input required inputMode="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} autoComplete="tel" placeholder="eg. 9876543210" /></label>
              <label>Address<input required value={form.address} onChange={e => setForm({...form, address: e.target.value})} autoComplete="street-address" placeholder="eg. New Delhi" /></label>
              <label>City<input required value={form.city} onChange={e => setForm({...form, city: e.target.value})} placeholder="eg. Delhi" /></label>
              <label>State<select required value={form.state} onChange={e => setForm({...form, state: e.target.value})}><option value="">Select state</option>{indianStates.map(item => <option key={item}>{item}</option>)}</select></label>
              <label>Pincode<input required inputMode="numeric" value={form.pincode} onChange={e => setForm({...form, pincode: e.target.value.replace(/\D/g, '').slice(0, 6)})} placeholder="110001" /></label>
              <label>Affiliated To / Recognised By<select required value={form.affiliatedTo} onChange={e => setForm({...form, affiliatedTo: e.target.value})}>{recognitionOptions.map(item => <option key={item}>{item}</option>)}</select></label>
              {form.affiliatedTo === 'Write Custom...' && <label>Custom Affiliation<input required value={form.customAffiliation} onChange={e => setForm({...form, customAffiliation: e.target.value})} placeholder="Write custom recognition" /></label>}
              <label>Affiliation Number<input value={form.affiliationNo} onChange={e => setForm({...form, affiliationNo: e.target.value})} /></label>
              <label>UDISE Number<input value={form.udiseNo} onChange={e => setForm({...form, udiseNo: e.target.value})} /></label>
              <label>Board<select required value={form.board} onChange={e => setForm({...form, board: e.target.value})}>{boardOptions.map(item => <option key={item}>{item}</option>)}</select></label>
              <label>Academic Year<select required value={form.academicYear} onChange={e => setForm({...form, academicYear: e.target.value})}>{academicYears.map(item => <option key={item}>{item}</option>)}</select></label>
              <label className="full">School Logo <span className="optional-label">(optional)</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={async e => { const file = e.target.files?.[0]; if (file) { const logo = await readLogo(file); setForm(current => ({ ...current, logo })) } }} /></label>
              <label className="full">Classes Offered<div className="auth-check-grid">{classOptions.map(item => <span key={item}><input type="checkbox" checked={form.classesOffered.includes(item)} onChange={() => toggleClass(item)} /> {item}</span>)}</div></label>
            </>}
            <label>Password
              <span className="password-field">
                <input required minLength={8} type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => setForm({...form, password: e.target.value})} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} placeholder="Enter your password" />
                <button type="button" onClick={() => setShowPassword(current => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
              </span>
              {mode === 'signup' && <small>Must be at least 8 characters.</small>}
            </label>
            {mode === 'signin' && <button type="button" className="forgot-password" onClick={resetPassword}>Forgot Password?</button>}
            {error && <div className="auth-alert error">{error}</div>}
            {message && <div className="auth-alert success">{message}</div>}
            <button className="auth-submit" disabled={loading}>
              {loading && <LoaderCircle className="spin" size={16} />}
              {mode === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>
          </form>
          {mode === 'signin' && <>
            <div className="auth-divider"><span>Or</span></div>
            <button type="button" className="google-button login-google" onClick={googleSignIn} disabled={googleLoading || loading}>
              {googleLoading ? <LoaderCircle className="spin" size={18} /> : <GoogleLogo />}
              <span>{googleLoading ? 'Connecting...' : 'Continue with Google'}</span>
            </button>
          </>}
          <p className="auth-switch-copy">
            {mode === 'signin' ? 'New school?' : 'Already have an account?'}
            <button onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}>{mode === 'signin' ? 'Register here' : 'Log in'}</button>
          </p>
        </div>
      </section>
    </main>
  )
}

function readableAuthError(error) {
  const messages = {
    'auth/operation-not-allowed': 'Google login is not enabled in Firebase Authentication. Enable the Google provider and retry.',
    'auth/unauthorized-domain': `This domain (${window.location.hostname}) is not authorized in Firebase. Add it under Authentication > Settings > Authorized domains.`,
    'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
    'auth/cancelled-popup-request': 'Another Google sign-in window is already open.',
    'auth/network-request-failed': 'Network error while contacting Google. Check your internet connection and retry.',
  }
  return messages[error?.code] || error?.message?.replace('Firebase: ', '') || 'Google sign-in failed. Please retry.'
}

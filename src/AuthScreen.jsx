import React, { useState } from 'react'
import { GraduationCap, LoaderCircle, ShieldCheck } from 'lucide-react'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { auth } from './lib/firebase'

export default function AuthScreen() {
  const [mode, setMode] = useState('signin')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      if (mode === 'signup') {
        const credential = await createUserWithEmailAndPassword(auth, form.email, form.password)
        await updateProfile(credential.user, { displayName: form.name })
      } else {
        await signInWithEmailAndPassword(auth, form.email, form.password)
      }
    } catch (authError) {
      setError(authError.message.replace('Firebase: ', ''))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-brand">
        <div className="auth-logo"><GraduationCap size={26} /></div>
        <span>Northstar School OS</span>
        <h1>Run your school with clarity.</h1>
        <p>Attendance, fees, academics and communication in one secure workspace.</p>
        <div className="auth-trust"><ShieldCheck size={18} /><span>Encrypted access with role-based permissions</span></div>
      </section>
      <section className="auth-card">
        <div>
          <span className="eyebrow">School administration</span>
          <h2>{mode === 'signin' ? 'Welcome back' : 'Create admin account'}</h2>
          <p>{mode === 'signin' ? 'Sign in to continue to your workspace.' : 'Set up the first administrator for your school.'}</p>
        </div>
        <form onSubmit={submit}>
          {mode === 'signup' && (
            <label>Full name<input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} autoComplete="name" /></label>
          )}
          <label>Email address<input required type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} autoComplete="email" /></label>
          <label>Password<input required minLength={8} type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} /></label>
          {error && <div className="auth-alert error">{error}</div>}
          {message && <div className="auth-alert success">{message}</div>}
          <button className="primary-button auth-submit" disabled={loading}>
            {loading && <LoaderCircle className="spin" size={16} />}
            {mode === 'signin' ? 'Sign in securely' : 'Create account'}
          </button>
        </form>
        <button className="auth-switch" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setMessage('') }}>
          {mode === 'signin' ? 'First administrator? Create an account' : 'Already have an account? Sign in'}
        </button>
      </section>
    </main>
  )
}

import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('login') // 'login' | 'signup'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        alert('Account created! Ab login karo.')
        setMode('login')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '2rem', width: 360 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>🏫 School ERP</h1>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: '1.5rem' }}>
          {mode === 'login' ? 'Admin login karo' : 'Naya account banao'}
        </p>
        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 12px', marginBottom: '1rem', fontSize: 13, color: '#DC2626' }}>
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 4 }}>Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="admin@school.com"
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 4 }}>Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)} required
              placeholder="••••••••"
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}
            />
          </div>
          <button
            type="submit" disabled={loading}
            style={{ width: '100%', padding: '9px', background: '#1D4ED8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Account banao'}
          </button>
        </form>
        <p style={{ textAlign: 'center', fontSize: 13, color: '#6b7280', marginTop: '1rem' }}>
          {mode === 'login' ? 'Pehli baar? ' : 'Already account hai? '}
          <span style={{ color: '#1D4ED8', cursor: 'pointer' }} onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
            {mode === 'login' ? 'Account banao' : 'Login karo'}
          </span>
        </p>
      </div>
    </div>
  )
}

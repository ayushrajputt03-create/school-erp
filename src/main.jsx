import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './print-shared.css'
import App from './App'
import SuperAdminApp from './SuperAdminApp'
import ParentDashboard from './pages/ParentDashboard'
import TeacherApp from './TeacherApp'
import LandingPage from './LandingPage'
// Lazy so the public form's stylesheet only loads on its own route. As a static import its CSS
// applied everywhere, and its .admission-card rule collided with the admin Admission module's
// class of the same name, capping that page at 640px wide.
const AdmissionForm = lazy(() => import('./AdmissionForm'))

// Quality-of-life: when a number/numeric field showing just "0" is focused, select it so the
// first keystroke replaces the 0 instead of typing after it (the "0 hatta nahi" annoyance).
if (typeof document !== 'undefined') {
  document.addEventListener('focusin', event => {
    const el = event.target
    if (!el || el.tagName !== 'INPUT') return
    const numeric = el.type === 'number' || el.inputMode === 'numeric' || el.inputMode === 'decimal'
    if (numeric && (el.value === '0' || el.value === '0.0' || el.value === '0.00')) {
      requestAnimationFrame(() => { try { el.select() } catch { /* number inputs may not support select in some browsers */ } })
    }
  })
}

function Root() {
  const path = window.location.pathname
  // Public, no auth: reached by scanning a school's admission QR code.
  if (path.startsWith('/admission/')) return <Suspense fallback={null}><AdmissionForm /></Suspense>
  if (path.startsWith('/super-admin')) return <SuperAdminApp />
  if (path.startsWith('/parent/dashboard')) return <ParentDashboard />
  if (path.startsWith('/teacher')) return <TeacherApp />
  if (path.startsWith('/parent')) return <App />
  if (path.startsWith('/admin')) return <App />
  if (path === '/') return <LandingPage />
  return <App />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Root />
    </BrowserRouter>
  </React.StrictMode>,
)

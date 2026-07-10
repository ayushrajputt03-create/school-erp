import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import SuperAdminApp from './SuperAdminApp'
import ParentDashboard from './pages/ParentDashboard'
import TeacherApp from './TeacherApp'
import LandingPage from './LandingPage'

function Root() {
  const path = window.location.pathname
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

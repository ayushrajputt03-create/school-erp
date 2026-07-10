import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import SuperAdminApp from './SuperAdminApp'
import ParentDashboard from './pages/ParentDashboard'

function Root() {
  const path = window.location.pathname
  if (path.startsWith('/super-admin')) return <SuperAdminApp />
  if (path.startsWith('/parent/dashboard')) return <ParentDashboard />
  return <App />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Root />
    </BrowserRouter>
  </React.StrictMode>,
)

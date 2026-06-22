import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import SuperAdminApp from './SuperAdminApp'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      {window.location.pathname.startsWith('/super-admin') ? <SuperAdminApp /> : <App />}
    </BrowserRouter>
  </React.StrictMode>,
)

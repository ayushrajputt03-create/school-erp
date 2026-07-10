import React from 'react'
import { ChevronRight, GraduationCap, ShieldCheck, Users } from 'lucide-react'
import './teacher-app.css'

export default function LandingPage() {
  return <main className="landing-page">
    <div className="landing-brand">
      <img src="/nxt-logo-transparent.png" alt="NXT School ERP" onError={e => { e.target.style.display = 'none' }} />
      <h1>Northstar School OS</h1>
      <p>by NXT Eleveta Media — Complete School Management System</p>
    </div>
    <div className="landing-cards">
      <a href="/admin/login" className="landing-card">
        <div className="landing-card-icon admin"><ShieldCheck size={26} /></div>
        <h3>Principal / Admin</h3>
        <p>Full school management access — admissions, fees, certificates, reports and more.</p>
        <span className="landing-btn">Login <ChevronRight size={14} /></span>
      </a>
      <a href="/teacher/login" className="landing-card">
        <div className="landing-card-icon teacher"><GraduationCap size={26} /></div>
        <h3>Teacher Login</h3>
        <p>Mark attendance, enter marks, post homework and manage your classes.</p>
        <span className="landing-btn">Login <ChevronRight size={14} /></span>
      </a>
      <a href="/parent/login" className="landing-card">
        <div className="landing-card-icon parent"><Users size={26} /></div>
        <h3>Parent / Guardian</h3>
        <p>View your child's progress, attendance, fees and school notices.</p>
        <span className="landing-btn">Login <ChevronRight size={14} /></span>
      </a>
    </div>
  </main>
}

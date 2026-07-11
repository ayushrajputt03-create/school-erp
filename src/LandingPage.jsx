import React, { useEffect, useRef, useState } from 'react'
import {
  ArrowRight, Award, BookOpen, CalendarCheck, CalendarClock, Check, ChevronDown,
  ClipboardList, Cloud, CreditCard, FileBarChart2, GraduationCap, IndianRupee,
  Mail, Menu, MessageCircle, Rocket, ScrollText, ShieldCheck, Smartphone, Star,
  TrendingUp, Users, Wallet, Wifi, X,
} from 'lucide-react'
import './landing.css'

const LOGIN_CARDS = [
  { icon: ShieldCheck, cls: 'admin', title: 'Principal / Admin', desc: 'Manage your entire school — students, fees, staff, and reports.', href: '/login', label: 'Admin Login' },
  { icon: GraduationCap, cls: 'teacher', title: 'Teacher', desc: 'Mark attendance, enter marks, post homework for your classes.', href: '/teacher/login', label: 'Teacher Login' },
  { icon: Users, cls: 'parent', title: 'Parent / Guardian', desc: "View your child's attendance, fees, and academic progress.", href: '/parent/login', label: 'Parent Login' },
]

const FEATURES = [
  { icon: ClipboardList, name: 'Admission Management', desc: 'Enquiries to enrolment in one flow.' },
  { icon: CalendarCheck, name: 'Attendance Tracking', desc: 'Daily class attendance in seconds.' },
  { icon: Wallet, name: 'Fee Management', desc: 'Collect, track and receipt fees.' },
  { icon: FileBarChart2, name: 'Report Cards', desc: 'Generate marksheets and results.' },
  { icon: ScrollText, name: 'Certificates', desc: 'TC, Bonafide and Character certs.' },
  { icon: CreditCard, name: 'ID Card Generator', desc: 'Student and staff ID cards.' },
  { icon: BookOpen, name: 'Homework & Notices', desc: 'Share work and school updates.' },
  { icon: CalendarClock, name: 'Timetable Management', desc: 'Build and publish class timetables.' },
  { icon: Users, name: 'Employee Management', desc: 'Staff records, leave and payroll.' },
  { icon: Smartphone, name: 'Parent Portal', desc: 'Parents stay informed in real time.' },
  { icon: Cloud, name: 'Secure Cloud Storage', desc: 'Data isolated per school on Firebase.' },
  { icon: TrendingUp, name: 'Analytics & Reports', desc: 'Insights across every module.' },
]

const WHY = [
  { icon: IndianRupee, title: 'Affordable Pricing', desc: 'Pay only ₹15–25 per student per month. No hidden fees, no huge upfront costs.' },
  { icon: Rocket, title: 'Setup in Minutes', desc: 'Get your school onboarded in under 30 minutes. No technical knowledge needed.' },
  { icon: Wifi, title: 'Always Accessible', desc: 'Cloud-based platform works on mobile, tablet and laptop — anywhere, anytime.' },
]

const PRICING = [
  ['1 – 100', '₹25 / month'],
  ['101 – 300', '₹20 / month'],
  ['301 – 500', '₹18 / month'],
  ['501 – 1000', '₹15 / month'],
  ['1000+', '₹12 / month'],
]

const TESTIMONIALS = [
  { quote: 'Northstar has made our fee collection so much easier. Highly recommend to any school.', name: 'Principal', school: 'School name to be added' },
  { quote: 'Attendance and report cards that used to take days now take minutes for our teachers.', name: 'Vice Principal', school: 'School name to be added' },
  { quote: 'Parents love the portal — fewer calls to the office and more transparency all around.', name: 'Administrator', school: 'School name to be added' },
]

const FAQS = [
  { q: 'Is there really a free trial?', a: 'Yes! Get 3 months completely free with full access to all features.' },
  { q: 'How long does setup take?', a: 'Most schools are up and running within 30 minutes.' },
  { q: 'Is my school\'s data secure?', a: 'Yes, we use enterprise-grade Firebase security with complete data isolation between schools.' },
  { q: 'Can parents access this too?', a: 'Yes! Parents get their own portal to view attendance, fees and results.' },
  { q: 'What if I need help?', a: 'We provide WhatsApp and email support with quick response times.' },
]

const NAV_LINKS = [['features', 'Features'], ['pricing', 'Pricing'], ['faq', 'FAQ'], ['contact', 'Contact']]

function useReveal() {
  useEffect(() => {
    const root = document.documentElement
    const els = [...document.querySelectorAll('.reveal')]
    const reveal = el => el.classList.add('in-view')
    // A hidden/background tab pauses CSS animations — never hide content behind an
    // animation that can't run. Only enable the hide-then-fade when actually visible.
    if (document.hidden || !('IntersectionObserver' in window)) { els.forEach(reveal); return }
    root.classList.add('js-reveal')
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => { if (entry.isIntersecting) { reveal(entry.target); obs.unobserve(entry.target) } })
    }, { threshold: 0, rootMargin: '0px 0px -8% 0px' })
    els.forEach(el => io.observe(el))
    // Reveal above-the-fold content on the next frame so it fades in on load without
    // waiting for the observer's async first callback. Below-the-fold reveals on scroll.
    const raf = requestAnimationFrame(() => els.forEach(el => {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.9) reveal(el)
    }))
    return () => { io.disconnect(); cancelAnimationFrame(raf); root.classList.remove('js-reveal') }
  }, [])
}

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState(0)
  const [scrolled, setScrolled] = useState(false)
  const loginRef = useRef(null)
  useReveal()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTo = (id, e) => {
    e?.preventDefault()
    setMenuOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return <div className="ls">
    <header className={`ls-nav ${scrolled ? 'solid' : ''}`}>
      <div className="ls-nav-inner">
        <a href="/" className="ls-logo">
          <img src="/nxt-logo-transparent.png" alt="" onError={e => { e.target.style.display = 'none' }} />
          <span>Northstar <b>School OS</b></span>
        </a>
        <nav className="ls-nav-links">
          {NAV_LINKS.map(([id, label]) => <a key={id} href={`#${id}`} onClick={e => scrollTo(id, e)}>{label}</a>)}
        </nav>
        <div className="ls-nav-actions">
          <button className="ls-nav-login" onClick={e => scrollTo('login', e)}>Login</button>
          <a className="ls-btn ls-btn-primary sm" href="/register">Get Started <ArrowRight size={15} /></a>
        </div>
        <button className="ls-hamburger" onClick={() => setMenuOpen(o => !o)} aria-label="Menu">{menuOpen ? <X size={22} /> : <Menu size={22} />}</button>
      </div>
      {menuOpen && <div className="ls-mobile-menu">
        {NAV_LINKS.map(([id, label]) => <a key={id} href={`#${id}`} onClick={e => scrollTo(id, e)}>{label}</a>)}
        <a href="#login" onClick={e => scrollTo('login', e)}>Login</a>
        <a className="ls-btn ls-btn-primary" href="/register">Get Started Free <ArrowRight size={15} /></a>
      </div>}
    </header>

    {/* HERO */}
    <section className="ls-hero">
      <div className="ls-hero-glow" />
      <div className="ls-hero-content reveal">
        <span className="ls-eyebrow">by NXT Eleveta Media</span>
        <h1>Northstar School OS</h1>
        <p className="ls-tagline">Complete School Management, Simplified</p>
        <p className="ls-hero-desc">Admissions, Attendance, Fees, Report Cards, Certificates — everything your school needs in one place.</p>
        <div className="ls-hero-cta">
          <a className="ls-btn ls-btn-white" href="/register">Get Started Free <ArrowRight size={17} /></a>
          <button className="ls-btn ls-btn-outline" onClick={e => scrollTo('features', e)}>Watch Demo</button>
        </div>
        <div className="ls-trust"><ShieldCheck size={16} /> Trusted by schools in Delhi NCR</div>
      </div>
    </section>

    {/* LOGIN OPTIONS */}
    <section className="ls-section" id="login" ref={loginRef}>
      <div className="ls-head reveal"><h2>Login to Your Portal</h2><p>Pick the portal that fits your role.</p></div>
      <div className="ls-login-grid reveal">
        {LOGIN_CARDS.map(card => <a key={card.href} className="ls-login-card" href={card.href}>
          <span className={`ls-login-icon ${card.cls}`}><card.icon size={26} /></span>
          <h3>{card.title}</h3>
          <p>{card.desc}</p>
          <span className="ls-login-btn">{card.label} <ArrowRight size={15} /></span>
        </a>)}
      </div>
    </section>

    {/* FEATURES */}
    <section className="ls-section alt" id="features">
      <div className="ls-head reveal"><h2>Everything Your School Needs</h2><p>One platform, complete control.</p></div>
      <div className="ls-feature-grid reveal">
        {FEATURES.map(f => <div key={f.name} className="ls-feature">
          <span className="ls-feature-icon"><f.icon size={22} /></span>
          <strong>{f.name}</strong>
          <small>{f.desc}</small>
        </div>)}
      </div>
    </section>

    {/* WHY */}
    <section className="ls-section" id="why">
      <div className="ls-head reveal"><h2>Why Schools Choose Northstar</h2><p>Built for Indian schools, priced for reality.</p></div>
      <div className="ls-why-grid reveal">
        {WHY.map(w => <div key={w.title} className="ls-why">
          <span className="ls-why-icon"><w.icon size={24} /></span>
          <h3><Check size={16} /> {w.title}</h3>
          <p>{w.desc}</p>
        </div>)}
      </div>
    </section>

    {/* PRICING */}
    <section className="ls-section alt" id="pricing">
      <div className="ls-head reveal"><h2>Simple, Fair Pricing</h2><p>Pay only for what you use.</p></div>
      <div className="ls-pricing reveal">
        <table className="ls-pricing-table">
          <thead><tr><th>Students</th><th>Price / Student</th></tr></thead>
          <tbody>{PRICING.map(([range, price]) => <tr key={range}><td>{range}</td><td><strong>{price}</strong></td></tr>)}</tbody>
        </table>
        <div className="ls-pricing-highlight">
          <span className="ls-gift">🎁</span>
          <div><strong>First 3 months FREE</strong><small>for new schools — full access, no card needed.</small></div>
          <a className="ls-btn ls-btn-primary" href="/register">Start Free Trial <ArrowRight size={15} /></a>
        </div>
      </div>
    </section>

    {/* TESTIMONIALS */}
    <section className="ls-section" id="testimonials">
      <div className="ls-head reveal"><h2>Trusted by Schools</h2><p>Real feedback coming soon.</p></div>
      <div className="ls-testimonials reveal">
        {TESTIMONIALS.map((t, i) => <figure key={i} className="ls-testimonial">
          <div className="ls-stars">{Array.from({ length: 5 }, (_, s) => <Star key={s} size={14} fill="currentColor" />)}</div>
          <blockquote>“{t.quote}”</blockquote>
          <figcaption><strong>{t.name}</strong><small>{t.school}</small></figcaption>
        </figure>)}
      </div>
    </section>

    {/* FAQ */}
    <section className="ls-section alt" id="faq">
      <div className="ls-head reveal"><h2>Frequently Asked Questions</h2><p>Everything you need to know.</p></div>
      <div className="ls-faq reveal">
        {FAQS.map((item, i) => <div key={i} className={`ls-faq-item ${openFaq === i ? 'open' : ''}`}>
          <button onClick={() => setOpenFaq(openFaq === i ? -1 : i)}>
            <span>{item.q}</span><ChevronDown size={18} />
          </button>
          <div className="ls-faq-answer"><p>{item.a}</p></div>
        </div>)}
      </div>
    </section>

    {/* FINAL CTA */}
    <section className="ls-final" id="contact">
      <div className="ls-final-content reveal">
        <h2>Ready to transform your school?</h2>
        <p>Join schools already using Northstar School OS.</p>
        <a className="ls-btn ls-btn-white lg" href="/register">Get Started Free <ArrowRight size={18} /></a>
        <div className="ls-final-contact">
          <a href="https://wa.me/919999999999" target="_blank" rel="noopener noreferrer"><MessageCircle size={16} /> WhatsApp Support</a>
          <a href="mailto:ayushrajputt03@gmail.com"><Mail size={16} /> ayushrajputt03@gmail.com</a>
        </div>
      </div>
    </section>

    {/* FOOTER */}
    <footer className="ls-footer">
      <div className="ls-footer-inner">
        <div className="ls-footer-brand">
          <img src="/nxt-logo-transparent.png" alt="" onError={e => { e.target.style.display = 'none' }} />
          <span>Northstar <b>School OS</b></span>
          <small>Complete school management by NXT Eleveta Media.</small>
        </div>
        <div className="ls-footer-links">
          <a href="#features" onClick={e => scrollTo('features', e)}>Features</a>
          <a href="#pricing" onClick={e => scrollTo('pricing', e)}>Pricing</a>
          <a href="#faq" onClick={e => scrollTo('faq', e)}>FAQ</a>
          <a href="mailto:ayushrajputt03@gmail.com">Contact Us</a>
        </div>
      </div>
      <div className="ls-footer-bottom">
        <span>© 2026 NXT Eleveta Media. All rights reserved.</span>
        <span className="ls-footer-legal"><a href="/register">Terms &amp; Conditions</a> · <a href="/register">Privacy Policy</a></span>
      </div>
    </footer>
  </div>
}

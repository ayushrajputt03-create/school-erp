import React, { useEffect, useState } from 'react'
import {
  Activity, ArrowRight, BarChart3, BookOpen, Building2, CalendarCheck, Check,
  ChevronDown, ClipboardList, Cloud, CreditCard, Database, FileBarChart2, FileText,
  GraduationCap, IndianRupee, KeyRound, Lock, Mail, Megaphone, Menu, MessageCircle,
  Rocket, ScrollText, Server, ShieldCheck, Smartphone, Sparkles, Star, TrendingUp,
  Upload, UserPlus, Users, Wallet, Wifi, X, Zap,
} from 'lucide-react'
import './landing.css'

const NAV_LINKS = [['features', 'Features'], ['workflow', 'Workflow'], ['pricing', 'Pricing'], ['faq', 'FAQ'], ['contact', 'Contact']]

const TRUST_TECH = [
  { icon: Database, label: 'Firebase' },
  { icon: Zap, label: 'React SPA' },
  { icon: Cloud, label: 'Cloud Infrastructure' },
  { icon: KeyRound, label: 'Secure Auth' },
  { icon: Server, label: 'Real-Time Database' },
]
const TRUST_STATS = [
  ['5,000+', 'Students Managed'],
  ['99.9%', 'Uptime'],
  ['24/7', 'Availability'],
  ['Multi-School', 'Architecture'],
]

const LOGIN_CARDS = [
  { icon: ShieldCheck, cls: 'admin', title: 'Principal / Admin', desc: 'Manage students, staff, fees, academics and reports from a single dashboard.', href: '/login', label: 'Admin Login' },
  { icon: GraduationCap, cls: 'teacher', title: 'Staff / Teacher', desc: 'All employees — teachers, accountants, office & more. Attendance, marks, homework and your dashboard.', href: '/teacher/login', label: 'Staff Login' },
  { icon: Users, cls: 'parent', title: 'Parent / Guardian', desc: 'Track attendance, fees, academic progress and notices.', href: '/parent/login', label: 'Parent Login' },
]

const SHOWCASE = [
  { tag: 'Command Center', title: 'School Dashboard', desc: 'Live stats, fee collection and activity in one glance.' },
  { tag: 'Academics', title: 'Attendance System', desc: 'Class-wise daily attendance in seconds.' },
  { tag: 'Finance', title: 'Fee Management', desc: 'Collect, receipt and track fees with reminders.' },
  { tag: 'Family', title: 'Parent Portal', desc: 'Parents follow progress, fees and notices live.' },
  { tag: 'Results', title: 'Report Cards', desc: 'Generate marksheets and publish results instantly.' },
]

const FEATURE_GROUPS = [
  { group: 'Administration', items: [
    { icon: ClipboardList, name: 'Admission Management', desc: 'Enquiry to enrolment in one flow.' },
    { icon: GraduationCap, name: 'Student Records', desc: 'Complete profiles and history.' },
    { icon: Users, name: 'Employee Management', desc: 'Staff, roles, leave and payroll.' },
  ] },
  { group: 'Academics', items: [
    { icon: CalendarCheck, name: 'Attendance Tracking', desc: 'Daily class attendance in seconds.' },
    { icon: FileBarChart2, name: 'Report Cards', desc: 'Marksheets and published results.' },
    { icon: BookOpen, name: 'Homework & Notices', desc: 'Share work and school updates.' },
  ] },
  { group: 'Finance', items: [
    { icon: Wallet, name: 'Fee Management', desc: 'Collect, receipt and track fees.' },
    { icon: CreditCard, name: 'Payment Tracking', desc: 'Dues, reminders and history.' },
    { icon: TrendingUp, name: 'Financial Reports', desc: 'Collection insights and exports.' },
  ] },
  { group: 'Documents', items: [
    { icon: ScrollText, name: 'Certificates', desc: 'Bonafide, character and more.' },
    { icon: CreditCard, name: 'ID Cards', desc: 'Student and staff ID generator.' },
    { icon: FileText, name: 'Transfer Certificates', desc: 'Compliant TC in one click.' },
  ] },
  { group: 'Communication', items: [
    { icon: Smartphone, name: 'Parent Portal', desc: 'Real-time updates for families.' },
    { icon: Megaphone, name: 'Notices', desc: 'Targeted school announcements.' },
    { icon: MessageCircle, name: 'WhatsApp Communication', desc: 'Reach parents where they are.' },
  ] },
  { group: 'Security', items: [
    { icon: Lock, name: 'Role-Based Access', desc: 'Admin, teacher and parent scopes.' },
    { icon: Cloud, name: 'Secure Cloud Storage', desc: 'Encrypted, always available.' },
    { icon: ShieldCheck, name: 'Data Isolation', desc: 'Every school fully separated.' },
  ] },
]

const WORKFLOW = ['Admission', 'Enrollment', 'Attendance', 'Examinations', 'Report Cards', 'Certificates', 'Graduation']

const WHY = [
  { icon: IndianRupee, title: 'Affordable Pricing', desc: 'Pay only ₹12–25 per student per month. No hidden fees, no big upfront cost.' },
  { icon: Rocket, title: 'Setup in Minutes', desc: 'Go live in under 30 minutes. No technical knowledge required.' },
  { icon: Wifi, title: 'Accessible Anywhere', desc: 'Works beautifully on mobile, tablet and desktop — anytime.' },
]

const SECURITY = [
  { icon: ShieldCheck, title: 'School Data Isolation', desc: 'Each school’s data is fully partitioned.' },
  { icon: Cloud, title: 'Automated Backups', desc: 'Scheduled backups keep data safe.' },
  { icon: Lock, title: 'Role-Based Permissions', desc: 'Granular access per user role.' },
  { icon: Activity, title: 'Audit Logs', desc: 'Track key actions across the system.' },
  { icon: KeyRound, title: 'Firebase Authentication', desc: 'Enterprise-grade sign-in security.' },
]

const PRICING = [
  ['1 – 100', '₹25'], ['101 – 300', '₹20'], ['301 – 500', '₹18'], ['501 – 1000', '₹15'], ['1000+', '₹12'],
]

const STEPS = [
  { icon: UserPlus, step: '01', title: 'Register School', desc: 'Create your workspace in minutes.' },
  { icon: Upload, step: '02', title: 'Import Students', desc: 'Bring in your student data fast.' },
  { icon: Building2, step: '03', title: 'Configure Classes', desc: 'Set classes, sections and staff.' },
  { icon: Rocket, step: '04', title: 'Start Managing', desc: 'Run your whole school from one place.' },
]

const TESTIMONIALS = [
  { quote: 'Northstar has simplified fee management and administration for our entire school.', name: 'Principal', school: 'School name to be added' },
  { quote: 'Attendance and report cards that took days now take minutes for our teachers.', name: 'Vice Principal', school: 'School name to be added' },
  { quote: 'Parents love the portal — fewer office calls and far more transparency.', name: 'Administrator', school: 'School name to be added' },
]

const FAQS = [
  { q: 'Is there a free trial?', a: 'Yes — get your first 3 months completely free with full access to every feature, plus free setup and training.' },
  { q: 'How long does setup take?', a: 'Most schools are fully live within 30 minutes. No technical knowledge is required.' },
  { q: 'Is school data secure?', a: 'Absolutely. We use Firebase enterprise security with complete data isolation between schools and automated backups.' },
  { q: 'Can parents access the system?', a: 'Yes. Parents get their own portal to track attendance, fees, results and notices in real time.' },
  { q: 'What support is available?', a: 'We provide WhatsApp and email support with quick response times, plus onboarding help.' },
]

function useReveal() {
  useEffect(() => {
    const root = document.documentElement
    const els = [...document.querySelectorAll('.reveal')]
    const reveal = el => el.classList.add('in-view')
    // Hidden/background tabs pause CSS animations — never hide content behind an animation
    // that can't run. Only enable the hide-then-reveal when the tab is actually visible.
    if (document.hidden || !('IntersectionObserver' in window)) { els.forEach(reveal); return }
    root.classList.add('js-reveal')
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => { if (entry.isIntersecting) { reveal(entry.target); obs.unobserve(entry.target) } })
    }, { threshold: 0, rootMargin: '0px 0px -8% 0px' })
    els.forEach(el => io.observe(el))
    const raf = requestAnimationFrame(() => els.forEach(el => {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.9) reveal(el)
    }))
    return () => { io.disconnect(); cancelAnimationFrame(raf); root.classList.remove('js-reveal') }
  }, [])
}

function HeroMockup() {
  return <div className="ls-mockup reveal" aria-hidden="true">
    <div className="ls-mockup-glass">
      <div className="ls-mockup-head">
        <span className="ls-mockup-dot" /><span className="ls-mockup-dot" /><span className="ls-mockup-dot" />
        <b>Northstar · Command Center</b>
      </div>
      <div className="ls-mockup-stats">
        <div><span>Students</span><strong>1,248</strong><i className="up">▲ 4.2%</i></div>
        <div><span>Fees (mo)</span><strong>₹4.2L</strong><i className="up">▲ 8.1%</i></div>
        <div><span>Attendance</span><strong>96%</strong><i className="up">▲ 1.3%</i></div>
      </div>
      <div className="ls-mockup-chart">
        <div className="ls-mockup-bars">
          {[52, 68, 44, 80, 61, 92].map((h, i) => <span key={i} style={{ height: `${h}%` }} />)}
        </div>
        <div className="ls-mockup-chart-label">Fee collection · last 6 months</div>
      </div>
      <div className="ls-mockup-activity">
        <div className="ls-mockup-ring"><svg viewBox="0 0 36 36"><circle className="bg" cx="18" cy="18" r="15.9" /><circle className="fg" cx="18" cy="18" r="15.9" /></svg><div><strong>96%</strong><span>Present</span></div></div>
        <ul>
          <li><i className="g" /> New admission · Class 6-A</li>
          <li><i className="b" /> Fee received · ₹12,500</li>
          <li><i className="a" /> Notice published</li>
        </ul>
      </div>
    </div>
    <div className="ls-mockup-float ls-float-a"><CalendarCheck size={16} /> Attendance marked</div>
    <div className="ls-mockup-float ls-float-b"><Wallet size={16} /> ₹4.2L collected</div>
  </div>
}

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState(0)
  const [scrolled, setScrolled] = useState(false)
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
    {/* NAV */}
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
          <a className="ls-btn ls-btn-primary sm" href="/register">Get Started Free <ArrowRight size={15} /></a>
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
      <div className="ls-hero-grid" />
      <div className="ls-hero-inner">
        <div className="ls-hero-copy reveal">
          <span className="ls-badge"><Sparkles size={14} /> Trusted by Schools Across Delhi NCR</span>
          <h1>Northstar <span className="ls-grad">School OS</span></h1>
          <p className="ls-tagline">The Complete Operating System for Modern Schools</p>
          <p className="ls-hero-desc">Manage admissions, attendance, academics, fees, certificates, communication, staff and reports from one intelligent platform built for schools.</p>
          <div className="ls-hero-cta">
            <a className="ls-btn ls-btn-white" href="/register">Get Started Free <ArrowRight size={17} /></a>
            <button className="ls-btn ls-btn-ghost" onClick={e => scrollTo('showcase', e)}>Watch Demo</button>
          </div>
          <div className="ls-hero-trust">
            {['99.9% Uptime', 'Cloud Hosted', 'Multi-School Ready', 'Secure Infrastructure'].map(t =>
              <span key={t}><Check size={14} /> {t}</span>)}
          </div>
        </div>
        <HeroMockup />
      </div>
    </section>

    {/* TRUST BAR */}
    <section className="ls-trustbar">
      <p className="ls-trust-title reveal">Trusted Technology</p>
      <div className="ls-trust-tech reveal">
        {TRUST_TECH.map(t => <span key={t.label}><t.icon size={17} /> {t.label}</span>)}
      </div>
      <div className="ls-trust-stats reveal">
        {TRUST_STATS.map(([v, l]) => <div key={l}><strong>{v}</strong><span>{l}</span></div>)}
      </div>
    </section>

    {/* LOGIN PORTALS */}
    <section className="ls-section" id="login">
      <div className="ls-head reveal"><span className="ls-eyebrow">Portals</span><h2>Login to Your Portal</h2><p>Access your personalized dashboard.</p></div>
      <div className="ls-login-grid reveal">
        {LOGIN_CARDS.map(card => <a key={card.href} className="ls-login-card" href={card.href}>
          <span className={`ls-login-icon ${card.cls}`}><card.icon size={26} /></span>
          <h3>{card.title}</h3>
          <p>{card.desc}</p>
          <span className="ls-login-btn">{card.label} <ArrowRight size={15} /></span>
        </a>)}
      </div>
    </section>

    {/* PRODUCT SHOWCASE */}
    <section className="ls-section alt" id="showcase">
      <div className="ls-head reveal"><span className="ls-eyebrow">Product</span><h2>See Northstar in Action</h2><p>Designed for administrators, teachers and parents.</p></div>
      <div className="ls-showcase reveal">
        {SHOWCASE.map(s => <article key={s.title} className="ls-showcase-card">
          <div className="ls-showcase-glass">
            <div className="ls-showcase-bar"><span /><span /><span /></div>
            <div className="ls-showcase-body">
              <div className="ls-showcase-row"><i /><i className="w2" /></div>
              <div className="ls-showcase-mini">{[60, 40, 85, 55].map((h, i) => <span key={i} style={{ height: `${h}%` }} />)}</div>
              <div className="ls-showcase-row"><i className="w3" /><i /></div>
            </div>
          </div>
          <span className="ls-showcase-tag">{s.tag}</span>
          <h3>{s.title}</h3>
          <p>{s.desc}</p>
        </article>)}
      </div>
    </section>

    {/* FEATURES */}
    <section className="ls-section" id="features">
      <div className="ls-head reveal"><span className="ls-eyebrow">Features</span><h2>Everything Your School Needs</h2><p>One platform. Complete control.</p></div>
      <div className="ls-feature-groups">
        {FEATURE_GROUPS.map(group => <div key={group.group} className="ls-feature-group reveal">
          <h4 className="ls-feature-group-title">{group.group}</h4>
          <div className="ls-feature-row">
            {group.items.map(f => <div key={f.name} className="ls-feature">
              <span className="ls-feature-icon"><f.icon size={20} /></span>
              <strong>{f.name}</strong>
              <small>{f.desc}</small>
            </div>)}
          </div>
        </div>)}
      </div>
    </section>

    {/* WORKFLOW */}
    <section className="ls-section alt" id="workflow">
      <div className="ls-head reveal"><span className="ls-eyebrow">Lifecycle</span><h2>From Admission to Graduation</h2><p>Manage the complete student lifecycle from one platform.</p></div>
      <div className="ls-workflow reveal">
        {WORKFLOW.map((step, i) => <React.Fragment key={step}>
          <div className="ls-workflow-step"><span className="ls-workflow-num">{i + 1}</span><strong>{step}</strong></div>
          {i < WORKFLOW.length - 1 && <ArrowRight className="ls-workflow-arrow" size={18} />}
        </React.Fragment>)}
      </div>
    </section>

    {/* WHY */}
    <section className="ls-section" id="why">
      <div className="ls-head reveal"><span className="ls-eyebrow">Why Northstar</span><h2>Built for Indian Schools</h2><p>Priced for reality, designed for speed.</p></div>
      <div className="ls-why-grid reveal">
        {WHY.map(w => <div key={w.title} className="ls-why">
          <span className="ls-why-icon"><w.icon size={24} /></span>
          <h3><Check size={16} /> {w.title}</h3>
          <p>{w.desc}</p>
        </div>)}
      </div>
    </section>

    {/* SECURITY */}
    <section className="ls-section alt" id="security">
      <div className="ls-head reveal"><span className="ls-eyebrow">Security</span><h2>Enterprise Grade Security</h2><p>Your school data remains completely isolated and secure.</p></div>
      <div className="ls-security-grid reveal">
        {SECURITY.map(s => <div key={s.title} className="ls-security-card">
          <span className="ls-security-icon"><s.icon size={22} /></span>
          <strong>{s.title}</strong>
          <small>{s.desc}</small>
        </div>)}
      </div>
    </section>

    {/* PRICING */}
    <section className="ls-section" id="pricing">
      <div className="ls-head reveal"><span className="ls-eyebrow">Pricing</span><h2>Simple, Fair Pricing</h2><p>Pay only for what you use.</p></div>
      <div className="ls-pricing reveal">
        <table className="ls-pricing-table">
          <thead><tr><th>Students</th><th>Price / Student / mo</th></tr></thead>
          <tbody>{PRICING.map(([range, price]) => <tr key={range}><td>{range}</td><td><strong>{price}</strong></td></tr>)}</tbody>
        </table>
        <div className="ls-pricing-highlight">
          <span className="ls-gift">🎁</span>
          <strong>First 3 Months FREE</strong>
          <ul>
            <li><Check size={15} /> Free Setup</li>
            <li><Check size={15} /> Free Data Migration</li>
            <li><Check size={15} /> Free Training</li>
          </ul>
          <a className="ls-btn ls-btn-primary" href="/register">Start Free Trial <ArrowRight size={15} /></a>
        </div>
      </div>
    </section>

    {/* IMPLEMENTATION */}
    <section className="ls-section alt" id="implementation">
      <div className="ls-head reveal"><span className="ls-eyebrow">Onboarding</span><h2>Go Live in 30 Minutes</h2><p>Four simple steps from sign-up to running your school.</p></div>
      <div className="ls-steps reveal">
        {STEPS.map((s, i) => <React.Fragment key={s.title}>
          <div className="ls-step">
            <span className="ls-step-icon"><s.icon size={22} /></span>
            <span className="ls-step-num">{s.step}</span>
            <strong>{s.title}</strong>
            <small>{s.desc}</small>
          </div>
          {i < STEPS.length - 1 && <ArrowRight className="ls-step-arrow" size={18} />}
        </React.Fragment>)}
      </div>
    </section>

    {/* TESTIMONIALS */}
    <section className="ls-section" id="testimonials">
      <div className="ls-head reveal"><span className="ls-eyebrow">Testimonials</span><h2>Trusted by Schools</h2><p>Real feedback coming soon.</p></div>
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
      <div className="ls-head reveal"><span className="ls-eyebrow">FAQ</span><h2>Frequently Asked Questions</h2><p>Everything you need to know.</p></div>
      <div className="ls-faq reveal">
        {FAQS.map((item, i) => <div key={i} className={`ls-faq-item ${openFaq === i ? 'open' : ''}`}>
          <button onClick={() => setOpenFaq(openFaq === i ? -1 : i)}><span>{item.q}</span><ChevronDown size={18} /></button>
          <div className="ls-faq-answer"><p>{item.a}</p></div>
        </div>)}
      </div>
    </section>

    {/* FINAL CTA */}
    <section className="ls-final" id="contact">
      <div className="ls-final-glow" />
      <div className="ls-final-content reveal">
        <h2>Ready to Transform Your School?</h2>
        <p>Join forward-thinking schools using Northstar School OS to automate administration and improve communication.</p>
        <div className="ls-final-cta">
          <a className="ls-btn ls-btn-white lg" href="/register">Get Started Free <ArrowRight size={18} /></a>
          <a className="ls-btn ls-btn-ghost lg" href="https://wa.me/919999999999" target="_blank" rel="noopener noreferrer">Schedule Demo</a>
        </div>
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
          <small>The complete operating system for modern schools, by NXT Eleveta Media.</small>
        </div>
        <div className="ls-footer-cols">
          <div><h5>Product</h5><a href="#features" onClick={e => scrollTo('features', e)}>Features</a><a href="#pricing" onClick={e => scrollTo('pricing', e)}>Pricing</a><a href="#security" onClick={e => scrollTo('security', e)}>Security</a></div>
          <div><h5>Company</h5><a href="#why" onClick={e => scrollTo('why', e)}>About</a><a href="#contact" onClick={e => scrollTo('contact', e)}>Contact</a></div>
          <div><h5>Support</h5><a href="#faq" onClick={e => scrollTo('faq', e)}>FAQ</a><a href="mailto:ayushrajputt03@gmail.com">Help Center</a></div>
          <div><h5>Legal</h5><a href="/register">Terms</a><a href="/register">Privacy Policy</a></div>
        </div>
      </div>
      <div className="ls-footer-bottom">
        <span>© 2026 NXT Eleveta Media. All Rights Reserved.</span>
        <a href="mailto:ayushrajputt03@gmail.com">ayushrajputt03@gmail.com</a>
      </div>
    </footer>
  </div>
}

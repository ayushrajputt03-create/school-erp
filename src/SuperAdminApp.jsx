import React, { useEffect, useMemo, useState } from 'react'
import {
  BarChart3, Bell, Building2, CalendarDays, CheckCircle2, ChevronRight,
  CircleDollarSign, Download, Eye, Gift, IndianRupee, LayoutDashboard, LogOut,
  Menu, Pencil, RefreshCw, Search, Settings, ShieldCheck, Tag, TriangleAlert,
  Users, WalletCards, X,
} from 'lucide-react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { auth, isFirebaseConfigured } from './lib/firebase'
import DatePicker from './DatePicker'
import './super-admin.css'

const databaseUrl = import.meta.env.VITE_FIREBASE_DATABASE_URL?.replace(/\/$/, '')
const ownerEmail = (import.meta.env.VITE_SUPER_ADMIN_EMAIL || 'ayushrajputt03@gmail.com').toLowerCase()

async function databaseRequest(path, token, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(`${databaseUrl}/${path ? `${path}.json` : '.json'}?auth=${encodeURIComponent(token)}`, {
      method: options.method || 'GET',
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) throw new Error(payload?.error || `Database request failed (${response.status})`)
    return payload
  } finally {
    clearTimeout(timeout)
  }
}

const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0))
const dateText = value => value ? new Date(Number(value) || value).toLocaleDateString('en-IN') : 'Not set'
const startOfMonth = value => new Date(value.getFullYear(), value.getMonth(), 1).getTime()
const addMonths = (value, count) => {
  const date = new Date(value)
  date.setMonth(date.getMonth() + count)
  return date.getTime()
}
const safePhone = value => String(value || '').replace(/\D/g, '').replace(/^0+/, '')
const schoolName = school => school.profile?.schoolName || school.profile?.name || school.name || 'Unnamed School'

const MIN_MONTHLY_FEE = 1500
const PRICING_LABELS = { default: 'Default', fixed: 'Fixed', free: 'Free', 'custom-rate': 'Per-student' }
const calculateDefaultSlab = count => {
  let fee = 0
  if (count <= 100) fee = count * 25
  else if (count <= 300) fee = 100 * 25 + (count - 100) * 20
  else if (count <= 500) fee = 100 * 25 + 200 * 20 + (count - 300) * 18
  else if (count <= 1000) fee = 100 * 25 + 200 * 20 + 200 * 18 + (count - 500) * 15
  else fee = 100 * 25 + 200 * 20 + 200 * 18 + 500 * 15 + (count - 1000) * 12
  return { amount: Math.max(fee, MIN_MONTHLY_FEE), status: 'active' }
}
const calculateSchoolFee = (sub, count) => {
  const isFree = sub.pricingType === 'free' || sub.isFree
  if (isFree) {
    const until = sub.freeUntil
    if (until === null || until === undefined || Number(until) === 0) return { amount: 0, status: 'free' }
    if (Date.now() < Number(until)) return { amount: 0, status: 'free' }
    return calculateDefaultSlab(count)
  }
  if (sub.pricingType === 'fixed') return { amount: Number(sub.fixedAmount || 0), status: 'active' }
  if (sub.pricingType === 'custom-rate') return { amount: count * Number(sub.customRate || 0), status: 'active' }
  return calculateDefaultSlab(count)
}
const subscriptionFor = school => {
  const sub = school.subscription || {}
  const studentCount = Object.keys(school.students || {}).length
  const pricingType = sub.pricingType || 'default'
  const computed = calculateSchoolFee({ ...sub, pricingType }, studentCount)
  const status = computed.status === 'free' ? 'free' : (sub.status || 'trial')
  return {
    plan: sub.plan || 'trial',
    status,
    pricingType,
    fixedAmount: Number(sub.fixedAmount || 0),
    customRate: Number(sub.customRate || 0),
    isFree: computed.status === 'free',
    freeUntil: sub.freeUntil ?? null,
    freeReason: sub.freeReason || '',
    studentCount,
    amount: computed.amount,
    startDate: sub.startDate || school.createdAt || school.profile?.createdAt,
    nextDueDate: sub.nextDueDate || addMonths(school.createdAt || school.profile?.createdAt || Date.now(), 1),
    lastPaidDate: sub.lastPaidDate || null,
    pricingHistory: sub.pricingHistory || {},
  }
}

function navigate(path, replace = false) {
  window.history[replace ? 'replaceState' : 'pushState']({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function SuperAdminLogin({ user, checking, denied }) {
  const [form, setForm] = useState({ email: user?.email || ownerEmail, password: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(denied || '')

  const submit = async event => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await signInWithEmailAndPassword(auth, form.email.trim(), form.password)
      if (result.user.email?.toLowerCase() !== ownerEmail) {
        await signOut(auth)
        throw new Error('This Firebase account is not authorized as the NXT owner.')
      }
      navigate('/super-admin/dashboard', true)
    } catch (loginError) {
      setError(loginError.message.replace('Firebase: ', ''))
    } finally {
      setBusy(false)
    }
  }

  return <main className="sa-login">
    <section className="sa-login-brand">
      <img src="/nxt-logo-transparent.png" alt="NXT School ERP" />
      <span>Owner Console</span>
      <h1>Control every school from one secure workspace.</h1>
      <p>Subscriptions, revenue, due payments and school operations stay separated from every school administrator.</p>
      <div className="sa-security-note"><ShieldCheck size={20} /><div><strong>Firebase protected</strong><small>Only the registered super admin UID can read all schools.</small></div></div>
    </section>
    <section className="sa-login-form">
      <form onSubmit={submit}>
        <div className="sa-login-heading"><img src="/favicon-master.png" alt="" /><div><span>SUPER ADMIN</span><h2>Owner sign in</h2></div></div>
        <p>Use your personal NXT owner account.</p>
        <label>Email<input type="email" required value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} autoComplete="email" /></label>
        <label>Password<input type="password" required value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} autoComplete="current-password" placeholder="Enter your Firebase password" /></label>
        {error && <div className="sa-error"><TriangleAlert size={16} />{error}</div>}
        <button className="sa-primary" disabled={busy || checking}>{busy || checking ? 'Checking access...' : 'Login to Owner Console'}</button>
        <button type="button" className="sa-back" onClick={() => window.location.assign('/')}>Back to school login</button>
      </form>
    </section>
  </main>
}

function StatusBadge({ value }) {
  const normalized = String(value || 'trial').toLowerCase()
  return <span className={`sa-badge ${normalized}`}>{normalized === 'active' ? 'Paid' : normalized[0].toUpperCase() + normalized.slice(1)}</span>
}

function StatCard({ label, value, icon: Icon, tone, note }) {
  return <article className="sa-stat"><span className={`sa-stat-icon ${tone}`}><Icon size={20} /></span><div><small>{label}</small><strong>{value}</strong><p>{note}</p></div></article>
}

function DashboardHome({ rows, payments, setPage, openSchool }) {
  const stats = calculateStats(rows, payments)
  const recent = [...rows].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 5)
  const due = rows.filter(row => ['due', 'trial'].includes(row.subscription.status)).slice(0, 5)
  return <>
    <div className="sa-stat-grid">
      <StatCard label="Total Schools Registered" value={rows.length} icon={Building2} tone="blue" note="All Firebase workspaces" />
      <StatCard label="Paying Schools" value={stats.paying} icon={CheckCircle2} tone="green" note="Chargeable subscriptions" />
      <StatCard label="Free Schools" value={stats.free} icon={Gift} tone="violet" note="No charge granted" />
      <StatCard label="Pending Payments" value={stats.due} icon={TriangleAlert} tone="red" note="Due and expired plans" />
      <StatCard label="Revenue This Month" value={money(stats.monthRevenue)} icon={IndianRupee} tone="cyan" note={`${stats.monthPayments} payments received`} />
      <StatCard label="Revenue All Time" value={money(stats.totalRevenue)} icon={WalletCards} tone="violet" note="Excludes free schools" />
    </div>
    <div className="sa-dashboard-grid">
      <section className="sa-panel">
        <header><div><h3>Recently registered schools</h3><p>Latest school workspaces</p></div><button className="sa-text" onClick={() => setPage('schools')}>View all <ChevronRight size={14} /></button></header>
        <div className="sa-compact-list">{recent.length ? recent.map(row => <button key={row.id} onClick={() => openSchool(row)}><span className="sa-school-mark">{schoolName(row).slice(0, 2).toUpperCase()}</span><div><strong>{schoolName(row)}</strong><small>{row.profile?.city || row.profile?.address || 'City not added'}</small></div><StatusBadge value={row.subscription.status} /></button>) : <Empty text="No schools registered yet." />}</div>
      </section>
      <section className="sa-panel">
        <header><div><h3>Payment attention</h3><p>Schools needing follow-up</p></div><button className="sa-text" onClick={() => setPage('due')}>Open due list <ChevronRight size={14} /></button></header>
        <div className="sa-compact-list">{due.length ? due.map(row => <button key={row.id} onClick={() => openSchool(row)}><span className="sa-school-mark warning">₹</span><div><strong>{schoolName(row)}</strong><small>Due {dateText(row.subscription.nextDueDate)}</small></div><strong>{money(row.subscription.amount)}</strong></button>) : <Empty text="No pending payments." />}</div>
      </section>
    </div>
  </>
}

function SchoolsPage({ rows, openSchool, editSchool, toggleSchool, exporting, exportExcel, bulkFree }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [city, setCity] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [picked, setPicked] = useState({})
  const cities = [...new Set(rows.map(row => row.profile?.city).filter(Boolean))].sort()
  const filtered = rows.filter(row => {
    const haystack = `${schoolName(row)} ${row.profile?.phone || ''} ${row.profile?.email || ''}`.toLowerCase()
    const registered = Number(row.createdAt || row.profile?.createdAt || 0)
    return (!query || haystack.includes(query.toLowerCase()))
      && (status === 'all' || row.subscription.status === status || (status === 'paid' && row.subscription.status === 'active') || (status === 'free' && row.subscription.isFree))
      && (city === 'all' || row.profile?.city === city)
      && (!from || registered >= new Date(from).getTime())
      && (!to || registered <= new Date(`${to}T23:59:59`).getTime())
  })
  const pickedIds = Object.keys(picked).filter(id => picked[id])
  const togglePick = id => setPicked(prev => ({ ...prev, [id]: !prev[id] }))
  const grantSelected = async () => {
    const chosen = filtered.filter(row => picked[row.id])
    if (!chosen.length) return
    await bulkFree(chosen)
    setPicked({})
  }
  return <section className="sa-panel sa-table-panel">
    <header><div><h3>All Schools</h3><p>{filtered.length} of {rows.length} workspaces</p></div><div className="sa-header-actions">{pickedIds.length > 0 && <button className="sa-primary small" onClick={grantSelected}><Gift size={14} /> Grant Free Access ({pickedIds.length})</button>}<button className="sa-secondary" onClick={exportExcel} disabled={exporting}><Download size={15} />{exporting ? 'Creating...' : 'Export Excel'}</button></div></header>
    <div className="sa-filters">
      <label className="sa-search"><Search size={15} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search school name, phone or email" /></label>
      <select value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option><option value="paid">Paid</option><option value="due">Due</option><option value="trial">Trial</option><option value="free">Free</option><option value="suspended">Suspended</option></select>
      <select value={city} onChange={event => setCity(event.target.value)}><option value="all">All cities</option>{cities.map(value => <option key={value}>{value}</option>)}</select>
          <DatePicker value={from} onChange={setFrom} placeholder="Registration from" />
          <DatePicker min={from} value={to} onChange={setTo} placeholder="Registration to" />
    </div>
    <div className="sa-table-scroll"><table><thead><tr><th><input type="checkbox" checked={filtered.length > 0 && filtered.every(row => picked[row.id])} onChange={e => setPicked(e.target.checked ? Object.fromEntries(filtered.map(row => [row.id, true])) : {})} /></th><th>#</th><th>School</th><th>Students</th><th>Pricing</th><th>Amount</th><th>Status</th><th>Next Due</th><th>Actions</th></tr></thead><tbody>
      {filtered.map((row, index) => <tr key={row.id}><td><input type="checkbox" checked={!!picked[row.id]} onChange={() => togglePick(row.id)} /></td><td>{index + 1}</td><td><button className="sa-school-link" onClick={() => openSchool(row)}><strong>{schoolName(row)}</strong><small>{row.profile?.city || row.profile?.email || 'No city'}</small></button></td><td>{row.subscription.studentCount}</td><td><PricingBadge subscription={row.subscription} /></td><td><strong>{money(row.subscription.amount)}</strong></td><td><StatusBadge value={row.subscription.status} /></td><td>{dateText(row.subscription.nextDueDate)}</td><td><div className="sa-actions"><button title="View" onClick={() => openSchool(row)}><Eye size={14} /></button><button title="Edit" onClick={() => editSchool(row)}><Pencil size={14} /></button><button title={row.subscription.status === 'suspended' ? 'Activate' : 'Suspend'} onClick={() => toggleSchool(row)}><ShieldCheck size={14} /></button></div></td></tr>)}
      {!filtered.length && <tr><td colSpan="9"><Empty text="No schools match these filters." /></td></tr>}
    </tbody></table></div>
  </section>
}

function PaymentsPage({ rows, payments, initialTab = 'received', markPaid }) {
  const [tab, setTab] = useState(initialTab)
  const dueRows = rows.filter(row => ['due', 'trial'].includes(row.subscription.status))
  const reminder = row => {
    const message = `Namaskar ${schoolName(row)} ji,\nAapka School ERP subscription ${money(row.subscription.amount)} due ho gaya hai.\n\nPlease jaldi payment karein:\nUPI: yourname@upi\nBank: XXXX\n\nPayment ke baad yahan confirm karein.\nDhanyavaad 🙏\nNXT School ERP Team`
    window.open(`https://wa.me/91${safePhone(row.profile?.phone)}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
  }
  return <section className="sa-panel sa-table-panel">
    <header><div><h3>Payment Management</h3><p>Subscription collections and outstanding dues</p></div></header>
    <div className="sa-tabs"><button className={tab === 'received' ? 'active' : ''} onClick={() => setTab('received')}>Received Payments</button><button className={tab === 'due' ? 'active' : ''} onClick={() => setTab('due')}>Due Payments</button><button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>All</button></div>
    {(tab === 'received' || tab === 'all') && <div className="sa-table-scroll"><table><thead><tr><th>School Name</th><th>Amount</th><th>Payment Date</th><th>Mode</th><th>Receipt No</th><th>Plan</th><th>Next Due</th></tr></thead><tbody>{payments.map(row => <tr key={`${row.schoolId}-${row.id}`}><td>{row.schoolName}</td><td><strong>{money(row.amount)}</strong></td><td>{dateText(row.date)}</td><td>{row.mode || 'UPI'}</td><td>{row.receiptNo || row.id}</td><td>{capitalize(row.plan)}</td><td>{dateText(row.nextDueDate)}</td></tr>)}{!payments.length && <tr><td colSpan="7"><Empty text="No subscription payments recorded." /></td></tr>}</tbody></table></div>}
    {(tab === 'due' || tab === 'all') && <div className="sa-table-scroll"><table><thead><tr><th>School</th><th>Phone</th><th>Due Since</th><th>Amount Due</th><th>Reminder</th><th>Payment</th></tr></thead><tbody>{dueRows.map(row => <tr key={row.id}><td><strong>{schoolName(row)}</strong></td><td>{row.profile?.phone || 'Not added'}</td><td>{daysDue(row.subscription.nextDueDate)} days</td><td>{money(row.subscription.amount)}</td><td><button className="sa-secondary small" disabled={!safePhone(row.profile?.phone)} onClick={() => reminder(row)}>WhatsApp</button></td><td><button className="sa-primary small" onClick={() => markPaid(row)}>Mark as Paid</button></td></tr>)}{!dueRows.length && <tr><td colSpan="6"><Empty text="Every school is up to date." /></td></tr>}</tbody></table></div>}
  </section>
}

function AnalyticsPage({ rows, payments }) {
  const now = new Date()
  const months = Array.from({ length: 6 }, (_, index) => new Date(now.getFullYear(), now.getMonth() - 5 + index, 1))
  const revenue = months.map(month => payments.filter(row => {
    const date = new Date(row.date || 0)
    return date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear()
  }).reduce((sum, row) => sum + Number(row.amount || 0), 0))
  const growth = months.map(month => rows.filter(row => Number(row.createdAt || row.profile?.createdAt || 0) <= new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59).getTime()).length)
  const maxRevenue = Math.max(...revenue, 1)
  const maxGrowth = Math.max(...growth, 1)
  const stats = calculateStats(rows, payments)
  const previousMonth = payments.filter(row => Number(row.date || 0) >= startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1)) && Number(row.date || 0) < startOfMonth(now)).reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const growthPercent = previousMonth ? Math.round(((stats.monthRevenue - previousMonth) / previousMonth) * 100) : stats.monthRevenue ? 100 : 0
  const cityCounts = rows.reduce((result, row) => ({ ...result, [row.profile?.city || 'Not specified']: (result[row.profile?.city || 'Not specified'] || 0) + 1 }), {})
  return <>
    <div className="sa-stat-grid four">
      <StatCard label="This Month Revenue" value={money(stats.monthRevenue)} icon={IndianRupee} tone="blue" note="Current calendar month" />
      <StatCard label="Last Month Revenue" value={money(previousMonth)} icon={CalendarDays} tone="violet" note="Previous calendar month" />
      <StatCard label="Growth" value={`${growthPercent}%`} icon={BarChart3} tone={growthPercent >= 0 ? 'green' : 'red'} note="Month-on-month" />
      <StatCard label="Average Revenue / School" value={money(rows.length ? stats.totalRevenue / rows.length : 0)} icon={CircleDollarSign} tone="cyan" note="All recorded payments" />
    </div>
    <div className="sa-analytics-grid">
      <section className="sa-panel sa-chart"><header><div><h3>Monthly revenue</h3><p>Last six months</p></div></header><div className="sa-bars">{months.map((month, index) => <div key={month.toISOString()}><span style={{ height: `${Math.max(5, revenue[index] / maxRevenue * 100)}%` }} title={money(revenue[index])} /><small>{month.toLocaleDateString('en-IN', { month: 'short' })}</small></div>)}</div></section>
      <section className="sa-panel sa-chart"><header><div><h3>Schools growth</h3><p>Cumulative registrations</p></div></header><div className="sa-bars growth">{months.map((month, index) => <div key={month.toISOString()}><span style={{ height: `${Math.max(5, growth[index] / maxGrowth * 100)}%` }} title={`${growth[index]} schools`} /><small>{month.toLocaleDateString('en-IN', { month: 'short' })}</small></div>)}</div></section>
      <section className="sa-panel sa-status-chart"><header><div><h3>Paid vs Due</h3><p>Subscription health</p></div></header><div className="sa-donut" style={{ background: `conic-gradient(#31a36f 0 ${rows.length ? stats.active / rows.length * 100 : 0}%,#df5555 0)` }}><div><strong>{rows.length}</strong><span>Schools</span></div></div><div className="sa-legend"><span><i className="paid" />Paid <strong>{stats.active}</strong></span><span><i className="due" />Due / Trial <strong>{rows.length - stats.active}</strong></span></div></section>
      <section className="sa-panel sa-city-map"><header><div><h3>City wise schools map</h3><p>Registration distribution</p></div></header><div>{Object.entries(cityCounts).sort((a, b) => b[1] - a[1]).map(([city, count]) => <span key={city} style={{ '--size': `${Math.min(100, 45 + count * 8)}px` }}><strong>{count}</strong><small>{city}</small></span>)}</div></section>
    </div>
  </>
}

function NotificationsPage({ rows, payments }) {
  const now = Date.now()
  const items = [
    ...rows.filter(row => Math.abs(Number(row.subscription.nextDueDate || 0) - now) < 86400000).map(row => ({ type: 'due', title: `${schoolName(row)} payment due today`, time: row.subscription.nextDueDate })),
    ...rows.filter(row => now - Number(row.createdAt || row.profile?.createdAt || 0) < 7 * 86400000).map(row => ({ type: 'new', title: `${schoolName(row)} just registered`, time: row.createdAt || row.profile?.createdAt })),
    ...payments.filter(row => now - Number(row.date || 0) < 7 * 86400000).map(row => ({ type: 'paid', title: `${row.schoolName} payment received`, time: row.date })),
    ...rows.filter(row => row.subscription.status === 'trial' && Number(row.subscription.nextDueDate || 0) - now > 0 && Number(row.subscription.nextDueDate || 0) - now < 4 * 86400000).map(row => ({ type: 'trial', title: `${schoolName(row)} trial ending in ${Math.ceil((row.subscription.nextDueDate - now) / 86400000)} days`, time: row.subscription.nextDueDate })),
  ].sort((a, b) => Number(b.time || 0) - Number(a.time || 0))
  return <section className="sa-panel"><header><div><h3>Notifications</h3><p>Automatic owner alerts from school and payment activity</p></div></header><div className="sa-notifications">{items.length ? items.map((item, index) => <article key={`${item.title}-${index}`}><span className={item.type}><Bell size={17} /></span><div><strong>{item.title}</strong><small>{dateText(item.time)}</small></div></article>) : <Empty text="No new notifications." />}</div></section>
}

function PricingControl({ row, onSave }) {
  const sub = row.subscription
  const count = sub.studentCount
  const [type, setType] = useState(sub.pricingType || 'default')
  const [fixedAmount, setFixedAmount] = useState(sub.fixedAmount || '')
  const [customRate, setCustomRate] = useState(sub.customRate || '')
  const [freeMode, setFreeMode] = useState(sub.freeUntil ? 'until' : 'permanent')
  const [freeUntilDate, setFreeUntilDate] = useState(sub.freeUntil ? new Date(Number(sub.freeUntil)).toISOString().slice(0, 10) : '')
  const [freeMonths, setFreeMonths] = useState(3)
  const [freeReason, setFreeReason] = useState(sub.freeReason || '')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const previewAmount = useMemo(() => {
    if (type === 'free') return 0
    if (type === 'fixed') return Number(fixedAmount || 0)
    if (type === 'custom-rate') return count * Number(customRate || 0)
    return calculateDefaultSlab(count).amount
  }, [type, fixedAmount, customRate, count])

  const buildPayload = () => {
    if (type === 'free') {
      let freeUntil = null
      if (freeMode === 'until' && freeUntilDate) freeUntil = new Date(`${freeUntilDate}T23:59:59`).getTime()
      else if (freeMode === 'months') freeUntil = addMonths(Date.now(), Number(freeMonths || 0))
      return { pricingType: 'free', isFree: true, freeUntil, freeReason: freeReason.trim(), fixedAmount: 0, customRate: 0 }
    }
    return {
      pricingType: type, isFree: false, freeUntil: null, freeReason: '',
      fixedAmount: type === 'fixed' ? Number(fixedAmount || 0) : 0,
      customRate: type === 'custom-rate' ? Number(customRate || 0) : 0,
    }
  }

  const submit = async () => {
    if (type === 'fixed' && !Number(fixedAmount)) { window.alert('Enter a fixed monthly amount.'); return }
    if (type === 'custom-rate' && !Number(customRate)) { window.alert('Enter a per-student rate.'); return }
    const label = type === 'free' ? 'Free (No Charge)' : `${PRICING_LABELS[type]} — ${money(previewAmount)}/month`
    if (!window.confirm(`Change pricing for ${schoolName(row)}?\n\nFrom: ${PRICING_LABELS[sub.pricingType]} (${money(sub.amount)}/month)\nTo: ${label}\n\nProceed?`)) return
    setBusy(true)
    try { await onSave(buildPayload(), reason.trim() || freeReason.trim()) }
    finally { setBusy(false) }
  }

  return <div className="sa-drawer-section sa-pricing">
    <div className="sa-drawer-title"><h3><Tag size={16} /> Pricing Control</h3><span className="sa-pricing-current">{money(sub.amount)}/mo</span></div>
    <div className="sa-pricing-options">
      {[['default', 'Default Slab Pricing'], ['fixed', 'Custom Fixed Price'], ['free', 'Free (No Charge)'], ['custom-rate', 'Custom Per-Student Rate']].map(([value, label]) =>
        <label key={value} className={`sa-radio ${type === value ? 'on' : ''}`}><input type="radio" name="pricingType" checked={type === value} onChange={() => setType(value)} /><span>{label}</span></label>)}
    </div>

    {type === 'default' && <div className="sa-pricing-detail"><p>Auto slab: ₹25 (1-100), ₹20 (101-300), ₹18 (301-500), ₹15 (501-1000), ₹12 (1000+). Min {money(MIN_MONTHLY_FEE)}.</p><div className="sa-pricing-amount">{count} students → <strong>{money(previewAmount)}/month</strong></div></div>}
    {type === 'fixed' && <div className="sa-pricing-detail"><label>Fixed Monthly Amount (₹)<input type="number" min="0" value={fixedAmount} onChange={e => setFixedAmount(e.target.value)} placeholder="e.g. 5000" /></label></div>}
    {type === 'custom-rate' && <div className="sa-pricing-detail"><label>Rate per student (₹)<input type="number" min="0" value={customRate} onChange={e => setCustomRate(e.target.value)} placeholder="e.g. 10" /></label><div className="sa-pricing-amount">{count} × {money(Number(customRate || 0))} = <strong>{money(previewAmount)}/month</strong></div></div>}
    {type === 'free' && <div className="sa-pricing-detail">
      <div className="sa-pricing-options col">
        <label className={`sa-radio ${freeMode === 'permanent' ? 'on' : ''}`}><input type="radio" name="freeMode" checked={freeMode === 'permanent'} onChange={() => setFreeMode('permanent')} /><span>Permanent Free</span></label>
        <label className={`sa-radio ${freeMode === 'until' ? 'on' : ''}`}><input type="radio" name="freeMode" checked={freeMode === 'until'} onChange={() => setFreeMode('until')} /><span>Free until date</span></label>
        {freeMode === 'until' && <DatePicker value={freeUntilDate} onChange={setFreeUntilDate} placeholder="Free until" />}
        <label className={`sa-radio ${freeMode === 'months' ? 'on' : ''}`}><input type="radio" name="freeMode" checked={freeMode === 'months'} onChange={() => setFreeMode('months')} /><span>Free for X months</span></label>
        {freeMode === 'months' && <input type="number" min="1" value={freeMonths} onChange={e => setFreeMonths(e.target.value)} placeholder="Months" />}
      </div>
      <label>Reason (Reference / Demo / Relative / Promotional)<input value={freeReason} onChange={e => setFreeReason(e.target.value)} placeholder="e.g. First reference school" /></label>
    </div>}

    <label className="sa-pricing-reason">Change note (logged in history)<input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for this pricing change" /></label>
    <button className="sa-primary" onClick={submit} disabled={busy}>{busy ? 'Saving...' : 'Save Pricing'}</button>

    {Object.keys(sub.pricingHistory).length > 0 && <div className="sa-pricing-history">
      <h4>Pricing History</h4>
      {Object.entries(sub.pricingHistory).sort((a, b) => Number(b[0]) - Number(a[0])).map(([key, entry]) =>
        <div key={key} className="sa-history-row"><div><strong>{PRICING_LABELS[entry.type] || entry.type}</strong>{entry.reason ? ` — ${entry.reason}` : ''}<small>{dateText(entry.changedAt)} · was {money(entry.previousAmount)}</small></div></div>)}
    </div>}
  </div>
}

function SchoolDetails({ row, close, edit, toggle, markPaid, savePricing }) {
  const payments = Object.entries(row.payments || {}).map(([id, value]) => ({ id, ...value })).sort((a, b) => Number(b.date || 0) - Number(a.date || 0))
  const message = `Namaskar ${schoolName(row)} ji, NXT School ERP Team ki taraf se aapke school account ke sambandh mein sampark kar rahe hain.`
  return <div className="sa-drawer-backdrop" onClick={close}><aside className="sa-drawer" onClick={event => event.stopPropagation()}>
    <header><div><span>School Details</span><h2>{schoolName(row)}</h2></div><button onClick={close}><X size={20} /></button></header>
    <div className="sa-school-hero">{row.profile?.logo ? <img src={row.profile.logo} alt="" /> : <span>{schoolName(row).slice(0, 2).toUpperCase()}</span>}<div><StatusBadge value={row.subscription.status} /><p>{row.profile?.address || 'Address not added'}</p></div></div>
    <div className="sa-detail-actions"><button className="sa-secondary" onClick={() => edit(row)}><Pencil size={14} />Edit</button><button className="sa-secondary" onClick={() => window.open(`https://wa.me/91${safePhone(row.profile?.phone)}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')}>Send Message</button><button className="sa-primary" onClick={() => toggle(row)}>{row.subscription.status === 'suspended' ? 'Activate' : 'Suspend'}</button></div>
    <div className="sa-detail-grid">
      {[['Email', row.profile?.email], ['Phone', row.profile?.phone], ['City', row.profile?.city], ['Registered', dateText(row.createdAt || row.profile?.createdAt)], ['Pricing', row.subscription.isFree ? 'Free' : `${PRICING_LABELS[row.subscription.pricingType]} · ${money(row.subscription.amount)}/mo`], ['Next Due', dateText(row.subscription.nextDueDate)], ['Students', row.subscription.studentCount], ['Teachers', Object.keys(row.staff || row.teachers || {}).length], ['Last Login', dateText(row.lastLoginAt || row.profile?.lastLoginAt)]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value || 'Not provided'}</strong></div>)}
    </div>
    <PricingControl row={row} onSave={(data, reason) => savePricing(row, data, reason)} />
    <div className="sa-drawer-section"><div className="sa-drawer-title"><h3>Payment History</h3>{row.subscription.status !== 'active' && <button className="sa-primary small" onClick={() => markPaid(row)}>Mark as Paid</button>}</div>
      {payments.length ? payments.map(payment => <div className="sa-payment-row" key={payment.id}><div><strong>{payment.receiptNo || payment.id}</strong><small>{dateText(payment.date)} · {payment.mode}</small></div><strong>{money(payment.amount)}</strong></div>) : <Empty text="No payments recorded for this school." />}
    </div>
  </aside></div>
}

function EditSchoolModal({ row, close, save }) {
  const [form, setForm] = useState({ schoolName: schoolName(row), principalName: row.profile?.principalName || '', email: row.profile?.email || '', phone: row.profile?.phone || '', city: row.profile?.city || '', address: row.profile?.address || '', plan: row.subscription.plan, status: row.subscription.status, amount: row.subscription.amount, nextDueDate: new Date(row.subscription.nextDueDate).toISOString().slice(0, 10) })
  const [busy, setBusy] = useState(false)
  const submit = async event => {
    event.preventDefault()
    setBusy(true)
    await save(row, form)
    setBusy(false)
  }
  return <div className="sa-modal-backdrop"><form className="sa-modal" onSubmit={submit}><header><div><span>Edit School</span><h3>{schoolName(row)}</h3></div><button type="button" onClick={close}><X size={18} /></button></header><div className="sa-form-grid">
    <label>School Name<input required value={form.schoolName} onChange={event => setForm({ ...form, schoolName: event.target.value })} /></label><label>Principal Name<input value={form.principalName} onChange={event => setForm({ ...form, principalName: event.target.value })} /></label>
    <label>Email<input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></label><label>Phone<input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} /></label>
    <label>City<input value={form.city} onChange={event => setForm({ ...form, city: event.target.value })} /></label><label>Plan<select value={form.plan} onChange={event => setForm({ ...form, plan: event.target.value })}><option value="monthly">Monthly</option><option value="yearly">Yearly</option><option value="trial">Trial</option></select></label>
    <label>Status<select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })}><option value="active">Paid / Active</option><option value="due">Due</option><option value="trial">Trial</option><option value="suspended">Suspended</option></select></label><label>Amount<input type="number" min="0" value={form.amount} onChange={event => setForm({ ...form, amount: event.target.value })} /></label>
          <label>Next Due Date<DatePicker value={form.nextDueDate} onChange={value => setForm({ ...form, nextDueDate: value })} /></label><label className="full">Address<textarea value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} /></label>
  </div><footer><button type="button" className="sa-secondary" onClick={close}>Cancel</button><button className="sa-primary" disabled={busy}>{busy ? 'Saving...' : 'Save Changes'}</button></footer></form></div>
}

function Empty({ text }) {
  return <div className="sa-empty"><Building2 size={25} /><p>{text}</p></div>
}

const capitalize = value => String(value || '').replace(/^./, letter => letter.toUpperCase())
const daysDue = value => Math.max(0, Math.floor((Date.now() - Number(value || Date.now())) / 86400000))
const calculateStats = (rows, payments) => {
  const monthStart = startOfMonth(new Date())
  const monthPayments = payments.filter(row => Number(row.date || 0) >= monthStart)
  return {
    active: rows.filter(row => row.subscription.status === 'active').length,
    due: rows.filter(row => ['due', 'suspended'].includes(row.subscription.status)).length,
    free: rows.filter(row => row.subscription.isFree).length,
    paying: rows.filter(row => !row.subscription.isFree).length,
    monthRevenue: monthPayments.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    monthPayments: monthPayments.length,
    totalRevenue: payments.reduce((sum, row) => sum + Number(row.amount || 0), 0),
  }
}

function PricingBadge({ subscription }) {
  if (subscription.isFree) return <span className="sa-badge free"><Gift size={12} /> Free</span>
  return <span className={`sa-pricing-tag ${subscription.pricingType}`}>{PRICING_LABELS[subscription.pricingType] || 'Default'}</span>
}

export default function SuperAdminApp() {
  const [route, setRoute] = useState(window.location.pathname)
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)
  const [denied, setDenied] = useState('')
  const [schools, setSchools] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const update = () => setRoute(window.location.pathname)
    window.addEventListener('popstate', update)
    return () => window.removeEventListener('popstate', update)
  }, [])

  const loadSchools = async currentUser => {
    setLoading(true)
    setError('')
    try {
      const token = await currentUser.getIdToken()
      const data = await databaseRequest('schools', token)
      setSchools(data || {})
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setChecking(false)
      setDenied('Firebase environment is not configured.')
      return
    }
    return onAuthStateChanged(auth, async currentUser => {
      setUser(currentUser)
      setDenied('')
      if (!currentUser) {
        setChecking(false)
        if (window.location.pathname !== '/super-admin/login') navigate('/super-admin/login', true)
        return
      }
      if (currentUser.email?.toLowerCase() !== ownerEmail) {
        setDenied('This account is not authorized for the owner console.')
        setChecking(false)
        return
      }
      try {
        const token = await currentUser.getIdToken()
        const profile = await databaseRequest(`superAdmin/${currentUser.uid}`, token)
        if (!profile) await databaseRequest(`superAdmin/${currentUser.uid}`, token, { method: 'PUT', body: { uid: currentUser.uid, name: currentUser.displayName || 'NXT Owner', email: currentUser.email, phone: '', role: 'super-admin', createdAt: Date.now(), lastLoginAt: Date.now() } })
        else await databaseRequest(`superAdmin/${currentUser.uid}/lastLoginAt`, token, { method: 'PUT', body: Date.now() })
        await loadSchools(currentUser)
        if (window.location.pathname === '/super-admin/login') navigate('/super-admin/dashboard', true)
      } catch (accessError) {
        setDenied(`Super admin access is not active: ${accessError.message}`)
      } finally {
        setChecking(false)
      }
    })
  }, [])

  useEffect(() => {
    if (!user || denied) return
    const timer = setInterval(() => loadSchools(user), 30000)
    return () => clearInterval(timer)
  }, [user, denied])

  const rows = useMemo(() => Object.entries(schools).map(([id, value]) => ({ id, ...value, subscription: subscriptionFor(value) })), [schools])
  const payments = useMemo(() => rows.flatMap(row => Object.entries(row.payments || {}).map(([id, value]) => ({ id, schoolId: row.id, schoolName: schoolName(row), plan: value.plan || row.subscription.plan, nextDueDate: value.nextDueDate || row.subscription.nextDueDate, ...value }))).sort((a, b) => Number(b.date || 0) - Number(a.date || 0)), [rows])
  const syncSelected = nextSchools => {
    if (!selected) return
    const value = nextSchools[selected.id]
    setSelected(value ? { id: selected.id, ...value, subscription: subscriptionFor(value) } : null)
  }
  const patchRoot = async changes => {
    const token = await user.getIdToken()
    await databaseRequest('', token, { method: 'PATCH', body: changes })
    const data = await databaseRequest('schools', token)
    setSchools(data || {})
    syncSelected(data || {})
  }
  const toggleSchool = async row => {
    const nextStatus = row.subscription.status === 'suspended' ? 'active' : 'suspended'
    if (!window.confirm(`${nextStatus === 'suspended' ? 'Suspend' : 'Activate'} ${schoolName(row)}?`)) return
    await patchRoot({ [`schools/${row.id}/subscription/status`]: nextStatus, [`schools/${row.id}/subscription/updatedAt`]: Date.now() })
  }
  const saveSchool = async (row, form) => {
    await patchRoot({
      [`schools/${row.id}/name`]: form.schoolName.trim(),
      [`schools/${row.id}/profile/schoolName`]: form.schoolName.trim(),
      [`schools/${row.id}/profile/principalName`]: form.principalName.trim(),
      [`schools/${row.id}/profile/email`]: form.email.trim(),
      [`schools/${row.id}/profile/phone`]: form.phone.trim(),
      [`schools/${row.id}/profile/city`]: form.city.trim(),
      [`schools/${row.id}/profile/address`]: form.address.trim(),
      [`schools/${row.id}/profile/updatedAt`]: Date.now(),
      [`schools/${row.id}/subscription/plan`]: form.plan,
      [`schools/${row.id}/subscription/status`]: form.status,
      [`schools/${row.id}/subscription/amount`]: Number(form.amount || 0),
      [`schools/${row.id}/subscription/nextDueDate`]: new Date(form.nextDueDate).getTime(),
      [`schools/${row.id}/subscription/updatedAt`]: Date.now(),
    })
    setEditing(null)
  }
  const savePricing = async (row, data, reason) => {
    const now = Date.now()
    const historyKey = `H${now}`
    const changes = {
      [`schools/${row.id}/subscription/pricingType`]: data.pricingType,
      [`schools/${row.id}/subscription/isFree`]: data.isFree,
      [`schools/${row.id}/subscription/freeUntil`]: data.freeUntil,
      [`schools/${row.id}/subscription/freeReason`]: data.freeReason || '',
      [`schools/${row.id}/subscription/fixedAmount`]: data.fixedAmount || 0,
      [`schools/${row.id}/subscription/customRate`]: data.customRate || 0,
      [`schools/${row.id}/subscription/status`]: data.isFree ? 'free' : (row.subscription.status === 'free' ? 'active' : row.subscription.status),
      [`schools/${row.id}/subscription/updatedAt`]: now,
      [`schools/${row.id}/subscription/pricingHistory/${historyKey}`]: {
        type: data.pricingType, changedAt: now, changedBy: 'super-admin',
        reason: reason || data.freeReason || '', previousAmount: row.subscription.amount, previousType: row.subscription.pricingType,
      },
    }
    await patchRoot(changes)
  }
  const bulkFree = async chosen => {
    const reason = window.prompt(`Grant permanent FREE access to ${chosen.length} school(s)?\nAdd a reason (logged in history):`, 'Reference / Demo school')
    if (reason === null) return
    const now = Date.now()
    const changes = {}
    chosen.forEach(row => {
      const historyKey = `H${now}_${row.id.slice(0, 4)}`
      changes[`schools/${row.id}/subscription/pricingType`] = 'free'
      changes[`schools/${row.id}/subscription/isFree`] = true
      changes[`schools/${row.id}/subscription/freeUntil`] = null
      changes[`schools/${row.id}/subscription/freeReason`] = reason
      changes[`schools/${row.id}/subscription/status`] = 'free'
      changes[`schools/${row.id}/subscription/updatedAt`] = now
      changes[`schools/${row.id}/subscription/pricingHistory/${historyKey}`] = { type: 'free', changedAt: now, changedBy: 'super-admin', reason, previousAmount: row.subscription.amount, previousType: row.subscription.pricingType }
    })
    await patchRoot(changes)
  }
  const markPaid = async row => {
    const mode = window.prompt('Payment mode: Cash, UPI or Bank', 'UPI')
    if (!mode) return
    const amount = Number(window.prompt('Amount received', String(row.subscription.amount)) || 0)
    if (!amount) return
    const now = Date.now()
    const nextDueDate = addMonths(now, row.subscription.plan === 'yearly' ? 12 : 1)
    const id = `PAY${now}`
    const receiptNo = `RCP${String(payments.length + 1).padStart(4, '0')}`
    await patchRoot({
      [`schools/${row.id}/subscription/status`]: 'active',
      [`schools/${row.id}/subscription/lastPaidDate`]: now,
      [`schools/${row.id}/subscription/nextDueDate`]: nextDueDate,
      [`schools/${row.id}/subscription/amount`]: amount,
      [`schools/${row.id}/payments/${id}`]: { amount, date: now, mode, receiptNo, plan: row.subscription.plan, nextDueDate, recordedBy: user.uid },
    })
  }
  const exportExcel = async () => {
    setExporting(true)
    try {
      const ExcelJS = (await import('exceljs')).default
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'NXT School ERP Super Admin'
      const schoolsSheet = workbook.addWorksheet('Schools')
      schoolsSheet.columns = [{ header: 'School Name', key: 'name', width: 28 }, { header: 'Principal', key: 'principal', width: 22 }, { header: 'Phone', key: 'phone', width: 16 }, { header: 'Email', key: 'email', width: 28 }, { header: 'City', key: 'city', width: 18 }, { header: 'Registered', key: 'registered', width: 16 }, { header: 'Plan', key: 'plan', width: 12 }, { header: 'Status', key: 'status', width: 12 }, { header: 'Next Due', key: 'due', width: 16 }, { header: 'Students', key: 'students', width: 12 }, { header: 'Teachers', key: 'teachers', width: 12 }]
      rows.forEach(row => schoolsSheet.addRow({ name: schoolName(row), principal: row.profile?.principalName, phone: row.profile?.phone, email: row.profile?.email, city: row.profile?.city, registered: dateText(row.createdAt || row.profile?.createdAt), plan: row.subscription.plan, status: row.subscription.status, due: dateText(row.subscription.nextDueDate), students: Object.keys(row.students || {}).length, teachers: Object.keys(row.staff || row.teachers || {}).length }))
      const paymentSheet = workbook.addWorksheet('Payments')
      paymentSheet.columns = [{ header: 'School', key: 'school', width: 28 }, { header: 'Amount', key: 'amount', width: 14 }, { header: 'Date', key: 'date', width: 16 }, { header: 'Mode', key: 'mode', width: 12 }, { header: 'Receipt', key: 'receipt', width: 18 }, { header: 'Plan', key: 'plan', width: 12 }]
      payments.forEach(row => paymentSheet.addRow({ school: row.schoolName, amount: row.amount, date: dateText(row.date), mode: row.mode, receipt: row.receiptNo, plan: row.plan }))
      ;[schoolsSheet, paymentSheet].forEach(sheet => { sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF052659' } }; sheet.views = [{ state: 'frozen', ySplit: 1 }] })
      const buffer = await workbook.xlsx.writeBuffer()
      const link = document.createElement('a')
      link.href = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      link.download = `nxt-super-admin-report-${new Date().toISOString().slice(0, 10)}.xlsx`
      link.click()
      setTimeout(() => URL.revokeObjectURL(link.href), 1000)
    } finally {
      setExporting(false)
    }
  }

  if (route === '/super-admin/login' || !user || denied) return <SuperAdminLogin user={user} checking={checking} denied={denied} />
  if (checking || loading) return <main className="sa-loading"><span /><p>Loading owner console...</p></main>

  const nav = [
    ['dashboard', 'Dashboard', LayoutDashboard], ['schools', 'All Schools', Building2],
    ['payments', 'Payments', WalletCards], ['due', 'Due Payments', TriangleAlert],
    ['analytics', 'Analytics', BarChart3], ['notifications', 'Notifications', Bell],
    ['settings', 'Settings', Settings],
  ]
  const pageTitle = nav.find(item => item[0] === page)?.[1] || 'Dashboard'
  const openSchool = row => setSelected(row)
  const content = {
    dashboard: <DashboardHome rows={rows} payments={payments} setPage={setPage} openSchool={openSchool} />,
    schools: <SchoolsPage rows={rows} openSchool={openSchool} editSchool={setEditing} toggleSchool={toggleSchool} exporting={exporting} exportExcel={exportExcel} bulkFree={bulkFree} />,
    payments: <PaymentsPage rows={rows} payments={payments} markPaid={markPaid} />,
    due: <PaymentsPage rows={rows} payments={payments} initialTab="due" markPaid={markPaid} />,
    analytics: <AnalyticsPage rows={rows} payments={payments} />,
    notifications: <NotificationsPage rows={rows} payments={payments} />,
    settings: <section className="sa-panel sa-settings"><header><div><h3>Owner Settings</h3><p>Super admin identity and payment instructions</p></div></header><div><label>Owner Email<input value={ownerEmail} readOnly /></label><label>Monthly Plan<input value="₹999" readOnly /></label><label>Yearly Plan<input value="₹9,999" readOnly /></label><label>UPI ID<input defaultValue="yourname@upi" /></label></div></section>,
  }
  return <div className="sa-shell">
    <aside className={`sa-sidebar ${menuOpen ? 'open' : ''}`}>
      <div className="sa-brand"><img src="/nxt-logo-transparent.png" alt="" /><div><strong>NXT</strong><span>SUPER ADMIN</span></div><button onClick={() => setMenuOpen(false)}><X size={18} /></button></div>
      <div className="sa-owner"><span>{(user.displayName || 'NXT Owner').slice(0, 2).toUpperCase()}</span><div><strong>{user.displayName || 'NXT Owner'}</strong><small>{user.email}</small></div></div>
      <nav>{nav.map(([id, label, Icon]) => <button key={id} className={page === id ? 'active' : ''} onClick={() => { setPage(id); setMenuOpen(false) }}><Icon size={17} />{label}{id === 'due' && calculateStats(rows, payments).due > 0 && <b>{calculateStats(rows, payments).due}</b>}</button>)}</nav>
      <button className="sa-signout" onClick={async () => { await signOut(auth); navigate('/super-admin/login', true) }}><LogOut size={17} />Sign out</button>
    </aside>
    {menuOpen && <button className="sa-overlay" onClick={() => setMenuOpen(false)} />}
    <main className="sa-main">
      <header className="sa-topbar"><button className="sa-menu" onClick={() => setMenuOpen(true)}><Menu size={19} /></button><div><span>Owner Console</span><h1>{pageTitle}</h1></div><div className="sa-top-actions"><button title="Refresh data" onClick={() => loadSchools(user)}><RefreshCw size={17} /></button><button onClick={() => setPage('notifications')}><Bell size={17} /></button><span>SA</span></div></header>
      <div className="sa-content">{error && <div className="sa-error"><TriangleAlert size={16} />{error}</div>}{content[page]}</div>
    </main>
    {selected && <SchoolDetails row={selected} close={() => setSelected(null)} edit={setEditing} toggle={toggleSchool} markPaid={markPaid} savePricing={savePricing} />}
    {editing && <EditSchoolModal row={editing} close={() => setEditing(null)} save={saveSchool} />}
  </div>
}

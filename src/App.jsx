import React, { useEffect, useRef, useState } from 'react'
import imageCompression from 'browser-image-compression'
import {
  Bell, BookOpen, BusFront, CalendarCheck, Check, ChevronRight, IndianRupee,
  GraduationCap, LayoutDashboard, LogOut, Menu, MessageSquareText,
  MoreHorizontal, Plus, Search, Settings, ShieldCheck, Sparkles, Users, X,
  Eye, Receipt, Save, ClipboardList, Download, Upload, Link2, Cake,
  UserCheck, Clock3, TrendingUp, WalletCards, Printer, FileText, Pencil, Trash2,
  DatabaseBackup, BriefcaseBusiness, Moon, Sun, Camera, Badge, Umbrella, UserRound
} from 'lucide-react'
import './app.css'
import AuthScreen from './AuthScreen'
import SchoolSetup from './SchoolSetup'
import FeeManager from './FeeManager'
import BackupCenter from './BackupCenter'
import TimetableManager from './TimetableManager'
import EmployeeManager from './EmployeeManager'
import CertificateManager from './CertificateManager'
import ReportCardManager from './ReportCardManager'
import IDCardManager from './IDCardManager'
import HomeworkManager from './HomeworkManager'
import TransportManager from './TransportManager'
import ExpenseManager from './ExpenseManager'
import LibraryManager from './LibraryManager'
import AccountsManager from './AccountsManager'
import LeaveManager from './LeaveManager'
import SplashScreen from './SplashScreen'
import DatePicker from './DatePicker'
import ParentPortal from './ParentPortal'
import {
  academicYears,
  ageOnDate,
  boardOptions,
  classOptions,
  feeGroups,
  formatAadhaar,
  generateSchoolCode,
  indianStates,
  onlyDigits,
  recognitionOptions as schoolRecognitionOptions,
  sectionOptions,
} from './schoolOptions'

const admissionClasses = classOptions.flatMap(cls => sectionOptions.slice(0, cls.match(/^(11|12)$/) ? 1 : 5).map(section => `${cls}-${section}`))

import { onAuthStateChanged, signOut } from 'firebase/auth'
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import { auth, isFirebaseConfigured, storage } from './lib/firebase'

const databaseUrl = import.meta.env.VITE_FIREBASE_DATABASE_URL?.replace(/\/$/, '')
const useFirebaseStorage = import.meta.env.VITE_USE_FIREBASE_STORAGE === 'true'

async function databaseRequest(path, token, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  const url = `${databaseUrl}/${path ? `${path}.json` : '.json'}?auth=${encodeURIComponent(token)}`

  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) throw new Error(payload?.error || `Database request failed (${response.status})`)
    return payload
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Database connection timed out. Please retry.')
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

function cleanDatabaseValue(value) {
  if (value === undefined) return null
  if (value === null) return null
  if (value instanceof File || value instanceof Blob) return null
  if (Array.isArray(value)) return value.map(cleanDatabaseValue)
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined && !(entry instanceof File) && !(entry instanceof Blob))
        .map(([key, entry]) => [key, cleanDatabaseValue(entry)])
    )
  }
  return value
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Could not read the selected image.'))
    reader.readAsDataURL(file)
  })
}

async function optimizeLogo(file) {
  const source = await fileToDataUrl(file)
  const image = await new Promise((resolve, reject) => {
    const preview = new Image()
    preview.onload = () => resolve(preview)
    preview.onerror = () => reject(new Error('Could not process this logo image.'))
    preview.src = source
  })
  const maxSize = 512
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, 0, 0, width, height)
  return canvas.toDataURL('image/webp', 0.86)
}

const formatBytes = bytes => {
  if (!bytes) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function compressPhoto(file) {
  const options = {
    maxSizeMB: 0.1,
    maxWidthOrHeight: 260,
    useWebWorker: true,
    fileType: 'image/jpeg',
    initialQuality: 0.68,
  }
  return imageCompression(file, options)
}

async function compressEmployeePhoto(file) {
  const options = {
    maxSizeMB: 0.15,
    maxWidthOrHeight: 360,
    useWebWorker: true,
    fileType: 'image/jpeg',
    initialQuality: 0.72,
  }
  return imageCompression(file, options)
}

async function prepareStudentPhoto(file) {
  if (!file) return null
  if (!/^image\/(jpe?g|png)$/i.test(file.type)) throw new Error('Please choose a JPG, JPEG or PNG photo.')
  const compressed = await compressPhoto(file)
  return {
    file: compressed,
    preview: await fileToDataUrl(compressed),
    originalSize: file.size,
    compressedSize: compressed.size,
    name: file.name,
  }
}

function StudentAvatar({ student, size = 'default', loading = false }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [student?.photoUrl, student?.photo, student?.id])
  if (loading) return <span className={`student-photo-avatar ${size} skeleton`} />
  const photo = student?.photoUrl || student?.photo || student?.photoURL || student?.imageUrl
  if (photo && !failed) return <img className={`student-photo-avatar ${size}`} src={photo} alt={`${student.name} photo`} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
  return <span className={`student-photo-avatar ${size} initials tone-${student?.tone || 'blue'}`}>{student?.initials || '?'}</span>
}

function PhotoUploader({ photo, onPhoto, onRemove, compact = false, disabled = false }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputId = useRef(`student-photo-${Math.random().toString(36).slice(2)}`).current
  const selectPhoto = async event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    setError('')
    try {
      onPhoto(await prepareStudentPhoto(file))
    } catch (photoError) {
      setError(photoError.message)
    } finally {
      setBusy(false)
    }
  }
  return <div className={`student-photo-upload ${compact ? 'compact' : ''}`}>
    <label className={`student-photo-picker ${photo?.preview ? 'has-photo' : ''} ${busy ? 'is-busy' : ''}`} htmlFor={inputId}>
      {photo?.preview ? <img src={photo.preview} alt="Student photo preview" /> : <span><strong>{busy ? 'Compressing...' : 'Click to Upload Photo'}</strong><Camera size={compact ? 18 : 24} /><em>3.5 x 4.5</em></span>}
      <input id={inputId} disabled={disabled || busy} type="file" accept="image/jpeg,image/jpg,image/png" onChange={selectPhoto} />
    </label>
    {photo?.preview && <button type="button" className="student-photo-remove" onClick={onRemove} aria-label="Remove photo"><X size={14} /></button>}
    {!compact && photo?.compressedSize && <small className="compression-info">Original: {formatBytes(photo.originalSize)} &rarr; Compressed: {formatBytes(photo.compressedSize)} <b>OK</b></small>}
    {error && <small className="photo-error">{error}</small>}
  </div>
}

async function createSchoolRecord(user, token, profile) {
  const createdAt = Date.now()
  const schoolId = user.uid
  let schoolCode = profile.schoolCode || ''
  for (let attempt = 0; attempt < 8 && !schoolCode; attempt += 1) {
    const candidate = generateSchoolCode(profile.schoolName)
    const existing = await databaseRequest(`schoolCodes/${candidate}`, token).catch(() => null)
    if (!existing || existing.schoolId === schoolId) schoolCode = candidate
  }
  if (!schoolCode) schoolCode = `${generateSchoolCode(profile.schoolName)}${String(schoolId).slice(0, 3).toUpperCase()}`
  const schoolProfile = {
    schoolName: profile.schoolName.trim(),
    schoolCode,
    email: profile.email || user.email || '',
    phone: profile.phone?.trim() || '',
    address: profile.address?.trim() || '',
    city: profile.city?.trim() || '',
    state: profile.state || '',
    pincode: profile.pincode?.trim() || '',
    affiliatedTo: profile.affiliatedTo || profile.recognition || '',
    customAffiliation: profile.customAffiliation || '',
    affiliationNo: profile.affiliationNo || '',
    udiseNo: profile.udiseNo || '',
    board: profile.board || 'CBSE',
    classesOffered: profile.classesOffered || classOptions,
    logo: profile.logo?.trim() || '',
    logoURL: profile.logoURL || profile.logo?.trim() || '',
    principalName: profile.principalName || '',
    principalSignatureURL: profile.principalSignatureURL || '',
    schoolSealURL: profile.schoolSealURL || '',
    schoolMotto: profile.schoolMotto || '',
    schoolWebsite: profile.schoolWebsite || '',
    schoolContactNo: profile.schoolContactNo || profile.phone?.trim() || '',
    schoolEmail: profile.schoolEmail || profile.email || user.email || '',
    academicYear: profile.academicYear || '2026-27',
    createdAt,
    updatedAt: createdAt,
  }
  await databaseRequest('', token, { method: 'PATCH', body: {
    [`schoolCodes/${schoolCode}`]: { schoolId, schoolName: schoolProfile.schoolName, createdAt },
    [`schools/${schoolId}`]: {
    name: schoolProfile.schoolName,
    academicYear: schoolProfile.academicYear,
    profile: schoolProfile,
    subscription: {
      plan: 'trial',
      status: 'trial',
      amount: 999,
      startDate: createdAt,
      nextDueDate: createdAt + (30 * 24 * 60 * 60 * 1000),
      lastPaidDate: null,
    },
    createdBy: user.uid,
    createdAt,
    lastLoginAt: createdAt,
    admissionCounter: { lastIssued: 0, updatedAt: createdAt },
    students: {},
    teachers: {},
    fees: {},
    attendance: {},
    notices: {},
    }
  } })
  await databaseRequest(`schoolMembers/${schoolId}/${user.uid}`, token, { method: 'PUT', body: {
    userId: user.uid,
    role: 'owner',
    status: 'active',
    createdAt,
  } }).catch(() => {})
  await databaseRequest(`users/${user.uid}`, token, { method: 'PUT', body: {
    uid: user.uid,
    schoolId,
    fullName: user.displayName || user.email?.split('@')[0] || 'Administrator',
    email: user.email || '',
    photoURL: user.photoURL || '',
    role: 'owner',
    createdAt,
    lastLoginAt: createdAt,
  } })
}

async function reserveAdmissionNumber(schoolId, token) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const counterUrl = `${databaseUrl}/schools/${schoolId}/admissionCounter.json?auth=${encodeURIComponent(token)}`
    const counterResponse = await fetch(counterUrl, { headers: { 'X-Firebase-ETag': 'true' } })
    if (!counterResponse.ok) throw new Error('Could not generate admission number.')
    const etag = counterResponse.headers.get('ETag')
    const counter = await counterResponse.json()
    let highest = Number(counter?.lastIssued || 0)
    if (!highest) {
      const existing = await databaseRequest(`schools/${schoolId}/students`, token)
      highest = Math.max(0, ...Object.values(existing || {}).map(row => admissionValue(row.admission_number)))
    }
    const next = highest + 1
    const update = await fetch(counterUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'If-Match': etag },
      body: JSON.stringify({ lastIssued: next, updatedAt: Date.now() }),
    })
    if (update.ok) return next
    if (update.status !== 412) throw new Error('Could not reserve admission number.')
  }
  throw new Error('Admission number is busy. Please retry.')
}

async function reserveCertificateNumber(schoolId, token, type) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const counterUrl = `${databaseUrl}/schools/${schoolId}/certificateCounters/${type}.json?auth=${encodeURIComponent(token)}`
    const response = await fetch(counterUrl, { headers: { 'X-Firebase-ETag': 'true' } })
    if (!response.ok) throw new Error('Could not generate certificate number.')
    const etag = response.headers.get('ETag')
    const counter = await response.json()
    const next = Number(counter?.lastIssued || 0) + 1
    const update = await fetch(counterUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'If-Match': etag },
      body: JSON.stringify({ lastIssued: next, updatedAt: Date.now() }),
    })
    if (update.ok) return next
    if (update.status !== 412) throw new Error('Could not reserve certificate number.')
  }
  throw new Error('Certificate number is busy. Please retry.')
}

const seedStudents = [
  { id: 1, name: 'Aarav Sharma', roll: '2026-041', className: '10-A', guardian: 'Ramesh Sharma', phone: '98765 43210', attendance: 94, fee: 'Paid', initials: 'AS', tone: 'blue' },
  { id: 2, name: 'Meera Kapoor', roll: '2026-042', className: '8-B', guardian: 'Anil Kapoor', phone: '98112 48810', attendance: 88, fee: 'Pending', initials: 'MK', tone: 'violet' },
  { id: 3, name: 'Kabir Verma', roll: '2026-043', className: '6-A', guardian: 'Nitin Verma', phone: '99102 34118', attendance: 96, fee: 'Paid', initials: 'KV', tone: 'green' },
  { id: 4, name: 'Ananya Singh', roll: '2026-044', className: '9-C', guardian: 'Priya Singh', phone: '98991 22018', attendance: 81, fee: 'Overdue', initials: 'AS', tone: 'orange' },
  { id: 5, name: 'Vihaan Gupta', roll: '2026-045', className: '5-A', guardian: 'Sanjay Gupta', phone: '98201 99881', attendance: 91, fee: 'Paid', initials: 'VG', tone: 'cyan' },
  { id: 6, name: 'Ira Malhotra', roll: '2026-046', className: '7-B', guardian: 'Rohit Malhotra', phone: '99901 22341', attendance: 86, fee: 'Pending', initials: 'IM', tone: 'pink' },
]

const seedNotices = [
  { id: 1, title: 'Parent Teacher Meeting', detail: 'Classes 6-10, Saturday at 10:00 AM', date: '15 Jun', type: 'Event', priority: 'High' },
  { id: 2, title: 'Summer assignment submission', detail: 'All class teachers to verify submissions', date: '18 Jun', type: 'Academic', priority: 'Normal' },
  { id: 3, title: 'Inter-house football trials', detail: 'Senior wing sports ground after school', date: '20 Jun', type: 'Sports', priority: 'Normal' },
]

const timetable = [
  ['08:00', 'Mathematics', 'Science', 'English', 'Mathematics', 'Computer'],
  ['09:00', 'English', 'Mathematics', 'Social Sci.', 'Science', 'Hindi'],
  ['10:00', 'Science', 'Computer', 'Mathematics', 'English', 'Social Sci.'],
  ['11:15', 'Hindi', 'Social Sci.', 'Computer', 'Hindi', 'Mathematics'],
  ['12:15', 'Social Sci.', 'English', 'Science', 'Computer', 'Science'],
]
const defaultTimetable = {
  '10-A': timetable.flatMap(row => row.slice(1).map((subject, index) => ({
    id: `${row[0]}_${index}`,
    time: row[0],
    day: ['Monday','Tuesday','Wednesday','Thursday','Friday'][index],
    subject,
    teacher: ['NK','RS','AM','PK','SJ'][index],
    room: `R${204 + index}`,
  }))),
  '9-C': timetable.flatMap(row => row.slice(1).map((subject, index) => ({
    id: `${row[0]}_${index}`,
    time: row[0],
    day: ['Monday','Tuesday','Wednesday','Thursday','Friday'][index],
    subject: row.slice(1)[(index + 2) % 5],
    teacher: ['AM','PK','SJ','NK','RS'][index],
    room: `R${310 + index}`,
  }))),
}

const dateKey = date => {
  const local = new Date(date)
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset())
  return local.toISOString().slice(0, 10)
}
const today = () => dateKey(new Date())
const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0))
const readableDate = value => new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
const roleLabel = value => {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return 'Staff'
  if (raw === 'owner') return 'Owner'
  if (raw === 'admin' || raw === 'administrator') return 'Administrator'
  if (raw === 'teacher' || raw === 'faculty') return 'Teacher'
  return raw.split(/[\s_-]+/).map(part => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ')
}
const normalizeAttendanceStatus = value => {
  const raw = String(value || '').trim().toLowerCase()
  if (raw === 'a' || raw === 'absent') return 'A'
  if (raw === 'l' || raw === 'leave') return 'L'
  return 'P'
}
const attendanceStatusLabel = value => normalizeAttendanceStatus(value) === 'A' ? 'absent' : normalizeAttendanceStatus(value) === 'L' ? 'leave' : 'present'
const splitClassSection = value => {
  const [className = '', section = ''] = String(value || '').split('-')
  return { className: className.trim(), section: section.trim() }
}
const timeAgo = timestamp => {
  const minutes = Math.max(1, Math.round((Date.now() - timestamp) / 60000))
  if (minutes < 60) return `${minutes} min`
  if (minutes < 1440) return `${Math.round(minutes / 60)} hr`
  return `${Math.round(minutes / 1440)} d`
}
const admissionValue = value => Number(String(value || '').match(/(\d+)$/)?.[1] || 0)

const nav = [
  { id: 'dashboard', label: 'Command Center', icon: LayoutDashboard },
  { id: 'admissions', label: 'Admissions', icon: ClipboardList },
  { id: 'students', label: 'Students', icon: Users },
  { id: 'employees', label: 'Employees', icon: BriefcaseBusiness },
  { id: 'leave', label: 'Leave', icon: Umbrella },
  { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
  { id: 'fees', label: 'Fee Management', icon: IndianRupee },
  { id: 'academics', label: 'Timetable', icon: BookOpen },
  { id: 'homework', label: 'Homework', icon: ClipboardList },
  { id: 'transport', label: 'Transport', icon: BusFront },
  { id: 'expenses', label: 'Expenses', icon: IndianRupee },
  { id: 'library', label: 'Library', icon: BookOpen },
  { id: 'accounts', label: 'Accounts', icon: WalletCards },
  { id: 'parents', label: 'Parent Accounts', icon: UserRound },
  { id: 'reports', label: 'Report Cards', icon: GraduationCap },
  { id: 'certificates', label: 'Certificates', icon: FileText },
  { id: 'id-cards', label: 'ID Cards', icon: Badge },
  { id: 'notices', label: 'Notices', icon: MessageSquareText },
  { id: 'school-profile', label: 'School Profile', icon: Settings },
  { id: 'backup', label: 'Data Backup', icon: DatabaseBackup },
]

function useStoredState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key)
      return saved ? JSON.parse(saved) : initialValue
    } catch {
      return initialValue
    }
  })
  useEffect(() => localStorage.setItem(key, JSON.stringify(value)), [key, value])
  return [value, setValue]
}

function StudentSearch({ students, onSelect, prominent = false }) {
  const [query, setQuery] = useState('')
  const results = query.trim() ? students.filter(student => `${student.roll} ${student.name} ${student.phone}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6) : []
  return <div className={`student-quick-search ${prominent ? 'prominent' : ''}`}>
    <Search size={prominent ? 18 : 16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search admission no., student name or phone" />
    {results.length > 0 && <div className="search-results">{results.map(student => <button key={student.id} onClick={() => { onSelect(student); setQuery('') }}><StudentAvatar student={student} size="search" /><div><strong>{student.name}</strong><small>Adm No: {student.roll}</small><small>Class: {student.className} - Father: {student.fatherName || student.guardian || '-'}</small><small>Phone: {student.phone}</small></div></button>)}</div>}
    {query.trim() && !results.length && <div className="search-results empty-search">No matching student found.</div>}
  </div>
}

function UserAvatar({ profile, className = '' }) {
  return profile.photo
    ? <img className={`avatar user-photo ${className}`} src={profile.photo} alt="" referrerPolicy="no-referrer" />
    : <span className={`avatar tone-blue ${className}`}>{profile.initials}</span>
}

function Header({ title, subtitle, schoolCode, onMenu, profile, onSignOut, students, onSelectStudent, darkMode, onToggleTheme }) {
  return (
    <header className="topbar">
      <button className="icon-button mobile-menu" onClick={onMenu} aria-label="Open menu"><Menu size={20} /></button>
      <div className="page-heading">
        <h1>{title}</h1>
        <p>{subtitle}{schoolCode ? ` · Code ${schoolCode}` : ''}</p>
      </div>
      <div className="topbar-actions">
        <StudentSearch students={students} onSelect={onSelectStudent} />
        <button className="icon-button theme-toggle" onClick={onToggleTheme} aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'} title={darkMode ? 'Light mode' : 'Dark mode'}>{darkMode ? <Sun size={18} /> : <Moon size={18} />}</button>
        <div className="profile">
          <UserAvatar profile={profile} />
          <div><strong>{profile.name}</strong><small>{profile.email}</small></div>
        </div>
        <button className="icon-button" onClick={onSignOut} aria-label="Sign out" title="Sign out"><LogOut size={18} /></button>
      </div>
    </header>
  )
}

function Sidebar({ page, setPage, open, close, schoolName, schoolLogo, schoolCode, cloudMode, profile }) {
  return (
    <>
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <img className="app-brand-logo" src="/nxt-logo-transparent.png" alt="NXT School ERP" />
          <div><strong>NXT</strong><span>School ERP</span></div>
          <button className="icon-button sidebar-close" onClick={close}><X size={18} /></button>
        </div>
        <div className="school-switcher">
          {schoolLogo ? <img className="school-logo image" src={schoolLogo} alt="" /> : <span className="school-logo">{schoolName.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()}</span>}
          <div><strong>{schoolName}</strong><small>{schoolCode ? `School Code ${schoolCode}` : 'Academic year 2026-27'}</small></div>
          <MoreHorizontal size={17} />
        </div>
        <nav>
          <span className="nav-label">Workspace</span>
          {nav.map(({ id, label, icon: Icon }) => (
            <button key={id} className={page === id ? 'active' : ''} onClick={() => { setPage(id); close() }}>
              <Icon size={18} /><span>{label}</span>{page === id && <ChevronRight size={15} />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-user">
            <UserAvatar profile={profile} />
            <div><strong>{profile.name}</strong><small>{profile.email}</small></div>
          </div>
          <button onClick={() => { setPage('backup'); close() }}><Settings size={18} /><span>Backup Settings</span></button>
          <div className="trial-card">
            <Sparkles size={18} />
            <strong>{cloudMode ? 'Cloud workspace' : 'Development demo'}</strong>
            <p>{cloudMode ? 'Securely synced with Firebase.' : 'Changes stay on this device.'}</p>
          </div>
        </div>
      </aside>
      {open && <button className="sidebar-overlay" onClick={close} aria-label="Close menu" />}
    </>
  )
}

function SchoolProfile({ profile, students, staff, save }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(profile)
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(profile.logoURL || profile.logo || '')
  const profileLogo = profile.logoURL || profile.logo || ''
  const [processingLogo, setProcessingLogo] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const readProfileImage = async (file, key) => {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('Please choose an image smaller than 5 MB.'); return }
    setProcessingLogo(true)
    try {
      const optimized = await optimizeLogo(file)
      setForm(current => ({ ...current, [key]: optimized }))
      if (key === 'logo') setLogoPreview(optimized)
    } catch (imageError) {
      setError(imageError.message)
    } finally {
      setProcessingLogo(false)
    }
  }
  const submit = async event => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await save(form, logoFile)
      setLogoFile(null)
      setEditing(false)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }
  return <div className="school-profile-page">
    <section className="school-profile-hero">
        {profileLogo ? <img src={profileLogo} alt={`${profile.schoolName} logo`} /> : <div className="school-profile-placeholder"><GraduationCap size={34} /></div>}
      <div><span>School Profile</span><h2>{profile.schoolName}</h2><p>{[profile.address, profile.city, profile.state, profile.pincode].filter(Boolean).join(', ') || 'Address not added'}</p><button className="school-code-chip" type="button" onClick={() => navigator.clipboard?.writeText(profile.schoolCode || '')}>Code: {profile.schoolCode || 'Generating'} <small>Copy</small></button></div>
      <button className="secondary-button" onClick={() => { setForm(profile); setLogoFile(null); setLogoPreview(profile.logoURL || profile.logo || ''); setEditing(true) }}><Pencil size={15} /> Edit Profile</button>
    </section>
    <section className="school-profile-stats">
      <div><span>Total Students</span><strong>{students.length}</strong></div>
      <div><span>Total Teachers</span><strong>{Object.keys(staff || {}).length}</strong></div>
      <div><span>Academic Year</span><strong>{profile.academicYear || '2026-27'}</strong></div>
      <div><span>School Code</span><strong>{profile.schoolCode || '-'}</strong></div>
    </section>
    <section className="panel school-profile-details">
      {[['School Name', profile.schoolName], ['School Code', profile.schoolCode], ['Email', profile.email], ['Phone', profile.phone], ['Address', [profile.address, profile.city, profile.state, profile.pincode].filter(Boolean).join(', ')], ['Affiliated To', profile.affiliatedTo], ['Affiliation No', profile.affiliationNo], ['UDISE No', profile.udiseNo], ['Board', profile.board], ['Principal', profile.principalName], ['Academic Year', profile.academicYear]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value || 'Not provided'}</strong></div>)}
    </section>
    {editing && <div className="modal-backdrop"><form className="modal" onSubmit={submit}>
      <div className="modal-header"><div><h3>Edit school profile</h3><p>Update the identity shown across your workspace.</p></div><button type="button" className="icon-button" onClick={() => setEditing(false)}><X size={18} /></button></div>
      <div className="form-grid">
        <label className="full">School Name<input required value={form.schoolName || ''} onChange={e => setForm({ ...form, schoolName: e.target.value })} /></label>
        <label>School Code<input readOnly className="readonly-input" value={form.schoolCode || 'Auto generated'} /></label>
        <label>Email<input required type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
        <label>Phone<input required value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} /></label>
        <label className="full">Address<input required value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} /></label>
        <label>City<input required value={form.city || ''} onChange={e => setForm({ ...form, city: e.target.value })} /></label>
        <label>State<select required value={form.state || ''} onChange={e => setForm({ ...form, state: e.target.value })}><option value="">Select state</option>{indianStates.map(item => <option key={item}>{item}</option>)}</select></label>
        <label>Pincode<input required value={form.pincode || ''} onChange={e => setForm({ ...form, pincode: onlyDigits(e.target.value, 6) })} /></label>
        <label>Affiliated To<select required value={form.affiliatedTo || ''} onChange={e => setForm({ ...form, affiliatedTo: e.target.value })}><option value="">Select</option>{schoolRecognitionOptions.map(item => <option key={item}>{item}</option>)}</select></label>
        {form.affiliatedTo === 'Write Custom...' && <label>Custom Affiliation<input value={form.customAffiliation || ''} onChange={e => setForm({ ...form, customAffiliation: e.target.value })} /></label>}
        <label>Affiliation Number<input value={form.affiliationNo || ''} onChange={e => setForm({ ...form, affiliationNo: e.target.value })} /></label>
        <label>UDISE Number<input value={form.udiseNo || ''} onChange={e => setForm({ ...form, udiseNo: e.target.value })} /></label>
        <label>Board<select required value={form.board || 'CBSE'} onChange={e => setForm({ ...form, board: e.target.value })}>{boardOptions.map(item => <option key={item}>{item}</option>)}</select></label>
        <label>Academic Year<select required value={form.academicYear || '2026-27'} onChange={e => setForm({ ...form, academicYear: e.target.value })}>{academicYears.map(item => <option key={item}>{item}</option>)}</select></label>
        <label>Principal Name<input value={form.principalName || ''} onChange={e => setForm({ ...form, principalName: e.target.value })} /></label>
        <label>School Motto<input value={form.schoolMotto || ''} onChange={e => setForm({ ...form, schoolMotto: e.target.value })} /></label>
        <label>Website<input value={form.schoolWebsite || ''} onChange={e => setForm({ ...form, schoolWebsite: e.target.value })} /></label>
        <label>Certificate Contact<input value={form.schoolContactNo || ''} onChange={e => setForm({ ...form, schoolContactNo: e.target.value })} /></label>
        <label>Certificate Email<input type="email" value={form.schoolEmail || ''} onChange={e => setForm({ ...form, schoolEmail: e.target.value })} /></label>
        <label className="full">Classes Offered<div className="auth-check-grid">{classOptions.map(item => <span key={item}><input type="checkbox" checked={(form.classesOffered || []).includes(item)} onChange={() => setForm(current => ({ ...current, classesOffered: (current.classesOffered || []).includes(item) ? current.classesOffered.filter(cls => cls !== item) : [...(current.classesOffered || []), item] }))} /> {item}</span>)}</div></label>
        <div className="school-logo-uploader full">
          <div className="school-logo-preview">{logoPreview ? <img src={logoPreview} alt="Selected school logo preview" /> : <GraduationCap size={32} />}</div>
          <div>
            <strong>School Logo Photo</strong>
            <p>PNG, JPG or WebP, maximum 2 MB</p>
            <label className={`secondary-button ${processingLogo ? 'disabled' : ''}`}><Upload size={15} /> {processingLogo ? 'Optimizing...' : logoPreview ? 'Change Logo Photo' : 'Choose Logo Photo'}<input disabled={processingLogo} type="file" accept="image/png,image/jpeg,image/webp" onChange={async event => {
              const file = event.target.files?.[0] || null
              if (!file) return
              if (file.size > 5 * 1024 * 1024) { setError('Please choose an image smaller than 5 MB.'); return }
              setError('')
              setProcessingLogo(true)
              await readProfileImage(file, 'logo')
            }} /></label>
            {logoPreview && <button type="button" className="text-button muted" onClick={() => { setLogoFile(null); setLogoPreview(''); setForm(current => ({ ...current, logo: '', logoPath: '' })) }}>Remove logo</button>}
          </div>
        </div>
        <label>Principal Signature Upload<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => readProfileImage(e.target.files?.[0], 'principalSignatureURL')} /></label>
        <label>School Seal Upload<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => readProfileImage(e.target.files?.[0], 'schoolSealURL')} /></label>
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setEditing(false)}>Cancel</button><button className="primary-button" disabled={saving || processingLogo}><Save size={15} /> {processingLogo ? 'Preparing Logo...' : saving ? 'Saving...' : 'Save Changes'}</button></div>
    </form></div>}
  </div>
}

function ParentAccounts({ parents = {}, students = [], school = {}, onSaveParent }) {
  const [query, setQuery] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const studentMap = Object.fromEntries(students.map(student => [student.id, student]))
  const rows = Object.values(parents || {}).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  const classList = [...new Set(students.map(student => splitClassSection(student.className).className).filter(Boolean))]
  const filtered = rows.filter(parent => {
    const linked = Object.keys(parent.students || {}).map(id => studentMap[id]).filter(Boolean)
    const text = `${parent.name} ${parent.phone} ${linked.map(student => `${student.name} ${student.className}`).join(' ')}`.toLowerCase()
    return (!query || text.includes(query.toLowerCase())) && (!classFilter || linked.some(student => splitClassSection(student.className).className === classFilter))
  })
  const reset = async parent => {
    if (!window.confirm(`Reset password for ${parent.name || parent.phone} to child's DOB?`)) return
    await onSaveParent(parent.id || parent.phone, { passwordHash: null, mustChangePassword: true, updatedAt: Date.now() })
    alert('Password reset to child DOB.')
  }
  const toggle = async parent => {
    await onSaveParent(parent.id || parent.phone, { status: parent.status === 'inactive' ? 'active' : 'inactive', updatedAt: Date.now() })
  }
  const whatsapp = parent => {
    const linked = Object.keys(parent.students || {}).map(id => studentMap[id]).filter(Boolean)
    const student = linked[0]
    const text = encodeURIComponent(`Parent Portal Login\n${school.schoolName || 'School'}\nStudent: ${student?.name || '-'}\nClass: ${student?.className || '-'}\nSchool Code: ${school.schoolCode || '-'}\nPhone: ${parent.phone}\nPassword: Child DOB\nLink: ${window.location.origin}/parent/login\nPlease change password after first login.`)
    window.open(`https://wa.me/91${parent.phone}?text=${text}`, '_blank')
  }
  const printCards = parentsToPrint => {
    const cards = parentsToPrint.flatMap(parent => Object.keys(parent.students || {}).map(id => studentMap[id]).filter(Boolean).map(student => ({ parent, student })))
    const logo = school.logoURL || school.logo || ''
    const html = `<!doctype html><html><head><title>Parent Login Cards</title><style>@page{size:A4;margin:10mm}body{font-family:Arial,sans-serif}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10mm}.card{border:1px solid #111;border-radius:10px;padding:12px;min-height:120mm;box-sizing:border-box;break-inside:avoid}.head{display:flex;gap:10px;align-items:center;border-bottom:1px solid #111;padding-bottom:8px}.logo{width:44px;height:44px;border-radius:8px;background:#1a56db;color:#fff;display:grid;place-items:center;font-weight:bold;overflow:hidden}.logo img{width:100%;height:100%;object-fit:cover}h2{font-size:16px;margin:0}.row{margin:9px 0;font-size:13px}.code{font-size:22px;font-weight:bold;letter-spacing:1px}.muted{font-size:11px;color:#555}.footer{border-top:1px dashed #999;margin-top:12px;padding-top:8px;font-size:11px}</style></head><body><div class="grid">${cards.map(({ parent, student }) => `<div class="card"><div class="head"><div class="logo">${logo ? `<img src="${logo}">` : textInitials(school.schoolName)}</div><div><h2>${school.schoolName || 'School'}</h2><div class="muted">Parent Portal Login</div></div></div><div class="row">Student: <b>${student.name}</b></div><div class="row">Class: <b>${student.className}</b></div><div class="row">School Code:</div><div class="code">${school.schoolCode || '-'}</div><div class="row">Phone: <b>${parent.phone}</b></div><div class="row">Password: <b>Child's Date of Birth</b></div><div class="muted">Example: 15032008</div><div class="footer">Login: ${window.location.origin}/parent/login<br>Help: ${school.schoolContactNo || school.phone || '-'}</div></div>`).join('')}</div></body></html>`
    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    setTimeout(() => win.print(), 400)
  }
  return <div className="parent-admin-module">
    <div className="section-actions"><div><h2>Parent Accounts</h2><p>Manage parent portal access, login cards and password resets.</p></div><button className="primary-button" onClick={() => printCards(filtered)}><Printer size={15} /> Bulk Print Login Cards</button></div>
    <section className="panel parent-admin-tools">
      <div className="table-search"><Search size={15} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search parent, phone, child or class" /></div>
      <label>Class<select value={classFilter} onChange={event => setClassFilter(event.target.value)}><option value="">All Classes</option>{classList.map(item => <option key={item}>{item}</option>)}</select></label>
      <div><span>School Code</span><strong>{school.schoolCode || '-'}</strong></div>
    </section>
    <section className="panel"><div className="table-scroll"><table className="data-table"><thead><tr><th>Parent</th><th>Phone</th><th>Children</th><th>Code</th><th>Status</th><th>Last Login</th><th>Actions</th></tr></thead><tbody>
      {filtered.map(parent => {
        const linked = Object.keys(parent.students || {}).map(id => studentMap[id]).filter(Boolean)
        return <tr key={parent.id || parent.phone}><td><strong>{parent.name || 'Parent'}</strong><small>{parent.email || ''}</small></td><td>{parent.phone}</td><td>{linked.map(student => <span key={student.id} className="parent-child-pill">{student.name} · {student.className}</span>)}</td><td><button className="school-code-chip" onClick={() => navigator.clipboard?.writeText(school.schoolCode || '')}>{school.schoolCode || '-'}</button></td><td><span className={`status ${parent.status === 'inactive' ? 'overdue' : parent.mustChangePassword ? 'pending' : 'paid'}`}>{parent.status === 'inactive' ? 'Inactive' : parent.mustChangePassword ? 'Must Change' : 'Active'}</span></td><td>{parent.lastLogin ? new Date(parent.lastLogin).toLocaleString('en-IN') : '-'}</td><td><div className="table-actions"><button onClick={() => reset(parent)}>Reset</button><button onClick={() => toggle(parent)}>{parent.status === 'inactive' ? 'Activate' : 'Deactivate'}</button><button onClick={() => whatsapp(parent)}>WhatsApp</button><button onClick={() => printCards([parent])}>Print</button></div></td></tr>
      })}
      {!filtered.length && <tr><td colSpan={7}><div className="empty-state">No parent accounts yet. Add students with father phone to auto-create parent logins.</div></td></tr>}
    </tbody></table></div></section>
  </div>
}

const Stat = ({ label, value, note, icon: Icon, color, trend }) => (
  <div className="stat-card">
    <div className={`stat-icon ${color}`}><Icon size={20} /></div>
    <div className="stat-copy"><span>{label}</span><strong>{value}</strong><small className={trend ? 'positive' : ''}>{note}</small></div>
  </div>
)

function SummaryPanel({ title, subtitle, items }) {
  return <section className="panel summary-panel">
    <div className="panel-header"><div><h3>{title}</h3><p>{subtitle}</p></div></div>
    <div className="summary-grid">{items.map(item => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}</div>
  </section>
}

function Dashboard({ students, notices, fees, attendance, activities, staff, staffAttendance, employeeConfig, approvals, expenses, transport, library, leaveData, setPage, onSelectStudent }) {
  const [financeRange, setFinanceRange] = useState('This Month')
  const [attendanceRange, setAttendanceRange] = useState('This Week')
  const todayMarks = attendance[today()] || {}
  const marked = Object.values(todayMarks)
  const present = marked.filter(mark => mark === 'P').length
  const absent = marked.filter(mark => mark === 'A').length
  const leave = marked.filter(mark => mark === 'L').length
  const attendanceRate = marked.length ? Math.round(present / marked.length * 100) : 0
  const feeRows = Object.values(fees)
  const collected = feeRows.reduce((sum, fee) => sum + Number(fee.amount || fee.paidAmount || 0), 0)
  const pendingFees = feeRows.reduce((sum, fee) => sum + Number(fee.balance || 0), 0)
  const billed = collected + pendingFees
  const feeRate = billed ? Math.min(100, Math.round(collected / billed * 100)) : 0
  const newAdmissions = students.filter(student => student.admissionType === 'New').length
  const dropouts = students.filter(student => !student.active).length
  const rteStudents = students.filter(student => student.admissionScheme === 'RTE').length
  const ewsStudents = students.filter(student => student.admissionScheme === 'EWS').length
  const staffRows = Object.values(staff || {})
  const teachingStaff = staffRows.filter(item => {
    const designation = employeeConfig?.designations?.[item.designationId]?.name || item.designation || item.role || ''
    const department = employeeConfig?.departments?.[item.departmentId]?.name || item.department || ''
    return /teacher|faculty|academic/i.test(`${designation} ${department}`)
  }).length
  const staffMarks = staffAttendance[today()] || {}
  const staffPresent = Object.values(staffMarks).filter(mark => mark === 'P').length
  const staffAbsent = Object.values(staffMarks).filter(mark => mark === 'A').length
  const staffLeave = Object.values(staffMarks).filter(mark => mark === 'L').length
  const birthdayDistance = dob => {
    if (!dob) return 999
    const birth = new Date(`${dob}T00:00:00`)
    const current = new Date()
    const next = new Date(current.getFullYear(), birth.getMonth(), birth.getDate())
    next.setHours(0, 0, 0, 0)
    const start = new Date(current.getFullYear(), current.getMonth(), current.getDate())
    if (next < start) next.setFullYear(next.getFullYear() + 1)
    return Math.round((next - start) / 86400000)
  }
  const birthdaysToday = students.filter(student => birthdayDistance(student.dob) === 0)
  const upcomingBirthdays = students.filter(student => birthdayDistance(student.dob) > 0 && birthdayDistance(student.dob) <= 7).sort((a, b) => birthdayDistance(a.dob) - birthdayDistance(b.dob))
  const pendingFeeApprovals = Object.values(approvals.fees || {}).filter(item => item.status === 'pending').length
  const pendingLeaveApprovals = Object.values(approvals.leaves || {}).filter(item => item.status === 'pending').length
  const boys = students.filter(student => student.gender === 'Male').length
  const girls = students.filter(student => student.gender === 'Female').length
  const knownGender = boys + girls
  const boysRate = knownGender ? Math.round(boys / knownGender * 100) : 0
  const outstandingByStudent = feeRows.reduce((totals, fee) => {
    const balance = Number(fee.balance || 0)
    if (fee.studentId && balance > 0) totals[fee.studentId] = (totals[fee.studentId] || 0) + balance
    return totals
  }, {})
  const overdueStudents = students
    .filter(student => outstandingByStudent[student.id] > 0)
    .sort((a, b) => outstandingByStudent[b.id] - outstandingByStudent[a.id])
    .slice(0, 5)
  const rangeDays = financeRange === 'This Week' ? 7 : financeRange === 'This Month' ? 30 : 365
  const cutoff = Date.now() - rangeDays * 86400000
  const income = Object.values(fees).filter(item => (item.paidAt || 0) >= cutoff && item.status === 'paid').reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const expenseRows = Object.values(expenses?.items || expenses || {}).filter(item => item && typeof item === 'object' && 'amount' in item)
  const expense = expenseRows.filter(item => (item.paidAt || item.createdAt || 0) >= cutoff).reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const todayExpenseRows = expenseRows.filter(item => item.date === today())
  const monthExpenseRows = expenseRows.filter(item => String(item.date || '').startsWith(today().slice(0, 7)))
  const todayExpense = todayExpenseRows.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const monthExpense = monthExpenseRows.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const salaryStructures = Object.values(expenses?.salary?.structures || {})
  const salaryPaidThisMonth = Object.values(expenses?.salary?.payments || {}).filter(item => item.monthKey === today().slice(0, 7))
  const pendingSalaryCount = Math.max(0, salaryStructures.length - salaryPaidThisMonth.length)
  const pendingSalaryAmount = salaryStructures.reduce((sum, item) => sum + Number(item.netSalary || 0), 0) - salaryPaidThisMonth.reduce((sum, item) => sum + Number(item.netSalary || 0), 0)
  const financeMax = Math.max(income, expense, 1)
  const transportRoutes = Object.values(transport?.routes || {})
  const transportVehicles = Object.values(transport?.vehicles || {})
  const transportDrivers = Object.values(transport?.drivers || {})
  const transportAllocations = Object.values(transport?.allocations || {})
  const daysUntil = value => value ? Math.ceil((new Date(`${String(value).slice(0, 10)}T00:00:00`) - new Date(`${today()}T00:00:00`)) / 86400000) : 999
  const transportAlerts = [
    ...transportVehicles.flatMap(vehicle => [
      { label: `${vehicle.vehicleNumber || 'Vehicle'} insurance expires in ${daysUntil(vehicle.insuranceExpiry)} days`, days: daysUntil(vehicle.insuranceExpiry) },
      { label: `${vehicle.vehicleNumber || 'Vehicle'} fitness expires in ${daysUntil(vehicle.fitnessExpiry)} days`, days: daysUntil(vehicle.fitnessExpiry) },
    ]),
    ...transportDrivers.map(driver => ({ label: `${driver.name || 'Driver'} license expires in ${daysUntil(driver.licenseExpiry)} days`, days: daysUntil(driver.licenseExpiry) })),
  ].filter(item => item.days <= 30).slice(0, 4)
  const libraryBooks = Object.values(library?.books || {})
  const libraryIssues = Object.values(library?.issues || {})
  const activeLibraryIssues = libraryIssues.filter(item => item.status === 'issued')
  const overdueLibraryIssues = activeLibraryIssues.filter(item => item.dueDate && daysUntil(item.dueDate) < 0)
  const availableLibraryBooks = libraryBooks.filter(item => Number(item.availableCopies || 0) > 0 && item.status !== 'issued')
  const leaveApplications = Object.values(leaveData?.applications || {})
  const leaveToday = leaveApplications.filter(item => item.status === 'approved' && item.fromDate <= today() && item.toDate >= today())
  const pendingLeaveRequests = leaveApplications.filter(item => item.status === 'pending')
  const upcomingLeaveRequests = leaveApplications
    .filter(item => item.status !== 'rejected' && item.status !== 'cancelled' && item.fromDate >= today())
    .sort((a, b) => String(a.fromDate).localeCompare(String(b.fromDate)))
    .slice(0, 3)
  const attendanceBars = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date()
    date.setDate(date.getDate() - (attendanceRange === 'Last Week' ? 7 : 0) - (6 - offset))
    const key = dateKey(date)
    const values = Object.values(attendance[key] || {})
    return { label: date.toLocaleDateString('en-IN', { weekday: 'short' }), value: values.length ? Math.round(values.filter(mark => mark === 'P').length / values.length * 100) : 0 }
  })
  return (
    <>
      <div className="welcome-row">
        <div><span className="eyebrow">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</span><h2>School command center</h2><p>Live operational data from your Firebase workspace.</p></div>
        <button className="primary-button" onClick={() => setPage('admissions')}><Plus size={17} /> Add student</button>
      </div>
      <StudentSearch students={students} onSelect={onSelectStudent} prominent />
      <section className="stat-grid">
        <Stat label="Total students" value={students.length} note={`${students.filter(s => s.createdAt && Date.now() - s.createdAt < 30 * 86400000).length} added this month`} icon={Users} color="blue" trend />
        <Stat label="Present today" value={`${attendanceRate}%`} note={`${present} of ${marked.length || students.length} marked present`} icon={CalendarCheck} color="green" trend />
        <Stat label="Fee collected" value={money(collected)} note={`${feeRate}% of recorded billing`} icon={IndianRupee} color="orange" />
        <Stat label="Pending fees" value={money(pendingFees)} note="Outstanding recorded balances" icon={WalletCards} color="orange" />
        <Stat label="Teaching staff" value={teachingStaff} note={`${staffRows.length} total employees`} icon={GraduationCap} color="violet" />
      </section>
      <section className="command-summary-grid">
        <SummaryPanel title="Student Summary" subtitle="Current admission strength" items={[
          { label: 'Total Students', value: students.length },
          { label: 'New Admissions', value: newAdmissions },
          { label: 'Dropouts', value: dropouts },
          { label: 'RTE Students', value: rteStudents },
          { label: 'EWS Students', value: ewsStudents },
        ]} />
        <SummaryPanel title="Employee Summary" subtitle="Staff attendance today" items={[
          { label: 'Total Staff', value: staffRows.length },
          { label: 'Present Today', value: staffPresent },
          { label: 'Absent Today', value: staffAbsent },
          { label: 'On Leave', value: staffLeave },
        ]} />
      </section>
      <section className="dashboard-grid">
        <div className="panel attendance-panel">
          <div className="panel-header"><div><h3>Attendance overview</h3><p>Student attendance over seven days</p></div><select value={attendanceRange} onChange={event => setAttendanceRange(event.target.value)}><option>This Week</option><option>Last Week</option></select></div>
          <div className="chart-wrap">
            <div className="chart-y"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div>
            <div className="bar-chart">
              {attendanceBars.map(day => <div className="bar-column" key={day.label}><div className="bar-track"><div className="bar-fill" style={{ '--bar-height': `${day.value}%` }} title={`${day.value}% present`} /></div><span>{day.label}</span></div>)}
            </div>
          </div>
          <div className="chart-summary"><span><i className="dot green" />Present <strong>{present}</strong></span><span><i className="dot red" />Absent <strong>{absent}</strong></span><span><i className="dot amber" />On leave <strong>{leave}</strong></span></div>
        </div>
        <div className="panel collection-panel">
          <div className="panel-header"><div><h3>Fee collection</h3><p>{new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p></div><button className="text-button" onClick={() => setPage('fees')}>View details</button></div>
          <div className="donut-row">
            <button className="donut" style={{ '--fee-rate': `${feeRate}%` }} title={`${feeRate}% collected`} onClick={() => setPage('fees')}><div><strong>{feeRate}%</strong><span>Collected</span></div></button>
            <div className="fee-legend">
              <span><i className="dot blue" /><small>Collected</small><strong>{money(collected)}</strong></span>
              <span><i className="dot gray" /><small>Pending</small><strong>{money(pendingFees)}</strong></span>
            </div>
          </div>
          <div className="target"><div><span>Monthly billing</span><strong>{money(billed)}</strong></div><div className="progress"><i style={{ width: `${feeRate}%` }} /></div></div>
        </div>
        <div className="panel activity-panel">
          <div className="panel-header"><div><h3>Recent activity</h3><p>Latest updates from your team</p></div><MoreHorizontal size={18} /></div>
          <div className="activity-list">
            {activities.slice(0, 6).map((activity, i) => <div className="activity" key={activity.id}><span className={`activity-icon a${i % 4}`}>{activity.icon}</span><div><strong>{activity.title}</strong><p>{activity.detail}</p></div><time>{timeAgo(activity.at)}</time></div>)}
            {!activities.length && <div className="empty-state">Actions performed in the ERP will appear here.</div>}
          </div>
        </div>
        <div className="panel notice-panel">
          <div className="panel-header"><div><h3>Upcoming & notices</h3><p>What needs your attention</p></div><button className="text-button" onClick={() => setPage('notices')}>View all</button></div>
          <div className="notice-list">
            {notices.slice(0, 3).map(n => <div className="notice-item" key={n.id}><div className="date-box"><strong>{n.date.split(' ')[0]}</strong><span>{n.date.split(' ')[1]}</span></div><div><strong>{n.title}</strong><p>{n.detail}</p></div>{n.priority === 'High' && <span className="priority">Important</span>}</div>)}
          </div>
        </div>
      </section>
      <section className="dashboard-insights">
        <div className="panel birthday-panel">
          <div className="panel-header"><div><h3>Birthdays</h3><p>Today and the next 7 days</p></div><Cake size={18} /></div>
          <div className="birthday-block"><span>Birthdays Today</span>{birthdaysToday.map(student => <div className="birthday-person" key={student.id}><span className={`avatar tone-${student.tone}`}>{student.initials}</span><div><strong>{student.name}</strong><small>{student.className}</small></div></div>)}{!birthdaysToday.length && <p>No birthdays today.</p>}</div>
          <div className="birthday-block"><span>Upcoming</span>{upcomingBirthdays.map(student => <div className="birthday-person" key={student.id}><span className={`avatar tone-${student.tone}`}>{student.initials}</span><div><strong>{student.name}</strong><small>In {birthdayDistance(student.dob)} day{birthdayDistance(student.dob) === 1 ? '' : 's'} Â· {student.className}</small></div></div>)}{!upcomingBirthdays.length && <p>No birthdays in the next 7 days.</p>}</div>
        </div>
        <div className="panel approval-panel">
          <div className="panel-header"><div><h3>Pending Approvals</h3><p>Items waiting for review</p></div><Clock3 size={18} /></div>
          <div className="approval-list"><div><span className="approval-icon fee"><WalletCards size={18} /></span><div><strong>Fee approvals</strong><small>Payment adjustments and waivers</small></div><b>{pendingFeeApprovals}</b></div><div><span className="approval-icon leave"><UserCheck size={18} /></span><div><strong>Leave approvals</strong><small>Employee leave requests</small></div><b>{pendingLeaveApprovals}</b></div></div>
        </div>
        <div className="panel gender-panel">
          <div className="panel-header"><div><h3>Boys / Girls Count</h3><p>Gender distribution from student profiles</p></div></div>
          <div className="gender-content"><div className="gender-donut" style={{ '--boys-rate': `${boysRate}%` }}><div><strong>{knownGender}</strong><span>Profiles</span></div></div><div className="gender-legend"><span><i className="dot blue" />Boys <strong>{boys}</strong></span><span><i className="dot pink-dot" />Girls <strong>{girls}</strong></span><span><i className="dot gray" />Not specified <strong>{students.length - knownGender}</strong></span></div></div>
        </div>
        <div className="panel reminder-panel">
          <div className="panel-header"><div><h3>Payment Reminder</h3><p>Top overdue student accounts</p></div><button className="text-button" onClick={() => setPage('fees')}>Open ledger</button></div>
          <div className="reminder-list">{overdueStudents.map(student => <div key={student.id}><span className={`avatar tone-${student.tone}`}>{student.initials}</span><div><strong>{student.name}</strong><small>{student.roll} Â· {student.className}</small></div><b>{money(outstandingByStudent[student.id])}</b></div>)}{!overdueStudents.length && <div className="empty-state">No recorded overdue balances.</div>}</div>
        </div>
        <div className="panel transport-widget">
          <div className="panel-header"><div><h3>Transport</h3><p>Vehicles, routes and document alerts</p></div><button className="text-button" onClick={() => setPage('transport')}>Open</button></div>
          <div className="transport-widget-grid"><span>Vehicles <strong>{transportVehicles.length}</strong></span><span>Routes <strong>{transportRoutes.length}</strong></span><span>Drivers <strong>{transportDrivers.length}</strong></span><span>Students <strong>{transportAllocations.length}</strong></span></div>
          <div className="transport-widget-alerts">{transportAlerts.map((alert, index) => <div key={index} className={alert.days <= 15 ? 'danger' : 'warn'}>{alert.label}</div>)}{!transportAlerts.length && <div className="empty-state">No transport alerts due soon.</div>}</div>
        </div>
        <div className="panel transport-widget">
          <div className="panel-header"><div><h3>Expenses</h3><p>Today and monthly school spending</p></div><button className="text-button" onClick={() => setPage('expenses')}>Open</button></div>
          <div className="transport-widget-grid"><span>Today <strong>{money(todayExpense)}</strong></span><span>Count <strong>{todayExpenseRows.length}</strong></span><span>This Month <strong>{money(monthExpense)}</strong></span><span>Pending Salary <strong>{pendingSalaryCount}</strong></span></div>
          <div className="finance-balance"><TrendingUp size={17} /><span>Income - Expense</span><strong>{money(collected - monthExpense)}</strong></div>
          {pendingSalaryCount > 0 && <div className="transport-widget-alerts"><div className="warn">Pending salary {money(Math.max(0, pendingSalaryAmount))}</div></div>}
        </div>
        <div className="panel transport-widget">
          <div className="panel-header"><div><h3>Library</h3><p>Books, issues and overdue alerts</p></div><button className="text-button" onClick={() => setPage('library')}>Open</button></div>
          <div className="transport-widget-grid"><span>Total Books <strong>{libraryBooks.length}</strong></span><span>Available <strong>{availableLibraryBooks.length}</strong></span><span>Issued <strong>{activeLibraryIssues.length}</strong></span><span>Overdue <strong>{overdueLibraryIssues.length}</strong></span></div>
          {overdueLibraryIssues.length > 0 && <div className="transport-widget-alerts"><div className="danger">{overdueLibraryIssues.length} library book(s) are overdue.</div></div>}
        </div>
        <div className="panel transport-widget">
          <div className="panel-header"><div><h3>Leave</h3><p>Staff leave and substitute planning</p></div><button className="text-button" onClick={() => setPage('leave')}>Open</button></div>
          <div className="transport-widget-grid"><span>On Leave Today <strong>{leaveToday.length}</strong></span><span>Pending <strong>{pendingLeaveRequests.length}</strong></span><span>This Month <strong>{leaveApplications.filter(item => String(item.fromDate || '').startsWith(today().slice(0, 7))).length}</strong></span><span>Total <strong>{leaveApplications.length}</strong></span></div>
          <div className="transport-widget-alerts">{upcomingLeaveRequests.map(item => <div key={item.id} className={item.status === 'pending' ? 'warn' : 'danger'}>{item.employeeName} - {item.leaveType} - {dateLabel(item.fromDate)}</div>)}{!upcomingLeaveRequests.length && <div className="empty-state">No upcoming leave requests.</div>}</div>
        </div>
        <div className="panel finance-report">
          <div className="panel-header"><div><h3>Earning / Expense Report</h3><p>Firebase financial transactions</p></div><select value={financeRange} onChange={event => setFinanceRange(event.target.value)}><option>This Week</option><option>This Month</option><option>This Year</option></select></div>
          <div className="finance-bars"><div><span>Income</span><div><i className="income" style={{ width: `${income / financeMax * 100}%` }} /></div><strong>{money(income)}</strong></div><div><span>Expense</span><div><i className="expense" style={{ width: `${expense / financeMax * 100}%` }} /></div><strong>{money(expense)}</strong></div></div>
          <div className="finance-balance"><TrendingUp size={17} /><span>Net balance</span><strong>{money(income - expense)}</strong></div>
        </div>
      </section>
    </>
  )
}

function StudentModal({ close, addStudent, updateStudent, getNextAdmissionNumber, student }) {
  const [form, setForm] = useState(student ? {
    name: student.name || '',
    className: student.className || '1-A',
    guardian: student.guardian || '',
    phone: student.phone || '',
    dob: student.dob || '',
    gender: student.gender || '',
    email: student.email || '',
    address: student.address || '',
    admissionDate: student.admissionDate || '',
    admissionScheme: student.admissionScheme || 'General',
  } : {
    name: '',
    className: '1-A',
    guardian: '',
    phone: '',
    dob: '',
    gender: '',
    email: '',
    address: '',
    admissionDate: '',
    admissionScheme: 'General',
  })
  const [saving, setSaving] = useState(false)
  const [admissionNumber, setAdmissionNumber] = useState(student ? student.roll : '')
  const [photo, setPhoto] = useState(student && student.photoUrl ? { preview: student.photoUrl, compressedSize: student.photoSize || 0 } : null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (student) return
    let active = true
    getNextAdmissionNumber().then(number => active && setAdmissionNumber(String(number)))
    return () => { active = false }
  }, [student])

  const submit = async e => {
    e.preventDefault()
    if (saving) return
    if (!form.name.trim()) {
      setError('Student name is required.')
      return
    }
    if (!/^\d{10}$/.test(String(form.phone || '').replace(/\D/g, ''))) {
      setError('Phone number must be a valid 10 digit mobile number.')
      return
    }
    const parts = form.name.trim().split(/\s+/)
    setSaving(true)
    setError('')
    try {
      const payload = {
        ...form,
        roll: admissionNumber,
        photoFile: photo?.file || null,
        photoPreview: photo?.preview || '',
        photoOriginalSize: photo?.originalSize || 0,
        photoCompressedSize: photo?.compressedSize || 0,
        initials: parts.map(p => p[0]).slice(0, 2).join('').toUpperCase(),
        attendance: student ? student.attendance : 100,
        fee: student ? student.fee : 'Pending'
      }
      if (student) {
        await updateStudent(student.id, payload)
        alert('Student details updated successfully!')
      } else {
        await addStudent(payload)
        alert('Student added successfully!')
      }
      close()
    } catch (submitError) {
      setError(submitError.message)
      alert(`Error: ${submitError.message}`)
    } finally {
      setSaving(false)
    }
  }

  return <div className="modal-backdrop"><form className="modal student-modal" onSubmit={submit}>
    <div className="modal-header"><div><h3>{student ? 'Edit student details' : 'Add new student'}</h3><p>{student ? 'Modify student profile information.' : 'Create a student profile and admission record.'}</p></div><button type="button" className="icon-button" onClick={close}><X size={19} /></button></div>
    <div className="student-modal-body">
      <div className="student-modal-top">
        <PhotoUploader photo={photo} onPhoto={setPhoto} onRemove={() => setPhoto(null)} compact />
        <div className="student-modal-top-fields">
          <label>Student name<input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Full name" /></label>
          <label>Admission number<input readOnly className="readonly-input" value={admissionNumber || 'Auto generating...'} /></label>
          <label>Class & section<select value={form.className} onChange={e => setForm({...form, className: e.target.value})}>{admissionClasses.map(c => <option key={c}>{c}</option>)}</select></label>
        </div>
      </div>
      <div className="form-grid student-form-fields">
        <label>Date of Birth<DatePicker value={form.dob} onChange={value => setForm({...form, dob: value})} max={today()} /></label>
        <label>Gender<select value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}><option value="">Select gender</option><option>Male</option><option>Female</option><option>Other</option></select></label>
        <label>Guardian name<input required value={form.guardian} onChange={e => setForm({...form, guardian: e.target.value})} placeholder="Parent / guardian" /></label>
        <label>Phone number<input required value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="10-digit mobile number" /></label>
        <label>Email<input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="Email address" /></label>
        <label>Admission Date<DatePicker value={form.admissionDate} onChange={value => setForm({...form, admissionDate: value})} /></label>
        <label>Admission Scheme<select value={form.admissionScheme} onChange={e => setForm({...form, admissionScheme: e.target.value})}>{['General','RTE','EWS','Staff Ward','Sibling','Scholarship'].map(s => <option key={s}>{s}</option>)}</select></label>
        <label>Address<input value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="Full address" /></label>
      </div>
      {error && <div className="form-error">{error}</div>}
    </div>
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={close} disabled={saving}>Cancel</button><button className="primary-button" disabled={saving || !admissionNumber}>{saving ? 'Saving...' : <>{student ? <Save size={16} /> : <Plus size={16} />}{student ? ' Update student' : ' Add student'}</>}</button></div>
  </form></div>
}

function StudentProfile({ student, close, attendance, fees, feeManager, schoolProfile, academics, documents, onRecordPayment, onUploadDocument, onUpdatePhoto }) {
  const [tab, setTab] = useState('personal')
  const [uploading, setUploading] = useState('')
  const [photoDraft, setPhotoDraft] = useState(null)
  const [photoSaving, setPhotoSaving] = useState(false)
  if (!student) return null
  const records = Object.entries(attendance).reduce((all, [date, marks]) => marks[student.id] ? { ...all, [date]: marks[student.id] } : all, {})
  const now = new Date()
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const currentMarks = Object.entries(records).filter(([date]) => date.startsWith(monthKey))
  const monthSummary = Object.entries(records).reduce((all, [date, mark]) => {
    const month = date.slice(0, 7)
    all[month] ||= { P: 0, A: 0, L: 0 }
    all[month][mark] += 1
    return all
  }, {})
  const academicYear = schoolProfile?.academicYear || `${now.getFullYear()}-${String(now.getFullYear() + 1).slice(-2)}`
  const startYear = Number(String(academicYear).match(/\d{4}/)?.[0] || now.getFullYear())
  const feeMonths = ['April','May','June','July','August','September','October','November','December','January','February','March']
  const studentFees = Object.values(fees).filter(fee => fee.studentId === student.id)
  const totalPaid = studentFees.filter(fee => fee.status === 'paid').reduce((sum, fee) => sum + Number(fee.amount || 0), 0)
  const structures = Object.values(feeManager?.structures || {})
  const monthlyFee = structures
    .filter(item => item.frequency === 'Monthly')
    .filter(item => item.mode === 'By Student Wise'
      ? String(item.target) === String(student.id)
      : String(item.target || '').toUpperCase() === String(student.feeGroup || '').toUpperCase()
        && (!item.className || item.className === student.className.split('-')[0])
        && (!item.section || item.section === student.className.split('-')[1]))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const pending = studentFees.reduce((sum, fee) => sum + Number(fee.balance || 0), 0)
  const results = academics?.[student.id] || {}
  const docs = documents?.[student.id] || {}
  const currentPhoto = student.photoUrl || docs.photo?.url || docs.photo?.data || ''
  const upload = async (type, file) => {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) return alert('Please upload a file smaller than 5 MB.')
    setUploading(type)
    try {
      await onUploadDocument(student.id, type, file)
    } catch (error) {
      alert(error.message)
    } finally {
      setUploading('')
    }
  }
  const changePhoto = async prepared => {
    setPhotoDraft(prepared)
    setPhotoSaving(true)
    try {
      await onUpdatePhoto(student.id, prepared.file, prepared.preview)
      setPhotoDraft(null)
    } catch (error) {
      alert(error.message)
    } finally {
      setPhotoSaving(false)
    }
  }
  return <div className="profile-page">
    <div className="profile-page-header"><button className="secondary-button" onClick={close}>Back</button><div><span>Student Profile</span><h2>{student.name}</h2></div><button className="icon-button" onClick={close}><X size={20} /></button></div>
    <section className="profile-cover"><div className="profile-photo-wrap"><label className="profile-photo editable">{photoDraft?.preview || currentPhoto ? <img src={photoDraft?.preview || currentPhoto} alt={student.name} /> : student.initials}<span><Camera size={18} />{photoSaving ? 'Saving...' : 'Change'}</span><input disabled={photoSaving} type="file" accept="image/jpeg,image/jpg,image/png" onChange={async event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) changePhoto(await prepareStudentPhoto(file)) }} /></label>{photoSaving && <small>Uploading photo...</small>}</div><div><span className="admission-badge">Admission Number</span><strong className="admission-number">{student.roll}</strong><h3>{student.name}</h3><p>Class {student.className} · {student.feeGroup}</p>{(photoDraft?.compressedSize || student.photoSize) ? <small className="compression-info inline">Photo: {formatBytes(photoDraft?.compressedSize || student.photoSize)} OK</small> : null}</div><span className={`status ${student.fee.toLowerCase()}`}>{student.fee}</span></section>
    <div className="profile-tabs">{[['personal','Personal Info'],['attendance','Attendance'],['fees','Fees'],['academics','Academics'],['documents','Documents']].map(([id,label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}</div>
    <section className="profile-tab-content" key={tab}>
      {tab === 'personal' && <dl className="profile-details full-profile-details">{[['Admission Number',student.roll],['Full Name',student.name],['Father Name',student.fatherName],['Mother Name',student.motherName],['Date of Birth',student.dob],['Gender',student.gender],['Phone',student.phone],['Email',student.email],['Address',[student.address,student.city,student.state,student.pincode].filter(Boolean).join(', ')],['Class',student.className.split('-')[0]],['Section',student.className.split('-')[1]],['Fee Group',student.feeGroup],['Admission Date',student.admissionDate],['Aadhaar',student.aadhaar],['PEN ID',student.penId],['APAAR ID',student.apaarId]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not provided'}</dd></div>)}</dl>}
      {tab === 'attendance' && <><div className="profile-metrics"><div><span>Present this month</span><strong>{currentMarks.filter(([,mark])=>mark==='P').length}</strong></div><div><span>Absent this month</span><strong>{currentMarks.filter(([,mark])=>mark==='A').length}</strong></div><div><span>Overall attendance</span><strong>{Object.keys(records).length ? Math.round(Object.values(records).filter(mark=>mark==='P').length/Object.keys(records).length*100) : 0}%</strong></div></div><div className="attendance-calendar"><div className="calendar-title">{now.toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</div><div className="calendar-week">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day=><span key={day}>{day}</span>)}</div><div className="calendar-grid">{Array.from({length:new Date(now.getFullYear(),now.getMonth(),1).getDay()}).map((_,i)=><i key={i}/>)}{Array.from({length:monthDays},(_,i)=>{const day=i+1;const mark=records[`${monthKey}-${String(day).padStart(2,'0')}`];return <div key={day} className={mark?`marked ${mark}`:''}><span>{day}</span><b>{mark||'â€”'}</b></div>})}</div></div><div className="panel table-panel profile-table"><table><thead><tr><th>Month</th><th>Present</th><th>Absent</th><th>Leave</th><th>Percentage</th></tr></thead><tbody>{Object.entries(monthSummary).map(([month,marks])=><tr key={month}><td>{new Date(`${month}-01`).toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</td><td>{marks.P}</td><td>{marks.A}</td><td>{marks.L}</td><td>{Math.round(marks.P/(marks.P+marks.A+marks.L)*100)}%</td></tr>)}{!Object.keys(monthSummary).length&&<tr><td colSpan="5"><div className="empty-state">No attendance records yet.</div></td></tr>}</tbody></table></div></>}
      {tab === 'fees' && <><div className="profile-metrics"><div><span>Total paid</span><strong>{money(totalPaid)}</strong></div><div><span>Recorded balance</span><strong>{money(pending)}</strong></div><div className="due-metric"><span>Monthly fee setup</span><strong>{monthlyFee ? money(monthlyFee) : 'Not set'}</strong></div></div><div className="fee-month-grid">{feeMonths.map((month,index)=>{const monthNo=((index+3)%12)+1;const year=monthNo<4?startYear+1:startYear;const billingMonth=`${year}-${String(monthNo).padStart(2,'0')}`;const fee=studentFees.find(item=>item.billingPeriod===billingMonth||item.billingMonth===billingMonth||item.billingMonth===month);const overdue=monthlyFee>0&&!fee&&new Date(year,monthNo-1,10)<new Date();return <div key={month} className={fee?.status==='paid'?'paid':overdue?'overdue':'pending'}><span>{month}</span><strong>{fee ? money(fee.amount || fee.totalDue) : monthlyFee ? money(monthlyFee) : 'Not set'}</strong><small>{fee?.status==='paid'?'Paid':overdue?'Overdue':monthlyFee?'Pending':'Configure fee'}</small>{!fee&&monthlyFee>0&&<button className="text-button" onClick={()=>onRecordPayment(student.id,monthlyFee,'UPI',billingMonth)}>Record payment</button>}</div>})}</div></>}
      {tab === 'academics' && <div className="academics-profile"><div className="profile-actions"><button className="secondary-button" onClick={()=>window.print()}><Printer size={16}/> Print report card</button></div>{Object.entries(results).map(([exam,record])=><div className="exam-block" key={exam}><div><h3>{exam}</h3><strong>{record.percentage||0}% Â· Grade {record.grade||'â€”'}</strong></div><table><thead><tr><th>Subject</th><th>Marks</th><th>Maximum</th></tr></thead><tbody>{Object.entries(record.subjects||{}).map(([subject,marks])=><tr key={subject}><td>{subject}</td><td>{marks.obtained}</td><td>{marks.maximum}</td></tr>)}</tbody></table></div>)}{!Object.keys(results).length&&<div className="empty-state large"><FileText size={28}/><strong>No academic results yet</strong><p>Exam-wise marks will appear here after publishing.</p></div>}</div>}
      {tab === 'documents' && <div className="documents-grid">{[['aadhaar','Aadhaar Card'],['birthCertificate','Birth Certificate'],['previousTc','Previous TC']].map(([type,label])=><div key={type}><FileText size={24}/><strong>{label}</strong><small>{docs[type]?.name||'No file uploaded'}</small><label className="secondary-button">{uploading===type?'Uploading...':'Upload'}<input type="file" accept="image/*,.pdf" onChange={event=>upload(type,event.target.files?.[0])}/></label>{(docs[type]?.url||docs[type]?.data)&&<a className="text-button" href={docs[type].url||docs[type].data} target="_blank" rel="noreferrer" download={docs[type].name}>Download</a>}</div>)}<button className="primary-button download-all" disabled={!Object.keys(docs).length} onClick={()=>Object.values(docs).forEach((doc,index)=>setTimeout(()=>{const link=document.createElement('a');link.href=doc.url||doc.data;link.target='_blank';link.rel='noreferrer';link.download=doc.name;link.click()},index*200))}><Download size={16}/> Download all documents</button></div>}
    </section>
  </div>
}

function Students({ students, onAddStudent, onUpdateStudent, onSelectStudent, getNextAdmissionNumber }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All classes')
  const [modal, setModal] = useState(null)
  const classes = [...new Set(students.map(student => student.className))].sort()
  const filtered = students.filter(s => (filter === 'All classes' || s.className === filter) && `${s.name} ${s.roll} ${s.phone}`.toLowerCase().includes(search.trim().toLowerCase()))
  const addStudent = student => onAddStudent(student)
  return <>
    <div className="section-actions"><div><h2>Student directory</h2><p>Manage profiles, guardians, attendance and fee status.</p></div><button className="primary-button" onClick={() => setModal('add')}><Plus size={17} /> Add student</button></div>
    <div className="mini-stats"><div><span>All students</span><strong>{students.length}</strong></div><div><span>New admissions</span><strong>{students.filter(s => s.createdAt && Date.now() - s.createdAt < 30 * 86400000).length}</strong></div><div><span>Avg. attendance</span><strong>{students.length ? Math.round(students.reduce((sum, s) => sum + s.attendance, 0) / students.length) : 0}%</strong></div><div><span>Fee defaulters</span><strong>{students.filter(s => s.fee !== 'Paid').length}</strong></div></div>
    <div className="panel table-panel">
      <div className="table-toolbar"><div className="table-search"><Search size={16} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student, roll no. or phone" /></div><select value={filter} onChange={e => setFilter(e.target.value)}><option>All classes</option>{classes.map(c => <option key={c}>{c}</option>)}</select></div>
      <div className="table-scroll"><table><thead><tr><th>Student</th><th>Class</th><th>Guardian</th><th>Attendance</th><th>Fee status</th><th /></tr></thead><tbody>
        {filtered.map(s => <tr key={s.id} onClick={() => onSelectStudent(s)} className="clickable-row"><td><div className="student-cell"><StudentAvatar student={s} /><div><strong>{s.name}</strong><small>{s.roll}</small></div></div></td><td><span className="class-pill">{s.className}</span></td><td><strong className="regular">{s.guardian}</strong><small className="cell-sub">{s.phone}</small></td><td><div className="attendance-cell"><span>{s.attendance}%</span><div><i style={{width: `${s.attendance}%`}} /></div></div></td><td><span className={`status ${s.fee.toLowerCase()}`}>{s.fee}</span></td><td><div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}><button type="button" className="icon-button" onClick={() => onSelectStudent(s)} title={`View ${s.name}`}><Eye size={16} /></button><button type="button" className="icon-button" onClick={() => setModal(s)} title={`Edit ${s.name}`}><Pencil size={16} /></button></div></td></tr>)}
        {!filtered.length && <tr><td colSpan="6"><div className="empty-state">No students match this search.</div></td></tr>}
      </tbody></table></div>
    </div>
    {modal && <StudentModal close={() => setModal(null)} student={modal !== 'add' ? modal : undefined} addStudent={addStudent} updateStudent={onUpdateStudent} getNextAdmissionNumber={getNextAdmissionNumber} />}
  </>
}



const occupationOptions = ['Business','Service / Job','Government Employee','Private Employee','Farmer','Labour','Teacher','Doctor','Engineer','Lawyer','Self Employed','Armed Forces','Retired','Unemployed','Other']
const qualificationOptions = ['Below 10th','10th Pass','12th Pass','Graduate','Post Graduate','Professional Degree','Other']
const religionList = ['Hindu','Muslim','Christian','Sikh','Jain','Buddhist','Parsi','Jewish','Other']
const casteList = ['General','OBC (Other Backward Class)','SC (Scheduled Caste)','ST (Scheduled Tribe)','EWS (Economically Weaker Section)','Brahmin','Rajput','Yadav','Jat','Gujjar','Kurmi','Baniya/Vaishya','Kayastha','Kshatriya','Lodhi','Kushwaha','Nai','Dhobi','Kummhar','Lohar','Teli','Other']
const categoryList = ['General','OBC','SC','ST','EWS','DG (Disadvantaged Group)']
const disabilityOptions = ['Visual Impairment (Blind/Low Vision)','Hearing Impairment (Deaf/Hard of Hearing)','Speech Impairment','Locomotor Disability (Physical)','Intellectual Disability','Learning Disability (Dyslexia)','Autism Spectrum Disorder','Cerebral Palsy','Multiple Disabilities','Other']
const languageOptions = ['Hindi','English','Urdu','Sanskrit','Punjabi','Bengali','Marathi','Tamil','Telugu','Kannada','Gujarati','Other']

function AdmissionForm({ students, onAddStudent, onUpdateStudent, onOpenRegister, getNextAdmissionNumber, school = {} }) {
  const [expanded, setExpanded] = useState('admission')
  const [saving, setSaving] = useState(false)
  const [permanentAddress, setPermanentAddress] = useState(true)
  const [photo, setPhoto] = useState(null)
  const [selectedOldStudent, setSelectedOldStudent] = useState(null)
  const [oldSearch, setOldSearch] = useState('')
  const [success, setSuccess] = useState(null)
  const [submitError, setSubmitError] = useState('')
  const [form, setForm] = useState({
    admissionType: 'new', className: 'Nursery-A', admissionScheme: 'General', roll: '',
    admissionDate: today(), academicSession: school.academicYear || '2026-27', rollNumber: '', feeGroup: 'Regular',
    name: '', fatherName: '', motherName: '', guardian: '', gender: '', dob: '', ageOn31March: '', phone: '', email: '',
    aadhaar: '', penId: '', apaarId: '', bloodGroup: "Don't Know", height: '', weight: '', motherTongue: 'Hindi', nationality: 'Indian',
    religion: 'Hindu', caste: 'General', subCaste: '', category: 'General', categoryCertNo: '',
    isDisabled: false, disabilityType: [], disabilityPercentage: '', disabilityCertNo: '', udidNo: '', scribeRequired: false, extraExamTime: false, specialEquipment: '', disabilityRemarks: '',
    fatherOccupation: '', fatherQualification: '', fatherPhone: '', fatherEmail: '', fatherAadhaar: '',
    motherOccupation: '', motherQualification: '', motherPhone: '', motherEmail: '', motherAadhaar: '',
    guardianPhone: '', guardianRelation: 'Father', annualIncome: '', siblings: 0, siblingInSameSchool: false, siblingAdmNo: '',
    address: '', city: '', state: '', district: '', pincode: '', permanentAddress: '',
    previousSchool: '', previousClass: '', previousTCNo: '', previousTCDate: '', reasonForLeaving: '',
    transportRequired: false, routeId: '', routeName: '', stopName: '', pickupTime: '', dropTime: '',
    sendSMS: true, smsEnabled: true, confirmDetails: false,
  })
  const [numberLoading, setNumberLoading] = useState(true)
  const refreshNumber = async () => {
    setNumberLoading(true)
    try {
      const next = await getNextAdmissionNumber()
      setForm(current => ({ ...current, roll: String(next) }))
    } finally { setNumberLoading(false) }
  }
  useEffect(() => { refreshNumber() }, [])
  const update = (key, value) => setForm(current => ({ ...current, [key]: value, ...(key === 'dob' ? { ageOn31March: ageOnDate(value) } : {}) }))
  const toggleDisability = value => setForm(current => ({ ...current, disabilityType: current.disabilityType.includes(value) ? current.disabilityType.filter(item => item !== value) : [...current.disabilityType, value] }))
  const oldMatches = oldSearch.trim() ? students.filter(student => `${student.roll} ${student.name} ${student.phone}`.toLowerCase().includes(oldSearch.toLowerCase())).slice(0, 8) : []
  const selectOldStudent = student => {
    setSelectedOldStudent(student)
    const { className, section } = splitClassSection(student.className)
    setOldSearch(`${student.roll} - ${student.name}`)
    setForm(current => ({ ...current, ...student, admissionType: 'old', className: `${className}-${section || 'A'}`, roll: String(student.roll), academicSession: current.academicSession, admissionDate: today(), confirmDetails: false }))
    setPhoto(student.photoUrl ? { preview: student.photoUrl, compressedSize: student.photoSize || 0 } : null)
  }
  const submit = async event => {
    event.preventDefault()
    if (saving || numberLoading) return
    if (!form.confirmDetails) {
      setSubmitError('Please confirm that all details are correct.')
      return
    }
    const aadhaarDigits = String(form.aadhaar || '').replace(/\D/g, '')
    if (aadhaarDigits && aadhaarDigits.length !== 12) {
      setSubmitError('Aadhaar number must be 12 digits.')
      return
    }
    if (!/^\d{10}$/.test(String(form.fatherPhone || form.phone || '').replace(/\D/g, ''))) {
      setSubmitError('Father phone must be a valid 10 digit parent login number.')
      return
    }
    setSaving(true)
    setSubmitError('')
    try {
      const payload = { ...form, newAdmission: form.admissionType === 'new', phone: form.fatherPhone || form.phone, guardian: form.guardian || form.fatherName, parentLoginPhone: form.fatherPhone || form.phone, aadhaar: formatAadhaar(form.aadhaar), photoFile: photo?.file || null, photoPreview: photo?.preview || '', photoOriginalSize: photo?.originalSize || 0, photoCompressedSize: photo?.compressedSize || 0 }
      const admissionNo = form.admissionType === 'old' && selectedOldStudent
        ? (await onUpdateStudent(selectedOldStudent.id, payload), selectedOldStudent.roll)
        : await onAddStudent(payload)
      const summary = { admissionNo, schoolCode: school.schoolCode || 'Not set', phone: payload.parentLoginPhone, password: form.dob || 'DOB' }
      setSuccess(summary)
      alert(`Student saved successfully!\nAdmission Number: ${admissionNo}\nSchool Code: ${summary.schoolCode}`)
      setForm(current => ({ ...current, roll: '', name: '', fatherName: '', motherName: '', guardian: '', gender: '', dob: '', phone: '', email: '', state: '', city: '', address: '', pincode: '', aadhaar: '', penId: '', apaarId: '', permanentAddress: '' }))
      setPhoto(null)
      setSelectedOldStudent(null)
      await refreshNumber()
    } catch (error) {
      console.error(error)
      setSubmitError(error.message)
      alert(`Error: ${error.message}`)
    } finally { setSaving(false) }
  }
  const section = (id, title, content) => <section className="panel admission-card"><button type="button" className="collapse-title" onClick={() => setExpanded(expanded === id ? '' : id)}><span>{title}</span><ChevronRight className={expanded === id ? 'rotated' : ''} size={18} /></button>{expanded === id && <div className="admission-fields">{content}</div>}</section>
  return <form className="admission-form admission-form-pro" onSubmit={submit}>
    <div className="admission-toolbar">
      <button type="button" className="secondary-button" onClick={() => {
        const content = `NXT OpenERP School\nADMISSION FORM\n\nAdmission No: __________  Date: __________\nStudent Name: ______________________________\nClass/Section: __________  Gender: __________\nFather: __________________  Mother: __________________\nMobile: __________________  DOB: __________________\nAddress: ____________________________________________`
        const link = document.createElement('a')
        link.href = URL.createObjectURL(new Blob([content], { type: 'text/plain' }))
        link.download = 'admission-form.txt'
        link.click()
        URL.revokeObjectURL(link.href)
      }}><Download size={16} /> Download Admission Form</button>
      <label className="secondary-button file-button"><Upload size={16} /> Import Excel<input type="file" accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={async event => {
        const file = event.target.files?.[0]
        if (!file) return
        event.target.value = ''

        // Flexible header aliases → internal field keys
        const HEADER_MAP = {
          name: 'name', fullname: 'name', studentname: 'name', 'student name': 'name', 'full name': 'name', 'student full name': 'name',
          class: 'className', classname: 'className', 'class name': 'className', grade: 'className', standard: 'className', 'class/section': 'className',
          section: 'section',
          guardian: 'guardian', guardianname: 'guardian', 'guardian name': 'guardian',
          father: 'guardian', fathername: 'guardian', 'father name': 'guardian', 'fathers name': 'guardian',
          phone: 'phone', mobile: 'phone', contact: 'phone', mobileno: 'phone', phoneno: 'phone',
          guardianphone: 'phone', 'guardian phone': 'phone', fatherphone: 'phone', 'father phone': 'phone',
          admissiondate: 'admissionDate', 'admission date': 'admissionDate', dateofadmission: 'admissionDate',
          dob: 'dob', dateofbirth: 'dob', 'date of birth': 'dob', birthdate: 'dob', 'birth date': 'dob',
          gender: 'gender', sex: 'gender',
          email: 'email', emailid: 'email', 'email id': 'email',
          address: 'address',
          admissionscheme: 'admissionScheme', 'admission scheme': 'admissionScheme', category: 'admissionScheme',
        }

        // Convert Excel date serial (Windows epoch: Dec 30 1899) to YYYY-MM-DD
        const excelSerialToDate = n => {
          if (typeof n !== 'number') return String(n || '').trim()
          const d = new Date((n - 25569) * 86400 * 1000)
          const y = d.getUTCFullYear()
          const m = String(d.getUTCMonth() + 1).padStart(2, '0')
          const day = String(d.getUTCDate()).padStart(2, '0')
          return `${y}-${m}-${day}`
        }

        const normalizeHeader = h => String(h || '').toLowerCase().replace(/[^a-z0-9 /]/g, '').trim()

        let parsed = []
        try {
          if (file.name.toLowerCase().endsWith('.xlsx')) {
            // — Excel file path —
            const ExcelJS = (await import('exceljs')).default
            const wb = new ExcelJS.Workbook()
            await wb.xlsx.load(await file.arrayBuffer())
            const ws = wb.worksheets[0]
            if (!ws) throw new Error('No worksheets found in this Excel file.')
            const headers = {}
            ws.getRow(1).eachCell((cell, col) => {
              const raw = cell.value && typeof cell.value === 'object' && cell.value.richText
                ? cell.value.richText.map(rt => rt.text).join('')
                : cell.value
              headers[col] = normalizeHeader(raw)
            })
            ws.eachRow((row, rowNum) => {
              if (rowNum === 1) return
              const obj = {}
              row.eachCell((cell, col) => {
                const h = headers[col]
                const key = h ? HEADER_MAP[h] : undefined
                if (!key) return
                let val = cell.value
                // Unwrap formula result / rich text
                if (val && typeof val === 'object' && val.result !== undefined) val = val.result
                if (val && typeof val === 'object' && val.richText !== undefined) val = val.richText.map(rt => rt.text).join('')
                if (val instanceof Date) {
                  const y = val.getFullYear(), m = String(val.getMonth() + 1).padStart(2, '0'), d = String(val.getDate()).padStart(2, '0')
                  obj[key] = `${y}-${m}-${d}`
                } else if ((key === 'admissionDate' || key === 'dob') && typeof val === 'number') {
                  obj[key] = excelSerialToDate(val)
                } else {
                  obj[key] = String(val ?? '').trim()
                }
              })
              if (obj.name?.trim() || obj.className?.trim()) parsed.push(obj)
            })
          } else {
            // — CSV file path —
            const text = await file.text()
            const lines = text.split(/\r?\n/).filter(l => l.trim())
            if (!lines.length) throw new Error('The CSV file is empty.')
            const headers = lines[0].split(',').map(normalizeHeader)
            for (let i = 1; i < lines.length; i++) {
              const cols = lines[i].split(',').map(c => c.trim())
              if (cols.every(c => !c)) continue
              const obj = {}
              headers.forEach((h, idx) => {
                const key = HEADER_MAP[h]
                if (key && cols[idx] !== undefined) obj[key] = cols[idx]
              })
              if (obj.name?.trim() || obj.className?.trim()) parsed.push(obj)
            }
          }
        } catch (parseErr) {
          console.error('[Import] Parse error', parseErr)
          alert(`Import failed: ${parseErr.message}`)
          return
        }

        if (!parsed.length) {
          alert('No valid rows found. Make sure your file has "Name" and "Class" columns.')
          return
        }

        let success = 0, failed = 0
        for (const row of parsed) {
          try {
            const className = row.section ? `${row.className}-${row.section}` : row.className
            await onAddStudent({
              name: row.name || '',
              className: className || '',
              guardian: row.guardian || '',
              phone: row.phone || '',
              dob: row.dob || '',
              gender: row.gender || '',
              email: row.email || '',
              address: row.address || '',
              admissionDate: row.admissionDate || today(),
              admissionScheme: row.admissionScheme || 'General',
              newAdmission: true,
            })
            success++
          } catch (rowErr) {
            console.error('[Import] Row failed', row, rowErr)
            failed++
          }
        }
        alert(`✅ Import complete: ${success} student(s) added${failed ? `, ⚠️ ${failed} failed (check console)` : ''}.`)
      }} /></label>
      <button type="button" className="secondary-button" onClick={onOpenRegister}><Search size={16} /> Search Student</button>
    </div>
    <section className="panel admission-card">
      <div className="admission-photo-top">
        <PhotoUploader photo={photo} onPhoto={setPhoto} onRemove={() => setPhoto(null)} />
      </div>
      <div className="admission-type-toggle">
        <label><input type="radio" checked={form.admissionType === 'new'} onChange={() => { update('admissionType', 'new'); setSelectedOldStudent(null); refreshNumber() }} /> New Admission</label>
        <label><input type="radio" checked={form.admissionType === 'old'} onChange={() => { update('admissionType', 'old'); setForm(current => ({ ...current, roll: '' })) }} /> Old Student</label>
      </div>
      {form.admissionType === 'old' && <div className="old-student-search"><label className="full">Search existing student<div className="table-search"><Search size={15} /><input value={oldSearch} onChange={e => setOldSearch(e.target.value)} placeholder="Search by Admission No / Name" /></div></label>{oldMatches.length > 0 && <div className="certificate-search-results">{oldMatches.map(student => <button type="button" key={student.id} onClick={() => selectOldStudent(student)}><StudentAvatar student={student} /><div><strong>{student.name}</strong><small>Adm {student.roll} - {student.className}</small></div></button>)}</div>}</div>}
      <div className="admission-grid five">
        <label>Class*<select required value={form.className.split('-')[0]} onChange={e => update('className', `${e.target.value}-${form.className.split('-')[1] || 'A'}`)}>{classOptions.map(item => <option key={item}>{item}</option>)}</select></label>
        <label>Section*<select required value={form.className.split('-')[1] || 'A'} onChange={e => update('className', `${form.className.split('-')[0]}-${e.target.value}`)}>{sectionOptions.map(item => <option key={item}>{item}</option>)}</select></label>
        <label>Academic Session*<select required value={form.academicSession} onChange={e => update('academicSession', e.target.value)}>{academicYears.map(item => <option key={item}>{item}</option>)}</select></label>
        <label>Admission Number*<input required readOnly value={numberLoading ? 'Auto generating...' : form.roll} className="readonly-input" /></label>
        <label>Date of Admission*<DatePicker required value={form.admissionDate} onChange={value => update('admissionDate', value)} /></label>
      </div>
    </section>
    {section('student', 'Section 2: Student Information', <>
        <div className="admission-grid four">
          <label>Student Name*<input required value={form.name} onChange={e => update('name', e.target.value)} /></label>
          <label>Gender*<select required value={form.gender} onChange={e => update('gender', e.target.value)}><option value="">Select gender</option><option>Male</option><option>Female</option><option>Other</option></select></label>
          <label>Date of Birth*<DatePicker required max={today()} value={form.dob} onChange={value => update('dob', value)} /></label>
          <label>Age as on 31 March 2026<input readOnly className="readonly-input" value={form.ageOn31March || ageOnDate(form.dob)} /></label>
          <label>Email Id<input type="email" value={form.email} onChange={e => update('email', e.target.value)} /></label>
          <label>Aadhaar Card<input value={form.aadhaar} onChange={e => update('aadhaar', formatAadhaar(e.target.value))} placeholder="XXXX XXXX XXXX" /></label>
          <label>PEN Id<input value={form.penId} onChange={e => update('penId', e.target.value)} /></label>
          <label>APAAR Id<input value={form.apaarId} onChange={e => update('apaarId', e.target.value)} /></label>
          <label>Blood Group<select value={form.bloodGroup} onChange={e => update('bloodGroup', e.target.value)}>{['A+','A-','B+','B-','AB+','AB-','O+','O-', "Don't Know"].map(item => <option key={item}>{item}</option>)}</select></label>
          <label>Height (cm)<input value={form.height} onChange={e => update('height', onlyDigits(e.target.value, 3))} /></label>
          <label>Weight (kg)<input value={form.weight} onChange={e => update('weight', onlyDigits(e.target.value, 3))} /></label>
          <label>Mother Tongue<select value={form.motherTongue} onChange={e => update('motherTongue', e.target.value)}>{languageOptions.map(item => <option key={item}>{item}</option>)}</select></label>
          <label>Nationality<select value={form.nationality} onChange={e => update('nationality', e.target.value)}><option>Indian</option><option>NRI</option><option>Other</option></select></label>
        </div>
      </>)}
    {section('admission-details', 'Section 1: Admission Details', <div className="admission-grid four"><label>Roll Number<input value={form.rollNumber} onChange={e => update('rollNumber', e.target.value)} /></label><label>Fee Group*<select required value={form.feeGroup} onChange={e => update('feeGroup', e.target.value)}>{feeGroups.map(item => <option key={item}>{item}</option>)}</select></label><label>Admission Scheme<select value={form.admissionScheme} onChange={e => update('admissionScheme', e.target.value)}><option>General</option><option>RTE</option><option>EWS</option><option>Scholarship</option><option>Staff Ward</option></select></label></div>)}
    {section('caste', 'Section 3: Caste & Religion', <div className="admission-grid four"><label>Religion*<select required value={form.religion} onChange={e => update('religion', e.target.value)}>{religionList.map(item => <option key={item}>{item}</option>)}</select></label><label>Caste*<select required value={form.caste} onChange={e => update('caste', e.target.value)}>{casteList.map(item => <option key={item}>{item}</option>)}</select></label><label>Sub-Caste<input value={form.subCaste} onChange={e => update('subCaste', e.target.value)} placeholder="Enter sub-caste if applicable" /></label><label>Category*<select required value={form.category} onChange={e => update('category', e.target.value)}>{categoryList.map(item => <option key={item}>{item}</option>)}</select></label><label>Category Certificate No<input value={form.categoryCertNo} onChange={e => update('categoryCertNo', e.target.value)} /></label></div>)}
    {section('disability', 'Section 4: Disability / Special Needs', <><div className="admission-type-toggle"><label><input type="radio" checked={!form.isDisabled} onChange={() => update('isDisabled', false)} /> No</label><label><input type="radio" checked={form.isDisabled} onChange={() => update('isDisabled', true)} /> Yes</label></div>{form.isDisabled && <div className="admission-grid four"><label className="full">Type of Disability<div className="auth-check-grid">{disabilityOptions.map(item => <span key={item}><input type="checkbox" checked={form.disabilityType.includes(item)} onChange={() => toggleDisability(item)} /> {item}</span>)}</div></label><label>Disability %<input value={form.disabilityPercentage} onChange={e => update('disabilityPercentage', onlyDigits(e.target.value, 3))} /></label><label>Certificate No<input value={form.disabilityCertNo} onChange={e => update('disabilityCertNo', e.target.value)} /></label><label>UDID Number<input value={form.udidNo} onChange={e => update('udidNo', e.target.value)} /></label><label>Scribe Required?<select value={form.scribeRequired ? 'Yes' : 'No'} onChange={e => update('scribeRequired', e.target.value === 'Yes')}><option>No</option><option>Yes</option></select></label><label>Extra Exam Time?<select value={form.extraExamTime ? 'Yes' : 'No'} onChange={e => update('extraExamTime', e.target.value === 'Yes')}><option>No</option><option>Yes</option></select></label><label>Special Equipment<input value={form.specialEquipment} onChange={e => update('specialEquipment', e.target.value)} placeholder="Wheelchair, hearing aid..." /></label><label className="full">Remarks<textarea value={form.disabilityRemarks} onChange={e => update('disabilityRemarks', e.target.value)} /></label></div>}</>)}
    {section('family', 'Section 5: Family Information', <div className="admission-grid four"><label>Father&apos;s Name*<input required value={form.fatherName} onChange={e => update('fatherName', e.target.value)} /></label><label>Father&apos;s Occupation<select value={form.fatherOccupation} onChange={e => update('fatherOccupation', e.target.value)}><option value="">Select</option>{occupationOptions.map(item => <option key={item}>{item}</option>)}</select></label><label>Father&apos;s Qualification<select value={form.fatherQualification} onChange={e => update('fatherQualification', e.target.value)}><option value="">Select</option>{qualificationOptions.map(item => <option key={item}>{item}</option>)}</select></label><label>Father&apos;s Phone*<input required value={form.fatherPhone} onChange={e => { const phone = onlyDigits(e.target.value, 10); update('fatherPhone', phone); update('phone', phone) }} placeholder="Parent portal login phone" /></label><label>Father&apos;s Email<input type="email" value={form.fatherEmail} onChange={e => update('fatherEmail', e.target.value)} /></label><label>Father&apos;s Aadhaar<input value={form.fatherAadhaar} onChange={e => update('fatherAadhaar', formatAadhaar(e.target.value))} /></label><label>Mother&apos;s Name*<input required value={form.motherName} onChange={e => update('motherName', e.target.value)} /></label><label>Mother&apos;s Occupation<select value={form.motherOccupation} onChange={e => update('motherOccupation', e.target.value)}><option value="">Select</option>{occupationOptions.map(item => <option key={item}>{item}</option>)}</select></label><label>Mother&apos;s Qualification<select value={form.motherQualification} onChange={e => update('motherQualification', e.target.value)}><option value="">Select</option>{qualificationOptions.map(item => <option key={item}>{item}</option>)}</select></label><label>Mother&apos;s Phone<input value={form.motherPhone} onChange={e => update('motherPhone', onlyDigits(e.target.value, 10))} /></label><label>Guardian Name<input value={form.guardian} onChange={e => update('guardian', e.target.value)} /></label><label>Guardian Phone<input value={form.guardianPhone} onChange={e => update('guardianPhone', onlyDigits(e.target.value, 10))} /></label><label>Guardian Relation<select value={form.guardianRelation} onChange={e => update('guardianRelation', e.target.value)}>{['Father','Mother','Brother','Sister','Uncle','Aunt','Grandfather','Grandmother','Other'].map(item => <option key={item}>{item}</option>)}</select></label><label>Annual Income<select value={form.annualIncome} onChange={e => update('annualIncome', e.target.value)}><option value="">Select</option>{['Below ₹1 Lakh','₹1-3 Lakh','₹3-5 Lakh','₹5-8 Lakh','₹8-10 Lakh','₹10-25 Lakh','Above ₹25 Lakh'].map(item => <option key={item}>{item}</option>)}</select></label><label>No. of Siblings<input type="number" min="0" value={form.siblings} onChange={e => update('siblings', e.target.value)} /></label><label>Sibling in same school?<select value={form.siblingInSameSchool ? 'Yes' : 'No'} onChange={e => update('siblingInSameSchool', e.target.value === 'Yes')}><option>No</option><option>Yes</option></select></label>{form.siblingInSameSchool && <label>Sibling Admission No<input value={form.siblingAdmNo} onChange={e => update('siblingAdmNo', e.target.value)} /></label>}</div>)}
    {section('address', 'Section 6: Address', <><div className="admission-grid four"><label className="full">Residence Address*<textarea required value={form.address} onChange={e => update('address', e.target.value)} /></label><label>City / Village*<input required value={form.city} onChange={e => update('city', e.target.value)} /></label><label>State*<select required value={form.state} onChange={e => update('state', e.target.value)}><option value="">Select state</option>{indianStates.map(item => <option key={item}>{item}</option>)}</select></label><label>District*<input required value={form.district} onChange={e => update('district', e.target.value)} /></label><label>Pincode*<input required value={form.pincode} onChange={e => update('pincode', onlyDigits(e.target.value, 6))} /></label></div><label className="check-line"><input type="checkbox" checked={permanentAddress} onChange={e => setPermanentAddress(e.target.checked)} /> Permanent address same as residence</label>{!permanentAddress && <label className="permanent-field">Permanent Address<textarea value={form.permanentAddress || ''} onChange={e => update('permanentAddress', e.target.value)} /></label>}</>)}
    {form.admissionType === 'new' && section('previous', 'Section 7: Previous School', <div className="admission-grid four"><label>Previous School Name<input value={form.previousSchool} onChange={e => update('previousSchool', e.target.value)} /></label><label>Previous Class<select value={form.previousClass} onChange={e => update('previousClass', e.target.value)}><option value="">Select</option>{classOptions.map(item => <option key={item}>{item}</option>)}</select></label><label>Previous TC Number<input value={form.previousTCNo} onChange={e => update('previousTCNo', e.target.value)} /></label><label>Previous TC Date<DatePicker value={form.previousTCDate} onChange={value => update('previousTCDate', value)} /></label><label className="full">Reason for Leaving<input value={form.reasonForLeaving} onChange={e => update('reasonForLeaving', e.target.value)} /></label></div>)}
    {section('transport', 'Section 8: Transport', <div className="admission-grid four"><label>Transport Required?<select value={form.transportRequired ? 'Yes' : 'No'} onChange={e => update('transportRequired', e.target.value === 'Yes')}><option>No</option><option>Yes</option></select></label>{form.transportRequired && <><label>Route<input value={form.routeName} onChange={e => update('routeName', e.target.value)} /></label><label>Stop<input value={form.stopName} onChange={e => update('stopName', e.target.value)} /></label><label>Pickup Time<input value={form.pickupTime} onChange={e => update('pickupTime', e.target.value)} /></label><label>Drop Time<input value={form.dropTime} onChange={e => update('dropTime', e.target.value)} /></label></>}</div>)}
    {section('documents', 'Section 9: Documents Upload', <div className="document-placeholder-grid">{['Birth Certificate','Aadhaar Card','Transfer Certificate','Caste Certificate','Category Certificate','Disability Certificate','Previous Marksheet','Parent ID Proof'].map(item => <div key={item}><FileText size={18} /><strong>{item}</strong><small>Upload support is available in Student Profile documents tab after saving.</small></div>)}</div>)}
    <div className="admission-options panel"><div className="sms-toggle"><button type="button" className={!form.smsEnabled ? 'active' : ''} onClick={() => update('smsEnabled', false)}>Don&apos;t Send SMS</button><button type="button" className={form.smsEnabled ? 'active' : ''} onClick={() => update('smsEnabled', true)}>Send SMS</button></div><label className="check-line"><input type="checkbox" checked={form.confirmDetails} onChange={e => update('confirmDetails', e.target.checked)} /> I confirm all details are correct</label></div>
    {success && <div className="admission-success"><strong>Student Registered Successfully!</strong><span>Admission Number: {success.admissionNo}</span><span>School Code: {success.schoolCode}</span><span>Parent Login: {success.phone || 'Father phone'} / Password: {success.password}</span><button type="button" className="secondary-button" onClick={() => window.print()}><Printer size={15} /> Print Admission Form</button></div>}
    {submitError && <div className="form-error">{submitError}</div>}
    <button className="primary-button admission-submit" disabled={saving || numberLoading}><Save size={16} /> {saving ? 'Saving...' : 'Submit'}</button>
  </form>
}

function StudentRegisterTable({ students }) {
  return <div className="panel table-panel"><div className="table-scroll"><table><thead><tr><th>Student</th><th>Admission No.</th><th>Class</th><th>Father</th><th>Mobile</th><th>Admission</th><th>Status</th></tr></thead><tbody>
    {students.map(student => <tr key={student.id}><td><div className="student-cell"><StudentAvatar student={student} /><strong>{student.name}</strong></div></td><td>{student.roll}</td><td>{student.className}</td><td>{student.fatherName || student.guardian}</td><td>{student.phone}</td><td>{student.admissionType}</td><td><span className={`status ${student.active ? 'paid' : 'overdue'}`}>{student.active ? 'Active' : 'Inactive'}</span></td></tr>)}
    {!students.length && <tr><td colSpan="7"><div className="empty-state">No students found.</div></td></tr>}
  </tbody></table></div></div>
}

function AdmissionRegister({ students, compact = false }) {
  const [query, setQuery] = useState('')
  const [type, setType] = useState(compact ? 'All Students' : 'Active Students')
  const [admissionType, setAdmissionType] = useState('All')
  const [category, setCategory] = useState('All categories')
  const filtered = students.filter(student =>
    `${student.name} ${student.roll} ${student.phone}`.toLowerCase().includes(query.toLowerCase()) &&
    (type !== 'Active Students' || student.active) &&
    (admissionType === 'All' || (admissionType === 'New' ? student.admissionType === 'New' : student.admissionType !== 'New')) &&
    (category === 'All categories' || student.feeGroup === category)
  )
  return <>
    <div className="register-filters panel">
      <label>Search By<select value={type} onChange={e => setType(e.target.value)}><option>Active Students</option><option>All Students</option></select></label>
      {!compact && <label>Admission Type<select value={admissionType} onChange={e => setAdmissionType(e.target.value)}><option>All</option><option>New</option><option>Except New</option></select></label>}
      {!compact && <label>Select Category<select value={category} onChange={e => setCategory(e.target.value)}><option>All categories</option><option>Standard</option><option>Transport</option><option>Hostel</option><option>RTE</option></select></label>}
      <label className="filter-search">Student Search<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Name, admission no. or mobile" /></label>
      <button className="primary-button"><Search size={16} /> Search</button>
    </div>
    <StudentRegisterTable students={filtered} />
  </>
}

function EnquiryModule({ enquiries, onSaveEnquiry }) {
  const [tab, setTab] = useState('Enquiry')
  const [status, setStatus] = useState('Pending')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [form, setForm] = useState({ name: '', className: 'Nursery-A', fatherName: '', motherName: '', dob: '', mobile: '', aadhaar: '', status: 'Pending' })
  const filtered = enquiries.filter(item => (!status || item.status === status) && (!from || item.createdDate >= from) && (!to || item.createdDate <= to))
  const submit = async event => {
    event.preventDefault()
    await onSaveEnquiry(form)
    setForm(current => ({ ...current, name: '', fatherName: '', motherName: '', mobile: '', aadhaar: '' }))
  }
  return <>
    <div className="sub-tabs"><button className={tab === 'Enquiry' ? 'active' : ''} onClick={() => setTab('Enquiry')}>Enquiry</button><button className={tab === 'Facility' ? 'active' : ''} onClick={() => setTab('Facility')}>Facility</button></div>
    {tab === 'Enquiry' ? <>
      <form className="panel enquiry-entry" onSubmit={submit}>
        <div className="admission-grid four"><label>Name*<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label><label>Class<select value={form.className} onChange={e => setForm({ ...form, className: e.target.value })}>{admissionClasses.map(item => <option key={item}>{item}</option>)}</select></label><label>Father Name<input value={form.fatherName} onChange={e => setForm({ ...form, fatherName: e.target.value })} /></label><label>Mother Name<input value={form.motherName} onChange={e => setForm({ ...form, motherName: e.target.value })} /></label><label>DOB<DatePicker max={today()} value={form.dob} onChange={value => setForm({ ...form, dob: value })} /></label><label>Mobile No.*<input required value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} /></label><label>Aadhaar Card<input value={form.aadhaar} onChange={e => setForm({ ...form, aadhaar: e.target.value })} /></label><label>Status<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option>Pending</option><option>Confirmed</option><option>Rejected</option></select></label></div>
        <button className="primary-button"><Plus size={16} /> Add enquiry</button>
      </form>
      <div className="register-filters panel"><label>Select Status<select value={status} onChange={e => setStatus(e.target.value)}><option>Pending</option><option>Confirmed</option><option>Rejected</option><option value="">All Status</option></select></label><label>From Date<DatePicker value={from} onChange={setFrom} /></label><label>To Date<DatePicker min={from} value={to} onChange={setTo} /></label><button className="primary-button"><Search size={16} /> Search</button><button className="secondary-button" onClick={() => { setStatus(''); setFrom(''); setTo('') }}>Clear</button></div>
      <div className="share-link"><Link2 size={15} /><span>{`${location.origin}/?admission=enquiry`}</span><button className="text-button" onClick={() => navigator.clipboard?.writeText(`${location.origin}/?admission=enquiry`)}>Copy link</button></div>
      <div className="panel table-panel"><div className="table-scroll"><table><thead><tr><th>Name</th><th>Class</th><th>Father Name</th><th>Mother Name</th><th>DOB</th><th>Mobile No</th><th>Aadhaar Card</th><th>Status</th></tr></thead><tbody>{filtered.map(item => <tr key={item.id}><td>{item.name}</td><td>{item.className}</td><td>{item.fatherName}</td><td>{item.motherName}</td><td>{item.dob}</td><td>{item.mobile}</td><td>{item.aadhaar}</td><td><span className={`status ${item.status === 'Confirmed' ? 'paid' : item.status === 'Rejected' ? 'overdue' : 'pending'}`}>{item.status}</span></td></tr>)}{!filtered.length && <tr><td colSpan="8"><div className="empty-state">No enquiries found.</div></td></tr>}</tbody></table></div></div>
    </> : <div className="panel facility-panel"><h3>Admission facilities</h3><p>Transport, hostel, day-care and scholarship requirements can be captured during counselling.</p><div className="facility-grid">{['School Transport','Hostel','Day Care','Scholarship'].map(item => <label key={item}><input type="checkbox" /> {item}</label>)}</div></div>}
  </>
}

function Admissions({ students, enquiries, onAddStudent, onUpdateStudent, onSaveEnquiry, getNextAdmissionNumber, school }) {
  const [page, setPage] = useState('add')
  const tabs = [['add','Add Student'],['master','Master Register'],['enquiry','Enquiry Form'],['register','Student Register']]
  return <>
    <div className="section-actions"><div><h2>Admission management</h2><p>Applications, enquiries and student registers in one workspace.</p></div></div>
    <div className="admission-tabs">{tabs.map(([id,label]) => <button key={id} className={page === id ? 'active' : ''} onClick={() => setPage(id)}>{label}</button>)}</div>
    {page === 'add' && <AdmissionForm students={students} onAddStudent={onAddStudent} onUpdateStudent={onUpdateStudent} onOpenRegister={() => setPage('master')} getNextAdmissionNumber={getNextAdmissionNumber} school={school} />}
    {page === 'master' && <AdmissionRegister students={students} />}
    {page === 'enquiry' && <EnquiryModule enquiries={enquiries} onSaveEnquiry={onSaveEnquiry} />}
    {page === 'register' && <AdmissionRegister students={students} compact />}
  </>
}

function Attendance({ students, attendance, onSaveAttendance }) {
  const [date, setDate] = useState(today())
  const [className, setClassName] = useState('')
  const [section, setSection] = useState('')
  const [search, setSearch] = useState('')
  const [marks, setMarks] = useState({})
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const classOptions = Array.from(new Set(students.map(student => splitClassSection(student.className).className).filter(Boolean))).sort()
  const sectionOptions = Array.from(new Set(students.filter(student => !className || splitClassSection(student.className).className === className).map(student => splitClassSection(student.className).section).filter(Boolean))).sort()
  const selectedStudents = students.filter(student => {
    const parts = splitClassSection(student.className)
    return parts.className === className && parts.section === section
  })
  const existingForDate = attendance[date] || {}
  const hasExisting = selectedStudents.some(student => existingForDate[student.id])
  const filteredStudents = selectedStudents.filter(student => `${student.name} ${student.roll} ${student.phone}`.toLowerCase().includes(search.trim().toLowerCase()))

  useEffect(() => {
    if (!className && classOptions.length) setClassName(classOptions[0])
  }, [className, classOptions])

  useEffect(() => {
    if (!sectionOptions.includes(section)) setSection(sectionOptions[0] || '')
  }, [section, sectionOptions])

  useEffect(() => {
    if (!className || !section) {
      setMarks({})
      return
    }
    setMarks(Object.fromEntries(selectedStudents.map(student => [student.id, normalizeAttendanceStatus(existingForDate[student.id] || 'P')])))
    setMessage('')
    setError('')
  }, [className, section, date, attendance, selectedStudents.length])

  const counts = selectedStudents.reduce((summary, student) => {
    const mark = normalizeAttendanceStatus(marks[student.id] || 'P')
    if (mark === 'A') summary.absent += 1
    else if (mark === 'L') summary.leave += 1
    else summary.present += 1
    return summary
  }, { total: selectedStudents.length, present: 0, absent: 0, leave: 0 })
  const rate = counts.total ? Math.round((counts.present / counts.total) * 100) : 0
  const updateOne = (studentId, status) => setMarks(current => ({ ...current, [studentId]: status }))
  const submit = async () => {
    setMessage('')
    setError('')
    if (!className || !section || !date) {
      setError('Please select class, section and date first.')
      return
    }
    if (!selectedStudents.length) {
      setError('No students found for this class and section.')
      return
    }
    const completeMarks = Object.fromEntries(selectedStudents.map(student => [student.id, normalizeAttendanceStatus(marks[student.id] || 'P')]))
    setSaving(true)
    try {
      await onSaveAttendance(completeMarks, date, { className, section })
      setMessage(hasExisting ? 'Attendance updated successfully.' : 'Attendance saved successfully.')
    } catch (err) {
      console.error('Attendance save failed', err)
      setError(err.message || 'Attendance could not be saved. Please retry.')
    } finally {
      setSaving(false)
    }
  }
  return <>
    <div className="section-actions"><div><h2>Smart attendance</h2><p>{readableDate(date)} · Mark by exception: everyone is Present unless changed.</p></div><button className="primary-button" onClick={submit} disabled={saving || !selectedStudents.length}>{saving ? <Clock3 size={17} /> : <Save size={17} />}{saving ? 'Saving...' : hasExisting ? 'Update attendance' : 'Submit attendance'}</button></div>
    <div className="panel attendance-filter-panel">
      <label>Class<select value={className} onChange={event => setClassName(event.target.value)}><option value="">Select class</option>{classOptions.map(item => <option key={item}>{item}</option>)}</select></label>
      <label>Section<select value={section} onChange={event => setSection(event.target.value)}><option value="">Select section</option>{sectionOptions.map(item => <option key={item}>{item}</option>)}</select></label>
      <div className="attendance-date-field"><span>Date</span><DatePicker value={date} onChange={setDate} max={today()} /></div>
      <label className="attendance-search">Search student<div className="table-search"><Search size={15} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, admission no. or phone" /></div></label>
    </div>
    <div className="attendance-note"><Check size={15} /> All unselected students will be marked Present automatically. Existing attendance for the same class, section and date loads here for editing.</div>
    {error && <div className="attendance-alert error">{error}</div>}
    {message && <div className="attendance-alert success">{message}</div>}
    <div className="attendance-summary smart"><div><strong>{counts.total}</strong><span>Total students</span></div><div className="present"><strong>{counts.present}</strong><span>Present</span></div><div className="absent"><strong>{counts.absent}</strong><span>Absent</span></div><div className="leave"><strong>{counts.leave}</strong><span>Leave</span></div><div><strong>{rate}%</strong><span>Attendance rate</span></div></div>
    <div className="panel table-panel">
      <div className="table-toolbar"><div><strong>{className && section ? `${className}-${section}` : 'Select class and section'}</strong><small>{hasExisting ? 'Edit mode: saved attendance loaded' : `${selectedStudents.length} students defaulted to Present`}</small></div><div className="toolbar-actions"><button className="secondary-button" onClick={() => setMarks(Object.fromEntries(selectedStudents.map(student => [student.id, 'P'])))} disabled={!selectedStudents.length}>Reset all present</button></div></div>
      <div className="attendance-list smart-list">{filteredStudents.map(s => {
        const selected = normalizeAttendanceStatus(marks[s.id] || 'P')
        return <div className="attendance-row smart-row" key={s.id}><div className="student-cell"><span className={`avatar tone-${s.tone}`}>{s.initials}</span><div><strong>{s.name}</strong><small>Adm/Roll: {s.roll} · {s.className}</small></div></div><div className="mark-control">{['P','A','L'].map(mark => <button key={mark} className={selected === mark ? `selected ${mark}` : ''} onClick={() => updateOne(s.id, mark)}>{mark === 'P' ? 'Present' : mark === 'A' ? 'Absent' : 'Leave'}</button>)}</div></div>
      })}{!filteredStudents.length && <div className="empty-state">{className && section ? 'No students match this search.' : 'Select class and section to load students.'}</div>}</div>
    </div>
    <AttendanceHistory attendance={attendance} students={students} onDateClick={setDate} />
  </>
}

function AttendanceHistory({ attendance, students, onDateClick }) {
  const dates = Object.keys(attendance).filter(d => d && Object.keys(attendance[d] || {}).length).sort().reverse().slice(0, 30)
  if (!dates.length) return null
  return <div className="panel" style={{ marginTop: 14 }}>
    <div className="table-toolbar"><div><strong>Past attendance records</strong><small>{dates.length} dates with saved attendance · click a date to edit</small></div></div>
    <div className="table-scroll"><table><thead><tr><th>Date</th><th>Present</th><th>Absent</th><th>Leave</th><th>Total marked</th><th>Rate</th><th></th></tr></thead><tbody>
      {dates.map(d => {
        const records = attendance[d] || {}
        const entries = Object.values(records)
        const present = entries.filter(v => normalizeAttendanceStatus(v) === 'P').length
        const absent = entries.filter(v => normalizeAttendanceStatus(v) === 'A').length
        const leave = entries.filter(v => normalizeAttendanceStatus(v) === 'L').length
        const total = entries.length
        const pct = total ? Math.round((present / total) * 100) : 0
        return <tr key={d}>
          <td><strong>{readableDate(d)}</strong></td>
          <td style={{ color: '#168357' }}>{present}</td>
          <td style={{ color: '#d14343' }}>{absent}</td>
          <td style={{ color: '#c17a20' }}>{leave}</td>
          <td>{total}</td>
          <td><span className={`status ${pct >= 75 ? 'paid' : 'overdue'}`}>{pct}%</span></td>
          <td><button className="text-button" onClick={() => onDateClick(d)}>View / Edit</button></td>
        </tr>
      })}
    </tbody></table></div>
  </div>
}

function PaymentModal({ students, close, onRecordPayment }) {
  const pending = students.filter(student => student.fee !== 'Paid')
  const [form, setForm] = useState({ studentId: pending[0]?.id || '', amount: 18500, method: 'UPI' })
  const [saving, setSaving] = useState(false)
  const submit = async event => {
    event.preventDefault()
    setSaving(true)
    try { await onRecordPayment(form.studentId, Number(form.amount), form.method); close() } finally { setSaving(false) }
  }
  return <div className="modal-backdrop"><form className="modal" onSubmit={submit}>
    <div className="modal-header"><div><h3>Record fee payment</h3><p>Create a receipt and update the student ledger.</p></div><button type="button" className="icon-button" onClick={close}><X size={19} /></button></div>
    <div className="form-grid">
      <label className="full">Student<select required value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })}>{pending.map(student => <option value={student.id} key={student.id}>{student.name} Â· {student.roll}</option>)}</select></label>
      <label>Amount<input required type="number" min="1" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></label>
      <label>Payment method<select value={form.method} onChange={e => setForm({ ...form, method: e.target.value })}><option>UPI</option><option>Cash</option><option>Card</option><option>Bank transfer</option></select></label>
    </div>
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={close}>Cancel</button><button className="primary-button" disabled={saving}><Receipt size={16} /> {saving ? 'Recording...' : 'Record payment'}</button></div>
  </form></div>
}

function LegacyFees({ students, fees, onRecordPayment }) {
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const total = students.length * 18500
  const collected = Object.values(fees).filter(fee => fee.status === 'paid').reduce((sum, fee) => sum + Number(fee.amount || 0), 0)
  const filtered = students.filter(student => `${student.name} ${student.roll} ${student.className}`.toLowerCase().includes(search.trim().toLowerCase()))
  return <>
    <div className="section-actions"><div><h2>Fee management</h2><p>Track collections, pending dues and receipts.</p></div><button className="primary-button" onClick={() => setModal(true)} disabled={!students.some(student => student.fee !== 'Paid')}><Plus size={17} /> Record payment</button></div>
    <section className="stat-grid fee-stats"><Stat label="Total billed" value={money(total)} note="Current billing cycle" icon={IndianRupee} color="blue" /><Stat label="Collected" value={money(collected)} note={`${total ? Math.round(collected/total*100) : 0}% collection rate`} icon={Check} color="green" trend /><Stat label="Pending" value={money(Math.max(0, total-collected))} note={`${students.filter(s => s.fee !== 'Paid').length} student accounts`} icon={Bell} color="orange" /></section>
    <div className="panel table-panel"><div className="table-toolbar"><div><strong>Student fee ledger</strong><small>Monthly tuition fee</small></div><div className="table-search"><Search size={16} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ledger" /></div></div><div className="table-scroll"><table><thead><tr><th>Student</th><th>Invoice</th><th>Amount</th><th>Paid on</th><th>Status</th><th>Action</th></tr></thead><tbody>
      {filtered.map(s => { const fee = fees[`${s.id}_2026-06`]; return <tr key={s.id}><td><div className="student-cell"><span className={`avatar tone-${s.tone}`}>{s.initials}</span><div><strong>{s.name}</strong><small>{s.className}</small></div></div></td><td>{fee?.invoiceNumber || `INV-202606-${s.roll.replace(/\D/g, '').slice(-4)}`}</td><td><strong>{money(fee?.amount || 18500)}</strong></td><td>{fee?.paidAt ? new Date(fee.paidAt).toLocaleDateString('en-IN') : 'â€”'}</td><td><span className={`status ${s.fee.toLowerCase()}`}>{s.fee}</span></td><td>{s.fee !== 'Paid' ? <button className="text-button" onClick={() => onRecordPayment(s.id, 18500, 'UPI')}>Mark paid</button> : <button className="text-button muted" title={fee?.method || 'Payment received'}><Receipt size={14} /> Receipt</button>}</td></tr> })}
      {!filtered.length && <tr><td colSpan="6"><div className="empty-state">No ledger entries match this search.</div></td></tr>}
    </tbody></table></div></div>
    {modal && <PaymentModal students={students} close={() => setModal(false)} onRecordPayment={onRecordPayment} />}
  </>
}

function PeriodModal({ initial, className, close, onSave }) {
  const [form, setForm] = useState(initial || { day: 'Monday', time: '08:00', subject: '', teacher: '', room: '' })
  const [saving, setSaving] = useState(false)
  const submit = async event => {
    event.preventDefault()
    setSaving(true)
    try { await onSave(className, form); close() } finally { setSaving(false) }
  }
  return <div className="modal-backdrop"><form className="modal" onSubmit={submit}>
    <div className="modal-header"><div><h3>{initial?.subject ? 'Edit period' : 'Add period'}</h3><p>{className} weekly timetable</p></div><button type="button" className="icon-button" onClick={close} aria-label="Close period form"><X size={19} /></button></div>
    <div className="form-grid">
      <label>Day<select value={form.day} onChange={e => setForm({ ...form, day: e.target.value })}>{['Monday','Tuesday','Wednesday','Thursday','Friday'].map(day => <option key={day}>{day}</option>)}</select></label>
      <label>Time<input required type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} /></label>
      <label className="full">Subject<input required value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} /></label>
      <label>Teacher<input required value={form.teacher} onChange={e => setForm({ ...form, teacher: e.target.value })} /></label>
      <label>Room<input required value={form.room} onChange={e => setForm({ ...form, room: e.target.value })} /></label>
    </div>
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={close}>Cancel</button><button className="primary-button" disabled={saving}><Save size={16} /> {saving ? 'Saving...' : 'Save period'}</button></div>
  </form></div>
}

function WeeklyPlanner({ timetableData, onSavePeriod }) {
  const classes = Object.keys(timetableData).length ? Object.keys(timetableData) : ['10-A']
  const [className, setClassName] = useState(classes[0])
  const [editing, setEditing] = useState(null)
  const periods = timetableData[className] || []
  const times = [...new Set(periods.map(period => period.time))].sort()
  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday']
  return <>
    <div className="section-actions"><div><h2>Academic planner</h2><p>Class timetable and teaching schedule for this week.</p></div><button className="primary-button" onClick={() => setEditing({})}><Plus size={17} /> Add period</button></div>
    <div className="academic-banner"><div><span className="eyebrow">Current term</span><h3>Term I Â· 2026-27</h3><p>72 instructional days Â· 4 assessments planned</p></div><div className="term-progress"><span>Term progress <strong>38%</strong></span><div className="progress"><i style={{width:'38%'}} /></div></div></div>
    <div className="panel timetable-panel"><div className="panel-header"><div><h3>Weekly timetable</h3><p>Class {className} Â· Click any period to edit</p></div><select value={className} onChange={e => setClassName(e.target.value)}>{classes.map(item => <option key={item}>{item}</option>)}</select></div><div className="table-scroll"><table className="timetable"><thead><tr><th>Time</th>{days.map(d => <th key={d}>{d}</th>)}</tr></thead><tbody>{times.map(time => <tr key={time}><td><strong>{time}</strong></td>{days.map((day, i) => { const period = periods.find(item => item.time === time && item.day === day); return <td key={day}>{period ? <button className="period-button" onClick={() => setEditing(period)}><span className={`subject s${i}`}>{period.subject}</span><small>{period.teacher} Â· {period.room}</small></button> : <button className="empty-period" onClick={() => setEditing({ day, time })}>+ Add</button>}</td> })}</tr>)}</tbody></table>{!times.length && <div className="empty-state">No periods yet. Add the first period for {className}.</div>}</div></div>
    {editing && <PeriodModal initial={editing.subject ? editing : { day: editing.day || 'Monday', time: editing.time || '08:00', subject: '', teacher: '', room: '' }} className={className} close={() => setEditing(null)} onSave={onSavePeriod} />}
  </>
}

function Academics({ timetableData, timetableRecords, students, onSavePeriod, onSaveTimetable, onDeleteTimetable }) {
  const [view, setView] = useState('records')
  return <>
    <div className="section-actions"><div><h2>Timetable</h2><p>Upload published schedules and manage the weekly teaching plan.</p></div></div>
    <div className="sub-tabs timetable-subtabs"><button className={view === 'records' ? 'active' : ''} onClick={() => setView('records')}>Add Timetable</button><button className={view === 'weekly' ? 'active' : ''} onClick={() => setView('weekly')}>Weekly Planner</button></div>
    {view === 'records'
      ? <TimetableManager records={timetableRecords} students={students} saveRecord={onSaveTimetable} deleteRecord={onDeleteTimetable} />
      : <WeeklyPlanner timetableData={timetableData} onSavePeriod={onSavePeriod} />}
  </>
}

function Notices({ notices, onAddNotice }) {
  const [form, setForm] = useState({ title: '', detail: '', audience: 'Entire school', type: 'Notice', priority: 'Normal' })
  const [filter, setFilter] = useState('All audiences')
  const [saving, setSaving] = useState(false)
  const filtered = notices.filter(notice => filter === 'All audiences' || notice.audience === filter)
  const add = async e => {
    e.preventDefault()
    if (!form.title.trim() || !form.detail.trim()) return
    setSaving(true)
    try {
      await onAddNotice({ ...form, date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) })
      setForm({ title: '', detail: '', audience: 'Entire school', type: 'Notice', priority: 'Normal' })
    } finally { setSaving(false) }
  }
  return <>
    <div className="section-actions"><div><h2>Notices & communication</h2><p>Publish announcements for students, parents and staff.</p></div></div>
    <div className="notice-layout">
      <form className="panel compose-panel" onSubmit={add}><div className="panel-header"><div><h3>Create announcement</h3><p>Share an update with your school community.</p></div></div><label>Announcement title<input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="What would you like to announce?" /></label><label>Audience<select value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value })}><option>Entire school</option><option>Students only</option><option>Staff only</option></select></label><label>Message<textarea required value={form.detail} onChange={e => setForm({ ...form, detail: e.target.value })} placeholder="Write the announcement details..." /></label><button className="primary-button" disabled={saving}><MessageSquareText size={16} /> {saving ? 'Publishing...' : 'Publish notice'}</button></form>
      <div className="panel notice-feed"><div className="panel-header"><div><h3>Published notices</h3><p>{filtered.length} active announcements</p></div><select value={filter} onChange={e => setFilter(e.target.value)}><option>All audiences</option><option>Entire school</option><option>Students only</option><option>Staff only</option></select></div>{filtered.map(n => <article key={n.id}><div className="notice-meta"><span className="class-pill">{n.type}</span><time>{n.date}</time></div><h4>{n.title}</h4><p>{n.detail}</p><div className="notice-footer"><span>{n.audience}</span><button className="icon-button"><MoreHorizontal size={17} /></button></div></article>)}{!filtered.length && <div className="empty-state">No notices for this audience.</div>}</div>
    </div>
  </>
}

const tones = ['blue', 'violet', 'green', 'orange', 'cyan', 'pink']

function studentFromRow(row, index) {
  const fullName = row.full_name || row.name || row.fullName || ''
  const className = row.class_name || row.class || row.className || ''
  const section = row.section || 'A'
  const initials = fullName ? fullName.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase() : '?'
  const classLabel = `${className}-${section}`
  return {
    id: row.id,
    name: fullName,
    roll: row.admission_number || row.admissionNo || row.roll || '',
    admissionNo: row.admission_number || row.admissionNo || row.roll || '',
    className: classLabel,
    guardian: row.guardian_name || row.fatherName || row.father_name || 'Not provided',
    phone: row.guardian_phone || row.fatherPhone || row.father_phone || row.phone || 'Not provided',
    attendance: row.attendance_rate || 100,
    fee: row.fee_status || 'Pending',
    createdAt: row.createdAt || 0,
    admissionScheme: row.admission_scheme || 'General',
    admissionDate: row.admission_date || '',
    admissionType: row.admission_type || 'New',
    fatherName: row.father_name || row.guardian_name || '',
    motherName: row.mother_name || '',
    gender: row.gender || '',
    dob: row.date_of_birth || '',
    email: row.email || '',
    state: row.state || '',
    city: row.city || '',
    address: row.address || '',
    pincode: row.pincode || '',
    aadhaar: row.aadhaar || '',
    penId: row.pen_id || '',
    apaarId: row.apaar_id || '',
    feeGroup: row.fee_group || 'Standard',
    academicSession: row.academic_session || row.academicSession || '',
    rollNumber: row.roll_number || row.rollNumber || '',
    bloodGroup: row.blood_group || row.bloodGroup || '',
    height: row.height || '',
    weight: row.weight || '',
    motherTongue: row.mother_tongue || row.motherTongue || '',
    nationality: row.nationality || 'Indian',
    religion: row.religion || '',
    caste: row.caste || '',
    subCaste: row.sub_caste || row.subCaste || '',
    category: row.category || row.admission_scheme || '',
    categoryCertNo: row.category_cert_no || row.categoryCertNo || '',
    categoryCertURL: row.category_cert_url || row.categoryCertURL || '',
    isDisabled: row.is_disabled || row.isDisabled || false,
    disabilityType: row.disability_type || row.disabilityType || [],
    disabilityPercentage: row.disability_percentage || row.disabilityPercentage || '',
    disabilityCertNo: row.disability_cert_no || row.disabilityCertNo || '',
    disabilityCertURL: row.disability_cert_url || row.disabilityCertURL || '',
    udidNo: row.udid_no || row.udidNo || '',
    scribeRequired: row.scribe_required || row.scribeRequired || false,
    extraExamTime: row.extra_exam_time || row.extraExamTime || false,
    specialEquipment: row.special_equipment || row.specialEquipment || '',
    disabilityRemarks: row.disability_remarks || row.disabilityRemarks || '',
    fatherOccupation: row.father_occupation || row.fatherOccupation || '',
    fatherQualification: row.father_qualification || row.fatherQualification || '',
    fatherPhone: row.father_phone || row.fatherPhone || row.guardian_phone || '',
    fatherEmail: row.father_email || row.fatherEmail || '',
    fatherAadhaar: row.father_aadhaar || row.fatherAadhaar || '',
    motherOccupation: row.mother_occupation || row.motherOccupation || '',
    motherQualification: row.mother_qualification || row.motherQualification || '',
    motherPhone: row.mother_phone || row.motherPhone || '',
    motherEmail: row.mother_email || row.motherEmail || '',
    motherAadhaar: row.mother_aadhaar || row.motherAadhaar || '',
    guardianPhone: row.guardian_phone || row.guardianPhone || '',
    guardianRelation: row.guardian_relation || row.guardianRelation || '',
    annualIncome: row.annual_income || row.annualIncome || '',
    siblings: row.siblings || 0,
    siblingInSameSchool: row.sibling_in_same_school || row.siblingInSameSchool || false,
    siblingAdmNo: row.sibling_adm_no || row.siblingAdmNo || '',
    district: row.district || '',
    permanentAddress: row.permanent_address || row.permanentAddress || '',
    previousSchool: row.previous_school || row.previousSchool || '',
    previousClass: row.previous_class || row.previousClass || '',
    previousTCNo: row.previous_tc_no || row.previousTCNo || '',
    previousTCDate: row.previous_tc_date || row.previousTCDate || '',
    previousTCURL: row.previous_tc_url || row.previousTCURL || '',
    reasonForLeaving: row.reason_for_leaving || row.reasonForLeaving || '',
    transportRequired: row.transport_required || row.transportRequired || false,
    routeId: row.route_id || row.routeId || '',
    routeName: row.route_name || row.routeName || '',
    stopName: row.stop_name || row.stopName || '',
    pickupTime: row.pickup_time || row.pickupTime || '',
    dropTime: row.drop_time || row.dropTime || '',
    documents: row.documents || {},
    parentLoginPhone: row.parent_login_phone || row.parentLoginPhone || row.guardian_phone || '',
    parentPasswordDOB: row.parent_password_dob !== false,
    photoUrl: row.photo_url || row.photoURL || row.photo || row.image_url || '',
    photoPath: row.photo_path || row.photoPath || '',
    photoSize: row.photo_size || row.photoSize || 0,
    photoUpdatedAt: row.photo_updated_at || row.photoUpdatedAt || 0,
    smsEnabled: row.sms_enabled !== false,
    active: row.active !== false,
    initials,
    tone: tones[index % tones.length],
  }
}

function studentToRow(student) {
  const [className, section = 'A'] = String(student.className || '').split('-')
  return {
    full_name: student.name,
    admission_number: String(student.roll),
    class_name: className,
    section,
    guardian_name: student.guardian || '',
    guardian_phone: student.phone || '',
    attendance_rate: Number(student.attendance || 0),
    fee_status: student.fee || 'Pending',
    admission_scheme: student.admissionScheme || 'General',
    admission_date: student.admissionDate || '',
    admission_type: student.admissionType || 'New',
    father_name: student.fatherName || '',
    mother_name: student.motherName || '',
    gender: student.gender || '',
    date_of_birth: student.dob || '',
    email: student.email || '',
    state: student.state || '',
    city: student.city || '',
    address: student.address || '',
    pincode: student.pincode || '',
    aadhaar: student.aadhaar || '',
    pen_id: student.penId || '',
    apaar_id: student.apaarId || '',
    fee_group: student.feeGroup || 'Standard',
    academic_session: student.academicSession || '',
    roll_number: student.rollNumber || '',
    blood_group: student.bloodGroup || '',
    height: student.height || '',
    weight: student.weight || '',
    mother_tongue: student.motherTongue || '',
    nationality: student.nationality || 'Indian',
    religion: student.religion || '',
    caste: student.caste || '',
    sub_caste: student.subCaste || '',
    category: student.category || student.admissionScheme || '',
    category_cert_no: student.categoryCertNo || '',
    category_cert_url: student.categoryCertURL || '',
    is_disabled: Boolean(student.isDisabled),
    disability_type: student.disabilityType || [],
    disability_percentage: student.disabilityPercentage || '',
    disability_cert_no: student.disabilityCertNo || '',
    disability_cert_url: student.disabilityCertURL || '',
    udid_no: student.udidNo || '',
    scribe_required: Boolean(student.scribeRequired),
    extra_exam_time: Boolean(student.extraExamTime),
    special_equipment: student.specialEquipment || '',
    disability_remarks: student.disabilityRemarks || '',
    father_occupation: student.fatherOccupation || '',
    father_qualification: student.fatherQualification || '',
    father_phone: student.fatherPhone || student.phone || '',
    father_email: student.fatherEmail || '',
    father_aadhaar: student.fatherAadhaar || '',
    mother_occupation: student.motherOccupation || '',
    mother_qualification: student.motherQualification || '',
    mother_phone: student.motherPhone || '',
    mother_email: student.motherEmail || '',
    mother_aadhaar: student.motherAadhaar || '',
    guardian_relation: student.guardianRelation || '',
    annual_income: student.annualIncome || '',
    siblings: Number(student.siblings || 0),
    sibling_in_same_school: Boolean(student.siblingInSameSchool),
    sibling_adm_no: student.siblingAdmNo || '',
    district: student.district || '',
    permanent_address: student.permanentAddress || '',
    previous_school: student.previousSchool || '',
    previous_class: student.previousClass || '',
    previous_tc_no: student.previousTCNo || '',
    previous_tc_date: student.previousTCDate || '',
    previous_tc_url: student.previousTCURL || '',
    reason_for_leaving: student.reasonForLeaving || '',
    transport_required: Boolean(student.transportRequired),
    route_id: student.routeId || '',
    route_name: student.routeName || '',
    stop_name: student.stopName || '',
    pickup_time: student.pickupTime || '',
    drop_time: student.dropTime || '',
    documents: student.documents || {},
    parent_login_phone: student.parentLoginPhone || student.fatherPhone || student.phone || '',
    parent_password_dob: student.parentPasswordDOB !== false,
    photo_url: student.photoUrl || '',
    photo_path: student.photoPath || '',
    photo_size: Number(student.photoSize || 0),
    photo_updated_at: student.photoUpdatedAt || 0,
    sms_enabled: student.smsEnabled !== false,
    active: student.active !== false,
    createdAt: student.createdAt || Date.now(),
    updatedAt: Date.now(),
  }
}

const parentPhoneOf = student => onlyDigits(student.parentLoginPhone || student.fatherPhone || student.phone || student.guardianPhone || '').slice(-10)
const parentIdOf = phone => onlyDigits(phone).slice(-10)
const parentDobPassword = student => onlyDigits(student.dob || student.date_of_birth || '')
const textInitials = value => String(value || 'S').split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()
function buildParentAccount(existing = {}, studentId, student, schoolProfile = {}) {
  const phone = parentPhoneOf(student)
  const currentStudents = Array.isArray(existing.students)
    ? Object.fromEntries(existing.students.filter(Boolean).map(id => [id, true]))
    : { ...(existing.students || {}) }
  if (studentId) currentStudents[studentId] = true
  return {
    id: phone,
    phone,
    name: existing.name || student.fatherName || student.guardian || 'Parent',
    email: existing.email || student.fatherEmail || '',
    address: existing.address || student.address || '',
    students: currentStudents,
    schoolCode: schoolProfile.schoolCode || existing.schoolCode || '',
    mustChangePassword: existing.mustChangePassword !== false,
    fcmToken: existing.fcmToken || '',
    language: existing.language || 'english',
    status: existing.status || 'active',
    lastLogin: existing.lastLogin || null,
    passwordSetAt: existing.passwordSetAt || null,
    defaultDOB: existing.defaultDOB || parentDobPassword(student),
    createdAt: existing.createdAt || Date.now(),
    updatedAt: Date.now(),
  }
}

function noticeFromRow(row) {
  const published = row.publishAt || row.publish_at || Date.now()
  return {
    id: row.id,
    title: row.title,
    detail: row.body,
    date: new Date(published).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
    type: row.category,
    priority: row.priority,
    audience: row.audience === 'students' ? 'Students only' : row.audience === 'staff' ? 'Staff only' : row.audience || 'Entire school',
    publishAt: published,
  }
}

function useSchoolWorkspace(session) {
  const developmentDemo = !isFirebaseConfigured && import.meta.env.VITE_APP_ENV !== 'production'
  const [students, setStudents] = useStoredState('northstar-students', seedStudents)
  const [notices, setNotices] = useStoredState('northstar-notices', seedNotices)
  const [fees, setFees] = useStoredState('northstar-fees', {})
  const [attendance, setAttendance] = useStoredState('northstar-attendance-records', {})
  const [timetableData, setTimetableData] = useStoredState('northstar-timetable', defaultTimetable)
  const [timetableRecords, setTimetableRecords] = useState({})
  const [homework, setHomework] = useState({})
  const [transport, setTransport] = useState({ routes: {}, vehicles: {}, drivers: {}, allocations: {}, fees: {}, attendance: {}, settings: {} })
  const [library, setLibrary] = useState({ books: {}, issues: {}, returns: {}, categories: {}, settings: {}, fines: {} })
  const [accounts, setAccounts] = useState({})
  const [enquiries, setEnquiries] = useStoredState('northstar-enquiries', [])
  const [staff, setStaff] = useState({})
  const [staffAttendance, setStaffAttendance] = useState({})
  const [employeeConfig, setEmployeeConfig] = useState({ departments: {}, designations: {}, shifts: {} })
  const [leave, setLeave] = useState({})
  const [parents, setParents] = useState({})
  const [parentMessages, setParentMessages] = useState({})
  const [parentNotifications, setParentNotifications] = useState({})
  const [certificateRequests, setCertificateRequests] = useState({})
  const [approvals, setApprovals] = useState({ fees: {}, leaves: {} })
  const [expenses, setExpenses] = useState({})
  const [academics, setAcademics] = useState({})
  const [documents, setDocuments] = useState({})
  const [certificates, setCertificates] = useState({})
  const [certificateSettings, setCertificateSettings] = useState({})
  const [examData, setExamData] = useState({ exams: {}, dateSheet: {}, admitCards: {} })
  const [reportData, setReportData] = useState({ exams: {}, marks: {}, reports: {} })
  const [idCards, setIdCards] = useState({})
  const [idCardSettings, setIdCardSettings] = useState({})
  const [feeManager, setFeeManager] = useState({ groups: {}, structures: {}, fines: {}, settings: {}, deleted: {} })
  const [backupSettings, setBackupSettings] = useState({ enabled: false, email: session?.email || '', lastSentAt: 0 })
  const [activities, setActivities] = useState([])
  const [workspaceVersion, setWorkspaceVersion] = useState(0)
  const [workspace, setWorkspace] = useState({
    loading: Boolean(session && isFirebaseConfigured),
    schoolId: null,
    schoolName: 'Northstar Public School',
    schoolProfile: {},
    role: 'Administrator',
    staffCount: 1,
    needsSetup: false,
    error: '',
  })

  useEffect(() => {
    if (!session || !isFirebaseConfigured) return
    let active = true
    const controller = new AbortController()

    async function safeRequest(path, token, options) {
      try {
        return await databaseRequest(path, token, options)
      } catch (err) {
        if (!active) return undefined
        return null
      }
    }

    async function load() {
      setWorkspace(current => ({ ...current, loading: true, error: '' }))
      try {
        const token = await session.getIdToken()
        const ownSchoolId = session.uid
        let schoolId = ownSchoolId
        let workspaceRole = 'Owner'
        let canMaintainWorkspace = true
        let school = await safeRequest(`schools/${schoolId}`, token)
        if (!active) return
        const pendingProfile = JSON.parse(localStorage.getItem('northstar-pending-school-profile') || 'null')
        const legacyUser = await safeRequest(`users/${session.uid}`, token)
        const teacherIndex = !school?.profile ? await safeRequest(`teachersIndex/${session.uid}`, token) : null
        if (!active) return

        const linkedSchoolId = legacyUser?.schoolId || teacherIndex?.schoolId || ''
        if (!school?.profile && linkedSchoolId && linkedSchoolId !== schoolId) {
          const legacySchool = await safeRequest(`schools/${linkedSchoolId}`, token)
          if (!active) return
          if (legacySchool?.profile) {
            schoolId = linkedSchoolId
            school = legacySchool
            const linkedRole = legacyUser?.role || teacherIndex?.role || teacherIndex?.employeeRole || 'teacher'
            workspaceRole = roleLabel(linkedRole)
            canMaintainWorkspace = ['owner', 'admin', 'administrator'].includes(String(linkedRole || '').toLowerCase())
          } else if (legacySchool?.createdBy === session.uid) {
            const [legacyStudents, legacyFees, legacyAttendance, legacyNotices] = await Promise.all([
              databaseRequest(`students/${linkedSchoolId}`, token).catch(() => null),
              databaseRequest(`fees/${linkedSchoolId}`, token).catch(() => null),
              databaseRequest(`attendance/${linkedSchoolId}`, token).catch(() => null),
              databaseRequest(`notices/${linkedSchoolId}`, token).catch(() => null),
            ])
            school = {
              ...legacySchool,
              profile: {
                schoolName: legacySchool.name || 'My School',
                email: session.email || '',
                phone: '',
                address: '',
                logo: '',
                academicYear: legacySchool.academicYear || '2026-27',
                createdAt: legacySchool.createdAt || Date.now(),
              },
              students: legacyStudents || {},
              fees: legacyFees || {},
              attendance: legacyAttendance || {},
              notices: legacyNotices || {},
              migratedFrom: legacyUser.schoolId,
            }
            await databaseRequest(`schools/${schoolId}`, token, { method: 'PUT', body: school })
            await databaseRequest(`schoolMembers/${schoolId}/${session.uid}`, token, { method: 'PUT', body: {
              userId: session.uid,
              role: 'owner',
              status: 'active',
              createdAt: Date.now(),
            } }).catch(() => {})
          }
        }

        if (!school?.profile && pendingProfile) {
          await createSchoolRecord(session, token, pendingProfile)
          localStorage.removeItem('northstar-pending-school-profile')
          school = await safeRequest(`schools/${schoolId}`, token)
          if (!active) return
        }

        if (school === undefined) return

        if (!school?.profile) {
          if (active) setWorkspace(current => ({ ...current, loading: false, schoolId, needsSetup: true, error: '' }))
          return
        }

        if (canMaintainWorkspace && !school.profile.schoolCode) {
          const code = generateSchoolCode(school.profile.schoolName || school.name || 'School')
          await databaseRequest('', token, { method: 'PATCH', body: {
            [`schools/${schoolId}/profile/schoolCode`]: code,
            [`schoolCodes/${code}`]: { schoolId, schoolName: school.profile.schoolName || school.name || 'School', createdAt: Date.now() },
          } }).catch(() => {})
          school = { ...school, profile: { ...school.profile, schoolCode: code } }
        }

        if (canMaintainWorkspace && school.admissionSequenceVersion !== 1) {
          const orderedStudents = Object.entries(school.students || {}).sort(([, a], [, b]) => (a.createdAt || 0) - (b.createdAt || 0))
          const normalizedStudents = { ...(school.students || {}) }
          const admissionChanges = {
            [`schools/${schoolId}/admissionCounter`]: { lastIssued: orderedStudents.length, updatedAt: Date.now() },
            [`schools/${schoolId}/admissionSequenceVersion`]: 1,
          }
          orderedStudents.forEach(([studentId, row], index) => {
            const admissionNumber = String(index + 1)
            normalizedStudents[studentId] = { ...row, admission_number: admissionNumber }
            admissionChanges[`schools/${schoolId}/students/${studentId}/admission_number`] = admissionNumber
          })
          await databaseRequest('', token, { method: 'PATCH', body: admissionChanges })
          school = {
            ...school,
            students: normalizedStudents,
            admissionCounter: { lastIssued: orderedStudents.length, updatedAt: Date.now() },
            admissionSequenceVersion: 1,
          }
        }

        localStorage.setItem('northstar-school-id', schoolId)
        await databaseRequest(`schools/${schoolId}/lastLoginAt`, token, { method: 'PUT', body: Date.now() }).catch(() => {})
        await databaseRequest(`users/${session.uid}`, token, { method: 'PATCH', body: {
          uid: session.uid,
          schoolId,
          fullName: session.displayName || session.email.split('@')[0],
          email: session.email || '',
          photoURL: session.photoURL || '',
          role: legacyUser?.role || (schoolId === ownSchoolId ? 'owner' : 'teacher'),
          lastLoginAt: Date.now(),
        } }).catch(() => {})

        const studentData = school.students || {}
        const noticeData = school.notices || {}
        const feeData = school.fees || {}
        const attendanceData = school.attendance || {}
        if (!active) return
        const studentRows = Object.entries(studentData || {})
          .map(([id, row]) => ({ id, ...row }))
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        const noticeRows = Object.entries(noticeData || {})
          .map(([id, row]) => ({ id, ...row }))
          .sort((a, b) => (b.publishAt || 0) - (a.publishAt || 0))
        const attendanceByDate = Object.values(attendanceData || {}).reduce((dates, record) => {
          const studentId = record.studentId || record.student_id
          if (!studentId || !record.date) return dates
          dates[record.date] ||= {}
          dates[record.date][studentId] = normalizeAttendanceStatus(record.mark || record.status)
          return dates
        }, {})
        const nextFees = feeData || {}
        const nextActivities = [
          ...studentRows.map(row => ({ id: `student-${row.id}`, title: 'Student admitted', detail: `${row.full_name || row.name || ''} joined Class ${row.class_name || row.class || ''}-${row.section || 'A'}`, at: row.createdAt || 0, icon: '+' })),
          ...Object.entries(nextFees).map(([id, row]) => ({ id: `fee-${id}`, title: 'Fee payment received', detail: `${money(row.amount)} via ${row.method || 'payment'}`, at: row.paidAt || row.updatedAt || 0, icon: 'â‚¹' })),
          ...noticeRows.map(row => ({ id: `notice-${row.id}`, title: 'Notice published', detail: row.title, at: row.publishAt || 0, icon: 'N' })),
          ...Object.entries(attendanceData || {}).map(([id, row]) => ({ id: `attendance-${id}`, title: 'Attendance updated', detail: `${row.date} attendance marked`, at: row.updatedAt || 0, icon: 'âœ“' })),
        ].filter(item => item.at).sort((a, b) => b.at - a.at)
        setStudents(studentRows.map(studentFromRow))
        setNotices(noticeRows.map(noticeFromRow))
        setFees(nextFees)
        setAttendance(attendanceByDate)
        setTimetableData(school?.timetable || {})
        setTimetableRecords(school?.timetableRecords || {})
        setHomework(school?.homework || {})
        setTransport(school?.transport || { routes: {}, vehicles: {}, drivers: {}, allocations: {}, fees: {}, attendance: {}, settings: {} })
        setLibrary(school?.library || { books: {}, issues: {}, returns: {}, categories: {}, settings: {}, fines: {} })
        setAccounts(school?.accounts || {})
        setEnquiries(Object.entries(school?.enquiries || {}).map(([id, item]) => ({ id, ...item })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)))
        setStaff(school?.staff || {})
        setStaffAttendance(school?.staffAttendance || {})
        setEmployeeConfig(school?.employeeManager || { departments: {}, designations: {}, shifts: {} })
        setLeave(school?.leave || {})
        setParents(school?.parents || {})
        setParentMessages(school?.parentMessages || {})
        setParentNotifications(school?.parentNotifications || {})
        setCertificateRequests(school?.certificateRequests || {})
        setApprovals({ fees: school?.approvals?.fees || {}, leaves: school?.approvals?.leaves || {} })
        setExpenses(school?.expenses || {})
        setAcademics(school?.studentAcademics || {})
        setDocuments(school?.studentDocuments || {})
        setCertificates(school?.certificates || {})
        setCertificateSettings(school?.certificateSettings || {})
        setExamData({ exams: school?.exams || {}, dateSheet: school?.dateSheet || {}, admitCards: school?.admitCards || {} })
        setReportData({ exams: school?.reportExams || {}, marks: school?.reportMarks || {}, reports: school?.reportCards || {} })
        setIdCards(school?.idCards || {})
        setIdCardSettings(school?.idCardSettings || {})
        setFeeManager({
          groups: school?.feeManager?.groups || {},
          structures: school?.feeManager?.structures || {},
          fines: school?.feeManager?.fines || {},
          settings: school?.feeManager?.settings || {},
          deleted: school?.feeManager?.deleted || {},
        })
        setBackupSettings({ enabled: false, email: session.email || '', lastSentAt: 0, ...(school?.backupSettings || {}) })
        setActivities(nextActivities)
        setWorkspace({
          loading: false,
          schoolId,
          schoolName: school.profile.schoolName,
          schoolProfile: school.profile,
          staffCount: school?.staffCount || 1,
          needsSetup: false,
          role: workspaceRole,
          error: '',
        })
      } catch (error) {
        if (active) setWorkspace(current => ({ ...current, loading: false, error: error.message }))
      }
    }

    load()
    return () => { active = false; controller.abort() }
  }, [session, setAttendance, setEnquiries, setFees, setNotices, setStudents, setTimetableData, workspaceVersion])

  // Near-real-time sync: while on the Command Center dashboard, silently pull fresh school
  // data so stats and the activity feed reflect changes from the Teacher/Parent panels
  // (attendance marked, fee paid, new student) without a manual reload. Gated to the
  // dashboard only — no edit forms are mounted there, so a live refresh can't overwrite work.
  useEffect(() => {
    if (!session || !workspace.schoolId || workspace.loading || page !== 'dashboard') return undefined
    let active = true
    const tick = async () => {
      try {
        const token = await session.getIdToken()
        const school = await databaseRequest(`schools/${workspace.schoolId}`, token)
        if (!active || !school) return
        const studentRows = Object.entries(school.students || {}).map(([id, row]) => ({ id, ...row })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        const noticeRows = Object.entries(school.notices || {}).map(([id, row]) => ({ id, ...row })).sort((a, b) => (b.publishAt || 0) - (a.publishAt || 0))
        const attendanceByDate = Object.values(school.attendance || {}).reduce((dates, record) => {
          const studentId = record.studentId || record.student_id
          if (!studentId || !record.date) return dates
          dates[record.date] ||= {}
          dates[record.date][studentId] = normalizeAttendanceStatus(record.mark || record.status)
          return dates
        }, {})
        const nextFees = school.fees || {}
        const nextActivities = [
          ...studentRows.map(row => ({ id: `student-${row.id}`, title: 'Student admitted', detail: `${row.full_name || row.name || ''} joined Class ${row.class_name || row.class || ''}-${row.section || 'A'}`, at: row.createdAt || 0, icon: '+' })),
          ...Object.entries(nextFees).map(([id, row]) => ({ id: `fee-${id}`, title: 'Fee payment received', detail: `${money(row.amount)} via ${row.method || 'payment'}`, at: row.paidAt || row.updatedAt || 0, icon: '₹' })),
          ...noticeRows.map(row => ({ id: `notice-${row.id}`, title: 'Notice published', detail: row.title, at: row.publishAt || 0, icon: 'N' })),
          ...Object.entries(school.attendance || {}).map(([id, row]) => ({ id: `attendance-${id}`, title: 'Attendance updated', detail: `${row.date} attendance marked`, at: row.updatedAt || 0, icon: '✓' })),
        ].filter(item => item.at).sort((a, b) => b.at - a.at)
        if (!active) return
        setStudents(studentRows.map(studentFromRow))
        setNotices(noticeRows.map(noticeFromRow))
        setFees(nextFees)
        setAttendance(attendanceByDate)
        setHomework(school.homework || {})
        setStaff(school.staff || {})
        setStaffAttendance(school.staffAttendance || {})
        setParentNotifications(school.parentNotifications || {})
        setCertificateRequests(school.certificateRequests || {})
        setActivities(nextActivities)
      } catch { /* ignore transient poll failures; next tick retries */ }
    }
    const id = setInterval(tick, 25000)
    return () => { active = false; clearInterval(id) }
  }, [session, workspace.schoolId, workspace.loading, page])

  const createSchoolWorkspace = async profile => {
    const token = await session.getIdToken()
    await createSchoolRecord(session, token, profile)
    localStorage.setItem('northstar-school-id', session.uid)
    setWorkspace(current => ({ ...current, loading: true, needsSetup: false }))
    setWorkspaceVersion(current => current + 1)
  }

  const uploadStudentPhotoFile = async (file, admissionNo, token, oldPath = '', fallbackUrl = '') => {
    if (!file) return null
    const path = `schools/${workspace.schoolId}/students/${admissionNo}/photo.jpg`
    if (!useFirebaseStorage || !storage) {
      return { path: '', url: fallbackUrl || await fileToDataUrl(file), size: file.size, updatedAt: Date.now(), fallback: true }
    }
    try {
      if (oldPath && oldPath !== path) await deleteObject(storageRef(storage, oldPath)).catch(() => {})
      const uploaded = await uploadBytes(storageRef(storage, path), file, { contentType: 'image/jpeg' })
      return { path, url: await getDownloadURL(uploaded.ref), size: file.size, updatedAt: Date.now(), fallback: false }
    } catch {
      return { path: '', url: await fileToDataUrl(file), size: file.size, updatedAt: Date.now(), fallback: true }
    }
  }

  const addStudent = async student => {
    const token = developmentDemo ? null : await session.getIdToken()
    const assignedNumber = developmentDemo ? await getNextAdmissionNumber() : await reserveAdmissionNumber(workspace.schoolId, token)
    if (developmentDemo) {
      const createdAt = Date.now()
      const { photoFile, photoPreview, photoOriginalSize, photoCompressedSize, ...safeStudent } = student
      setStudents(current => [{ ...safeStudent, roll: String(assignedNumber), id: createdAt, createdAt, attendance: 100, fee: 'Pending', photoUrl: photoPreview || '', photoPath: '', photoSize: photoCompressedSize || 0, photoUpdatedAt: photoPreview ? createdAt : 0, initials: student.name.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase(), tone: tones[current.length % tones.length] }, ...current])
      setActivities(current => [{ id: `student-${createdAt}`, title: 'Student admitted', detail: `${student.name} joined Class ${student.className}`, at: createdAt, icon: '+' }, ...current])
      return assignedNumber
    }
    const [className, section = 'A'] = student.className.split('-')
    const studentId = `student_${Date.now()}`
    const row = {
      ...studentToRow({ ...student, roll: String(assignedNumber), className: `${className}-${section}`, guardian: student.guardian || student.fatherName || '', phone: student.fatherPhone || student.phone || '' }),
      admission_number: String(assignedNumber),
      class_name: className,
      section,
      admission_type: student.newAdmission === false ? 'Existing' : 'New',
      sms_enabled: student.smsEnabled !== false,
      active: true,
      attendance_rate: 100,
      fee_status: 'Pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    if (student.photoFile) {
      const photo = await uploadStudentPhotoFile(student.photoFile, assignedNumber, token, '', student.photoPreview || '')
      row.photo_url = photo.url
      row.photo_path = photo.path
      row.photo_size = photo.size
      row.photo_updated_at = photo.updatedAt
    }
    const parentPhone = parentIdOf(row.parent_login_phone || row.father_phone || row.guardian_phone)
    const parentRow = parentPhone ? buildParentAccount(await databaseRequest(`schools/${workspace.schoolId}/parents/${parentPhone}`, token).catch(() => null) || {}, studentId, studentFromRow({ id: studentId, ...row }, students.length), workspace.schoolProfile) : null
    const parentNotification = parentRow ? {
      id: `notif_${Date.now()}`,
      parentId: parentPhone,
      title: 'Parent Portal login ready',
      message: `Login with School Code ${workspace.schoolProfile.schoolCode || ''} and phone ${parentPhone}. Default password is child DOB.`,
      type: 'account',
      isRead: false,
      createdAt: Date.now(),
    } : null
    await databaseRequest('', token, { method: 'PATCH', body: {
      [`schools/${workspace.schoolId}/students/${studentId}`]: row,
      ...(parentRow ? { [`schools/${workspace.schoolId}/parents/${parentPhone}`]: parentRow } : {}),
      ...(parentNotification ? { [`schools/${workspace.schoolId}/parentNotifications/${parentNotification.id}`]: parentNotification } : {}),
    } })
    setStudents(current => [studentFromRow({ id: studentId, ...row }, current.length), ...current])
    if (parentRow) setParents(current => ({ ...current, [parentPhone]: parentRow }))
    if (parentNotification) setParentNotifications(current => ({ ...current, [parentNotification.id]: parentNotification }))
    setActivities(current => [{ id: `student-${studentId}`, title: 'Student admitted', detail: `${student.name} joined Class ${student.className}`, at: row.createdAt, icon: '+' }, ...current])
    return assignedNumber
  }

  const updateStudent = async (studentId, updates = {}) => {
    const existing = students.find(item => item.id === studentId)
    if (!existing) throw new Error('Student not found.')
    const updated = { ...existing, ...updates, roll: existing.roll, admissionNo: existing.admissionNo || existing.roll }
    const row = studentToRow(updated)
    row.admission_number = String(existing.roll)
    row.updatedAt = Date.now()
    if (updates.photoFile) {
      const token = developmentDemo ? null : await session.getIdToken()
      const photo = await uploadStudentPhotoFile(updates.photoFile, existing.roll, token, existing.photoPath, updates.photoPreview || existing.photoUrl || '')
      row.photo_url = photo.url
      row.photo_path = photo.path
      row.photo_size = photo.size
      row.photo_updated_at = photo.updatedAt
    }
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/students/${studentId}`, token, { method: 'PUT', body: row })
      const parentPhone = parentIdOf(row.parent_login_phone || row.father_phone || row.guardian_phone)
      if (parentPhone) {
        try {
          const existingParent = await databaseRequest(`schools/${workspace.schoolId}/parents/${parentPhone}`, token).catch(() => null)
          const parentRow = buildParentAccount(existingParent || {}, studentId, { ...updated, phone: parentPhone }, workspace.schoolProfile)
          await databaseRequest(`schools/${workspace.schoolId}/parents/${parentPhone}`, token, { method: 'PUT', body: parentRow })
          setParents(current => ({ ...current, [parentPhone]: parentRow }))
        } catch (_) {}
      }
    }
    setStudents(current => current.map((item, index) => item.id === studentId ? studentFromRow({ id: studentId, ...row }, index) : item))
    setActivities(current => [{ id: `student-update-${studentId}-${Date.now()}`, title: 'Student updated', detail: `${updated.name} moved to Class ${updated.className}`, at: row.updatedAt, icon: 'U' }, ...current])
    return updated
  }

  const updateStudentPhoto = async (studentId, photoFile, previewUrl = '') => {
    const student = students.find(item => item.id === studentId)
    if (!student || !photoFile) return null
    const updatedAt = Date.now()
    if (developmentDemo) {
      const dataUrl = previewUrl || await fileToDataUrl(photoFile)
      setStudents(current => current.map(item => item.id === studentId ? { ...item, photoUrl: dataUrl, photoSize: photoFile.size, photoUpdatedAt: updatedAt } : item))
      return { url: dataUrl, size: photoFile.size, updatedAt }
    }
    const token = await session.getIdToken()
    const photo = await uploadStudentPhotoFile(photoFile, student.roll, token, student.photoPath, previewUrl || student.photoUrl || '')
    await databaseRequest('', token, { method: 'PATCH', body: {
      [`schools/${workspace.schoolId}/students/${studentId}/photo_url`]: photo.url,
      [`schools/${workspace.schoolId}/students/${studentId}/photo_path`]: photo.path,
      [`schools/${workspace.schoolId}/students/${studentId}/photo_size`]: photo.size,
      [`schools/${workspace.schoolId}/students/${studentId}/photo_updated_at`]: photo.updatedAt,
      [`schools/${workspace.schoolId}/students/${studentId}/updatedAt`]: photo.updatedAt,
    } })
    setStudents(current => current.map(item => item.id === studentId ? { ...item, photoUrl: photo.url, photoPath: photo.path, photoSize: photo.size, photoUpdatedAt: photo.updatedAt } : item))
    return photo
  }

  async function getNextAdmissionNumber() {
    if (developmentDemo) return Math.max(0, ...students.map(student => admissionValue(student.roll))) + 1
    const token = await session.getIdToken()
    const [fresh, counter] = await Promise.all([
      databaseRequest(`schools/${workspace.schoolId}/students`, token),
      databaseRequest(`schools/${workspace.schoolId}/admissionCounter`, token),
    ])
    return Math.max(Number(counter?.lastIssued || 0), ...Object.values(fresh || {}).map(row => admissionValue(row.admission_number))) + 1
  }

  const recordPayment = async (studentId, amount = 0, method = 'UPI', billingMonth = today().slice(0, 7)) => {
    if (Number(amount) <= 0) throw new Error('Set a valid fee amount before recording payment.')
    const paidAt = Date.now()
    const invoiceId = `${studentId}_${billingMonth}`
    const invoiceNumber = `INV-${billingMonth.replace('-', '')}-${String(paidAt).slice(-6)}`
    const row = { studentId, billingMonth, billingPeriod: billingMonth, invoiceNumber, amount: Number(amount), balance: 0, method, status: 'paid', paidAt, updatedAt: paidAt }
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest('', token, { method: 'PATCH', body: {
        [`schools/${workspace.schoolId}/fees/${invoiceId}`]: row,
        [`schools/${workspace.schoolId}/students/${studentId}/fee_status`]: 'Paid',
        [`schools/${workspace.schoolId}/students/${studentId}/updatedAt`]: paidAt,
      } })
    }
    setFees(current => ({ ...current, [invoiceId]: row }))
    setStudents(current => current.map(student => student.id === studentId ? { ...student, fee: 'Paid' } : student))
    setActivities(current => [{ id: `fee-${invoiceId}`, title: 'Fee payment received', detail: `${money(amount)} via ${method}`, at: paidAt, icon: 'â‚¹' }, ...current])
  }

  const submitFeeReceipt = async receipt => {
    const paidAt = Date.now()
    const receiptId = `receipt_${paidAt}`
    const monthIndex = ['January','February','March','April','May','June','July','August','September','October','November','December'].indexOf(receipt.billingMonth)
    const receiptYear = Number(String(receipt.receiptDate || '').slice(0, 4)) || new Date().getFullYear()
    const billingPeriod = monthIndex >= 0 ? `${receiptYear}-${String(monthIndex + 1).padStart(2, '0')}` : ''
    const settings = feeManager.settings?.config || {}
    const prefix = settings.prefix || `RCP-${new Date().getFullYear()}`
    const existingNumbers = Object.values(fees).map(item => Number(String(item.receiptNumber || '').match(/(\d+)$/)?.[1] || 0))
    const sequence = Math.max(Number(settings.start || 1) - 1, ...existingNumbers) + 1
    const receiptNumber = `${prefix}-${String(sequence).padStart(5, '0')}`
    const row = {
      ...receipt,
      billingPeriod,
      receiptNumber,
      invoiceNumber: receiptNumber,
      amount: Number(receipt.paidAmount || receipt.amount || 0),
      method: (receipt.payments || []).map(item => item.type).join(' + ') || 'CASH',
      status: receipt.paymentStatus ? String(receipt.paymentStatus).toLowerCase() : Number(receipt.balance || 0) > 0 ? 'partial' : 'paid',
      paidAt,
      updatedAt: paidAt,
    }
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest('', token, { method: 'PATCH', body: {
        [`schools/${workspace.schoolId}/fees/${receiptId}`]: row,
        [`schools/${workspace.schoolId}/students/${receipt.studentId}/fee_status`]: row.status === 'paid' ? 'Paid' : 'Pending',
        [`schools/${workspace.schoolId}/students/${receipt.studentId}/fee_group`]: receipt.feeGroup,
        [`schools/${workspace.schoolId}/students/${receipt.studentId}/updatedAt`]: paidAt,
        ...(row.status === 'partial' ? { [`schools/${workspace.schoolId}/approvals/fees/${receiptId}`]: { receiptId, studentId: receipt.studentId, studentName: receipt.studentName, receiptNumber, amount: row.amount, balance: receipt.balance, discount: receipt.discount || 0, status: 'pending', createdAt: paidAt } } : {}),
      } })
    }
    setFees(current => ({ ...current, [receiptId]: row }))
    setStudents(current => current.map(student => student.id === receipt.studentId ? { ...student, fee: row.status === 'paid' ? 'Paid' : 'Pending', feeGroup: receipt.feeGroup } : student))
    setActivities(current => [{ id: `fee-${receiptId}`, title: 'Fee receipt submitted', detail: `${receiptNumber} Â· ${money(row.amount)}`, at: paidAt, icon: 'â‚¹' }, ...current])
    if (row.status === 'partial') setApprovals(current => ({ ...current, fees: { ...(current.fees || {}), [receiptId]: { receiptId, studentId: receipt.studentId, studentName: receipt.studentName, receiptNumber, amount: row.amount, balance: receipt.balance, discount: receipt.discount || 0, status: 'pending', createdAt: paidAt } } }))
    return { id: receiptId, ...row }
  }

  const saveFeeGroup = async group => {
    const id = group.id || `group_${Date.now()}`
    const row = { ...group, id, updatedAt: Date.now(), createdAt: group.createdAt || Date.now(), createdBy: group.createdBy || workspace.role }
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/feeManager/groups/${id}`, token, { method: 'PUT', body: row })
    }
    setFeeManager(current => ({ ...current, groups: { ...current.groups, [id]: row } }))
  }

  const deleteFeeGroup = async id => {
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/feeManager/groups/${id}`, token, { method: 'DELETE' })
    }
    setFeeManager(current => {
      const groups = { ...current.groups }
      delete groups[id]
      return { ...current, groups }
    })
  }

  const saveFeeStructure = async structure => {
    const id = structure.id || `structure_${Date.now()}`
    const row = { ...structure, id, updatedAt: Date.now() }
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/feeManager/structures/${id}`, token, { method: 'PUT', body: row })
    }
    setFeeManager(current => ({ ...current, structures: { ...current.structures, [id]: row } }))
  }

  const deleteFeeStructure = async id => {
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/feeManager/structures/${id}`, token, { method: 'DELETE' })
    }
    setFeeManager(current => {
      const structures = { ...current.structures }
      delete structures[id]
      return { ...current, structures }
    })
  }

  const deleteFeeReceipt = async receiptId => {
    const row = fees[receiptId]
    if (!row) return
    const deletedRow = { ...row, originalId: receiptId, deletedAt: Date.now() }
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest('', token, { method: 'PATCH', body: {
        [`schools/${workspace.schoolId}/fees/${receiptId}`]: null,
        [`schools/${workspace.schoolId}/feeManager/deleted/${receiptId}`]: deletedRow,
      } })
    }
    setFees(current => { const next = { ...current }; delete next[receiptId]; return next })
    setFeeManager(current => ({ ...current, deleted: { ...current.deleted, [receiptId]: deletedRow } }))
  }

  const restoreFeeReceipt = async receiptId => {
    const row = feeManager.deleted[receiptId]
    if (!row) return
    const restored = { ...row }
    delete restored.deletedAt
    delete restored.originalId
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest('', token, { method: 'PATCH', body: {
        [`schools/${workspace.schoolId}/fees/${receiptId}`]: restored,
        [`schools/${workspace.schoolId}/feeManager/deleted/${receiptId}`]: null,
      } })
    }
    setFees(current => ({ ...current, [receiptId]: restored }))
    setFeeManager(current => { const deleted = { ...current.deleted }; delete deleted[receiptId]; return { ...current, deleted } })
  }

  const decideFeeApproval = async (receiptId, decision) => {
    const approval = approvals.fees?.[receiptId]
    const nextStatus = decision === 'approved' ? 'paid' : 'rejected'
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest('', token, { method: 'PATCH', body: {
        [`schools/${workspace.schoolId}/approvals/fees/${receiptId}/status`]: decision,
        [`schools/${workspace.schoolId}/approvals/fees/${receiptId}/decidedAt`]: Date.now(),
        [`schools/${workspace.schoolId}/fees/${receiptId}/status`]: nextStatus,
        ...(decision === 'approved' && approval?.studentId ? { [`schools/${workspace.schoolId}/students/${approval.studentId}/fee_status`]: 'Paid' } : {}),
      } })
    }
    setApprovals(current => ({ ...current, fees: { ...current.fees, [receiptId]: { ...current.fees[receiptId], status: decision, decidedAt: Date.now() } } }))
    setFees(current => ({ ...current, [receiptId]: { ...current[receiptId], status: nextStatus } }))
    if (decision === 'approved' && approval?.studentId) setStudents(current => current.map(student => student.id === approval.studentId ? { ...student, fee: 'Paid' } : student))
  }

  const saveFeeManagerConfig = async (section, value, id = 'config') => {
    const row = { ...value, id, updatedAt: Date.now() }
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/feeManager/${section}/${id}`, token, { method: 'PUT', body: row })
    }
    setFeeManager(current => ({ ...current, [section]: { ...(current[section] || {}), [id]: row } }))
  }

  const createBackupPayload = () => {
    const studentRows = Object.fromEntries(students.map(student => [student.id, studentToRow(student)]))
    const attendanceRows = {}
    Object.entries(attendance).forEach(([date, marks]) => Object.entries(marks).forEach(([studentId, status]) => {
      attendanceRows[`${date}_${studentId}`] = { studentId, date, status, markedBy: session?.uid || 'backup', updatedAt: Date.now() }
    }))
    return {
      format: 'northstar-school-backup',
      version: 1,
      school: { id: workspace.schoolId, name: workspace.schoolName, academicYear: '2026-27' },
      exportedAt: new Date().toISOString(),
      data: {
        students: studentRows,
        fees,
        attendance: attendanceRows,
        notices: Object.fromEntries(notices.map(notice => [notice.id, {
          title: notice.title, body: notice.detail, category: notice.type, priority: notice.priority,
          audience: notice.audience, publishAt: notice.publishAt || Date.now(),
        }])),
        timetable: timetableData,
        timetableRecords,
        homework,
        transport,
        library,
        accounts,
        enquiries: Object.fromEntries(enquiries.map(item => [item.id, { ...item, id: undefined }])),
        feeManager,
        staff,
        staffAttendance,
        employeeManager: employeeConfig,
        leave,
        approvals,
        expenses,
        studentAcademics: academics,
        studentDocuments: documents,
        certificates,
        certificateSettings,
        reportExams: reportData.exams,
        reportMarks: reportData.marks,
        reportCards: reportData.reports,
      },
    }
  }

  const restoreBackup = async payload => {
    if (payload?.format !== 'northstar-school-backup' || payload?.version !== 1 || !payload?.data) throw new Error('This is not a valid Northstar backup file.')
    if (payload.school?.id && workspace.schoolId && payload.school.id !== workspace.schoolId) throw new Error('This backup belongs to a different school account.')
    const restoredStudents = Object.entries(payload.data.students || {}).map(([id, row], index) => studentFromRow({ id, ...row }, index))
    const restoredAdmissionCounter = Math.max(0, ...Object.values(payload.data.students || {}).map(row => admissionValue(row.admission_number)))
    const attendanceUpload = Object.fromEntries(Object.entries(payload.data.attendance || {}).map(([id, record]) => [id, { ...record, markedBy: session?.uid || 'backup', updatedAt: Date.now() }]))
    const restoredAttendance = Object.values(attendanceUpload).reduce((dates, record) => {
      dates[record.date] ||= {}
      dates[record.date][record.studentId] = record.status
      return dates
    }, {})
    const restoredNotices = Object.entries(payload.data.notices || {}).map(([id, row]) => noticeFromRow({ id, ...row }))
    const restoredEnquiries = Object.entries(payload.data.enquiries || {}).map(([id, row]) => ({ id, ...row }))
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await Promise.all([
        databaseRequest(`schools/${workspace.schoolId}/students`, token, { method: 'PUT', body: payload.data.students || {} }),
        databaseRequest(`schools/${workspace.schoolId}/fees`, token, { method: 'PUT', body: payload.data.fees || {} }),
        databaseRequest(`schools/${workspace.schoolId}/attendance`, token, { method: 'PUT', body: attendanceUpload }),
        databaseRequest(`schools/${workspace.schoolId}/notices`, token, { method: 'PUT', body: payload.data.notices || {} }),
        databaseRequest(`schools/${workspace.schoolId}/timetable`, token, { method: 'PUT', body: payload.data.timetable || {} }),
        databaseRequest(`schools/${workspace.schoolId}/timetableRecords`, token, { method: 'PUT', body: payload.data.timetableRecords || {} }),
        databaseRequest(`schools/${workspace.schoolId}/homework`, token, { method: 'PUT', body: payload.data.homework || {} }),
        databaseRequest(`schools/${workspace.schoolId}/transport`, token, { method: 'PUT', body: payload.data.transport || {} }),
        databaseRequest(`schools/${workspace.schoolId}/library`, token, { method: 'PUT', body: payload.data.library || {} }),
        databaseRequest(`schools/${workspace.schoolId}/accounts`, token, { method: 'PUT', body: payload.data.accounts || {} }),
        databaseRequest(`schools/${workspace.schoolId}/enquiries`, token, { method: 'PUT', body: payload.data.enquiries || {} }),
        databaseRequest(`schools/${workspace.schoolId}/feeManager`, token, { method: 'PUT', body: payload.data.feeManager || {} }),
        databaseRequest(`schools/${workspace.schoolId}/staff`, token, { method: 'PUT', body: payload.data.staff || {} }),
        databaseRequest(`schools/${workspace.schoolId}/staffAttendance`, token, { method: 'PUT', body: payload.data.staffAttendance || {} }),
        databaseRequest(`schools/${workspace.schoolId}/employeeManager`, token, { method: 'PUT', body: payload.data.employeeManager || {} }),
        databaseRequest(`schools/${workspace.schoolId}/leave`, token, { method: 'PUT', body: payload.data.leave || {} }),
        databaseRequest(`schools/${workspace.schoolId}/approvals`, token, { method: 'PUT', body: payload.data.approvals || {} }),
        databaseRequest(`schools/${workspace.schoolId}/expenses`, token, { method: 'PUT', body: payload.data.expenses || {} }),
        databaseRequest(`schools/${workspace.schoolId}/studentAcademics`, token, { method: 'PUT', body: payload.data.studentAcademics || {} }),
        databaseRequest(`schools/${workspace.schoolId}/studentDocuments`, token, { method: 'PUT', body: payload.data.studentDocuments || {} }),
        databaseRequest(`schools/${workspace.schoolId}/certificates`, token, { method: 'PUT', body: payload.data.certificates || {} }),
        databaseRequest(`schools/${workspace.schoolId}/certificateSettings`, token, { method: 'PUT', body: payload.data.certificateSettings || {} }),
        databaseRequest(`schools/${workspace.schoolId}/reportExams`, token, { method: 'PUT', body: payload.data.reportExams || {} }),
        databaseRequest(`schools/${workspace.schoolId}/reportMarks`, token, { method: 'PUT', body: payload.data.reportMarks || {} }),
        databaseRequest(`schools/${workspace.schoolId}/reportCards`, token, { method: 'PUT', body: payload.data.reportCards || {} }),
        databaseRequest(`schools/${workspace.schoolId}/admissionCounter`, token, { method: 'PUT', body: { lastIssued: restoredAdmissionCounter, updatedAt: Date.now() } }),
      ])
    }
    setStudents(restoredStudents)
    setFees(payload.data.fees || {})
    setAttendance(restoredAttendance)
    setNotices(restoredNotices)
    setTimetableData(payload.data.timetable || {})
    setTimetableRecords(payload.data.timetableRecords || {})
    setHomework(payload.data.homework || {})
    setTransport(payload.data.transport || { routes: {}, vehicles: {}, drivers: {}, allocations: {}, fees: {}, attendance: {}, settings: {} })
    setLibrary(payload.data.library || { books: {}, issues: {}, returns: {}, categories: {}, settings: {}, fines: {} })
    setAccounts(payload.data.accounts || {})
    setEnquiries(restoredEnquiries)
    setFeeManager(payload.data.feeManager || { groups: {}, structures: {}, fines: {}, settings: {}, deleted: {} })
    setStaff(payload.data.staff || {})
    setStaffAttendance(payload.data.staffAttendance || {})
    setEmployeeConfig(payload.data.employeeManager || { departments: {}, designations: {}, shifts: {} })
    setLeave(payload.data.leave || {})
    setApprovals(payload.data.approvals || { fees: {}, leaves: {} })
    setExpenses(payload.data.expenses || {})
    setAcademics(payload.data.studentAcademics || {})
    setDocuments(payload.data.studentDocuments || {})
    setCertificates(payload.data.certificates || {})
    setCertificateSettings(payload.data.certificateSettings || {})
    setReportData({ exams: payload.data.reportExams || {}, marks: payload.data.reportMarks || {}, reports: payload.data.reportCards || {} })
    setActivities(current => [{ id: `restore-${Date.now()}`, title: 'School backup restored', detail: `${restoredStudents.length} students restored`, at: Date.now(), icon: 'R' }, ...current])
  }

  const saveBackupSettings = async settings => {
    const row = { ...settings, updatedAt: Date.now() }
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/backupSettings`, token, { method: 'PUT', body: row })
    }
    setBackupSettings(row)
  }

  const saveSchoolProfile = async (profile, logoFile) => {
    let logo = profile.logo || ''
    let logoPath = profile.logoPath || ''
    if (logoFile) {
      if (logoFile.size > 2 * 1024 * 1024) throw new Error('School logo must be smaller than 2 MB.')
      if (!/^image\/(png|jpeg|webp)$/.test(logoFile.type)) throw new Error('School logo must be PNG, JPG or WebP.')
      if (!developmentDemo) {
        try {
          if (logoPath) await deleteObject(storageRef(storage, logoPath)).catch(() => {})
          const safeName = logoFile.name.replace(/[^a-zA-Z0-9._-]/g, '-')
          logoPath = `schools/${workspace.schoolId}/branding/${session.uid}/${Date.now()}-${safeName}`
          const uploaded = await uploadBytes(storageRef(storage, logoPath), logoFile, { contentType: logoFile.type })
          logo = await getDownloadURL(uploaded.ref)
        } catch {
          logo = await fileToDataUrl(logoFile)
          logoPath = ''
        }
      } else {
        logo = await fileToDataUrl(logoFile)
      }
    }
    const row = { ...profile, logo, logoURL: profile.logoURL || logo, logoPath, schoolContactNo: profile.schoolContactNo || profile.phone || '', schoolEmail: profile.schoolEmail || profile.email || '', updatedAt: Date.now() }
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/profile`, token, { method: 'PUT', body: row })
    }
    setWorkspace(current => ({ ...current, schoolName: row.schoolName, schoolProfile: row }))
  }

  const saveParentAccount = async (parentId, changes = {}) => {
    const id = parentIdOf(parentId)
    if (!id) throw new Error('Parent phone is required.')
    const row = { ...(parents[id] || { id, phone: id, students: {}, createdAt: Date.now() }), ...changes, id, phone: id, updatedAt: Date.now() }
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/parents/${id}`, token, { method: 'PATCH', body: row })
    }
    setParents(current => ({ ...current, [id]: row }))
    return row
  }

  const addNotice = async notice => {
    if (developmentDemo) {
      const publishAt = Date.now()
      setNotices(current => [{ ...notice, id: publishAt, publishAt }, ...current])
      setActivities(current => [{ id: `notice-${publishAt}`, title: 'Notice published', detail: notice.title, at: publishAt, icon: 'N' }, ...current])
      return
    }
    const noticeId = `notice_${Date.now()}`
    const row = {
      title: notice.title,
      body: notice.detail,
      category: notice.type,
      priority: notice.priority,
      audience: notice.audience === 'Students only' ? 'students' : notice.audience === 'Staff only' ? 'staff' : 'Entire school',
      publishAt: Date.now(),
      createdBy: session.uid,
    }
    const token = await session.getIdToken()
    await databaseRequest(`schools/${workspace.schoolId}/notices/${noticeId}`, token, { method: 'PUT', body: row })
    setNotices(current => [{ ...notice, id: noticeId, publishAt: row.publishAt }, ...current])
    setActivities(current => [{ id: `notice-${noticeId}`, title: 'Notice published', detail: notice.title, at: row.publishAt, icon: 'N' }, ...current])
  }

  const saveAttendance = async (marks, date = today(), meta = {}) => {
    const now = Date.now()
    const normalizedMarks = Object.fromEntries(Object.entries(marks).map(([studentId, status]) => [studentId, normalizeAttendanceStatus(status)]))
    const changes = {}
    Object.entries(normalizedMarks).forEach(([studentId, status]) => {
      const id = `${date}_${studentId}`
      changes[`schools/${workspace.schoolId}/attendance/${id}`] = {
        id,
        studentId,
        student_id: studentId,
        class: meta.className || '',
        section: meta.section || '',
        date,
        status,
        statusText: attendanceStatusLabel(status),
        mark: status,
        markedBy: session?.uid || 'demo',
        marked_by: session?.uid || 'demo',
        created_at: now,
        updated_at: now,
        updatedAt: now,
      }
    })
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest('', token, { method: 'PATCH', body: changes })
    }
    setAttendance(current => ({ ...current, [date]: { ...(current[date] || {}), ...normalizedMarks } }))
    setActivities(current => [{ id: `attendance-${date}-${now}`, title: 'Attendance updated', detail: `${Object.keys(normalizedMarks).length} records saved for ${readableDate(date)}`, at: now, icon: '✓' }, ...current])
  }

  const saveEmployeeConfig = async (section, value) => {
    const id = value.id || `${section.slice(0, -1)}_${Date.now()}`
    const row = { ...value, id, updatedAt: Date.now(), createdAt: value.createdAt || Date.now() }
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/employeeManager/${section}/${id}`, token, { method: 'PUT', body: row })
    }
    setEmployeeConfig(current => ({ ...current, [section]: { ...(current[section] || {}), [id]: row } }))
  }

  const deleteEmployeeConfig = async (section, id) => {
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/employeeManager/${section}/${id}`, token, { method: 'DELETE' })
    }
    setEmployeeConfig(current => {
      const nextSection = { ...(current[section] || {}) }
      delete nextSection[id]
      return { ...current, [section]: nextSection }
    })
  }

  const saveEmployee = async form => {
    const existing = form.id ? staff[form.id] : null
    const number = Math.max(0, ...Object.values(staff || {}).map(item => Number(String(item.employeeCode || '').match(/\d+/)?.[0] || 0))) + 1
    const employeeCode = existing?.employeeCode || `EMP${String(number).padStart(3, '0')}`
    const id = form.id || `employee_${Date.now()}`
    const defaultDepartments = {
      dept_teacher: { name: 'Teacher' },
      dept_staff: { name: 'Staff' },
      dept_worker: { name: 'Worker' },
      dept_admin: { name: 'Admin' },
      dept_transport: { name: 'Transport' },
    }
    const defaultDesignations = {
      des_teacher: { name: 'Teacher' },
      des_class_teacher: { name: 'Class Teacher' },
      des_principal: { name: 'Principal' },
      des_accountant: { name: 'Accountant' },
      des_receptionist: { name: 'Receptionist' },
      des_worker: { name: 'Worker' },
      des_guard: { name: 'Security Guard' },
      des_driver: { name: 'Driver' },
      des_conductor: { name: 'Conductor' },
    }
    const department = employeeConfig.departments?.[form.departmentId]?.name || defaultDepartments[form.departmentId]?.name || ''
    const designation = employeeConfig.designations?.[form.designationId]?.name || defaultDesignations[form.designationId]?.name || ''
    let photoUrl = existing?.photoUrl || ''
    let photoPath = existing?.photoPath || ''
    if (form.photo) {
      const previousPhotoPath = photoPath
      if (!/^image\/(jpe?g|png|webp)$/i.test(form.photo.type || '')) {
        throw new Error('Please choose a valid employee photo: JPG, PNG or WEBP.')
      }
      const compressedPhoto = await compressEmployeePhoto(form.photo)
      const localPhotoUrl = await fileToDataUrl(compressedPhoto).catch(() => '')
      if (localPhotoUrl) photoUrl = localPhotoUrl
      photoPath = ''
      if (!developmentDemo) {
        try {
          if (!useFirebaseStorage || !storage) throw new Error('Firebase Storage is disabled; using compressed database photo.')
          if (previousPhotoPath) await deleteObject(storageRef(storage, previousPhotoPath)).catch(() => {})
          photoPath = `schools/${workspace.schoolId}/employees/${session.uid}/${id}.jpg`
          const uploaded = await uploadBytes(storageRef(storage, photoPath), compressedPhoto, { contentType: 'image/jpeg' })
          photoUrl = await getDownloadURL(uploaded.ref)
        } catch (error) {
          console.warn('Employee photo upload failed, saving employee without blocking.', error)
          photoPath = ''
        }
      }
    }
    const row = cleanDatabaseValue({
      ...existing,
      ...form,
      department,
      designation,
      employeeRole: designation,
      id,
      employeeCode,
      photoUrl,
      photoPath,
      salary: Number(form.salary || 0),
      active: true,
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now(),
    })
    if (!developmentDemo) {
      const token = await session.getIdToken()
      try {
        await databaseRequest(`schools/${workspace.schoolId}/staff/${id}`, token, { method: 'PUT', body: row })
      } catch (error) {
        throw new Error(`Employee Firebase save failed at schools/${workspace.schoolId}/staff/${id}: ${error.message}`)
      }
    }
    setStaff(current => ({ ...current, [id]: row }))
    setActivities(current => [{ id: `employee-${id}-${Date.now()}`, title: existing ? 'Employee updated' : 'Employee added', detail: `${form.firstName} ${form.lastName} Â· ${employeeCode}`, at: row.updatedAt, icon: 'E' }, ...current])
    return employeeCode
  }

  const deleteEmployee = async employee => {
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await Promise.all([
        databaseRequest(`schools/${workspace.schoolId}/staff/${employee.id}`, token, { method: 'DELETE' }),
        employee.photoPath ? deleteObject(storageRef(storage, employee.photoPath)).catch(() => {}) : Promise.resolve(),
      ])
    }
    setStaff(current => { const next = { ...current }; delete next[employee.id]; return next })
  }

  const saveStaffAttendance = async (date, marks, meta = {}) => {
    const existing = staffAttendance[date] || {}
    // Merge marks, preserving any private _audit fields already on the record
    const row = { ...existing, ...marks }
    const isEditingPast = date < today()
    if (isEditingPast || meta.isPastEdit) {
      row._editedAt = Date.now()
      row._editedBy = session?.email || session?.uid || 'unknown'
      row._isEdited = true
    }
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/staffAttendance/${date}`, token, { method: 'PUT', body: row })
    }
    setStaffAttendance(current => ({ ...current, [date]: row }))
    setActivities(current => [{
      id: `staff-attendance-${date}-${Date.now()}`,
      title: isEditingPast ? 'Employee attendance edited' : 'Employee attendance updated',
      detail: `${Object.keys(marks).filter(k => !k.startsWith('_')).length} staff records ${isEditingPast ? 'corrected' : 'saved'} for ${date}`,
      at: Date.now(),
      icon: 'E',
    }, ...current])
  }

  const savePeriod = async (className, period) => {
    const id = `${period.day}_${period.time}`.replace(/[:\s]/g, '-')
    const next = {
      ...timetableData,
      [className]: [...(timetableData[className] || []).filter(item => !(item.day === period.day && item.time === period.time)), { ...period, id }],
    }
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/timetable`, token, { method: 'PUT', body: next })
    }
    setTimetableData(next)
    setActivities(current => [{ id: `period-${id}-${Date.now()}`, title: 'Timetable updated', detail: `${period.subject} added to ${className}`, at: Date.now(), icon: 'T' }, ...current])
  }

  const saveTimetableRecord = async form => {
    const id = form.id || `timetable_${Date.now()}`
    let fileUrl = form.fileUrl || ''
    let filePath = form.filePath || ''
    let fileName = form.fileName || ''
    let fileType = form.fileType || ''
    if (form.file) {
      fileName = form.file.name
      fileType = form.file.type
      if (developmentDemo) {
        fileUrl = URL.createObjectURL(form.file)
        filePath = `demo/${fileName}`
      } else {
        const safeName = form.file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
        filePath = `schools/${workspace.schoolId}/timetables/${session.uid}/${id}-${Date.now()}-${safeName}`
        const uploaded = await uploadBytes(storageRef(storage, filePath), form.file, { contentType: form.file.type })
        fileUrl = await getDownloadURL(uploaded.ref)
        if (form.filePath && form.filePath !== filePath) {
          await deleteObject(storageRef(storage, form.filePath)).catch(() => {})
        }
      }
    }
    const row = {
      id,
      title: form.title,
      className: form.className,
      section: form.section,
      startDate: form.startDate,
      endDate: form.endDate,
      fileUrl,
      filePath,
      fileName,
      fileType,
      createdAt: form.createdAt || Date.now(),
      updatedAt: Date.now(),
      uploadedBy: session?.uid || 'demo',
    }
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/timetableRecords/${id}`, token, { method: 'PUT', body: row })
    }
    setTimetableRecords(current => ({ ...current, [id]: row }))
    setActivities(current => [{ id: `timetable-${id}-${Date.now()}`, title: form.id ? 'Timetable edited' : 'Timetable uploaded', detail: `${row.title} Â· Class ${row.className}-${row.section}`, at: Date.now(), icon: 'T' }, ...current])
  }

  const deleteTimetableRecord = async record => {
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await Promise.all([
        databaseRequest(`schools/${workspace.schoolId}/timetableRecords/${record.id}`, token, { method: 'DELETE' }),
        record.filePath ? deleteObject(storageRef(storage, record.filePath)).catch(() => {}) : Promise.resolve(),
      ])
    }
    setTimetableRecords(current => {
      const next = { ...current }
      delete next[record.id]
      return next
    })
  }

  const saveHomework = async form => {
    const id = form.id || `homework_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const existing = homework[id] || {}
    let attachmentURL = form.attachmentURL || existing.attachmentURL || ''
    let attachmentPath = form.attachmentPath || existing.attachmentPath || ''
    let attachmentName = form.attachmentName || existing.attachmentName || ''
    let attachmentType = form.attachmentType || existing.attachmentType || ''
    if (form.attachment) {
      if (form.attachment.size > 5 * 1024 * 1024) throw new Error('Attachment max size is 5MB.')
      if (!/^(application\/pdf|image\/)/i.test(form.attachment.type || '')) throw new Error('Attachment must be PDF or image.')
      attachmentName = form.attachment.name
      attachmentType = form.attachment.type
      if (!developmentDemo && useFirebaseStorage && storage) {
        const safeName = form.attachment.name.replace(/[^a-zA-Z0-9._-]/g, '-')
        const nextPath = `schools/${workspace.schoolId}/homework/${session.uid}/${id}-${Date.now()}-${safeName}`
        const uploaded = await uploadBytes(storageRef(storage, nextPath), form.attachment, { contentType: form.attachment.type })
        attachmentURL = await getDownloadURL(uploaded.ref)
        if (attachmentPath && attachmentPath !== nextPath) await deleteObject(storageRef(storage, attachmentPath)).catch(() => {})
        attachmentPath = nextPath
      } else {
        attachmentURL = await fileToDataUrl(form.attachment)
        attachmentPath = ''
      }
    }
    const row = cleanDatabaseValue({
      ...existing,
      ...form,
      id,
      className: form.className,
      section: form.section,
      dueDate: String(form.dueDate || today()).slice(0, 10),
      attachment: undefined,
      attachmentURL,
      attachmentPath,
      attachmentName,
      attachmentType,
      completed: Boolean(existing.completed),
      seenBy: existing.seenBy || [],
      createdAt: existing.createdAt || Date.now(),
      updatedAt: Date.now(),
      postedBy: form.postedBy || session?.displayName || session?.email || 'Admin',
    })
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/homework/${id}`, token, { method: 'PUT', body: row })
    }
    setHomework(current => ({ ...current, [id]: row }))
    setActivities(current => [{ id: `homework-${id}-${Date.now()}`, title: form.id ? 'Homework updated' : 'Homework posted', detail: `${row.subject} · ${row.className}-${row.section}`, at: row.updatedAt, icon: 'H' }, ...current])
    return row
  }

  const deleteHomework = async item => {
    if (!item?.id) return
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await Promise.all([
        databaseRequest(`schools/${workspace.schoolId}/homework/${item.id}`, token, { method: 'DELETE' }),
        item.attachmentPath ? deleteObject(storageRef(storage, item.attachmentPath)).catch(() => {}) : Promise.resolve(),
      ])
    }
    setHomework(current => {
      const next = { ...current }
      delete next[item.id]
      return next
    })
  }

  const markHomeworkDone = async item => {
    const row = { ...item, completed: !item.completed, completedAt: !item.completed ? Date.now() : 0, updatedAt: Date.now() }
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/homework/${item.id}`, token, { method: 'PATCH', body: row })
    }
    setHomework(current => ({ ...current, [item.id]: row }))
  }

  const markHomeworkSeen = async (item, studentId) => {
    if (!item?.id || !studentId) return
    const seenBy = [...new Set([...(item.seenBy || []), studentId])]
    const row = { ...item, seenBy, updatedAt: Date.now() }
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/homework/${item.id}`, token, { method: 'PATCH', body: { seenBy, updatedAt: row.updatedAt } })
    }
    setHomework(current => ({ ...current, [item.id]: row }))
  }

  const saveTransportItem = async (collectionName, item) => {
    const id = item.id || `${collectionName}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const row = cleanDatabaseValue({ ...item, id, createdAt: item.createdAt || Date.now(), updatedAt: Date.now() })
    if (!developmentDemo) {
      const token = await session.getIdToken()
      if (collectionName === 'allocations' && row.studentId) {
        const studentPatch = {
          transportAllocated: true,
          routeId: row.routeId || '',
          routeName: row.routeName || '',
          stopName: row.stopName || '',
          pickupTime: row.pickupTime || '',
          dropTime: row.dropTime || '',
          vehicleId: row.vehicleId || '',
          vehicleNumber: row.vehicleNumber || '',
          driverId: row.driverId || '',
          updatedAt: row.updatedAt,
        }
        await databaseRequest(`schools/${workspace.schoolId}/transport/${collectionName}/${id}`, token, { method: 'PUT', body: row })
        await databaseRequest(`schools/${workspace.schoolId}/students/${row.studentId}`, token, { method: 'PATCH', body: {
          transportAllocated: true,
          transportInfo: studentPatch,
          updatedAt: row.updatedAt,
        } }).catch(error => console.warn('Student transport mirror update failed:', error.message))
      } else {
        await databaseRequest(`schools/${workspace.schoolId}/transport/${collectionName}/${id}`, token, { method: 'PUT', body: row })
      }
    }
    if (collectionName === 'allocations' && row.studentId) {
      setStudents(current => current.map(student => student.id === row.studentId ? {
        ...student,
        transportAllocated: true,
        transportInfo: {
          routeId: row.routeId || '',
          routeName: row.routeName || '',
          stopName: row.stopName || '',
          pickupTime: row.pickupTime || '',
          dropTime: row.dropTime || '',
          vehicleId: row.vehicleId || '',
          vehicleNumber: row.vehicleNumber || '',
          driverId: row.driverId || '',
          updatedAt: row.updatedAt,
        },
      } : student))
    }
    setTransport(current => ({
      routes: {},
      vehicles: {},
      drivers: {},
      allocations: {},
      fees: {},
      attendance: {},
      settings: {},
      ...current,
      [collectionName]: { ...(current[collectionName] || {}), [id]: row },
    }))
    setActivities(current => [{ id: `transport-${collectionName}-${id}-${Date.now()}`, title: 'Transport updated', detail: `${collectionName} record saved`, at: row.updatedAt, icon: 'B' }, ...current])
    return row
  }

  const deleteTransportItem = async (collectionName, id) => {
    if (!id) return
    const existing = transport?.[collectionName]?.[id]
    if (!developmentDemo) {
      const token = await session.getIdToken()
      if (collectionName === 'allocations' && existing?.studentId) {
        await databaseRequest(`schools/${workspace.schoolId}/transport/${collectionName}/${id}`, token, { method: 'DELETE' })
        await databaseRequest(`schools/${workspace.schoolId}/students/${existing.studentId}`, token, { method: 'PATCH', body: {
          transportAllocated: false,
          transportInfo: null,
          updatedAt: Date.now(),
        } }).catch(error => console.warn('Student transport mirror delete failed:', error.message))
      } else {
        await databaseRequest(`schools/${workspace.schoolId}/transport/${collectionName}/${id}`, token, { method: 'DELETE' })
      }
    }
    if (collectionName === 'allocations' && existing?.studentId) {
      setStudents(current => current.map(student => student.id === existing.studentId ? { ...student, transportAllocated: false, transportInfo: null } : student))
    }
    setTransport(current => {
      const rows = { ...(current[collectionName] || {}) }
      delete rows[id]
      return { ...current, [collectionName]: rows }
    })
  }

  const saveExpenseItem = async (collectionName, item) => {
    const parts = String(collectionName).split('/').filter(Boolean)
    const leaf = parts[parts.length - 1] || 'items'
    const id = item.id || `${leaf}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const row = cleanDatabaseValue({ ...item, id, createdAt: item.createdAt || Date.now(), updatedAt: Date.now() })
    const path = `schools/${workspace.schoolId}/expenses/${parts.join('/')}/${id}`
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(path, token, { method: 'PUT', body: row })
    }
    setExpenses(current => {
      const base = { categories: {}, items: {}, budget: {}, ...current, salary: { structures: {}, payments: {}, ...(current.salary || {}) } }
      if (parts.length === 1) return { ...base, [leaf]: { ...(base[leaf] || {}), [id]: row } }
      if (parts.length === 2) return { ...base, [parts[0]]: { ...(base[parts[0]] || {}), [parts[1]]: { ...((base[parts[0]] || {})[parts[1]] || {}), [id]: row } } }
      return base
    })
    setActivities(current => [{ id: `expense-${leaf}-${id}-${Date.now()}`, title: 'Expense updated', detail: `${leaf} record saved`, at: row.updatedAt, icon: '₹' }, ...current])
    return row
  }

  const deleteExpenseItem = async (collectionName, id) => {
    if (!id) return
    const parts = String(collectionName).split('/').filter(Boolean)
    const leaf = parts[parts.length - 1] || 'items'
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/expenses/${parts.join('/')}/${id}`, token, { method: 'DELETE' })
    }
    setExpenses(current => {
      const base = { categories: {}, items: {}, budget: {}, ...current, salary: { structures: {}, payments: {}, ...(current.salary || {}) } }
      if (parts.length === 1) {
        const rows = { ...(base[leaf] || {}) }
        delete rows[id]
        return { ...base, [leaf]: rows }
      }
      if (parts.length === 2) {
        const parent = { ...(base[parts[0]] || {}) }
        const rows = { ...(parent[parts[1]] || {}) }
        delete rows[id]
        return { ...base, [parts[0]]: { ...parent, [parts[1]]: rows } }
      }
      return base
    })
  }

  const saveLibraryItem = async (collectionName, item) => {
    const parts = String(collectionName).split('/').filter(Boolean)
    const leaf = parts[parts.length - 1] || 'items'
    const id = item.id || `${leaf}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const row = cleanDatabaseValue({ ...item, id, createdAt: item.createdAt || Date.now(), updatedAt: Date.now() })
    if (leaf === 'settings') {
      if (!developmentDemo) {
        const token = await session.getIdToken()
        await databaseRequest(`schools/${workspace.schoolId}/library/settings`, token, { method: 'PUT', body: row })
      }
      setLibrary(current => {
        const base = { books: {}, issues: {}, returns: {}, categories: {}, settings: {}, fines: {}, ...current }
        return { ...base, settings: row }
      })
      return row
    }
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/library/${parts.join('/')}/${id}`, token, { method: 'PUT', body: row })
    }
    setLibrary(current => {
      const base = { books: {}, issues: {}, returns: {}, categories: {}, settings: {}, fines: {}, ...current }
      if (parts.length === 1) return { ...base, [leaf]: { ...(base[leaf] || {}), [id]: row } }
      if (parts.length === 2) return { ...base, [parts[0]]: { ...(base[parts[0]] || {}), [parts[1]]: { ...((base[parts[0]] || {})[parts[1]] || {}), [id]: row } } }
      return base
    })
    setActivities(current => [{ id: `library-${leaf}-${id}-${Date.now()}`, title: 'Library updated', detail: `${leaf} record saved`, at: row.updatedAt, icon: 'L' }, ...current])
    return row
  }

  const deleteLibraryItem = async (collectionName, id) => {
    if (!id) return
    const parts = String(collectionName).split('/').filter(Boolean)
    const leaf = parts[parts.length - 1] || 'items'
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/library/${parts.join('/')}/${id}`, token, { method: 'DELETE' })
    }
    setLibrary(current => {
      const base = { books: {}, issues: {}, returns: {}, categories: {}, settings: {}, fines: {}, ...current }
      if (parts.length === 1) {
        const rows = { ...(base[leaf] || {}) }
        delete rows[id]
        return { ...base, [leaf]: rows }
      }
      if (parts.length === 2) {
        const parent = { ...(base[parts[0]] || {}) }
        const rows = { ...(parent[parts[1]] || {}) }
        delete rows[id]
        return { ...base, [parts[0]]: { ...parent, [parts[1]]: rows } }
      }
      return base
    })
  }

  const saveAccountsItem = async (collectionName, item) => {
    const parts = String(collectionName).split('/').filter(Boolean)
    const leaf = parts[parts.length - 1] || 'items'
    const id = item.id || `${leaf}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const row = cleanDatabaseValue({ ...item, id, createdAt: item.createdAt || Date.now(), updatedAt: Date.now() })
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/accounts/${parts.join('/')}/${id}`, token, { method: 'PUT', body: row })
    }
    setAccounts(current => {
      const base = { ...current }
      if (parts.length === 1) return { ...base, [leaf]: { ...(base[leaf] || {}), [id]: row } }
      if (parts.length === 2) return { ...base, [parts[0]]: { ...(base[parts[0]] || {}), [parts[1]]: { ...((base[parts[0]] || {})[parts[1]] || {}), [id]: row } } }
      return base
    })
    setActivities(current => [{ id: `accounts-${leaf}-${id}-${Date.now()}`, title: 'Accounts updated', detail: `${leaf} record saved`, at: row.updatedAt, icon: 'A' }, ...current])
    return row
  }

  const deleteAccountsItem = async (collectionName, id) => {
    if (!id) return
    const parts = String(collectionName).split('/').filter(Boolean)
    const leaf = parts[parts.length - 1] || 'items'
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/accounts/${parts.join('/')}/${id}`, token, { method: 'DELETE' })
    }
    setAccounts(current => {
      const base = { ...current }
      if (parts.length === 1) {
        const rows = { ...(base[leaf] || {}) }
        delete rows[id]
        return { ...base, [leaf]: rows }
      }
      if (parts.length === 2) {
        const parent = { ...(base[parts[0]] || {}) }
        const rows = { ...(parent[parts[1]] || {}) }
        delete rows[id]
        return { ...base, [parts[0]]: { ...parent, [parts[1]]: rows } }
      }
      return base
    })
  }

  const saveLeaveItem = async (collectionName, item) => {
    const id = item.id || `${collectionName}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const row = cleanDatabaseValue({ ...item, id, createdAt: item.createdAt || Date.now(), updatedAt: Date.now() })
    if (collectionName === 'settings') {
      if (!developmentDemo) {
        const token = await session.getIdToken()
        await databaseRequest(`schools/${workspace.schoolId}/leave/settings`, token, { method: 'PUT', body: row })
      }
      setLeave(current => ({ ...current, settings: row }))
      return row
    }
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/leave/${collectionName}/${id}`, token, { method: 'PUT', body: row })
    }
    setLeave(current => ({ ...current, [collectionName]: { ...(current[collectionName] || {}), [id]: row } }))
    setActivities(current => [{ id: `leave-${collectionName}-${id}-${Date.now()}`, title: 'Leave updated', detail: `${collectionName} record saved`, at: row.updatedAt, icon: 'L' }, ...current])
    return row
  }

  const deleteLeaveItem = async (collectionName, id) => {
    if (!id) return
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/leave/${collectionName}/${id}`, token, { method: 'DELETE' })
    }
    setLeave(current => {
      const rows = { ...(current[collectionName] || {}) }
      delete rows[id]
      return { ...current, [collectionName]: rows }
    })
  }

  const saveEnquiry = async enquiry => {
    const id = `enquiry_${Date.now()}`
    const row = { ...enquiry, createdAt: Date.now(), createdDate: today() }
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/enquiries/${id}`, token, { method: 'PUT', body: row })
    }
    setEnquiries(current => [{ id, ...row }, ...current])
    setActivities(current => [{ id, title: 'Admission enquiry added', detail: `${enquiry.name} enquired for ${enquiry.className}`, at: row.createdAt, icon: 'E' }, ...current])
  }

  const uploadStudentDocument = async (studentId, type, file) => {
    if (file.size > 5 * 1024 * 1024) throw new Error('Student document must be smaller than 5 MB.')
    if (!/^(image\/|application\/pdf$)/.test(file.type)) throw new Error('Only images and PDF documents are supported.')
    const existing = documents?.[studentId]?.[type]
    let document
    if (developmentDemo) {
      document = { name: file.name, mime: file.type, url: URL.createObjectURL(file), uploadedAt: Date.now() }
    } else {
      if (existing?.path) await deleteObject(storageRef(storage, existing.path)).catch(() => {})
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
      const path = `schools/${workspace.schoolId}/student-documents/${session.uid}/${studentId}/${type}-${Date.now()}-${safeName}`
      const uploaded = await uploadBytes(storageRef(storage, path), file, { contentType: file.type })
      document = { name: file.name, mime: file.type, path, url: await getDownloadURL(uploaded.ref), uploadedAt: Date.now() }
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/studentDocuments/${studentId}/${type}`, token, { method: 'PUT', body: document })
    }
    setDocuments(current => ({ ...current, [studentId]: { ...(current[studentId] || {}), [type]: document } }))
  }

  const saveCertificate = async certificate => {
    const createdAt = Date.now()
    const certificatePrefixes = { tc: 'TC', bonafide: 'BON', character: 'CHR', study: 'STD', sports: 'SPT', admit: 'ADM', fee: 'FEE' }
    const sameType = Object.values(certificates).filter(item => item.certificateType === certificate.certificateType)
    const sequence = developmentDemo
      ? Math.max(0, ...sameType.map(item => Number(String(item.certificateNumber || '').match(/(\d+)$/)?.[1] || 0))) + 1
      : await reserveCertificateNumber(workspace.schoolId, await session.getIdToken(), certificate.certificateType)
    const certificateNumber = `${certificatePrefixes[certificate.certificateType] || 'CERT'}-${new Date().getFullYear()}-${String(sequence).padStart(3, '0')}`
    const id = `certificate_${createdAt}_${sequence}`
    const row = {
      ...certificate,
      certificateNumber,
      schoolId: workspace.schoolId || 'demo',
      issueDate: certificate.issueDate || today(),
      status: certificate.status || 'Generated',
      createdBy: session?.displayName || session?.email?.split('@')[0] || workspace.role,
      createdAt,
      updatedAt: createdAt,
    }
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/certificates/${id}`, token, { method: 'PUT', body: row })
    }
    setCertificates(current => ({ ...current, [id]: row }))
    setActivities(current => [{ id, title: 'Certificate generated', detail: `${certificateNumber} Â· ${certificate.certificateType}`, at: createdAt, icon: 'C' }, ...current])
    return { id, ...row }
  }

  const saveCertificateSettings = async (settings, logoFile) => {
    let logo = settings.logo || ''
    let logoPath = settings.logoPath || ''
    if (logoFile) {
      if (logoFile.size > 2 * 1024 * 1024) throw new Error('Certificate logo must be smaller than 2 MB.')
      if (!/^image\/(png|jpeg|webp)$/.test(logoFile.type)) throw new Error('Certificate logo must be PNG, JPG or WebP.')
      if (!developmentDemo) {
        try {
          if (logoPath) await deleteObject(storageRef(storage, logoPath)).catch(() => {})
          const safeName = logoFile.name.replace(/[^a-zA-Z0-9._-]/g, '-')
          logoPath = `schools/${workspace.schoolId}/branding/${session.uid}/certificate-${Date.now()}-${safeName}`
          const uploaded = await uploadBytes(storageRef(storage, logoPath), logoFile, { contentType: logoFile.type })
          logo = await getDownloadURL(uploaded.ref)
        } catch {
          logo = await fileToDataUrl(logoFile)
          logoPath = ''
        }
      } else {
        logo = await fileToDataUrl(logoFile)
      }
    }
    const row = { ...settings, logo, logoPath, updatedAt: Date.now() }
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/certificateSettings`, token, { method: 'PUT', body: row })
    }
    setCertificateSettings(row)
  }

  const saveExamRecord = async exam => {
    const now = Date.now()
    const id = exam.id || `exam_${now}`
    const row = { ...exam, id, name: exam.name || 'Annual Exam 2026', createdAt: exam.createdAt || now, updatedAt: now }
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/exams/${id}`, token, { method: 'PUT', body: row })
    }
    setExamData(current => ({ ...current, exams: { ...current.exams, [id]: row } }))
    return row
  }

  const saveDateSheetRow = async row => {
    const now = Date.now()
    const id = row.id || `sheet_${now}`
    const item = { ...row, id, createdAt: row.createdAt || now, updatedAt: now }
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/dateSheet/${id}`, token, { method: 'PUT', body: item })
    }
    setExamData(current => ({ ...current, dateSheet: { ...current.dateSheet, [id]: item } }))
    return item
  }

  const deleteDateSheetRow = async id => {
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/dateSheet/${id}`, token, { method: 'DELETE' })
    }
    setExamData(current => {
      const dateSheet = { ...current.dateSheet }
      delete dateSheet[id]
      return { ...current, dateSheet }
    })
  }

  const saveAdmitCards = async cards => {
    const now = Date.now()
    const entries = cards.map((card, index) => ({ ...card, id: card.id || `admit_${card.examId}_${card.studentId}_${now}_${index}`, generatedOn: now }))
    const certificateEntries = entries.map((card, index) => {
      const student = students.find(item => item.id === card.studentId) || {}
      const certificateNumber = `ADM-${new Date().getFullYear()}-${String(Object.values(certificates).filter(item => item.certificateType === 'admit').length + index + 1).padStart(4, '0')}`
      return {
        id: `certificate_admit_${card.examId}_${card.studentId}_${now}_${index}`,
        certificateType: 'admit',
        certificateNumber,
        studentId: card.studentId,
        studentName: student.name || card.studentName || '',
        admissionNo: student.roll || card.rollNo || '',
        className: student.className || card.className || '',
        issueDate: today(),
        examId: card.examId,
        data: { examId: card.examId, examName: card.examName, showPendingFee: card.showPendingFee },
        status: 'Generated',
        printCount: 1,
        createdBy: session?.displayName || session?.email?.split('@')[0] || workspace.role,
        createdAt: now,
        updatedAt: now,
      }
    })
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest('', token, { method: 'PATCH', body: {
        ...Object.fromEntries(entries.map(card => [`schools/${workspace.schoolId}/admitCards/${card.id}`, card])),
        ...Object.fromEntries(certificateEntries.map(row => [`schools/${workspace.schoolId}/certificates/${row.id}`, row])),
      } })
    }
    setExamData(current => ({ ...current, admitCards: { ...current.admitCards, ...Object.fromEntries(entries.map(card => [card.id, card])) } }))
    setCertificates(current => ({ ...current, ...Object.fromEntries(certificateEntries.map(row => [row.id, row])) }))
    return entries
  }

  const deleteCertificate = async id => {
    if (!window.confirm('Delete this certificate register entry?')) return
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/certificates/${id}`, token, { method: 'DELETE' })
    }
    setCertificates(current => {
      const next = { ...current }
      delete next[id]
      return next
    })
  }

  const updateCertificateStatus = async (id, status, extra = {}) => {
    const updatedAt = Date.now()
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/certificates/${id}`, token, { method: 'PATCH', body: { status, updatedAt, ...extra } })
    }
    setCertificates(current => ({ ...current, [id]: { ...current[id], status, updatedAt, ...extra } }))
  }

  const saveReportExam = async exam => {
    const now = Date.now()
    const id = exam.id || `report_exam_${now}`
    const row = { ...exam, id, createdAt: exam.createdAt || now, updatedAt: now }
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/reportExams/${id}`, token, { method: 'PUT', body: row })
    }
    setReportData(current => ({ ...current, exams: { ...current.exams, [id]: row } }))
    return row
  }

  const deleteReportExam = async id => {
    if (!id) return
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/reportExams/${id}`, token, { method: 'DELETE' })
    }
    setReportData(current => {
      const exams = { ...current.exams }
      delete exams[id]
      return { ...current, exams }
    })
  }

  const saveReportMarks = async marks => {
    const id = `${marks.examId}_${marks.studentId}`
    const row = { ...marks, id, updatedAt: Date.now(), createdAt: marks.createdAt || Date.now() }
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/reportMarks/${id}`, token, { method: 'PUT', body: row })
    }
    setReportData(current => ({ ...current, marks: { ...current.marks, [id]: row } }))
    setActivities(current => [{ id: `report-marks-${id}-${Date.now()}`, title: row.status === 'published' ? 'Result published' : 'Marks draft saved', detail: `${row.className}-${row.section} · ${row.examId}`, at: Date.now(), icon: 'R' }, ...current])
    return row
  }

  const saveReportCard = async report => {
    const id = report.id || `${report.examId}_${report.studentId}`
    const row = { ...report, id, updatedAt: Date.now(), createdAt: report.createdAt || Date.now() }
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/reportCards/${id}`, token, { method: 'PUT', body: row })
    }
    setReportData(current => ({ ...current, reports: { ...current.reports, [id]: row } }))
    return row
  }

  const updateReportCard = async (id, changes) => {
    const updatedAt = Date.now()
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/reportCards/${id}`, token, { method: 'PATCH', body: { ...changes, updatedAt } })
      await databaseRequest(`schools/${workspace.schoolId}/reportMarks/${id}`, token, { method: 'PATCH', body: { ...changes, updatedAt } }).catch(() => {})
    }
    setReportData(current => ({
      ...current,
      reports: { ...current.reports, [id]: { ...(current.reports[id] || {}), ...changes, updatedAt } },
      marks: current.marks[id] ? { ...current.marks, [id]: { ...current.marks[id], ...changes, updatedAt } } : current.marks,
    }))
  }

  const saveIdCardSettings = async settings => {
    const row = { ...settings, updatedAt: Date.now() }
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/idCardSettings`, token, { method: 'PUT', body: row })
    }
    setIdCardSettings(row)
    setActivities(current => [{ id: `id-card-settings-${Date.now()}`, title: 'ID card template saved', detail: row.templateName || 'Template updated', at: Date.now(), icon: 'ID' }, ...current])
    return row
  }

  const saveIdCard = async card => {
    const id = card.id || `idcard_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const row = { ...card, id, updatedAt: Date.now(), createdAt: card.createdAt || Date.now() }
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/idCards/${id}`, token, { method: 'PUT', body: row })
    }
    setIdCards(current => ({ ...current, [id]: row }))
    setActivities(current => [{ id: `id-card-${id}`, title: 'ID card generated', detail: `${row.personName} · ${row.cardNo}`, at: row.createdAt, icon: 'ID' }, ...current])
    return row
  }

  const deleteIdCard = async id => {
    if (!id) return
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/idCards/${id}`, token, { method: 'DELETE' })
    }
    setIdCards(current => {
      const next = { ...current }
      delete next[id]
      return next
    })
  }

  const uploadIdCardLogo = async file => {
    if (!file) throw new Error('Please choose a logo file.')
    if (!/^image\/(png|jpe?g)$/i.test(file.type)) throw new Error('School logo must be JPG or PNG.')
    const compressed = await imageCompression(file, {
      maxSizeMB: 0.18,
      maxWidthOrHeight: 512,
      useWebWorker: true,
      fileType: 'image/jpeg',
      initialQuality: 0.82,
    })
    let logo = ''
    let logoPath = `schools/${workspace.schoolId}/profile/logo.jpg`
    if (!developmentDemo) {
      try {
        const uploaded = await uploadBytes(storageRef(storage, logoPath), compressed, { contentType: 'image/jpeg' })
        logo = await getDownloadURL(uploaded.ref)
      } catch (error) {
        console.warn('Storage logo upload failed, saving compressed data URL fallback.', error)
        logo = await fileToDataUrl(compressed)
        logoPath = ''
      }
    } else {
      logo = await fileToDataUrl(compressed)
      logoPath = ''
    }
    const row = { ...workspace.schoolProfile, logo, logoURL: logo, logoUrl: logo, logoPath, updatedAt: Date.now() }
    if (!developmentDemo) {
      const token = await session.getIdToken()
      await databaseRequest(`schools/${workspace.schoolId}/profile`, token, { method: 'PATCH', body: row })
    }
    setWorkspace(current => ({ ...current, schoolName: row.schoolName, schoolProfile: row }))
    return logo
  }

  return { students, notices, fees, feeManager, attendance, timetableData, timetableRecords, homework, transport, library, accounts, leave, parents, parentMessages, parentNotifications, certificateRequests, enquiries, staff, staffAttendance, employeeConfig, approvals, expenses, academics, documents, certificates, certificateSettings, examData, reportData, idCards, idCardSettings, activities, backupSettings, workspace, createSchoolWorkspace, getNextAdmissionNumber, addStudent, updateStudent, updateStudentPhoto, recordPayment, submitFeeReceipt, saveFeeGroup, deleteFeeGroup, saveFeeStructure, deleteFeeStructure, deleteFeeReceipt, restoreFeeReceipt, decideFeeApproval, saveFeeManagerConfig, createBackupPayload, restoreBackup, saveBackupSettings, saveSchoolProfile, saveParentAccount, addNotice, saveAttendance, saveEmployeeConfig, deleteEmployeeConfig, saveEmployee, deleteEmployee, saveStaffAttendance, savePeriod, saveTimetableRecord, deleteTimetableRecord, saveHomework, deleteHomework, markHomeworkDone, markHomeworkSeen, saveTransportItem, deleteTransportItem, saveExpenseItem, deleteExpenseItem, saveLibraryItem, deleteLibraryItem, saveAccountsItem, deleteAccountsItem, saveLeaveItem, deleteLeaveItem, saveEnquiry, uploadStudentDocument, saveCertificate, saveCertificateSettings, saveExamRecord, saveDateSheetRow, deleteDateSheetRow, saveAdmitCards, deleteCertificate, updateCertificateStatus, saveReportExam, deleteReportExam, saveReportMarks, saveReportCard, updateReportCard, saveIdCardSettings, saveIdCard, deleteIdCard, uploadIdCardLogo, developmentDemo }
}

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(isFirebaseConfigured)
  const [loginSplash, setLoginSplash] = useState(false)
  const sawLoggedOutState = useRef(false)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('northstar-theme') === 'dark')

  useEffect(() => {
    localStorage.setItem('northstar-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => {
    if (!isFirebaseConfigured) return
    const unsubscribe = onAuthStateChanged(auth, user => {
      setSession(user)
      setAuthLoading(false)
      if (user) {
        if (sawLoggedOutState.current) {
          setLoginSplash(true)
        }
        return
      }
      sawLoggedOutState.current = true
      setLoginSplash(false)
    })
    return () => {
      unsubscribe()
    }
  }, [])

  const data = useSchoolWorkspace(session)

  if (window.location.pathname.startsWith('/parent')) return <ParentPortal />
  if (!isFirebaseConfigured && import.meta.env.VITE_APP_ENV === 'production') {
    return <main className="setup-error"><ShieldCheck size={30} /><h1>Secure setup required</h1><p>Firebase environment variables are missing. Configure the deployment before launch.</p></main>
  }
  if (authLoading) return <SplashScreen persistent />
  if (isFirebaseConfigured && !session) return <AuthScreen />

  if (data.workspace.needsSetup) return <SchoolSetup user={session} onSubmit={data.createSchoolWorkspace} />
  if (loginSplash) return <SplashScreen onComplete={() => { setLoginSplash(false); setPage('dashboard') }} />
  if (data.workspace.loading) return <SplashScreen persistent />
  if (data.workspace.error) return <main className="setup-error"><ShieldCheck size={30} /><h1>Workspace unavailable</h1><p>{data.workspace.error}</p><button className="secondary-button" onClick={() => signOut(auth)}>Sign out</button></main>

  const userName = session?.displayName || session?.email?.split('@')[0] || 'Demo Admin'
  const profile = {
    name: userName,
    role: data.workspace.role,
    email: session?.email || 'Local demo',
    photo: session?.photoURL || '',
    initials: userName.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase(),
  }
  const current = nav.find(item => item.id === page) || nav[0]
  const screens = {
    dashboard: <Dashboard students={data.students} notices={data.notices} fees={data.fees} attendance={data.attendance} activities={data.activities} staff={data.staff} staffAttendance={data.staffAttendance} employeeConfig={data.employeeConfig} approvals={data.approvals} expenses={data.expenses} transport={data.transport} library={data.library} leaveData={data.leave} setPage={setPage} onSelectStudent={setSelectedStudent} />,
    admissions: <Admissions students={data.students} enquiries={data.enquiries} onAddStudent={data.addStudent} onUpdateStudent={data.updateStudent} onSaveEnquiry={data.saveEnquiry} getNextAdmissionNumber={data.getNextAdmissionNumber} school={data.workspace.schoolProfile} />,
    students: <Students students={data.students} onAddStudent={data.addStudent} onUpdateStudent={data.updateStudent} onSelectStudent={setSelectedStudent} getNextAdmissionNumber={data.getNextAdmissionNumber} />,
    employees: <EmployeeManager staff={data.staff} attendance={data.staffAttendance} config={data.employeeConfig} saveConfig={data.saveEmployeeConfig} deleteConfig={data.deleteEmployeeConfig} saveEmployee={data.saveEmployee} deleteEmployee={data.deleteEmployee} saveAttendance={data.saveStaffAttendance} />,
    leave: <LeaveManager staff={data.staff} config={data.employeeConfig} leave={data.leave} saveLeaveItem={data.saveLeaveItem} deleteLeaveItem={data.deleteLeaveItem} saveStaffAttendance={data.saveStaffAttendance} />,
    attendance: <Attendance students={data.students} attendance={data.attendance} onSaveAttendance={data.saveAttendance} />,
    fees: <FeeManager students={data.students} fees={data.fees} feeManager={data.feeManager} approvals={data.approvals.fees || {}} schoolProfile={data.workspace.schoolProfile} onSubmitFee={data.submitFeeReceipt} onSaveGroup={data.saveFeeGroup} onDeleteGroup={data.deleteFeeGroup} onSaveStructure={data.saveFeeStructure} onDeleteStructure={data.deleteFeeStructure} onDeleteReceipt={data.deleteFeeReceipt} onRestoreReceipt={data.restoreFeeReceipt} onDecideApproval={data.decideFeeApproval} onSaveConfig={data.saveFeeManagerConfig} onOpenProfile={setSelectedStudent} />,
    academics: <Academics timetableData={data.timetableData} timetableRecords={data.timetableRecords} students={data.students} onSavePeriod={data.savePeriod} onSaveTimetable={data.saveTimetableRecord} onDeleteTimetable={data.deleteTimetableRecord} />,
    homework: <HomeworkManager students={data.students} homework={data.homework} saveHomework={data.saveHomework} deleteHomework={data.deleteHomework} markHomeworkDone={data.markHomeworkDone} markHomeworkSeen={data.markHomeworkSeen} profile={profile} />,
    transport: <TransportManager students={data.students} transport={data.transport} saveTransportItem={data.saveTransportItem} deleteTransportItem={data.deleteTransportItem} />,
    expenses: <ExpenseManager expenses={data.expenses} staff={data.staff} fees={data.fees} saveExpenseItem={data.saveExpenseItem} deleteExpenseItem={data.deleteExpenseItem} />,
    library: <LibraryManager students={data.students} library={data.library} saveLibraryItem={data.saveLibraryItem} deleteLibraryItem={data.deleteLibraryItem} />,
    accounts: <AccountsManager students={data.students} fees={data.fees} expenses={data.expenses} transport={data.transport} library={data.library} staff={data.staff} employeeConfig={data.employeeConfig} accounts={data.accounts} school={data.workspace.schoolProfile} saveAccountsItem={data.saveAccountsItem} deleteAccountsItem={data.deleteAccountsItem} saveExpenseItem={data.saveExpenseItem} setPage={setPage} />,
    parents: <ParentAccounts parents={data.parents} students={data.students} school={data.workspace.schoolProfile} onSaveParent={data.saveParentAccount} />,
    reports: <ReportCardManager students={data.students} school={data.workspace.schoolProfile} reportData={data.reportData} onSaveExam={data.saveReportExam} onDeleteExam={data.deleteReportExam} onSaveMarks={data.saveReportMarks} onSaveReport={data.saveReportCard} onUpdateReport={data.updateReportCard} />,
    certificates: <CertificateManager students={data.students} fees={data.fees} attendance={data.attendance} academics={data.academics} documents={data.documents} school={data.workspace.schoolProfile} certificates={data.certificates} settings={data.certificateSettings} examData={data.examData} onSave={data.saveCertificate} onSaveSettings={data.saveCertificateSettings} onSaveExam={data.saveExamRecord} onSaveDateSheet={data.saveDateSheetRow} onDeleteDateSheet={data.deleteDateSheetRow} onSaveAdmitCards={data.saveAdmitCards} onDelete={data.deleteCertificate} onStatus={data.updateCertificateStatus} />,
    'id-cards': <IDCardManager students={data.students} staff={data.staff} school={data.workspace.schoolProfile} idCards={data.idCards} settings={data.idCardSettings} onSaveSettings={data.saveIdCardSettings} onSaveCard={data.saveIdCard} onDeleteCard={data.deleteIdCard} onUploadLogo={data.uploadIdCardLogo} />,
    notices: <Notices notices={data.notices} onAddNotice={data.addNotice} />,
    'school-profile': <SchoolProfile profile={data.workspace.schoolProfile} students={data.students} staff={data.staff} save={data.saveSchoolProfile} />,
    backup: <BackupCenter students={data.students} fees={data.fees} attendance={data.attendance} settings={data.backupSettings} createBackup={data.createBackupPayload} restoreBackup={data.restoreBackup} saveSettings={data.saveBackupSettings} role={data.workspace.role} />,
  }
  const logout = async () => {
    localStorage.removeItem('northstar-school-id')
    localStorage.removeItem('northstar-pending-school-profile')
    await signOut(auth)
    setPage('dashboard')
  }
  return <div className={`app-shell ${darkMode ? 'theme-dark' : 'theme-light'}`}><Sidebar page={page} setPage={setPage} open={menuOpen} close={() => setMenuOpen(false)} schoolName={data.workspace.schoolName} schoolLogo={data.workspace.schoolProfile.logoURL || data.workspace.schoolProfile.logo} schoolCode={data.workspace.schoolProfile.schoolCode} cloudMode={!data.developmentDemo} profile={profile} /><main className="main-area"><Header title={current.label} subtitle={`${data.workspace.schoolName} · ${data.workspace.schoolProfile.academicYear || '2026-27'}`} schoolCode={data.workspace.schoolProfile.schoolCode} onMenu={() => setMenuOpen(true)} profile={profile} onSignOut={logout} students={data.students} onSelectStudent={setSelectedStudent} darkMode={darkMode} onToggleTheme={() => setDarkMode(current => !current)} /><div className="page-content page-enter" key={page}>{screens[page]}</div></main>{selectedStudent && <StudentProfile student={data.students.find(student => student.id === selectedStudent.id) || selectedStudent} close={() => setSelectedStudent(null)} attendance={data.attendance} fees={data.fees} feeManager={data.feeManager} schoolProfile={data.workspace.schoolProfile} academics={data.academics} documents={data.documents} onRecordPayment={data.recordPayment} onUploadDocument={data.uploadStudentDocument} onUpdatePhoto={data.updateStudentPhoto} />}</div>
}

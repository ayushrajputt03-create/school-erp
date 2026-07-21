import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useStudentPhotos } from './student-photos'
import {
  Badge, Download, Eye, FileImage, Layers, Palette, Printer, QrCode,
  Save, Search, Settings, ShieldCheck, Trash2, Upload, Users
} from 'lucide-react'
import DatePicker from './DatePicker'
import { IdCardDesign, ID_DESIGNS, isFixedDesign } from './idCardTemplates'
import './IDCardManager.css'

const DESIGN_KEY = 'northstar-id-design'

const CARD_TYPES = [
  { id: 'student', label: 'Student ID Card', prefix: 'STU' },
  { id: 'teacher', label: 'Teacher ID Card', prefix: 'TCH' },
  { id: 'staff', label: 'Staff ID Card', prefix: 'STF' },
  { id: 'visitor', label: 'Visitor Pass', prefix: 'VIS' },
]

const CARD_SIZES = {
  horizontal: { label: 'PVC Horizontal 86 x 54 mm', width: 86, height: 54, orientation: 'landscape' },
  vertical: { label: 'PVC Vertical 54 x 86 mm', width: 54, height: 86, orientation: 'portrait' },
  a4: { label: 'A4 Printable Sheet', width: 190, height: 277, orientation: 'portrait' },
  custom: { label: 'Custom Size', width: 86, height: 54, orientation: 'landscape' },
}

const today = () => new Date().toISOString().slice(0, 10)
const addYears = years => {
  const date = new Date()
  date.setFullYear(date.getFullYear() + years)
  return date.toISOString().slice(0, 10)
}

const FIELD_LABELS = {
  photo: 'Photo',
  schoolLogo: 'School Logo',
  schoolName: 'School Name',
  name: 'Name',
  admissionNo: 'Admission No',
  employeeId: 'Employee ID',
  classSection: 'Class / Section',
  designation: 'Designation',
  department: 'Department',
  rollNumber: 'Roll Number',
  house: 'House',
  dob: 'Date of Birth',
  gender: 'Gender',
  bloodGroup: 'Blood Group',
  fatherName: 'Father Name',
  motherName: 'Mother Name',
  contact: 'Contact Number',
  email: 'Email',
  address: 'Address',
  transportRoute: 'Transport Route',
  rfid: 'RFID Number',
  visitorPurpose: 'Visitor Purpose',
  visitorTime: 'Visitor Date / Time',
  issueDate: 'Issue Date',
  expiryDate: 'Expiry Date',
  barcode: 'Barcode',
  qrCode: 'QR Code',
  board: 'Affiliation / Board',
  motto: 'Motto',
  principal: 'Principal Name',
  signature: 'Principal Signature',
  seal: 'School Seal',
}

const BASE_LAYOUT = {
  schoolLogo: { x: 4, y: 4, w: 9, h: 9 },
  schoolName: { x: 15, y: 4, w: 52, h: 7 },
  photo: { x: 6, y: 17, w: 20, h: 24 },
  name: { x: 29, y: 17, w: 37, h: 6 },
  admissionNo: { x: 29, y: 24, w: 35, h: 5 },
  employeeId: { x: 29, y: 24, w: 35, h: 5 },
  classSection: { x: 29, y: 30, w: 35, h: 5 },
  designation: { x: 29, y: 30, w: 35, h: 5 },
  department: { x: 29, y: 36, w: 35, h: 5 },
  fatherName: { x: 29, y: 36, w: 42, h: 5 },
  contact: { x: 29, y: 42, w: 36, h: 5 },
  visitorPurpose: { x: 29, y: 30, w: 40, h: 5 },
  visitorTime: { x: 29, y: 36, w: 42, h: 5 },
  qrCode: { x: 69, y: 31, w: 12, h: 12 },
  barcode: { x: 6, y: 46, w: 42, h: 5 },
}

const TEMPLATE_DEFAULTS = {
  student: {
    name: 'Student Premium Blue',
    fields: {
      photo: true, schoolLogo: true, schoolName: true, name: true, admissionNo: true,
      classSection: true, rollNumber: false, fatherName: true, contact: true,
      dob: false, gender: false, bloodGroup: false, house: false, address: false,
      issueDate: true, expiryDate: true, qrCode: true, barcode: true,
    },
    backFields: { address: true, contact: true, qrCode: true, motto: true, principal: true, signature: true, seal: true },
    layout: BASE_LAYOUT,
  },
  teacher: {
    name: 'Teacher Corporate Blue',
    fields: {
      photo: true, schoolLogo: true, schoolName: true, name: true, employeeId: true,
      designation: true, department: true, contact: true, email: false, bloodGroup: false,
      address: false, issueDate: true, expiryDate: true, qrCode: true, barcode: true,
    },
    backFields: { address: true, contact: true, qrCode: true, motto: true, principal: true, signature: true, seal: true },
    layout: BASE_LAYOUT,
  },
  staff: {
    name: 'Staff Clean Blue',
    fields: {
      photo: true, schoolLogo: true, schoolName: true, name: true, employeeId: true,
      designation: true, department: false, contact: true, bloodGroup: false, address: false,
      issueDate: true, expiryDate: true, qrCode: true, barcode: true,
    },
    backFields: { address: true, contact: true, qrCode: true, motto: true, principal: true, signature: true, seal: true },
    layout: BASE_LAYOUT,
  },
  visitor: {
    name: 'Visitor Pass',
    fields: {
      schoolLogo: true, schoolName: true, name: true, employeeId: false, visitorPurpose: true,
      visitorTime: true, contact: true, qrCode: true, barcode: false,
    },
    backFields: { address: true, contact: true, qrCode: true, motto: true, seal: true },
    layout: BASE_LAYOUT,
  },
}

const DEFAULT_SETTINGS = {
  theme: '#052659',
  accent: '#5483B3',
  background: '#ffffff',
  font: 'Inter, Arial, sans-serif',
  size: 'horizontal',
  customWidth: 86,
  customHeight: 54,
  cornerRadius: 3,
  watermark: true,
}

function initials(value = '') {
  return String(value).split(/\s+/).map(part => part[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'ID'
}

function safeLogo(school) {
  return school?.logo || school?.logoURL || school?.logoUrl || ''
}

function mmStyle(box) {
  return { left: `${box.x}mm`, top: `${box.y}mm`, width: `${box.w}mm`, height: `${box.h}mm` }
}

function classParts(value = '') {
  const [className = '', section = ''] = String(value).split('-')
  return { className: className.trim(), section: section.trim() }
}

// This used to be a 7x7 pattern derived from a string hash - it looked like a QR code but
// encoded nothing, so the "Scan to verify ERP profile" line on the card back was not true and
// nothing could actually be scanned. Now a real QR encoding the verification URL.
function QRPreview({ value }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let active = true
    const text = String(value || '')
    if (!text) { setSrc(''); return undefined }
    import('qrcode')
      .then(({ default: QRCode }) => QRCode.toDataURL(text, { margin: 0, width: 320, errorCorrectionLevel: 'M', color: { dark: '#021024ff', light: '#ffffffff' } }))
      .then(result => { if (active) setSrc(result) })
      .catch(() => { if (active) setSrc('') })
    return () => { active = false }
  }, [value])
  return <div className="id-qr" title={value}>{src ? <img src={src} alt="" /> : null}</div>
}

function BarcodePreview({ value }) {
  const chars = String(value || 'NXT').padEnd(20, '0').slice(0, 20)
  return <div className="id-barcode">{chars.split('').map((char, index) => <i key={index} style={{ width: `${(char.charCodeAt(0) % 3) + 1}px` }} />)}</div>
}

function studentPerson(student) {
  const parts = classParts(student.className)
  return {
    id: student.id,
    type: 'student',
    name: student.name,
    photo: student.photoUrl,
    admissionNo: student.roll,
    className: parts.className,
    section: parts.section,
    classSection: student.className,
    rollNumber: student.roll,
    fatherName: student.fatherName,
    motherName: student.motherName,
    contact: student.phone,
    email: student.email,
    dob: student.dob,
    gender: student.gender,
    bloodGroup: student.bloodGroup || '',
    address: [student.address, student.city, student.state, student.pincode].filter(Boolean).join(', '),
    house: student.house || '',
    transportRoute: student.transportRoute || '',
    rfid: student.rfid || '',
  }
}

function staffPerson(row) {
  const designation = row.designation || row.employeeRole || 'Staff'
  const name = `${row.firstName || ''} ${row.lastName || ''}`.trim() || row.name || 'Employee'
  const isTeacher = /teacher/i.test(`${designation} ${row.employeeRole || ''}`)
  return {
    id: row.id,
    type: isTeacher ? 'teacher' : 'staff',
    name,
    photo: row.photoUrl,
    employeeId: row.employeeCode,
    designation,
    department: row.department || '',
    contact: row.phone,
    email: row.email,
    address: row.address,
    bloodGroup: row.bloodGroup || '',
  }
}

function visitorPerson(form) {
  return {
    id: 'visitor-current',
    type: 'visitor',
    name: form.visitorName || 'Visitor Name',
    employeeId: form.visitorId || `VIS-${new Date().toISOString().slice(5, 10).replace('-', '')}`,
    visitorPurpose: form.purpose || 'Visitor Meeting',
    visitorTime: `${form.issueDate || today()} ${form.visitTime || new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`,
    contact: form.visitorPhone || '',
    address: form.visitorAddress || '',
  }
}

function valueForField(field, person, school, form) {
  const values = {
    schoolName: school.schoolName || 'School Name',
    name: person.name,
    admissionNo: `Adm No: ${person.admissionNo || ''}`,
    employeeId: person.type === 'visitor' ? `Pass No: ${person.employeeId || ''}` : `Emp ID: ${person.employeeId || ''}`,
    classSection: person.classSection ? `Class: ${person.className} / ${person.section}` : '',
    designation: person.designation ? `Designation: ${person.designation}` : '',
    department: person.department ? `Department: ${person.department}` : '',
    rollNumber: person.rollNumber ? `Roll No: ${person.rollNumber}` : '',
    house: person.house ? `House: ${person.house}` : '',
    dob: person.dob ? `DOB: ${person.dob}` : '',
    gender: person.gender ? `Gender: ${person.gender}` : '',
    bloodGroup: person.bloodGroup ? `Blood: ${person.bloodGroup}` : '',
    fatherName: person.fatherName ? `Father: ${person.fatherName}` : '',
    motherName: person.motherName ? `Mother: ${person.motherName}` : '',
    contact: person.contact ? `Phone: ${person.contact}` : '',
    email: person.email ? `Email: ${person.email}` : '',
    address: person.address || school.address || '',
    transportRoute: person.transportRoute ? `Route: ${person.transportRoute}` : '',
    rfid: person.rfid ? `RFID: ${person.rfid}` : '',
    visitorPurpose: person.visitorPurpose ? `Purpose: ${person.visitorPurpose}` : '',
    visitorTime: person.visitorTime ? `Date/Time: ${person.visitorTime}` : '',
    issueDate: `Issue: ${form.issueDate || today()}`,
    expiryDate: `Valid Till: ${form.expiryDate || addYears(1)}`,
    board: school.affiliation || school.board || '',
    motto: school.motto || 'Learn. Lead. Serve.',
    principal: school.principalName || form.principalName || '',
  }
  return values[field] || ''
}

function CardPreview({ person, school, settings, template, form, side, selectedField, onSelect }) {
  const size = settings.size === 'custom'
    ? { width: Number(settings.customWidth || 86), height: Number(settings.customHeight || 54) }
    : CARD_SIZES[settings.size] || CARD_SIZES.horizontal
  const fields = side === 'front' ? template.fields : template.backFields
  const layout = { ...BASE_LAYOUT, ...(template.layout || {}) }
  const logo = safeLogo(school)
  const verification = `${location.origin}/?verify=${person.type}-${person.admissionNo || person.employeeId || person.id}`
  const textFields = Object.keys(fields).filter(field => !['photo', 'schoolLogo', 'schoolName', 'qrCode', 'barcode', 'signature', 'seal'].includes(field) && fields[field])

  return <div
    id="id-card-preview"
    className={`id-card-preview ${side === 'back' ? 'back-side' : ''} ${person.type}-template`}
    style={{
      width: `${size.width}mm`,
      height: `${size.height}mm`,
      borderRadius: `${settings.cornerRadius || 3}mm`,
      '--id-theme': settings.theme,
      '--id-accent': settings.accent,
      '--id-bg': settings.background,
      '--id-font': settings.font,
    }}
  >
    {settings.watermark && <div className="id-watermark">{logo ? <img src={logo} alt="" /> : initials(school.schoolName)}</div>}
    <div className="id-swoosh" />
    {side === 'front' ? <>
      {fields.schoolLogo && <button type="button" className={`id-el logo ${selectedField === 'schoolLogo' ? 'selected' : ''}`} style={mmStyle(layout.schoolLogo)} onClick={() => onSelect('schoolLogo')}>{logo ? <img src={logo} alt="School logo" /> : initials(school.schoolName)}</button>}
      {fields.schoolName && <button type="button" className={`id-el school ${selectedField === 'schoolName' ? 'selected' : ''}`} style={mmStyle(layout.schoolName)} onClick={() => onSelect('schoolName')}><strong>{school.schoolName || 'School Name'}</strong><span>{school.address || 'School address'}{school.phone ? ` | ${school.phone}` : ''}</span></button>}
      {fields.photo && <button type="button" className={`id-el photo ${selectedField === 'photo' ? 'selected' : ''}`} style={mmStyle(layout.photo)} onClick={() => onSelect('photo')}>{person.photo ? <img src={person.photo} alt="" /> : <span>{initials(person.name)}</span>}</button>}
      {textFields.map((field, index) => {
        const value = valueForField(field, person, school, form)
        if (!value) return null
        const box = layout[field] || { x: 29, y: 17 + index * 5.7, w: 42, h: 5 }
        return <button type="button" key={field} className={`id-el text ${field} ${selectedField === field ? 'selected' : ''}`} style={mmStyle(box)} onClick={() => onSelect(field)}>{field === 'name' ? <strong>{value}</strong> : value}</button>
      })}
      {fields.qrCode && <button type="button" className={`id-el qr ${selectedField === 'qrCode' ? 'selected' : ''}`} style={mmStyle(layout.qrCode)} onClick={() => onSelect('qrCode')}><QRPreview value={verification} /></button>}
      {fields.barcode && <button type="button" className={`id-el barcode ${selectedField === 'barcode' ? 'selected' : ''}`} style={mmStyle(layout.barcode)} onClick={() => onSelect('barcode')}><BarcodePreview value={person.admissionNo || person.employeeId || person.id} /></button>}
    </> : <div className="id-back-content">
      <h4>{school.schoolName || 'School Name'}</h4>
      {fields.motto && <p className="motto">"{school.motto || 'Learn. Lead. Serve.'}"</p>}
      {fields.address && <p><strong>Address:</strong> {school.address || person.address || 'School address'}</p>}
      {fields.contact && <p><strong>Contact:</strong> {school.phone || person.contact || 'Not provided'} {school.email ? `| ${school.email}` : ''}</p>}
      {fields.qrCode && <div className="back-qr"><QRPreview value={verification} /><span>Scan to verify ERP profile</span></div>}
      <div className="id-sign-row">
        {fields.signature && <div><i />Principal Sign</div>}
        {fields.seal && <div className="seal">Seal</div>}
      </div>
    </div>}
  </div>
}

function DesignPicker({ value, onChange }) {
  return <div className="idc-picker">
    <label style={{ fontSize: 8, fontWeight: 700, color: '#536073' }}>Card Design</label>
    <div className="idc-picker-grid">{ID_DESIGNS.map(item => <button
      type="button" key={item.id} className={value === item.id ? 'active' : ''} onClick={() => onChange(item.id)}
    >
      <i className={`idc-swatch idc-swatch-${item.id}`} />
      {item.label}
      {item.note && <small>{item.note}</small>}
    </button>)}</div>
    <p className="idc-picker-note">
      {value === 'custom'
        ? 'Custom Layout uses the field toggles and drag positions below.'
        : 'Ready-made design, 54 x 86 mm portrait. Field toggles and drag positions do not apply to it, and optional details the record is missing (blood group, house, route) are left off the card rather than printed empty.'}
    </p>
  </div>
}

export default function IDCardManager({ students, staff, school, idCards, settings, onSaveSettings, onSaveCard, onDeleteCard, onUploadLogo }) {
  const [tab, setTab] = useState('generate')
  const [cardType, setCardType] = useState('student')
  const [side, setSide] = useState('front')
  const [query, setQuery] = useState('')
  const [className, setClassName] = useState('')
  const [section, setSection] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [selectedField, setSelectedField] = useState('name')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [logoPreview, setLogoPreview] = useState(safeLogo(school))
  const [visitor, setVisitor] = useState({ visitorName: '', visitorPhone: '', visitorAddress: '', purpose: 'Visitor Meeting', visitTime: '' })
  const [form, setForm] = useState({ issueDate: today(), expiryDate: addYears(1), principalName: school.principalName || '' })
  const [common, setCommon] = useState({ ...DEFAULT_SETTINGS, ...(settings?.common || settings || {}) })
  // Which design renders. 'custom' is the existing drag-and-drop editor and stays the default,
  // so a school that already laid out its card sees no change. Remembered per browser rather
  // than written to the saved settings record - it is a choice of look, not stored school data.
  const [design, setDesign] = useState(() => localStorage.getItem(DESIGN_KEY) || 'custom')
  useEffect(() => { localStorage.setItem(DESIGN_KEY, design) }, [design])
  const [templates, setTemplates] = useState(() => ({
    student: { ...TEMPLATE_DEFAULTS.student, ...(settings?.templates?.student || {}) },
    teacher: { ...TEMPLATE_DEFAULTS.teacher, ...(settings?.templates?.teacher || {}) },
    staff: { ...TEMPLATE_DEFAULTS.staff, ...(settings?.templates?.staff || {}) },
    visitor: { ...TEMPLATE_DEFAULTS.visitor, ...(settings?.templates?.visitor || {}) },
  }))
  const printRef = useRef(null)

  useEffect(() => setLogoPreview(safeLogo(school)), [school])

  const allStaff = useMemo(() => Object.values(staff || {}).map(staffPerson), [staff])
  const people = useMemo(() => {
    if (cardType === 'student') return students.map(studentPerson)
    if (cardType === 'teacher') return allStaff.filter(person => person.type === 'teacher')
    if (cardType === 'staff') return allStaff.filter(person => person.type === 'staff')
    return [visitorPerson({ ...visitor, ...form })]
  }, [students, allStaff, cardType, visitor, form])

  const classOptions = Array.from(new Set(students.map(student => classParts(student.className).className).filter(Boolean))).sort()
  const sectionOptions = Array.from(new Set(students.filter(student => !className || classParts(student.className).className === className).map(student => classParts(student.className).section).filter(Boolean))).sort()
  const filteredPeople = people.filter(person => {
    const term = `${person.name} ${person.admissionNo || ''} ${person.employeeId || ''} ${person.classSection || ''} ${person.contact || ''} ${person.designation || ''}`.toLowerCase()
    const classOk = cardType !== 'student' || !className || person.className === className
    const sectionOk = cardType !== 'student' || !section || person.section === section
    return classOk && sectionOk && term.includes(query.trim().toLowerCase())
  })
  const selectedPeople = filteredPeople.filter(person => selectedIds.includes(person.id))
  const activePerson = selectedPeople[0] || filteredPeople[0] || people[0] || visitorPerson({ ...visitor, ...form })
  // Cards render person.photo, which comes from the student's photoUrl. Staff and visitor ids
  // simply miss and are cached as misses, so they are never requested twice.
  useStudentPhotos([...selectedPeople.map(person => person.id), activePerson?.id])
  const activeTemplate = templates[cardType]
  const fieldList = Object.keys(activeTemplate.fields)
  const backFieldList = Object.keys(activeTemplate.backFields)
  const fieldBox = activeTemplate.layout?.[selectedField] || BASE_LAYOUT[selectedField] || { x: 28, y: 18, w: 36, h: 5 }
  const generatedCards = Object.values(idCards || {}).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

  const schoolForPreview = { ...school, logo: logoPreview || safeLogo(school) }
  const switchType = type => {
    setCardType(type)
    setSelectedIds([])
    setQuery('')
    setSide('front')
    setSelectedField('name')
  }
  const updateTemplate = patch => setTemplates(current => ({ ...current, [cardType]: { ...current[cardType], ...patch } }))
  const updateField = field => updateTemplate({ fields: { ...activeTemplate.fields, [field]: !activeTemplate.fields[field] } })
  const updateBackField = field => updateTemplate({ backFields: { ...activeTemplate.backFields, [field]: !activeTemplate.backFields[field] } })
  const updateBox = (key, value) => updateTemplate({ layout: { ...activeTemplate.layout, [selectedField]: { ...fieldBox, [key]: Number(value) } } })

  const saveTemplate = async () => {
    setSaving(true)
    try {
      await onSaveSettings({ common, templates })
      setNotice('ID card template saved successfully.')
    } finally {
      setSaving(false)
    }
  }

  const uploadLogo = async event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setSaving(true)
    const previousLogo = logoPreview
    let preview = ''
    try {
      preview = URL.createObjectURL(file)
      setLogoPreview(preview)
      const url = await onUploadLogo(file)
      setLogoPreview(url)
      setNotice('School logo uploaded and applied to ID cards.')
    } catch (error) {
      console.error(error)
      setLogoPreview(previousLogo)
      setNotice(error.message || 'Logo upload failed.')
    } finally {
      if (preview) URL.revokeObjectURL(preview)
      setSaving(false)
    }
  }

  const generateCards = async () => {
    const target = cardType === 'visitor' ? [visitorPerson({ ...visitor, ...form })] : (selectedPeople.length ? selectedPeople : [activePerson])
    setSaving(true)
    try {
      for (const person of target) {
        const type = CARD_TYPES.find(item => item.id === cardType)
        const primary = person.admissionNo || person.employeeId || person.id
        await onSaveCard({
          type: cardType,
          cardNo: `${type?.prefix || 'IDC'}-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}-${String(primary).replace(/\W/g, '')}`,
          personId: person.id,
          personName: person.name,
          primaryId: primary,
          classSection: person.classSection || person.designation || person.visitorPurpose || '',
          issueDate: form.issueDate,
          expiryDate: form.expiryDate,
          template: activeTemplate.name,
          createdAt: Date.now(),
        })
      }
      setNotice(`${target.length} ID card${target.length > 1 ? 's' : ''} generated and saved.`)
    } finally {
      setSaving(false)
    }
  }

  const downloadImage = async format => {
    const card = printRef.current?.querySelector('#id-card-preview')
    if (!card) return
    const { default: html2canvas } = await import('html2canvas')
    const canvas = await html2canvas(card, { scale: 3, useCORS: true, backgroundColor: null })
    const link = document.createElement('a')
    link.download = `${activePerson.name || 'id-card'}.${format}`
    link.href = canvas.toDataURL(`image/${format === 'jpg' ? 'jpeg' : 'png'}`, 0.95)
    link.click()
  }

  const downloadPDF = async () => {
    const card = printRef.current?.querySelector('#id-card-preview')
    if (!card) return
    // The ready-made designs are always 54 x 86 portrait. Sizing the PDF page from the size
    // selector instead would squash them onto an 86 x 54 landscape sheet.
    const size = isFixedDesign(design)
      ? { width: 54, height: 86 }
      : common.size === 'custom' ? { width: Number(common.customWidth || 86), height: Number(common.customHeight || 54) } : CARD_SIZES[common.size]
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ])
    const canvas = await html2canvas(card, { scale: 3, useCORS: true, backgroundColor: '#ffffff' })
    const pdf = new jsPDF(size.width >= size.height ? 'landscape' : 'portrait', 'mm', [size.width, size.height])
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, size.width, size.height)
    pdf.save(`${activePerson.name || 'id-card'}.pdf`)
  }

  const printCards = () => {
    const html = printRef.current?.innerHTML || ''
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(link => link.outerHTML).join('')
    const popup = window.open('', '_blank', 'width=1100,height=800')
    popup.document.write(`<html><head><title>ID Cards</title>${styles}</head><body><div class="id-print-sheet">${html}</div><script>setTimeout(()=>window.print(),600)</script></body></html>`)
    popup.document.close()
  }

  const openHtmlPreview = () => {
    const html = printRef.current?.innerHTML || ''
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(link => link.outerHTML).join('')
    const popup = window.open('', '_blank', 'width=1100,height=800')
    popup.document.write(`<html><head><title>ID Card HTML Preview</title>${styles}<style>body{margin:0;background:#eef2f7;padding:24px}.id-html-wrap{display:flex;gap:18px;flex-wrap:wrap;justify-content:center}</style></head><body><div class="id-html-wrap">${html}</div></body></html>`)
    popup.document.close()
  }

  return <div className="id-manager">
    <div className="section-actions"><div><span className="eyebrow">Premium ID Cards</span><h2>ID Card Generator</h2><p>Separate templates for Student, Teacher, Staff and Visitor cards with live HTML preview.</p></div><div className="toolbar-actions"><button className="secondary-button" onClick={openHtmlPreview}><Eye size={16} /> HTML Preview</button><button className="primary-button" onClick={generateCards} disabled={saving}><Badge size={16} />{saving ? 'Working...' : 'Generate ID'}</button></div></div>
    <div className="id-tabs">{[['generate', 'Generate'], ['builder', 'Design Builder'], ['bulk', 'Bulk Print'], ['history', 'History']].map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}</div>
    {notice && <div className="id-notice"><ShieldCheck size={15} />{notice}<button onClick={() => setNotice('')}>×</button></div>}
    <div className="id-grid">
      <aside className="id-controls panel">
        <div className="control-block"><h3><Settings size={15} /> Card Type</h3><div className="id-type-grid">{CARD_TYPES.map(type => <button key={type.id} className={cardType === type.id ? 'active' : ''} onClick={() => switchType(type.id)}>{type.label}</button>)}</div></div>
        <div className="control-block"><h3><Search size={15} /> {cardType === 'visitor' ? 'Visitor Details' : 'Data Source Search'}</h3>
          {cardType === 'visitor' ? <div className="id-form-mini"><input placeholder="Visitor name" value={visitor.visitorName} onChange={event => setVisitor({ ...visitor, visitorName: event.target.value })} /><input placeholder="Phone" value={visitor.visitorPhone} onChange={event => setVisitor({ ...visitor, visitorPhone: event.target.value })} /><input placeholder="Purpose" value={visitor.purpose} onChange={event => setVisitor({ ...visitor, purpose: event.target.value })} /><input placeholder="Time e.g. 10:30 AM" value={visitor.visitTime} onChange={event => setVisitor({ ...visitor, visitTime: event.target.value })} /></div> : <>
            {cardType === 'student' && <div className="id-filter-row"><select value={className} onChange={event => { setClassName(event.target.value); setSelectedIds([]) }}><option value="">All Classes</option>{classOptions.map(item => <option key={item}>{item}</option>)}</select><select value={section} onChange={event => { setSection(event.target.value); setSelectedIds([]) }}><option value="">All Sections</option>{sectionOptions.map(item => <option key={item}>{item}</option>)}</select></div>}
            <div className="table-search id-search"><Search size={14} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search ${cardType}s by name, id, class, phone`} /></div>
            {tab === 'bulk' && cardType === 'student' && <button className="secondary-button full" onClick={() => setSelectedIds(filteredPeople.map(person => person.id))}><Users size={15} /> Select all filtered</button>}
            <div className="id-person-list">{filteredPeople.map(person => <label key={person.id} className={selectedIds.includes(person.id) ? 'chosen' : ''}><input type="checkbox" checked={selectedIds.includes(person.id)} onChange={event => setSelectedIds(current => event.target.checked ? [...new Set([...current, person.id])] : current.filter(id => id !== person.id))} /><span>{person.photo ? <img src={person.photo} alt="" /> : initials(person.name)}</span><strong>{person.name}<small>{person.admissionNo || person.employeeId} · {person.classSection || person.designation}</small></strong></label>)}{!filteredPeople.length && <p className="empty-state">No records found. Check class filter or add records first.</p>}</div>
          </>}
        </div>
        <div className="control-block"><h3><Palette size={15} /> Card Design</h3><DesignPicker value={design} onChange={setDesign} /></div>
        <div className="control-block"><h3><Layers size={15} /> Card Settings</h3><label>School Logo<label className="id-logo-upload">{logoPreview ? <img src={logoPreview} alt="" /> : initials(school.schoolName)}<span><Upload size={14} /> Upload logo</span><input type="file" accept="image/png,image/jpeg,image/jpg" onChange={uploadLogo} /></label></label><label>Size<select value={common.size} onChange={event => setCommon({ ...common, size: event.target.value })}>{Object.entries(CARD_SIZES).map(([id, size]) => <option key={id} value={id}>{size.label}</option>)}</select></label>{common.size === 'custom' && <div className="id-filter-row"><input type="number" value={common.customWidth} onChange={event => setCommon({ ...common, customWidth: event.target.value })} /><input type="number" value={common.customHeight} onChange={event => setCommon({ ...common, customHeight: event.target.value })} /></div>}<div className="id-date-row"><label>Issue<DatePicker value={form.issueDate} onChange={value => setForm({ ...form, issueDate: value })} /></label><label>Expiry<DatePicker value={form.expiryDate} onChange={value => setForm({ ...form, expiryDate: value })} /></label></div></div>
      </aside>
      <main className="id-workspace">
        <div className="id-preview-toolbar panel"><div><button className={side === 'front' ? 'active' : ''} onClick={() => setSide('front')}>Front Side</button><button className={side === 'back' ? 'active' : ''} onClick={() => setSide('back')}>Back Side</button></div><div><button onClick={() => downloadImage('png')}><FileImage size={15} /> PNG</button><button onClick={() => downloadImage('jpg')}><Download size={15} /> JPG</button><button onClick={downloadPDF}><Download size={15} /> PDF</button><button onClick={printCards}><Printer size={15} /> Print</button></div></div>
        <div className="id-preview-stage"><div ref={printRef} className={`id-print-set ${tab === 'bulk' ? 'bulk' : ''}`}>{(tab === 'bulk' ? (selectedPeople.length ? selectedPeople : filteredPeople).slice(0, 60) : [activePerson]).map(person => <div className="id-print-pair" key={`${person.id}-${side}`}>{isFixedDesign(design)
            ? <IdCardDesign design={design} side={side} person={person} school={schoolForPreview} form={form} watermark={common.watermark} qr={<QRPreview value={`${location.origin}/?verify=${person.type}-${person.admissionNo || person.employeeId || person.id}`} />} />
            : <CardPreview person={person} school={schoolForPreview} settings={common} template={activeTemplate} form={form} side={side} selectedField={selectedField} onSelect={setSelectedField} />}</div>)}</div></div>
      </main>
      <aside className="id-builder panel">
        {tab === 'history' ? <><h3><Badge size={15} /> Generated Cards</h3><div className="id-history-table">{generatedCards.map(card => <div key={card.id || card.cardNo}><strong>{card.personName}</strong><span>{card.cardNo}</span><small>{card.type} · {card.createdAt ? new Date(card.createdAt).toLocaleDateString('en-IN') : card.issueDate}</small><button onClick={() => { setTab('generate'); setCardType(card.type || 'student'); setNotice('History card opened. Search/select the person to reprint latest data.') }}>View</button><button onClick={printCards}>Reprint</button>{onDeleteCard && <button className="danger" onClick={() => onDeleteCard(card.id)}><Trash2 size={13} /></button>}</div>)}{!generatedCards.length && <p className="empty-state">No generated cards found.</p>}</div></> : <>
          <h3><Palette size={15} /> Editable Builder</h3>
          <div className="color-row"><label>Theme<input type="color" value={common.theme} onChange={event => setCommon({ ...common, theme: event.target.value })} /></label><label>Accent<input type="color" value={common.accent} onChange={event => setCommon({ ...common, accent: event.target.value })} /></label><label>BG<input type="color" value={common.background} onChange={event => setCommon({ ...common, background: event.target.value })} /></label></div>
          <label>Template Name<input value={activeTemplate.name} onChange={event => updateTemplate({ name: event.target.value })} /></label>
          <label>Font<select value={common.font} onChange={event => setCommon({ ...common, font: event.target.value })}><option>Inter, Arial, sans-serif</option><option>Arial, sans-serif</option><option>Georgia, serif</option><option>Times New Roman, serif</option></select></label>
          <label className="toggle-line"><input type="checkbox" checked={common.watermark} onChange={event => setCommon({ ...common, watermark: event.target.checked })} /> Watermark logo</label>
          <div className="field-toggles"><h4>{CARD_TYPES.find(type => type.id === cardType)?.label} Fields</h4>{fieldList.map(field => <label key={field}><input type="checkbox" checked={!!activeTemplate.fields[field]} onChange={() => updateField(field)} />{FIELD_LABELS[field] || field}</label>)}</div>
          <div className="field-toggles"><h4>Back Fields</h4>{backFieldList.map(field => <label key={field}><input type="checkbox" checked={!!activeTemplate.backFields[field]} onChange={() => updateBackField(field)} />{FIELD_LABELS[field] || field}</label>)}</div>
          <div className="layout-editor"><h4>Move / Resize Selected</h4><select value={selectedField} onChange={event => setSelectedField(event.target.value)}>{Array.from(new Set([...fieldList, 'schoolLogo', 'schoolName', 'photo', 'qrCode', 'barcode'])).map(field => <option key={field} value={field}>{FIELD_LABELS[field] || field}</option>)}</select><div className="id-filter-row">{['x', 'y', 'w', 'h'].map(key => <label key={key}>{key.toUpperCase()}<input type="number" step="0.5" value={fieldBox[key]} onChange={event => updateBox(key, event.target.value)} /></label>)}</div></div>
          <button className="primary-button full" onClick={saveTemplate} disabled={saving}><Save size={16} /> Save Template</button>
        </>}
      </aside>
    </div>
  </div>
}

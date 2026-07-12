import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Award, Check, Download, Eye, FileBadge, FileText, GraduationCap,
  IdCard, Medal, MessageCircle, Printer, Save, Search, Settings,
  ShieldCheck, Trash2, X,
} from 'lucide-react'
import DatePicker from './DatePicker'
import { classOptions } from './schoolOptions'
import './CertificateManager.css'

const certificateTypes = [
  { id: 'tc', name: 'Transfer Certificate', short: 'TC', icon: FileBadge, description: 'Complete school leaving record' },
  { id: 'bonafide', name: 'Bonafide Certificate', short: 'BON', icon: ShieldCheck, description: 'Official student verification' },
  { id: 'character', name: 'Character Certificate', short: 'CHR', icon: Award, description: 'Conduct and moral character' },
  { id: 'study', name: 'Study Certificate', short: 'STD', icon: GraduationCap, description: 'Current enrollment confirmation' },
  { id: 'sports', name: 'Sports Certificate', short: 'SPT', icon: Medal, description: 'Participation and achievement' },
  { id: 'admit', name: 'Admit Card', short: 'ADM', icon: IdCard, description: 'Exam entry card with date sheet' },
]
const titles = Object.fromEntries(certificateTypes.map(item => [item.id, item.name.toUpperCase()]))
const prefix = Object.fromEntries(certificateTypes.map(item => [item.id, item.short]))

const today = () => {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}
const longDate = value => value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '-'
const shortDate = value => value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB') : '-'
const weekDay = value => value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long' }) : '-'
const dashDate = value => shortDate(value).replace(/\//g, '-')
const academicYear = value => String(value || '2026-27')
const classParts = value => {
  const raw = String(value || '').trim()
  if (!raw) return { className: '-', section: '-' }
  const normalized = raw.replace(/\s+/g, ' ')
  const slashMatch = normalized.match(/^(.+?)\s*\/\s*([A-Za-z0-9]+)$/)
  if (slashMatch) return { className: slashMatch[1].trim(), section: slashMatch[2].trim() }
  const dashMatch = normalized.match(/^(.+?)\s*[-–—]\s*([A-Za-z0-9]+)$/)
  if (dashMatch) return { className: dashMatch[1].trim(), section: dashMatch[2].trim() }
  const spaceMatch = normalized.match(/^(.+?)\s+([A-Za-z])$/)
  if (spaceMatch) return { className: spaceMatch[1].trim(), section: spaceMatch[2].trim() }
  return { className: normalized, section: '-' }
}
const pronouns = student => student?.gender === 'Female'
  ? { subject: 'She', subjectLower: 'she', possessive: 'Her', possessiveLower: 'her', relation: 'Daughter', object: 'her' }
  : { subject: 'He', subjectLower: 'he', possessive: 'His', possessiveLower: 'his', relation: 'Son', object: 'him' }
const numberWords = value => {
  const ones = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN']
  const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY']
  const n = Number(value)
  if (!n) return ''
  if (n < 20) return ones[n]
  if (n < 100) return [tens[Math.floor(n / 10)], ones[n % 10]].filter(Boolean).join(' ')
  if (n < 1000) return [ones[Math.floor(n / 100)], 'HUNDRED', numberWords(n % 100)].filter(Boolean).join(' ')
  if (n < 10000) return [numberWords(Math.floor(n / 1000)), 'THOUSAND', numberWords(n % 1000)].filter(Boolean).join(' ')
  return String(n)
}
const dateInWords = value => {
  if (!value) return '-'
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  const ordinals = ['', 'FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH', 'SIXTH', 'SEVENTH', 'EIGHTH', 'NINTH', 'TENTH', 'ELEVENTH', 'TWELFTH', 'THIRTEENTH', 'FOURTEENTH', 'FIFTEENTH', 'SIXTEENTH', 'SEVENTEENTH', 'EIGHTEENTH', 'NINETEENTH', 'TWENTIETH', 'TWENTY FIRST', 'TWENTY SECOND', 'TWENTY THIRD', 'TWENTY FOURTH', 'TWENTY FIFTH', 'TWENTY SIXTH', 'TWENTY SEVENTH', 'TWENTY EIGHTH', 'TWENTY NINTH', 'THIRTIETH', 'THIRTY FIRST']
  const month = date.toLocaleDateString('en-IN', { month: 'long' }).toUpperCase()
  return `${ordinals[date.getDate()]} ${month} ${numberWords(date.getFullYear())}`
}
const numberForPreview = type => `${prefix[type] || 'CERT'}-${new Date().getFullYear()}-001`
const profilePhoto = student => student?.photoUrl || student?.photo || student?.photoURL || student?.imageUrl || ''
const serialOnly = value => String(value || '').match(/(\d+)$/)?.[1] || '001'
const imageFormat = dataUrl => String(dataUrl || '').startsWith('data:image/png') ? 'PNG' : 'JPEG'
const numericClass = value => Number(String(value || '').match(/\d+/)?.[0] || 0)
const admissionNo = student => student?.admissionNo || student?.roll || student?.admissionNumber || ''
const studentInitials = student => student?.initials || String(student?.name || 'ST').split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase()
const schoolInitials = (school = {}, settings = {}) => String(settings.schoolName || school.schoolName || school.name || 'School').split(/\s+/).map(part => part[0]).join('').slice(0, 3).toUpperCase()
const schoolLogo = (school = {}, settings = {}) => settings.logoURL || settings.logo || school.logoURL || school.logo || school.schoolLogo || ''
const schoolNameOf = (school = {}, settings = {}) => settings.schoolName || school.schoolName || school.name || 'School Name'
const schoolRecognition = (school = {}, settings = {}) => settings.recognition || settings.affiliatedTo || school.affiliatedTo || school.recognition || ''
const schoolAffiliationNo = (school = {}, settings = {}) => settings.affiliationNo || school.affiliationNo || ''
const schoolCodeOf = (school = {}, settings = {}) => settings.schoolCode || school.schoolCode || ''
const schoolAddress = (school = {}, settings = {}) => [settings.address || school.address, settings.city || school.city, settings.state || school.state, settings.pincode || school.pincode].filter(Boolean).join(', ') || 'School Address'
const schoolPhone = (school = {}, settings = {}) => settings.phone || settings.schoolContactNo || school.schoolContactNo || school.phone || ''
const schoolEmail = (school = {}, settings = {}) => settings.email || settings.schoolEmail || school.schoolEmail || school.email || ''
const admitTime = (from, to) => [from, to].filter(Boolean).join(' - ') || ''
const defaultDateSheetRows = ['Mathematics', 'Science', 'English', 'Hindi'].map(subject => ({ subject, date: '', fromTime: '', toTime: '' }))
const waitFrame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
const waitForPrintableAssets = async (selector = '.formal-certificate, .admit-card') => {
  await waitFrame()
  await new Promise(resolve => setTimeout(resolve, 250))
  const root = document.querySelector(selector)
  const images = Array.from(root?.querySelectorAll('img') || [])
  await Promise.all(images.map(image => {
    if (image.complete) return Promise.resolve()
    return new Promise(resolve => {
      const done = () => resolve()
      image.addEventListener('load', done, { once: true })
      image.addEventListener('error', done, { once: true })
      setTimeout(done, 1200)
    })
  }))
  await waitFrame()
}
const safePrint = async (selector = '.certificate-preview-shell') => {
  document.body.classList.add('erp-printing')
  document.querySelectorAll('.print-target').forEach(node => node.classList.remove('print-target'))
  const target = document.querySelector(selector)
  target?.classList.add('print-target')
  const cleanup = () => {
    document.body.classList.remove('erp-printing')
    target?.classList.remove('print-target')
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup, { once: true })
  await waitForPrintableAssets(selector)
  window.print()
  setTimeout(cleanup, 2500)
}
const admitPrintCss = `
  @page { size: A4 portrait; margin: 10mm; }
  * { box-sizing: border-box; }
  html, body { width: 210mm; min-height: 297mm; margin: 0; padding: 0; background: #fff; }
  body { color: #021024; font-family: Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .admit-print-grid { display: block; width: 100%; margin: 0; padding: 0; background: #fff; }
  .admit-card { width: 190mm; min-height: 277mm; margin: 0 auto; padding: 7mm; background: #fff; color: #021024; border: 2px solid #000; border-radius: 0; overflow: hidden; position: relative; page-break-after: always; page-break-inside: avoid; break-inside: avoid; box-shadow: none; font-family: Arial, sans-serif; letter-spacing: 0; }
  .admit-card::after { content: ""; position: absolute; inset: 3mm; border: 1px solid #000; pointer-events: none; z-index: 5; }
  .admit-card > * { position: relative; z-index: 6; }
  .admit-school-header { display: grid; grid-template-columns: 24mm minmax(0, 1fr) 24mm; gap: 5mm; align-items: center; background: #052659; color: #fff; border-bottom: 2px solid #000; padding: 5mm 6mm; }
  .admit-school-logo { width: 22mm; height: 22mm; border: 1px solid #fff; background: #fff; border-radius: 3px; display: grid; place-items: center; overflow: hidden; color: #052659; }
  .admit-school-logo img { width: 100%; height: 100%; object-fit: contain; }
  .admit-school-logo span { display: grid; text-align: center; font-size: 12pt; line-height: 1; }
  .admit-school-logo small { font-size: 6pt; letter-spacing: 1px; }
  .admit-school-copy { min-width: 0; text-align: center; }
  .admit-school-copy h1 { margin: 0 0 1.5mm; color: #fff; font-size: 18pt; line-height: 1.05; text-transform: uppercase; letter-spacing: .2px; overflow-wrap: anywhere; }
  .admit-school-copy p, .admit-school-copy small { display: block; margin: 0 0 .8mm; color: #fff; font-size: 8pt; line-height: 1.2; overflow-wrap: anywhere; }
  .admit-header-spacer { width: 22mm; height: 22mm; }
  .admit-title-band { display: grid; grid-template-columns: 1fr 32mm; gap: 7mm; align-items: center; background: #eef6ff; border-bottom: 1px solid #000; padding: 6mm 6mm; min-height: 44mm; }
  .admit-title-band h2 { margin: 0; color: #052659; font-size: 24pt; letter-spacing: 2.5px; }
  .admit-title-band strong { display: block; margin-top: 2mm; color: #021024; font-size: 11pt; }
  .admit-student-photo { width: 30mm; height: 38mm; justify-self: end; border: 1px solid #000; background: #fff; display: grid; place-items: center; color: #64748b; font: 700 8pt/1.2 Arial; text-align: center; overflow: hidden; }
  .admit-student-photo img { width: 100%; height: 100%; object-fit: cover; }
  .admit-student-photo span { border: 1px dashed #777; width: calc(100% - 8px); height: calc(100% - 8px); display: grid; place-items: center; padding: 4px; }
  .admit-student-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2.2mm 7mm; padding: 6mm 6mm 4mm; }
  .admit-student-grid div { display: grid; grid-template-columns: 32mm 1fr; gap: 3mm; align-items: baseline; border-bottom: 1px dotted #777; padding-bottom: 1.3mm; font-size: 9.5pt; }
  .admit-student-grid .full { grid-column: 1 / -1; }
  .admit-student-grid strong { color: #000; }
  .admit-date-table { width: calc(100% - 12mm); margin: 2mm 6mm 5mm; border-collapse: collapse; font-size: 9pt; table-layout: fixed; }
  .admit-date-table th { background: #052659; color: #fff; text-align: left; padding: 2.2mm 3mm; border: 1px solid #000; }
  .admit-date-table td { padding: 2.2mm 3mm; border: 1px solid #777; color: #000; word-break: break-word; }
  .admit-date-table tbody tr:nth-child(even) { background: #eff6ff; }
  .missing-date { color: #991b1b; font-weight: 800; font-size: 8pt; }
  .admit-date-warning { margin: -2mm 6mm 4mm; padding: 2mm 3mm; border: 1px solid #fecaca; background: #fff1f2; color: #991b1b; border-radius: 2mm; font-size: 8pt; font-weight: 800; }
  .admit-instructions { margin: 0 6mm 5mm; padding: 3.5mm; background: #f8fbff; border: 1px solid #b9d2f0; border-radius: 2mm; page-break-inside: avoid; }
  .admit-instructions h3 { margin: 0 0 1.5mm; color: #000; font-size: 9.5pt; }
  .admit-instructions ol { margin: 0; padding-left: 5mm; font-size: 8.6pt; line-height: 1.45; }
  .admit-pending-fee { display: block; margin: 0 6mm 2mm; color: #b91c1c; font-size: 9pt; }
  .admit-issued { display: block; margin: 0 6mm 4mm; color: #000; font: 800 9pt Arial, sans-serif; }
  .admit-signatures { display: flex; justify-content: space-between; align-items: flex-end; gap: 9mm; padding: 8mm 6mm 6mm; font-size: 8.8pt; page-break-inside: avoid; break-inside: avoid; }
  .admit-signatures div { flex: 1 1 0; min-width: 0; display: grid; gap: 1.5mm; text-align: center; }
  .admit-signatures i { height: 12mm; border-bottom: 1px solid #000; }
  .admit-footer-note { position: absolute; left: 13mm; right: 13mm; bottom: 8mm; z-index: 6; display: flex; justify-content: space-between; gap: 8mm; border-top: 1px solid #cbd5e1; padding-top: 2mm; color: #334155; font-size: 7.5pt; }
  @media print { .admit-card { page-break-after: always; } .admit-card:last-child { page-break-after: auto; } }
`
const printAdmitCardsHtml = async html => {
  if (!html?.trim()) throw new Error('No admit card content is ready to print.')
  const oldFrame = document.getElementById('admit-card-print-frame')
  oldFrame?.remove()
  const frame = document.createElement('iframe')
  frame.id = 'admit-card-print-frame'
  frame.title = 'Admit Card Print'
  frame.setAttribute('aria-hidden', 'true')
  Object.assign(frame.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '0',
    height: '0',
    border: '0',
    opacity: '0',
    pointerEvents: 'none',
  })
  document.body.appendChild(frame)
  const frameWindow = frame.contentWindow
  const frameDocument = frame.contentDocument || frameWindow?.document
  if (!frameWindow || !frameDocument) throw new Error('Print frame could not be created.')
  frameDocument.open()
  frameDocument.write(`<!doctype html><html><head><title>Admit Card Print</title><style>${admitPrintCss}</style></head><body><main class="admit-print-grid">${html}</main></body></html>`)
  frameDocument.close()
  await new Promise(resolve => {
    if (frameDocument.readyState === 'complete') resolve()
    else frame.onload = resolve
    setTimeout(resolve, 900)
  })
  await Promise.all(Array.from(frameDocument.images || []).map(image => {
    if (image.complete) return Promise.resolve()
    return new Promise(resolve => {
      const done = () => resolve()
      image.addEventListener('load', done, { once: true })
      image.addEventListener('error', done, { once: true })
      setTimeout(done, 1600)
    })
  }))
  await new Promise(resolve => setTimeout(resolve, 250))
  frameWindow.focus()
  frameWindow.print()
  setTimeout(() => frame.remove(), 2500)
}
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))
const imageHtml = (src, fallback, style = '') => src
  ? `<img src="${escapeHtml(src)}" alt="" style="${style}" />`
  : fallback
const admitCardPrintHtml = ({ student, exam = {}, dateRows = [], school = {}, settings = {}, showPendingFee = false, pendingAmount = 0 }) => {
  const { className, section } = classParts(student?.className)
  const rows = dateRows.length ? dateRows : defaultDateSheetRows
  const schoolName = schoolNameOf(school, settings)
  const address = schoolAddress(school, settings)
  const phone = schoolPhone(school, settings) || 'XXXXXXXX'
  const email = schoolEmail(school, settings) || 'school@example.com'
  const recognition = schoolRecognition(school, settings)
  const affiliationNo = schoolAffiliationNo(school, settings)
  const code = schoolCodeOf(school, settings)
  const examName = exam.name || 'Annual Examination 2026-27'
  const logo = schoolLogo(school, settings)
  const photo = profilePhoto(student)
  const dateRowsHtml = rows.map((row, index) => `
    <tr style="${index % 2 ? 'background:#eff6ff;' : ''}">
      <td style="padding:2mm 3mm;border:1px solid #777;color:#000;">${escapeHtml(row.subject || 'Subject')}</td>
      <td style="padding:2mm 3mm;border:1px solid #777;color:#000;">${row.date ? escapeHtml(shortDate(row.date)) : '<span style="color:#991b1b;font-weight:800;font-size:8pt;">Set Date Sheet</span>'}</td>
      <td style="padding:2mm 3mm;border:1px solid #777;color:#000;">${admitTime(row.fromTime, row.toTime) ? escapeHtml(admitTime(row.fromTime, row.toTime)) : '<span style="color:#991b1b;font-weight:800;font-size:8pt;">Set Time</span>'}</td>
    </tr>
  `).join('')
  return `
    <article class="admit-card" style="width:190mm;min-height:277mm;margin:0 auto;padding:7mm;background:#fff;color:#021024;border:2px solid #000;overflow:hidden;position:relative;page-break-after:always;page-break-inside:avoid;break-inside:avoid;font-family:Arial,sans-serif;letter-spacing:0;box-sizing:border-box;">
      <div style="position:absolute;inset:3mm;border:1px solid #000;pointer-events:none;z-index:5;"></div>
      <header class="admit-school-header" style="position:relative;z-index:6;display:grid;grid-template-columns:24mm minmax(0,1fr) 24mm;gap:5mm;align-items:center;background:#052659;color:#fff;border-bottom:2px solid #000;padding:5mm 6mm;box-sizing:border-box;">
        <div class="admit-school-logo" style="width:22mm;height:22mm;border:1px solid #fff;background:#fff;border-radius:3px;display:grid;place-items:center;overflow:hidden;color:#052659;box-sizing:border-box;">
          ${imageHtml(logo, `<span style="display:grid;text-align:center;font-size:12pt;line-height:1;"><strong>${escapeHtml(schoolInitials(school, settings))}</strong><small style="font-size:6pt;letter-spacing:1px;">SCHOOL</small></span>`, 'width:100%;height:100%;object-fit:contain;display:block;')}
        </div>
        <div class="admit-school-copy" style="min-width:0;text-align:center;">
          <h1 style="margin:0 0 1.5mm;color:#fff;font-size:18pt;line-height:1.05;text-transform:uppercase;letter-spacing:.2px;overflow-wrap:anywhere;">${escapeHtml(schoolName)}</h1>
          ${recognition ? `<p style="display:block;margin:0 0 .8mm;color:#fff;font-size:8pt;line-height:1.2;overflow-wrap:anywhere;">${escapeHtml(recognition)}</p>` : ''}
          <p style="display:block;margin:0 0 .8mm;color:#fff;font-size:8pt;line-height:1.2;overflow-wrap:anywhere;">${escapeHtml(address)}</p>
          <small style="display:block;margin:0 0 .8mm;color:#fff;font-size:8pt;line-height:1.2;">Phone: ${escapeHtml(phone)} | Email: ${escapeHtml(email)}</small>
          <small style="display:block;margin:0;color:#fff;font-size:8pt;line-height:1.2;">Affiliation No: ${escapeHtml(affiliationNo || '___')}${code ? ` | School Code: ${escapeHtml(code)}` : ''}</small>
        </div>
        <div class="admit-header-spacer" style="width:22mm;height:22mm;"></div>
      </header>
      <section class="admit-title-band" style="position:relative;z-index:6;display:grid;grid-template-columns:1fr 32mm;gap:7mm;align-items:center;background:#eef6ff;border-bottom:1px solid #000;padding:6mm 6mm;min-height:44mm;box-sizing:border-box;">
        <div><h2 style="margin:0;color:#052659;font-size:24pt;letter-spacing:2.5px;">ADMIT CARD</h2><strong style="display:block;margin-top:2mm;color:#021024;font-size:11pt;">${escapeHtml(examName)}</strong></div>
        <div class="admit-student-photo" style="width:30mm;height:38mm;justify-self:end;border:1px solid #000;background:#fff;display:grid;place-items:center;color:#64748b;font:700 8pt/1.2 Arial;text-align:center;overflow:hidden;box-sizing:border-box;">
          ${imageHtml(photo, '<span style="border:1px dashed #777;width:calc(100% - 8px);height:calc(100% - 8px);display:grid;place-items:center;padding:4px;">Paste Photo Here</span>', 'width:100%;height:100%;object-fit:cover;display:block;')}
        </div>
      </section>
      <section class="admit-student-grid" style="position:relative;z-index:6;display:grid;grid-template-columns:1fr 1fr;gap:2.2mm 7mm;padding:6mm 6mm 4mm;box-sizing:border-box;">
        ${[
          ['Student Name', student?.name || '-'],
          ['Roll Number', student?.rollNo || student?.rollNumber || admissionNo(student) || '-'],
          ['Admission No', admissionNo(student) || '-'],
          ['Father Name', student?.fatherName || student?.guardian || '-'],
          ['Date of Birth', shortDate(student?.dob)],
          ['Class & Sec', `${className} / ${section}`],
        ].map(([label, value]) => `<div style="display:grid;grid-template-columns:32mm 1fr;gap:3mm;align-items:baseline;border-bottom:1px dotted #777;padding-bottom:1.3mm;font-size:9.5pt;box-sizing:border-box;"><strong style="color:#000;">${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`).join('')}
        <div style="grid-column:1/-1;display:grid;grid-template-columns:32mm 1fr;gap:3mm;align-items:baseline;border-bottom:1px dotted #777;padding-bottom:1.3mm;font-size:9.5pt;box-sizing:border-box;"><strong style="color:#000;">Exam Name</strong><span>${escapeHtml(examName)}</span></div>
      </section>
      <table class="admit-date-table" style="position:relative;z-index:6;width:calc(100% - 12mm);margin:2mm 6mm 5mm;border-collapse:collapse;font-size:9pt;table-layout:fixed;">
        <thead><tr><th style="background:#052659;color:#fff;text-align:left;padding:2.2mm 3mm;border:1px solid #000;">Subject</th><th style="background:#052659;color:#fff;text-align:left;padding:2.2mm 3mm;border:1px solid #000;">Date</th><th style="background:#052659;color:#fff;text-align:left;padding:2.2mm 3mm;border:1px solid #000;">Time</th></tr></thead>
        <tbody>${dateRowsHtml}</tbody>
      </table>
      ${dateRows.length ? '' : '<div class="admit-date-warning" style="position:relative;z-index:6;margin:-2mm 6mm 4mm;padding:2mm 3mm;border:1px solid #fecaca;background:#fff1f2;color:#991b1b;border-radius:2mm;font-size:8pt;font-weight:800;">Date Sheet not saved for this exam/class yet. Add it from the Date Sheet tab.</div>'}
      <section class="admit-instructions" style="position:relative;z-index:6;margin:0 6mm 5mm;padding:3.5mm;background:#f8fbff;border:1px solid #b9d2f0;border-radius:2mm;page-break-inside:avoid;">
        <h3 style="margin:0 0 1.5mm;color:#000;font-size:9.5pt;">IMPORTANT INSTRUCTIONS</h3>
        <ol style="margin:0;padding-left:5mm;font-size:8.6pt;line-height:1.45;">
          <li>Carry this admit card and valid photo ID to examination centre. Without it entry will be denied.</li>
          <li>Reach 30 minutes before exam.</li>
          <li>No mobile phones, smartwatches, calculators allowed in exam.</li>
          <li>Follow dress code strictly.</li>
          <li>Malpractice will lead to cancellation of candidature and disciplinary action.</li>
          <li>For fee queries contact office.</li>
        </ol>
      </section>
      ${showPendingFee && pendingAmount > 0 ? `<strong class="admit-pending-fee" style="position:relative;z-index:6;display:block;margin:0 6mm 2mm;color:#b91c1c;font-size:9pt;">Pending Fees: Rs. ${Number(pendingAmount).toLocaleString('en-IN')}</strong>` : ''}
      <strong class="admit-issued" style="position:relative;z-index:6;display:block;margin:0 6mm 4mm;color:#000;font:800 9pt Arial,sans-serif;">Issued On: ${escapeHtml(longDate(today()))}</strong>
      <footer class="admit-signatures" style="position:relative;z-index:6;display:flex;justify-content:space-between;align-items:flex-end;gap:9mm;padding:8mm 6mm 6mm;font-size:8.8pt;page-break-inside:avoid;break-inside:avoid;">
        ${['Class Teacher', 'Exam Controller', 'Principal & Stamp'].map(label => `<div style="flex:1 1 0;min-width:0;display:grid;gap:1.5mm;text-align:center;"><span>${label}</span><i style="height:12mm;border-bottom:1px solid #000;"></i></div>`).join('')}
      </footer>
      <div class="admit-footer-note" style="position:absolute;left:13mm;right:13mm;bottom:8mm;z-index:6;display:flex;justify-content:space-between;gap:8mm;border-top:1px solid #cbd5e1;padding-top:2mm;color:#334155;font-size:7.5pt;">
        <span>Generated by School ERP</span>
        ${code ? `<span>School Code: ${escapeHtml(code)}</span>` : ''}
        <span>Issue Date: ${escapeHtml(longDate(today()))}</span>
      </div>
    </article>
  `
}
const examPresets = [
  { id: 'first-term', name: 'First Term Examination' },
  { id: 'half-yearly', name: 'Half Yearly Examination' },
  { id: 'annual', name: 'Annual Examination' },
  { id: 'pre-board', name: 'Pre Board Examination' },
]
const subjectPresets = ['English', 'Hindi', 'Mathematics', 'Science', 'Social Science', 'Computer', 'EVS', 'Drawing', 'GK', 'Sanskrit']
const recognitionOptions = [
  'Recognised by U.P. Government', 'Recognised by Delhi Government', 'Recognised by Haryana Government', 'Recognised by Punjab Government',
  'Recognised by Rajasthan Government', 'Recognised by Bihar Government', 'Recognised by MP Government', 'Recognised by Maharashtra Government',
  'Recognised by Gujarat Government', 'Recognised by Karnataka Government', 'Recognised by Tamil Nadu Government', 'Recognised by West Bengal Government',
  'Recognised by Assam Government', 'Recognised by Odisha Government', 'Recognised by Jharkhand Government', 'Recognised by Uttarakhand Government',
  'Recognised by HP Government', 'Recognised by J&K Government', 'Affiliated to CBSE (New Delhi)', 'Affiliated to ICSE', 'Affiliated to NIOS',
  'Affiliated to UP Board (UPMSP)', 'Affiliated to Bihar Board (BSEB)', 'Affiliated to MP Board (MPBSE)', 'Affiliated to Rajasthan Board (RBSE)',
  'Affiliated to Haryana Board (HBSE)', 'Affiliated to Delhi Board', 'Write Custom Text...',
]
const classHistoryClasses = classOptions
const sessions = Array.from({ length: 12 }, (_, index) => `${2015 + index}-${2016 + index}`)
const occupations = ['BUSINESS', 'SERVICE/JOB', 'FARMER', 'LABOUR', 'TEACHER', 'DOCTOR', 'ENGINEER', 'LAWYER', 'GOVERNMENT EMPLOYEE', 'PRIVATE EMPLOYEE', 'SELF EMPLOYED', 'OTHER']
const casteOptions = ['GENERAL', 'OBC', 'SC', 'ST', 'BRAHMIN', 'RAJPUT', 'YADAV', 'KAYASTHA', 'VAISHYA', 'OTHER']
const religionOptions = ['HINDU', 'MUSLIM', 'CHRISTIAN', 'SIKH', 'JAIN', 'BUDDHIST', 'OTHER']
const leavingReasons = ['-', 'FOR HIGHER EDUCATION', 'TRANSFER OF PARENTS', 'FAMILY REASON', 'MIGRATION', 'RUSTICATED', 'OTHER']
const tcBottomText = 'Details of the above mentioned students have been tallied with S.R. Register. Certified that S.R. details of the transferring students have been filled up till today in S.R. Register according to department.'
const recognitionText = (form = {}, settings = {}) => {
  const value = form.recognition || settings.recognition || settings.recognitionBoard || 'Recognised by U.P. Government'
  if (value === 'Write Custom Text...') return form.customRecognition || settings.customRecognition || ''
  return value
}
const wrapRecognition = value => value ? `(${String(value).replace(/^\(|\)$/g, '')})` : ''
const classOptionsFromStudents = students => [...new Set(students.map(student => classParts(student.className).className).filter(Boolean))].sort((a, b) => numericClass(a) - numericClass(b) || String(a).localeCompare(String(b)))
const sectionOptionsFromStudents = students => [...new Set(students.map(student => classParts(student.className).section).filter(Boolean))].sort()
const classSectionOptionsFromStudents = students => {
  const pairs = students.map(student => classParts(student.className)).filter(item => item.className && item.section)
  return [...new Map(pairs.map(item => [`${item.className}-${item.section}`, item])).values()].sort((a, b) => numericClass(a.className) - numericClass(b.className) || String(a.className).localeCompare(String(b.className)) || String(a.section).localeCompare(String(b.section)))
}
const pendingFeeForStudent = (student, fees = {}) => Object.values(fees || {}).filter(row => row.studentId === student?.id || String(row.admissionNo || row.roll || '') === String(admissionNo(student))).reduce((total, row) => {
  const balance = Number(row.balance ?? row.due ?? row.pendingAmount ?? 0)
  const amount = Number(row.amount ?? row.total ?? 0)
  const paid = Number(row.paid ?? row.paidAmount ?? 0)
  return total + Math.max(0, balance || (String(row.status || '').toLowerCase().includes('paid') ? 0 : amount - paid))
}, 0)
function tcAcademicRows(student, form, academics = {}) {
  if (Array.isArray(form.academicHistory) && form.academicHistory.length) return form.academicHistory
  const { className } = classParts(student.className)
  const currentClass = numericClass(className)
  const startClass = Math.max(1, numericClass(form.classOfAdmission) || (currentClass >= 9 ? 9 : currentClass || 1))
  const classes = currentClass >= startClass ? Array.from({ length: currentClass - startClass + 1 }, (_, index) => String(startClass + index)) : [className]
  const sessionStart = Number(String(form.academicYear || '').match(/\d{4}/)?.[0] || new Date().getFullYear())
  const examRows = Object.values(academics || {})
  return classes.map((item, index) => ({
    className: item,
    class: item,
    admissionDate: index === 0 ? student.admissionDate : '',
    dateAdmission: index === 0 ? student.admissionDate : '',
    promotionDate: index < classes.length - 1 ? `${sessionStart + index + 1}-03-31` : '',
    datePromotion: index < classes.length - 1 ? `${sessionStart + index + 1}-03-31` : '',
    tcDate: index === classes.length - 1 ? form.dateOfLeaving : '',
    dateTc: index === classes.length - 1 ? form.dateOfLeaving : '',
    reason: index === classes.length - 1 ? String(form.reason || 'Higher Education').toUpperCase() : 'PROMOTED',
    session: `${sessionStart + index}-${String(sessionStart + index + 1).slice(-2)}`,
    result: String(form.result || (examRows[index]?.percentage >= 33 ? 'Pass' : 'Pass')).toUpperCase(),
    character: String(form.conduct || 'Good').toUpperCase(),
  }))
}

function StudentFinder({ students, value, onSelect }) {
  const [query, setQuery] = useState('')
  const [brokenPhotos, setBrokenPhotos] = useState({})
  const matches = query.trim()
    ? students.filter(student => `${student.roll} ${student.name} ${student.className} ${student.phone}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
    : []
  return <section className="panel certificate-search">
    <label>Search Student
      <div className="certificate-search-input"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Admission no., student name or phone" /></div>
    </label>
        {matches.length > 0 && <div className="certificate-search-results">{matches.map(student => {
          const photo = profilePhoto(student)
          return <button type="button" key={student.id} onClick={() => { onSelect(student); setQuery(`${student.roll} - ${student.name}`) }}>{photo && !brokenPhotos[student.id] ? <img className="certificate-search-photo" src={photo} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBrokenPhotos(current => ({ ...current, [student.id]: true }))} /> : <span className={`certificate-search-photo initials tone-${student.tone}`}>{student.initials}</span>}<div><strong>{student.name}</strong><small>Admission {student.roll} - {student.className}</small></div></button>
        })}</div>}
    {value && <div className="certificate-selected"><Check size={15} /><span>{value.name}</span><small>Admission #{value.roll} · {value.className}</small></div>}
  </section>
}

function SchoolHeader({ school, settings, photoUrl, student, red = false, centeredLogo = false }) {
  const logo = schoolLogo(school, settings)
  const recognition = schoolRecognition(school, settings)
  const affiliationNo = schoolAffiliationNo(school, settings)
  const code = schoolCodeOf(school, settings)
  return <header className={`formal-school-header ${centeredLogo ? 'centered-logo' : ''}`}>
    <div className="formal-logo">{logo ? <img src={logo} alt="School logo" /> : <GraduationCap size={44} />}</div>
    <div>
      <h1 className={red ? 'red-school-name' : ''}>{schoolNameOf(school, settings)}</h1>
      {recognition && <strong className="recognition">{recognition}</strong>}
      <p>{schoolAddress(school, settings)}</p>
      <small>{[schoolPhone(school, settings), schoolEmail(school, settings)].filter(Boolean).join(' | ')}</small>
      {(affiliationNo || code) && <small>{affiliationNo ? `Affiliation No: ${affiliationNo}` : ''}{affiliationNo && code ? ' | ' : ''}{code ? `School Code: ${code}` : ''}</small>}
    </div>
    {!centeredLogo && <div className={`formal-student-photo ${photoUrl ? '' : 'empty'}`}>{photoUrl ? <img src={photoUrl} alt={`${student?.name || 'Student'} photograph`} /> : <span>Paste Photo Here</span>}</div>}
  </header>
}

function FormalTitle({ title, certificateNumber, issueDate, dark = false }) {
  return <>
    <div className={`formal-title ${dark ? 'dark' : ''}`}>{title}</div>
    <div className="formal-meta"><strong>Certificate No: {certificateNumber}</strong><strong>Date: {longDate(issueDate)}</strong></div>
  </>
}

function CharacterCertificate({ student, form, school, settings, certificateNumber, photoUrl, duplicate }) {
  const parsedClass = classParts(student.className)
  const className = form.characterClass || parsedClass.className
  const section = form.characterSection || parsedClass.section
  const schoolName = form.characterSchoolName || schoolNameOf(school, settings)
  const location = form.characterLocation || settings.place || school.city || schoolAddress(school, settings)
  const recognition = form.characterRecognition || schoolRecognition(school, settings) || '(RECOGNISED BY GOVT.)'
  const logo = schoolLogo(school, settings)
  const display = {
    serial: form.characterSerial || serialOnly(certificateNumber),
    studentName: form.characterStudentName || student.name,
    fatherName: form.characterFatherName || student.fatherName || student.guardian || '-',
    srNo: form.characterSrNo || student.roll,
    address: form.characterAddress || student.address || form.address || '-',
    dob: form.characterDob || student.dob,
    dobWords: form.characterDobWords || dateInWords(form.characterDob || student.dob),
    conduct: form.characterConductText || String(form.conduct || 'hard working and sincere').toLowerCase(),
    session: form.characterSession || academicYear(form.academicYear || school.academicYear),
    principalLabel: form.characterPrincipalLabel || 'Principal',
    footerSchool: form.characterFooterSchool || schoolName,
    footerLocation: form.characterFooterLocation || location,
  }
  return <article className="formal-certificate character-template">
    {logo && <div className="cert-watermark" aria-hidden="true"><img src={logo} alt="" /></div>}
    {duplicate && <div className="duplicate-watermark">DUPLICATE</div>}
    <div className="character-top-serial">Serial No: {display.serial}</div>
    <header className="character-certificate-header">
      <div className="formal-logo character-logo">{logo ? <img src={logo} alt="School logo" /> : <GraduationCap size={42} />}</div>
      <div className="character-school-block">
        <h1>{schoolName}</h1>
        <p>{location}</p>
        <small>{recognition}</small>
      </div>
      <div className={`formal-student-photo ${photoUrl ? '' : 'empty'}`}>{photoUrl ? <img src={photoUrl} alt={`${display.studentName} photograph`} /> : <span>Paste Photo Here</span>}</div>
    </header>
    <div className="formal-title dark character-title">Character Certificate</div>
    <p className="certificate-session">Session: {display.session}</p>
    <div className="character-body">
      <p>This is to certify that <strong>{display.studentName}</strong> Ward of <strong>{display.fatherName}</strong> S.R.No. <strong>{display.srNo}</strong> R/o. <strong>{display.address}</strong> was a bonafide student of Class <strong>{className} {section}</strong>. During his/her stay in the school, he/she had been a <strong>{display.conduct}</strong> student. His/Her date of birth, according to school record is <strong>{dashDate(display.dob)} ({display.dobWords})</strong>.</p>
      <p>To the best of my knowledge he/she bears a good moral character. I wish him/her every success in life.</p>
    </div>
    <div className="character-footer">
      <div><strong>Date: {shortDate(form.issueDate)}</strong></div>
      <div className="principal-block character-principal"><span className="signature-line" /><strong>{display.footerSchool}</strong><small>{display.footerLocation}</small><small>({display.principalLabel})</small></div>
    </div>
  </article>
}

function TransferCertificate({ student, form, school, settings, certificateNumber, photoUrl, academics, duplicate }) {
  const { className, section } = classParts(student.className)
  const academicRows = tcAcademicRows(student, form, academics)
  const schoolName = schoolNameOf(school, settings)
  const address = schoolAddress(school, settings)
  const phone = schoolPhone(school, settings)
  const recognition = recognitionText(form, settings)
  const logo = schoolLogo(school, settings)
  const display = {
    regNo: form.regNo || student.roll || admissionNo(student),
    srNo: form.srNo || serialOnly(certificateNumber),
    studentName: form.studentName || student.name,
    gender: form.gender || student.gender || '-',
    fatherName: form.fatherName || student.fatherName || student.guardian || '-',
    motherName: form.motherName || student.motherName || '-',
    occupation: form.occupationCustom || form.occupation || student.parentOccupation || '-',
    address: form.address || student.address || '-',
    casteReligion: [form.casteCustom || form.caste, form.religionCustom || form.religion].filter(Boolean).join(' / ') || '-',
    dob: form.dob || student.dob,
    previousSchool: form.previousSchool || student.previousSchool || '-',
    nationality: form.nationalityCustom || form.nationality || 'INDIAN',
  }
  const leftRows = [
    ['Student\'s Name', display.studentName],
    ['Gender', display.gender],
    ['Father\'s Name', display.fatherName],
    ['Mother\'s Name', display.motherName],
    ['Occupation', display.occupation],
    ['Complete Address', display.address],
    ['Cast / Religion', display.casteReligion],
    ['Nationality', display.nationality],
    ['Date Of Birth', dashDate(display.dob)],
    ['In Words', dateInWords(display.dob)],
    ['Name Of Previous School', display.previousSchool],
  ]
  return <article className="formal-certificate tc-template">
    {logo && <div className="cert-watermark" aria-hidden="true"><img src={logo} alt="" /></div>}
    {duplicate && <div className="duplicate-watermark">DUPLICATE</div>}
    <header className="tc-school-top">
      <h1>{schoolName}</h1>
      <strong>{wrapRecognition(recognition)}</strong>
      <p>{address}{phone ? `, Ph.: ${phone}` : ''}{settings.email ? ` | ${settings.email}` : ''}</p>
      {(form.affiliationNo || schoolAffiliationNo(school, settings) || schoolCodeOf(school, settings)) && <small>Affiliation No: {form.affiliationNo || schoolAffiliationNo(school, settings) || '___'}{schoolCodeOf(school, settings) ? ` | School Code: ${schoolCodeOf(school, settings)}` : ''}</small>}
    </header>
    <section className="tc-title-row">
      <div className="formal-logo tc-logo">{logo ? <img src={logo} alt="School logo" /> : <span>SCHOOL<br />LOGO</span>}</div>
      <div className="tc-title">TRANSFER<br />CERTIFICATE</div>
      <div className={`formal-student-photo ${photoUrl ? '' : 'empty'}`}>{photoUrl ? <img src={photoUrl} alt={`${student.name} photograph`} /> : <span>PHOTO<br />3.5 x 4.5cm</span>}</div>
    </section>
    <div className="tc-reg-row"><span>Reg. No.: <strong>{display.regNo}</strong></span><span>Sr. No.: <strong>{display.srNo}</strong></span></div>
    <section className="tc-student-section">
      <div className="tc-left-details">{leftRows.map(([label, value]) => <div key={label}><strong>{label}</strong><span>{value || '-'}</span></div>)}</div>
      <aside className="tc-serial-box"><small>TC Date: {dashDate(form.issueDate)}</small><small>Class: {className} / {section}</small><small>Principal: {settings.principalName || form.principalName || '-'}</small></aside>
    </section>
    <table className="academic-history-table">
      <thead><tr><th>Class</th><th>Date of Admission</th><th>Date of Promotion</th><th>Date of TC</th><th>Reason for leaving the School</th><th>Session</th><th>Result</th><th>Character</th><th>Signature</th></tr></thead>
      <tbody>{academicRows.map((row, index) => <tr key={`${row.className || row.class}-${index}`}><td>{row.className || row.class || '-'}</td><td>{dashDate(row.admissionDate || row.dateAdmission)}</td><td>{dashDate(row.promotionDate || row.datePromotion)}</td><td>{dashDate(row.tcDate || row.dateTc)}</td><td>{row.reason || '-'}</td><td>{row.session || '-'}</td><td>{row.result || '-'}</td><td>{row.character || '-'}</td><td></td></tr>)}</tbody>
    </table>
    <section className="tc-certification"><p>{form.bottomText || settings.defaultBottomText || tcBottomText}</p></section>
    <div className="tc-signature-date"><strong>Date: {dashDate(form.issueDate)}</strong></div>
    <div className="formal-signatures three tc-signatures"><div><span className="signature-line" /><strong>({form.sig1Label || settings.sig1Label || 'Prepared By'})</strong></div><div><span className="signature-line" /><strong>({form.sig2Label || settings.sig2Label || 'Checked By'})</strong></div><div className="principal-block">{school.principalSignatureURL && <img className="admit-sign" src={school.principalSignatureURL} alt="Signature" />}<span className="signature-line" /><strong>({form.sig3Label || settings.sig3Label || 'Principal'})</strong><small>{settings.principalName || 'Name'} · Seal / Stamp</small>{school.schoolSealURL && <img className="admit-seal" src={school.schoolSealURL} alt="Seal" />}</div></div>
  </article>
}

function SimpleCertificate({ type, student, form, school, settings, certificateNumber, photoUrl, duplicate }) {
  const p = pronouns(student)
  const { className, section } = classParts(student.className)
  const logo = schoolLogo(school, settings)
  let paragraphs = []
  if (type === 'bonafide') paragraphs = [
    <>This is to certify that Mr./Ms. <strong>{student.name}</strong>, {p.relation} of <strong>{student.fatherName || student.guardian}</strong>, is a bonafide student of this school.</>,
    <>{p.subject} is currently studying in Class <strong>{className}</strong>, Section <strong>{section}</strong>, during the academic year <strong>{academicYear(form.academicYear || school.academicYear)}</strong>.</>,
    <>{p.possessive} date of birth as per school records is <strong>{shortDate(student.dob)}</strong>. {p.possessive} conduct and character is <strong>{form.conduct}</strong>.</>,
    <>This certificate is issued on {p.possessiveLower} request for <strong>{form.purpose === 'Other' ? form.customPurpose : form.purpose}</strong>.</>,
  ]
  if (type === 'study') paragraphs = [
    <>This is to certify that <strong>{student.name}</strong>, Admission No. <strong>{student.roll}</strong>, {p.relation} of <strong>{student.fatherName || student.guardian}</strong>, is studying in Class <strong>{className}-{section}</strong> in this school during the academic year <strong>{academicYear(form.academicYear || school.academicYear)}</strong>.</>,
    <>This certificate is issued for the purpose of <strong>{form.purpose === 'Other' ? form.customPurpose : form.purpose}</strong>.</>,
  ]
  if (type === 'sports') paragraphs = [
    <>This is to certify that <strong>{student.name}</strong> of Class <strong>{className}-{section}</strong> has participated in <strong>{form.sportName}</strong> at <strong>{form.competitionLevel}</strong> level competition held on <strong>{longDate(form.eventDate)}</strong> and secured <strong>{form.position}</strong> position.</>,
    <>We congratulate {p.object} for this achievement and wish {p.object} continued success.</>,
  ]
  return <article className={`formal-certificate simple-template ${type}-template`}>
    {logo && <div className="cert-watermark" aria-hidden="true"><img src={logo} alt="" /></div>}
    {duplicate && <div className="duplicate-watermark">DUPLICATE</div>}
    <SchoolHeader school={school} settings={settings} student={student} photoUrl={photoUrl} />
    <FormalTitle title={type === 'sports' ? 'CERTIFICATE OF ACHIEVEMENT' : titles[type] || 'SCHOOL CERTIFICATE'} certificateNumber={certificateNumber} issueDate={form.issueDate} />
    {type !== 'sports' && <h3>To Whomsoever It May Concern</h3>}
    <div className="simple-certificate-body">{paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
    <div className="formal-signatures simple-footer"><div><strong>Date: {shortDate(form.issueDate)}</strong><small>Place: {settings.place || school.city || '-'}</small></div><div className="principal-block">{school.principalSignatureURL && <img className="admit-sign" src={school.principalSignatureURL} alt="Signature" />}<span className="signature-line" /><strong>{settings.principalName || school.principalName || 'Principal'}</strong><small>Principal · School Seal &amp; Sign</small>{school.schoolSealURL && <img className="admit-seal" src={school.schoolSealURL} alt="Seal" />}</div></div>
  </article>
}

function CertificatePaper(props) {
  if (props.type === 'admit') return <AdmitCardPaper {...props} />
  if (props.type === 'character') return <CharacterCertificate {...props} />
  if (props.type === 'tc') return <TransferCertificate {...props} academics={props.academics?.[props.student?.id] || {}} />
  return <SimpleCertificate {...props} />
}

function PreviewModal(props) {
  const printPreview = () => {
    if (props.type === 'admit') {
      printAdmitCardsHtml(admitCardPrintHtml({
        student: props.student,
        exam: props.exam,
        dateRows: props.dateRows,
        school: props.school,
        settings: props.settings,
        showPendingFee: props.showPendingFee,
        pendingAmount: props.pendingAmount,
      }))
      return
    }
    props.onPrint()
  }
  return createPortal(<div className="certificate-preview-overlay" role="dialog" aria-modal="true">
    <div className="certificate-preview-shell">
      <div className="certificate-preview-toolbar"><strong>Certificate Preview</strong><button className="secondary-button" onClick={props.onClose}><X size={16} /> Close</button><button className="primary-button" onClick={printPreview}><Printer size={16} /> Print</button></div>
      <CertificatePaper {...props} />
    </div>
  </div>, document.body)
}

function AdmitCardLogo({ school, settings }) {
  const [broken, setBroken] = useState(false)
  const logo = schoolLogo(school, settings)
  if (logo && !broken) return <img src={logo} alt="School logo" loading="lazy" onError={() => setBroken(true)} />
  return <span><strong>{schoolInitials(school, settings)}</strong><small>SCHOOL</small></span>
}

function AdmitStudentPhoto({ student }) {
  const [broken, setBroken] = useState(false)
  const photo = profilePhoto(student)
  if (photo && !broken) return <img src={photo} alt={`${student?.name || 'Student'} photograph`} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
  return <span>Paste Photo Here</span>
}

function AdmitCardPaper({ student, exam = {}, dateRows = [], school = {}, settings = {}, showPendingFee = false, pendingAmount = 0 }) {
  const { className, section } = classParts(student?.className)
  const hasSavedDateSheet = dateRows.length > 0
  const rows = hasSavedDateSheet ? dateRows : defaultDateSheetRows
  const schoolName = schoolNameOf(school, settings)
  const address = schoolAddress(school, settings)
  const phone = schoolPhone(school, settings) || 'XXXXXXXX'
  const email = schoolEmail(school, settings) || 'school@example.com'
  const recognition = schoolRecognition(school, settings)
  const affiliationNo = schoolAffiliationNo(school, settings)
  const code = schoolCodeOf(school, settings)
  const examName = exam.name || 'Annual Examination 2026-27'
  return <article className="admit-card">
    <header className="admit-school-header">
      <div className="admit-school-logo"><AdmitCardLogo school={school} settings={settings} /></div>
      <div className="admit-school-copy">
        <h1>{schoolName}</h1>
        {recognition && <p>{recognition}</p>}
        <p>{address}</p>
        <small>Phone: {phone} | Email: {email}</small>
        <small>Affiliation No: {affiliationNo || '___'}{code ? ` | School Code: ${code}` : ''}</small>
      </div>
    </header>
    <section className="admit-title-band">
      <div><h2>ADMIT CARD</h2><strong>{examName}</strong></div>
      <div className="admit-student-photo"><AdmitStudentPhoto student={student} /></div>
    </section>
    <section className="admit-student-grid">
      <div><strong>Student Name</strong><span>{student?.name || '-'}</span></div>
      <div><strong>Roll Number</strong><span>{student?.rollNo || student?.rollNumber || admissionNo(student) || '-'}</span></div>
      <div><strong>Admission No</strong><span>{admissionNo(student) || '-'}</span></div>
      <div><strong>Father Name</strong><span>{student?.fatherName || student?.guardian || '-'}</span></div>
      <div><strong>Date of Birth</strong><span>{shortDate(student?.dob)}</span></div>
      <div><strong>Class &amp; Sec</strong><span>{className} / {section}</span></div>
      <div className="full"><strong>Exam Name</strong><span>{examName}</span></div>
    </section>
    <table className="admit-date-table">
      <thead><tr><th>Subject</th><th>Date</th><th>Time</th></tr></thead>
      <tbody>{rows.map((row, index) => <tr key={`${row.id || row.subject}-${index}`}><td>{row.subject || 'Subject'}</td><td>{row.date ? shortDate(row.date) : <span className="missing-date">Set Date Sheet</span>}</td><td>{admitTime(row.fromTime, row.toTime) || <span className="missing-date">Set Time</span>}</td></tr>)}</tbody>
    </table>
    {!hasSavedDateSheet && <div className="admit-date-warning">Date Sheet not saved for this exam/class yet. Add it from the Date Sheet tab.</div>}
    <section className="admit-instructions">
      <h3>IMPORTANT INSTRUCTIONS</h3>
      <ol>
        <li>Carry this admit card and valid photo ID to examination centre. Without it entry will be denied.</li>
        <li>Reach 30 minutes before exam.</li>
        <li>No mobile phones, smartwatches, calculators allowed in exam.</li>
        <li>Follow dress code strictly.</li>
        <li>Malpractice will lead to cancellation of candidature and disciplinary action.</li>
        <li>For fee queries contact office.</li>
      </ol>
    </section>
    {showPendingFee && pendingAmount > 0 && <strong className="admit-pending-fee">Pending Fees: ?{pendingAmount.toLocaleString('en-IN')}</strong>}
    <strong className="admit-issued">Issued On: {longDate(today())}</strong>
    <footer className="admit-signatures">
      <div><span>Class Teacher</span><i /></div>
      <div><span>Exam Controller</span><i /></div>
      <div className="principal"><span>Principal &amp; Stamp</span><i />{school.schoolSealURL && <img className="admit-seal" src={school.schoolSealURL} alt="School seal" />}{school.principalSignatureURL && <img className="admit-sign" src={school.principalSignatureURL} alt="Principal signature" />}</div>
    </footer>
    {code && <small className="certificate-school-code">School Code: {code}</small>}
  </article>
}

function admitRowsForStudent(student, examId, dateSheet = {}) {
  const allRows = Object.values(dateSheet || {}).sort((a, b) => `${a.date || ''}${a.fromTime || ''}`.localeCompare(`${b.date || ''}${b.fromTime || ''}`))
  const parts = classParts(student?.className)
  const examRows = allRows.filter(row => row.examId === examId)
  const exactRows = examRows.filter(row => String(row.className).trim().toLowerCase() === String(parts.className).trim().toLowerCase() && String(row.section).trim().toLowerCase() === String(parts.section).trim().toLowerCase())
  if (exactRows.length) return exactRows
  const classRows = examRows.filter(row => String(row.className).trim().toLowerCase() === String(parts.className).trim().toLowerCase())
  return classRows.length ? classRows : examRows
}

function DateSheetPreview({ exam, rows, school, settings, className, section }) {
  const schoolName = settings.schoolName || school.schoolName || school.name || 'School Name'
  const address = settings.address || school.address || school.city || 'School Address, City'
  const phone = settings.phone || school.phone || 'XXXXXXXX'
  const email = settings.email || school.email || 'school@example.com'
  return <article className="date-sheet-preview">
    <header>
      <div className="admit-school-logo"><AdmitCardLogo school={school} settings={settings} /></div>
      <div>
        <h2>{schoolName}</h2>
        <p>{address}</p>
        <small>Phone: {phone} | Email: {email}</small>
      </div>
    </header>
    <div className="date-sheet-title">
      <h3>DATE SHEET</h3>
      <strong>{exam?.name || 'Annual Examination 2026-27'}</strong>
      <span>Class: {className || 'All'} | Section: {section || 'All'}</span>
    </div>
    <table>
      <thead><tr><th>#</th><th>Date</th><th>Day</th><th>Subject</th><th>Time</th><th>Duration</th></tr></thead>
      <tbody>{rows.map((row, index) => <tr key={row.id || `${row.subject}-${row.date}`}><td>{index + 1}</td><td>{shortDate(row.date)}</td><td>{weekDay(row.date)}</td><td>{row.subject}</td><td>{admitTime(row.fromTime, row.toTime)}</td><td>{row.fromTime && row.toTime ? `${row.fromTime} to ${row.toTime}` : '-'}</td></tr>)}{!rows.length && <tr><td colSpan="6">No subjects added for this class/section yet.</td></tr>}</tbody>
    </table>
    <section>
      <strong>Instructions</strong>
      <ol>
        <li>Students must reach school 30 minutes before the exam time.</li>
        <li>Carry admit card and required stationery only.</li>
        <li>Mobile phones and smart devices are strictly not allowed.</li>
      </ol>
    </section>
    <footer><span>Exam Controller</span><span>Principal</span></footer>
  </article>
}

function AdmitCardManager({ students, fees, school, settings, examData, onSaveExam, onSaveDateSheet, onDeleteDateSheet, onSaveAdmitCards }) {
  const exams = useMemo(() => {
    const rows = Object.values(examData?.exams || {})
    const saved = new Map(rows.map(row => [row.id, row]))
    examPresets.forEach(preset => {
      const id = `${preset.id}-2026`
      const existing = rows.find(row => String(row.name || '').toLowerCase().includes(preset.name.toLowerCase()))
      if (existing && existing.id !== id) saved.set(id, { ...existing, id, preset: preset.id })
      if (!saved.has(id)) saved.set(id, { id, name: `${preset.name} 2026-27`, preset: preset.id })
    })
    return [...saved.values()]
  }, [examData])
  const [tab, setTab] = useState('generate')
  const [examId, setExamId] = useState(exams[0]?.id || 'annual-2026')
  const [searchBy, setSearchBy] = useState('Student Name')
  const [className, setClassName] = useState('')
  const [section, setSection] = useState('')
  const [admissionQuery, setAdmissionQuery] = useState('')
  const [showPendingFee, setShowPendingFee] = useState('No')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState({})
  const [searchMessage, setSearchMessage] = useState('')
  const [generatedIds, setGeneratedIds] = useState([])
  const [pendingPrint, setPendingPrint] = useState(false)
  const [sheetForm, setSheetForm] = useState({ examId: exams[0]?.id || 'annual-2026', target: 'single', className: '', section: '', subject: 'Mathematics', date: today(), fromTime: '10:00', toTime: '12:00' })
  const [sheetExamName, setSheetExamName] = useState('Annual Examination 2026-27')
  const [savingSheet, setSavingSheet] = useState(false)
  const [sheetMessage, setSheetMessage] = useState('')
  const selectedExam = exams.find(item => item.id === examId) || exams[0] || {}
  const allDateRows = Object.values(examData?.dateSheet || {}).sort((a, b) => `${a.date || ''}${a.fromTime || ''}`.localeCompare(`${b.date || ''}${b.fromTime || ''}`))
  const classSectionTargets = useMemo(() => classSectionOptionsFromStudents(students), [students])
  const previewDateRows = allDateRows.filter(row => row.examId === sheetForm.examId && (sheetForm.target === 'all' || !sheetForm.className || String(row.className) === String(sheetForm.className)) && (sheetForm.target === 'all' || !sheetForm.section || String(row.section) === String(sheetForm.section)))
  const matchingDateRows = student => {
    return admitRowsForStudent(student, examId, examData?.dateSheet || {})
  }
  const selectedStudents = results.filter(student => selected[student.id])
  const generatedStudents = results.filter(student => generatedIds.includes(student.id))
  useEffect(() => {
    if (!pendingPrint) return undefined
    const timer = setTimeout(() => setPendingPrint(false), 2500)
    return () => clearTimeout(timer)
  }, [pendingPrint])
  const clearSearch = () => {
    setResults([])
    setSelected({})
    setGeneratedIds([])
    setPendingPrint(false)
    setSearchMessage('Search filters changed. Click Search again.')
  }
  const runSearch = (silent = false) => {
    const query = admissionQuery.trim().toLowerCase()
    if (searchBy === 'Admission No' && !query) {
      setResults([])
      setSelected({})
      setGeneratedIds([])
      setSearchMessage('Admission number daalo, phir sirf wahi student generate hoga.')
      return
    }
    if (searchBy === 'Student Name' && !query) {
      setResults([])
      setSelected({})
      setGeneratedIds([])
      setSearchMessage('Admission no, student name ya phone type karo. Card automatic generate hoga.')
      return
    }
    if (searchBy === 'Class/Section' && !className) {
      setResults([])
      setSelected({})
      setGeneratedIds([])
      setSearchMessage('Class select karo. Empty search se all students generate nahi honge.')
      return
    }
    const matches = students.filter(student => {
      const parts = classParts(student.className)
      const classOk = !className || String(parts.className) === String(className)
      const sectionOk = !section || String(parts.section) === String(section)
      let queryOk = true
      if (searchBy === 'Admission No') queryOk = String(admissionNo(student)).toLowerCase() === query
      if (searchBy === 'Student Name') queryOk = `${admissionNo(student)} ${student.name} ${student.phone || ''}`.toLowerCase().includes(query)
      if (searchBy === 'Class/Section') queryOk = !query || `${admissionNo(student)} ${student.name} ${student.phone || ''}`.toLowerCase().includes(query)
      return classOk && sectionOk && queryOk
    })
    setResults(matches)
    setSelected(Object.fromEntries(matches.map(student => [student.id, true])))
    setGeneratedIds(matches.map(student => student.id))
    setSearchMessage(matches.length ? `${matches.length} admit card auto-generated from current search.` : 'No matching student found.')
  }
  useEffect(() => {
    const timer = setTimeout(() => runSearch(true), 250)
    return () => clearTimeout(timer)
  }, [searchBy, className, section, admissionQuery, examId, showPendingFee, students])
  const generatePreview = () => {
    setGeneratedIds(selectedStudents.map(student => student.id))
    setSearchMessage(selectedStudents.length ? `${selectedStudents.length} admit card preview generated from current search only.` : 'Pehle searched students select karo.')
  }
  const addDateRow = async event => {
    event.preventDefault()
    const targets = sheetForm.target === 'all'
      ? classSectionTargets
      : [{ className: sheetForm.className, section: sheetForm.section }]
    if (!targets.length || targets.some(target => !target.className || !target.section)) {
      setSheetMessage('Class/section select karo ya All Classes mode use karo.')
      return
    }
    setSavingSheet(true)
    setSheetMessage('')
    try {
      await onSaveExam({ id: sheetForm.examId, name: sheetExamName || selectedExam.name || 'Annual Examination 2026-27' })
      await Promise.all(targets.map(target => onSaveDateSheet({
        ...sheetForm,
        className: target.className,
        section: target.section,
        target: undefined,
      })))
      setSheetMessage(`${sheetForm.subject} saved for ${targets.length} class/section group(s).`)
      setSheetForm(current => ({ ...current, subject: '', date: today(), fromTime: '10:00', toTime: '12:00' }))
    } finally {
      setSavingSheet(false)
    }
  }
  const saveExamName = async () => {
    setSavingSheet(true)
    try {
      await onSaveExam({ id: sheetForm.examId, name: sheetExamName || selectedExam.name || 'Annual Examination 2026-27' })
      setSheetMessage('Exam saved smoothly.')
    } finally {
      setSavingSheet(false)
    }
  }
  const printSelected = () => {
    if (!selectedStudents.length) return
    setGeneratedIds(selectedStudents.map(student => student.id))
    setPendingPrint(true)
    const html = selectedStudents.map(student => admitCardPrintHtml({
      student,
      exam: selectedExam,
      dateRows: matchingDateRows(student),
      school,
      settings,
      showPendingFee: showPendingFee === 'Yes',
      pendingAmount: pendingFeeForStudent(student, fees),
    })).join('')
    printAdmitCardsHtml(html).finally(() => setPendingPrint(false))
    const cards = selectedStudents.map(student => ({
      examId,
      examName: selectedExam.name,
      studentId: student.id,
      rollNo: student.rollNo || admissionNo(student),
      className: student.className,
      showPendingFee: showPendingFee === 'Yes',
      generatedOn: Date.now(),
    }))
    onSaveAdmitCards(cards).catch(error => {
      console.error('Admit card register save failed', error)
      setSearchMessage('Print ready hai, lekin register save fail hua. Dobara print/save try kar lena.')
    })
  }
  return <div className="admit-module">
    <div className="admit-tabs no-print"><button className={tab === 'generate' ? 'active' : ''} onClick={() => setTab('generate')}>Generate Admit Cards</button><button className={tab === 'dateSheet' ? 'active' : ''} onClick={() => setTab('dateSheet')}>Date Sheet</button></div>
    {tab === 'generate' && <section className="panel admit-filter-panel no-print">
      <div className="panel-header"><div><h3>Admit Card Search</h3><p>Type admission no/name or choose class. Admit cards appear automatically from the current search.</p></div><div className="admit-action-group"><button className="secondary-button" disabled={!selectedStudents.length || pendingPrint} onClick={generatePreview}><Eye size={15} /> Refresh Preview</button><button className="primary-button" disabled={!selectedStudents.length || pendingPrint} onClick={printSelected}><Printer size={15} /> {pendingPrint ? 'Preparing Print...' : 'Print Selected'}</button></div></div>
      <div className="form-grid">
        <label>Select Exam<select value={examId} onChange={event => { setExamId(event.target.value); clearSearch() }}>{exams.map(exam => <option key={exam.id} value={exam.id}>{exam.name}</option>)}</select></label>
        <label>Search By<select value={searchBy} onChange={event => { setSearchBy(event.target.value); clearSearch() }}><option>Class/Section</option><option>Admission No</option><option>Student Name</option></select></label>
        <label>Select Class<select value={className} onChange={event => { setClassName(event.target.value); clearSearch() }}><option value="">All Classes</option>{classOptionsFromStudents(students).map(item => <option key={item}>{item}</option>)}</select></label>
        <label>Select Section<select value={section} onChange={event => { setSection(event.target.value); clearSearch() }}><option value="">All Sections</option>{sectionOptionsFromStudents(students).map(item => <option key={item}>{item}</option>)}</select></label>
        <label>Adm No / Name<input value={admissionQuery} onChange={event => { setAdmissionQuery(event.target.value); clearSearch() }} placeholder="Admission no., student name or phone" /></label>
        <label>Pending Fee Show<select value={showPendingFee} onChange={event => { setShowPendingFee(event.target.value); clearSearch() }}><option>No</option><option>Yes</option></select></label>
      </div>
      <button className="secondary-button" onClick={() => runSearch()}><Search size={15} /> Search / Auto Generate</button>
      {searchMessage && <div className={`admit-search-message ${results.length ? 'ok' : 'warn'}`}>{searchMessage}</div>}
      <div className="admit-results">
        <label className="select-all"><input type="checkbox" checked={results.length > 0 && results.every(student => selected[student.id])} onChange={event => { const next = Object.fromEntries(results.map(student => [student.id, event.target.checked])); setSelected(next); setGeneratedIds(event.target.checked ? results.map(student => student.id) : []) }} /> Select all</label>
        {results.map(student => <label key={student.id} className="admit-result-row"><input type="checkbox" checked={Boolean(selected[student.id])} onChange={event => { const checked = event.target.checked; setSelected(current => ({ ...current, [student.id]: checked })); setGeneratedIds(current => checked ? [...new Set([...current, student.id])] : current.filter(id => id !== student.id)) }} /><span className="certificate-search-photo initials">{studentInitials(student)}</span><strong>{student.name}</strong><small>Adm {admissionNo(student)} - {student.className} - {student.fatherName || student.guardian || '-'}</small></label>)}
        {!results.length && <div className="empty-state">No searched students selected yet. Search by admission no, name, or class first.</div>}
      </div>
    </section>}
    {tab === 'dateSheet' && <section className="panel admit-date-sheet-form no-print">
      <div className="panel-header"><div><h3>Date Sheet</h3><p>Create a proper exam date sheet. The same rows appear inside admit cards for that class and section.</p></div></div>
      <div className="date-sheet-builder">
        <label>Exam Type<select value={sheetForm.examId} onChange={event => { const exam = exams.find(item => item.id === event.target.value); setSheetForm({ ...sheetForm, examId: event.target.value }); setExamId(event.target.value); setSheetExamName(exam?.name || sheetExamName) }}>{exams.map(exam => <option key={exam.id} value={exam.id}>{exam.name}</option>)}</select></label>
        <label>Exam Name<input value={sheetExamName} onChange={event => setSheetExamName(event.target.value)} placeholder="Annual Examination 2026-27" /></label>
        <button type="button" className="secondary-button" disabled={savingSheet} onClick={saveExamName}><Save size={15} /> {savingSheet ? 'Saving...' : 'Save Exam'}</button>
      </div>
      <div className="exam-preset-row">{examPresets.map(preset => <button type="button" key={preset.id} onClick={() => { const id = `${preset.id}-2026`; setSheetForm({ ...sheetForm, examId: id }); setExamId(id); setSheetExamName(`${preset.name} 2026-27`) }}>{preset.name}</button>)}</div>
      <form className="form-grid" onSubmit={addDateRow}>
        <label>Save For<select value={sheetForm.target} onChange={event => setSheetForm({ ...sheetForm, target: event.target.value })}><option value="single">One Class / Section</option><option value="all">All Classes & Sections</option></select></label>
        <label>Select Class<select value={sheetForm.className} disabled={sheetForm.target === 'all'} onChange={event => setSheetForm({ ...sheetForm, className: event.target.value })} required={sheetForm.target !== 'all'}><option value="">Select Class</option>{classOptionsFromStudents(students).map(item => <option key={item}>{item}</option>)}</select></label>
        <label>Select Section<select value={sheetForm.section} disabled={sheetForm.target === 'all'} onChange={event => setSheetForm({ ...sheetForm, section: event.target.value })} required={sheetForm.target !== 'all'}><option value="">Select Section</option>{sectionOptionsFromStudents(students).map(item => <option key={item}>{item}</option>)}</select></label>
        <label>Subject<input list="admit-subjects" value={sheetForm.subject} onChange={event => setSheetForm({ ...sheetForm, subject: event.target.value })} required /><datalist id="admit-subjects">{subjectPresets.map(subject => <option key={subject} value={subject} />)}</datalist></label>
        <label>Date<DatePicker value={sheetForm.date} onChange={value => setSheetForm({ ...sheetForm, date: value })} /></label>
        <label>From Time<input type="time" value={sheetForm.fromTime} onChange={event => setSheetForm({ ...sheetForm, fromTime: event.target.value })} required /></label>
        <label>To Time<input type="time" value={sheetForm.toTime} onChange={event => setSheetForm({ ...sheetForm, toTime: event.target.value })} required /></label>
        <button className="primary-button" disabled={savingSheet}><Save size={15} /> {savingSheet ? 'Saving...' : sheetForm.target === 'all' ? `Save for ${classSectionTargets.length} Groups` : 'Add Subject'}</button>
      </form>
      {sheetMessage && <div className="admit-search-message ok">{sheetMessage}</div>}
      <DateSheetPreview exam={{ ...(exams.find(exam => exam.id === sheetForm.examId) || selectedExam), name: sheetExamName || selectedExam.name }} rows={previewDateRows} school={school} settings={settings} className={sheetForm.className} section={sheetForm.section} />
      <div className="table-scroll"><table><thead><tr><th>Subject</th><th>Exam</th><th>Class</th><th>Section</th><th>Date</th><th>From</th><th>To</th><th>Actions</th></tr></thead><tbody>{allDateRows.map(row => <tr key={row.id}><td>{row.subject}</td><td>{exams.find(exam => exam.id === row.examId)?.name || row.examId}</td><td>{row.className}</td><td>{row.section}</td><td>{shortDate(row.date)}</td><td>{row.fromTime}</td><td>{row.toTime}</td><td><button className="icon-button danger" onClick={() => onDeleteDateSheet(row.id)}><Trash2 size={14} /></button></td></tr>)}{!allDateRows.length && <tr><td colSpan="8"><div className="empty-state">No date sheet rows added yet.</div></td></tr>}</tbody></table></div>
    </section>}
    <section className="admit-print-grid">
      {generatedStudents.map(student => <AdmitCardPaper key={student.id} student={student} exam={selectedExam} dateRows={matchingDateRows(student)} school={school} settings={settings} showPendingFee={showPendingFee === 'Yes'} pendingAmount={pendingFeeForStudent(student, fees)} />)}
    </section>
  </div>
}

async function imageUrlToDataUrl(url) {
  if (!url) return ''
  try {
    if (url.startsWith('data:')) return url
    const response = await fetch(url)
    const blob = await response.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return ''
  }
}

async function downloadCharacterCertificatePdf(student, form, school, settings, certificateNumber, duplicate, photoUrl = '') {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const width = pdf.internal.pageSize.getWidth()
  const height = pdf.internal.pageSize.getHeight()
  const schoolName = form.characterSchoolName || settings.schoolName || school.schoolName || 'School Name'
  const location = form.characterLocation || settings.place || school.city || settings.address || school.address || 'School Location'
  const recognition = form.characterRecognition || settings.recognition || '(RECOGNISED BY GOVT.)'
  const logoData = await imageUrlToDataUrl(settings.logo || school.logo || '')
  const photoData = await imageUrlToDataUrl(photoUrl || profilePhoto(student))
  const parsedClass = classParts(student.className)
  const className = form.characterClass || parsedClass.className
  const section = form.characterSection || parsedClass.section
  const display = {
    serial: form.characterSerial || serialOnly(certificateNumber),
    studentName: form.characterStudentName || student.name,
    fatherName: form.characterFatherName || student.fatherName || student.guardian || '-',
    srNo: form.characterSrNo || student.roll,
    address: form.characterAddress || student.address || form.address || '-',
    dob: form.characterDob || student.dob,
    dobWords: form.characterDobWords || dateInWords(form.characterDob || student.dob),
    conduct: form.characterConductText || String(form.conduct || 'hard working and sincere').toLowerCase(),
    session: form.characterSession || academicYear(form.academicYear || school.academicYear),
    principalLabel: form.characterPrincipalLabel || 'Principal',
    footerSchool: form.characterFooterSchool || schoolName,
    footerLocation: form.characterFooterLocation || location,
  }

  pdf.setTextColor(12, 28, 52)
  pdf.setDrawColor(0, 0, 0)
  pdf.setLineWidth(0.9)
  pdf.rect(10, 10, width - 20, height - 20)
  if (duplicate) {
    pdf.setTextColor(220, 38, 38)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(42)
    pdf.text('DUPLICATE', width / 2, height / 2, { align: 'center', angle: 35 })
    pdf.setTextColor(12, 28, 52)
  }

  pdf.setDrawColor(17, 24, 39)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.text(`Serial No: ${display.serial}`, 17, 24)
  pdf.circle(29, 73, 12)
  if (logoData) pdf.addImage(logoData, imageFormat(logoData), 17, 61, 24, 24, undefined, 'FAST')
  pdf.rect(width - 42, 58, 28, 34)
  if (photoData) {
    pdf.addImage(photoData, imageFormat(photoData), width - 42, 58, 28, 34, undefined, 'FAST')
  } else {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(6.5)
    pdf.setTextColor(100, 116, 139)
    pdf.text('Paste Photo', width - 28, 73, { align: 'center' })
    pdf.text('Here', width - 28, 77, { align: 'center' })
    pdf.setTextColor(12, 28, 52)
  }

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(23)
  pdf.text(schoolName.toUpperCase(), width / 2, 43, { align: 'center' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(13)
  pdf.text(location.toUpperCase(), width / 2, 51, { align: 'center' })
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.text(recognition, width / 2, 59, { align: 'center' })

  pdf.setFillColor(17, 24, 39)
  pdf.rect(70, 78, 70, 9, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(16)
  pdf.text('Character Certificate', width / 2, 84.5, { align: 'center' })
  pdf.setTextColor(12, 28, 52)
  pdf.setFontSize(15)
  pdf.text(`Session: ${display.session}`, width / 2, 101, { align: 'center' })

  pdf.setFont('times', 'normal')
  pdf.setFontSize(13)
  const body = [
    `This is to Certified that ${display.studentName} Ward of ${display.fatherName} S.R.No. ${display.srNo} R/o. ${display.address} was a bonafide student of Class ${className} ${section}. During his/her stay in the school, he/she had been ${display.conduct} student. His/Her date of birth, according to school record is ${dashDate(display.dob)} (${display.dobWords}).`,
    'To the best of my knowledge he/she bears a good moral character. I wish him/her every success in life.',
  ]
  pdf.text(pdf.splitTextToSize(body.join('\n\n'), width - 30), 17, 145, { lineHeightFactor: 1.55 })

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.text(`Date: ${shortDate(form.issueDate)}`, 17, 260)
  pdf.text(display.footerSchool, width - 24, 238, { align: 'right' })
  pdf.setFont('helvetica', 'normal')
  pdf.text(display.footerLocation, width - 24, 245, { align: 'right' })
  pdf.text(`(${display.principalLabel})`, width - 24, 260, { align: 'right' })

  pdf.save(`Character-Certificate-${student.name.replace(/\s+/g, '-')}.pdf`)
}

async function downloadTransferCertificatePdf(student, form, school, settings, certificateNumber, duplicate, photoUrl = '', academics = {}) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const width = pdf.internal.pageSize.getWidth()
  const height = pdf.internal.pageSize.getHeight()
  const schoolName = settings.schoolName || school.schoolName || 'School Name'
  const address = [settings.address || school.address, settings.city || school.city, settings.state, settings.pincode].filter(Boolean).join(', ') || 'School Address'
  const phone = settings.phone || school.phone || ''
  const recognition = recognitionText(form, settings)
  const logoData = await imageUrlToDataUrl(settings.logo || school.logo || '')
  const photoData = await imageUrlToDataUrl(photoUrl || profilePhoto(student))
  const { className, section } = classParts(student.className)
  const academicRows = tcAcademicRows(student, form, academics)
  const display = {
    regNo: form.regNo || student.roll || admissionNo(student),
    srNo: form.srNo || serialOnly(certificateNumber),
    studentName: form.studentName || student.name,
    gender: form.gender || student.gender || '-',
    fatherName: form.fatherName || student.fatherName || student.guardian || '-',
    motherName: form.motherName || student.motherName || '-',
    occupation: form.occupationCustom || form.occupation || student.parentOccupation || '-',
    address: form.address || student.address || '-',
    casteReligion: [form.casteCustom || form.caste, form.religionCustom || form.religion].filter(Boolean).join(' / ') || '-',
    dob: form.dob || student.dob,
    previousSchool: form.previousSchool || student.previousSchool || '-',
    nationality: form.nationalityCustom || form.nationality || 'INDIAN',
  }
  const leftRows = [
    ['Student\'s Name', display.studentName], ['Gender', display.gender],
    ['Father\'s Name', display.fatherName], ['Mother\'s Name', display.motherName],
    ['Occupation', display.occupation], ['Complete Address', display.address],
    ['Cast / Religion', display.casteReligion], ['Nationality', display.nationality],
    ['Date Of Birth', dashDate(display.dob)], ['In Words', dateInWords(display.dob)],
    ['Name Of Previous School', display.previousSchool],
  ]

  pdf.setDrawColor(0, 0, 0)
  pdf.setLineWidth(0.8)
  pdf.rect(8, 8, width - 16, height - 16)
  if (duplicate) {
    pdf.setTextColor(220, 38, 38)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(38)
    pdf.text('DUPLICATE', width / 2, height / 2, { align: 'center', angle: 35 })
  }

  pdf.setTextColor(15, 23, 42)
  pdf.circle(24, 24, 10)
  if (logoData) pdf.addImage(logoData, imageFormat(logoData), 14, 14, 20, 20, undefined, 'FAST')
  pdf.rect(width - 37, 14, 25, 30)
  if (photoData) pdf.addImage(photoData, imageFormat(photoData), width - 37, 14, 25, 30, undefined, 'FAST')
  else {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(6.5)
    pdf.setTextColor(100, 116, 139)
    pdf.text('Paste Photo', width - 24.5, 28, { align: 'center' })
    pdf.text('Here', width - 24.5, 32, { align: 'center' })
  }
  pdf.setTextColor(185, 28, 28)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(18)
  pdf.text(schoolName.toUpperCase(), width / 2, 18, { align: 'center' })
  pdf.setTextColor(15, 23, 42)
  pdf.setFontSize(8.5)
  pdf.setFont('helvetica', 'italic')
  pdf.text(wrapRecognition(recognition), width / 2, 25, { align: 'center' })
  pdf.setFont('helvetica', 'normal')
  pdf.text(address, width / 2, 31, { align: 'center' })
  if (phone) pdf.text(`Phone: ${phone}`, width / 2, 36, { align: 'center' })
  if (form.affiliationNo || settings.affiliationNo) pdf.text(`Affiliation No: ${form.affiliationNo || settings.affiliationNo}${settings.schoolCode ? ` | School Code: ${settings.schoolCode}` : ''}`, width / 2, 41, { align: 'center' })

  pdf.setFillColor(17, 24, 39)
  pdf.rect(57, 50, 96, 10, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(13)
  pdf.text('TRANSFER CERTIFICATE', width / 2, 57, { align: 'center' })
  pdf.setTextColor(15, 23, 42)

  let y = 69
  pdf.setFontSize(8.2)
  pdf.setLineWidth(0.25)
  leftRows.forEach(([label, value], index) => {
    const rowY = y + index * 6.2
    pdf.rect(14, rowY - 4, 118, 6.2)
    pdf.setFont('helvetica', 'bold')
    pdf.text(label, 16, rowY)
    pdf.setFont('helvetica', 'normal')
    pdf.text(pdf.splitTextToSize(String(value || '-'), 70)[0] || '-', 59, rowY)
  })
  pdf.text(`Reg. No.: ${display.regNo}`, 14, 65)
  pdf.text(`Sr. No.: ${display.srNo}`, width - 55, 65)
  pdf.rect(140, 69, 54, 44)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Sr. No.', 146, 74)
  pdf.setFontSize(16)
  pdf.text(String(display.srNo), 167, 74)
  pdf.setFontSize(8.2)
  pdf.text(`Adm. No. ${display.regNo}`, 146, 85)
  pdf.text(`Issue Date: ${dashDate(form.issueDate)}`, 146, 94)
  pdf.text(`Class: ${className} / ${section}`, 146, 103)

  y = 145
  const colWidths = [12, 24, 24, 21, 35, 18, 15, 18, 17]
  const headers = ['Class', 'Admission', 'Promotion', 'TC Date', 'Reason', 'Session', 'Result', 'Character', 'Sign.']
  let x = 12
  pdf.setFontSize(6.2)
  headers.forEach((header, i) => { pdf.rect(x, y, colWidths[i], 8); pdf.text(header, x + colWidths[i] / 2, y + 5, { align: 'center' }); x += colWidths[i] })
  academicRows.forEach((row, rowIndex) => {
    x = 12
    const rowY = y + 8 + rowIndex * 9
    const cells = [row.className || row.class, dashDate(row.admissionDate || row.dateAdmission), dashDate(row.promotionDate || row.datePromotion), dashDate(row.tcDate || row.dateTc), row.reason, row.session, row.result, row.character, '']
    cells.forEach((cell, i) => { pdf.rect(x, rowY, colWidths[i], 9); pdf.text(pdf.splitTextToSize(String(cell || '-'), colWidths[i] - 2), x + colWidths[i] / 2, rowY + 5, { align: 'center' }); x += colWidths[i] })
  })

  const certY = Math.min(215, y + 14 + academicRows.length * 9)
  pdf.setFontSize(8.5)
  pdf.text(pdf.splitTextToSize(form.bottomText || settings.defaultBottomText || tcBottomText, 150), 15, certY)
  pdf.setFont('helvetica', 'bold')
  pdf.text(`Date: ${dashDate(form.issueDate)}`, 16, 242)
  const sigs = [[form.sig1Label || settings.sig1Label || 'Prepared By', 24], [form.sig2Label || settings.sig2Label || 'Checked By', width / 2], [form.sig3Label || settings.sig3Label || 'Principal', width - 31]]
  sigs.forEach(([label, cx]) => { pdf.line(cx - 24, 258, cx + 24, 258); pdf.text(`(${label})`, cx, 265, { align: 'center' }) })
  pdf.setDrawColor(100, 116, 139)
  pdf.setLineDashPattern([1.8, 1.5], 0)
  pdf.ellipse(width - 31, 278, 17, 9)
  pdf.setFontSize(7)
  pdf.text('Seal / Stamp', width - 31, 280, { align: 'center' })
  pdf.save(`Transfer-Certificate-${student.name.replace(/\s+/g, '-')}.pdf`)
}

async function downloadCertificatePdf(type, student, form, school, settings, certificateNumber, duplicate, photoUrl = '', academics = {}) {
  if (type === 'character') return downloadCharacterCertificatePdf(student, form, school, settings, certificateNumber, duplicate, photoUrl)
  if (type === 'tc') return downloadTransferCertificatePdf(student, form, school, settings, certificateNumber, duplicate, photoUrl, academics)
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const width = pdf.internal.pageSize.getWidth()
  const height = pdf.internal.pageSize.getHeight()
  pdf.setDrawColor(12, 28, 52)
  pdf.setLineWidth(0.8)
  pdf.rect(9, 9, width - 18, height - 18)
  if (duplicate) {
    pdf.setTextColor(220, 38, 38)
    pdf.setFontSize(38)
    pdf.setFont('helvetica', 'bold')
    pdf.text('DUPLICATE', width / 2, height / 2, { align: 'center', angle: 35 })
  }
  pdf.setTextColor(12, 28, 52)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(type === 'tc' ? 17 : 20)
  pdf.text(settings.schoolName || school.schoolName || 'School Name', width / 2, 22, { align: 'center' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8.5)
  pdf.text(settings.address || school.address || '', width / 2, 28, { align: 'center' })
  pdf.text([settings.phone || school.phone, settings.email || school.email].filter(Boolean).join(' | '), width / 2, 33, { align: 'center' })
  pdf.setDrawColor(51, 51, 51)
  pdf.setLineWidth(0.25)
  pdf.rect(width - 32, 18, 24.5, 31.5)
  const photoData = await imageUrlToDataUrl(photoUrl || student.photoUrl || '')
  if (photoData) {
    pdf.addImage(photoData, 'JPEG', width - 32, 18, 24.5, 31.5, undefined, 'FAST')
  } else {
    pdf.setFontSize(6.5)
    pdf.setTextColor(110, 118, 132)
    pdf.text('Paste Photo', width - 19.75, 32, { align: 'center' })
    pdf.text('Here', width - 19.75, 35, { align: 'center' })
  }
  pdf.setFillColor(5, 38, 89)
  pdf.rect(45, 41, 120, 10, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(13)
  pdf.text(type === 'sports' ? 'CERTIFICATE OF ACHIEVEMENT' : titles[type], width / 2, 48, { align: 'center' })
  pdf.setTextColor(12, 28, 52)
  pdf.setFontSize(8.5)
  pdf.text(certificateNumber, 18, 60)
  pdf.text(longDate(form.issueDate), width - 18, 60, { align: 'right' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(type === 'tc' ? 8 : 11)
  const p = pronouns(student)
  const { className, section } = classParts(student.className)
  let lines = []
  if (type === 'tc') {
    lines = [
      `Name: ${student.name}`, `Father: ${student.fatherName || student.guardian}`, `Mother: ${student.motherName || '-'}`,
      `DOB: ${shortDate(student.dob)} (${dateInWords(student.dob)})`, `Admission No: ${student.roll}`,
      `Class / Section: ${className} / ${section}`, `Date of Admission: ${shortDate(student.admissionDate)}`,
      `Date of Leaving: ${shortDate(form.dateOfLeaving)}`, `Result: ${form.result}`, `General Conduct: ${form.conduct}`,
      `Reason for Leaving: ${form.reason}`, `Remarks: ${form.remarks || '-'}`,
    ]
  } else if (type === 'character') {
    lines = [
      `This is to certify that ${student.name}, ward of ${student.fatherName || student.guardian}, S.R. No. ${student.roll},`,
      `resident of ${student.address || '-'}, was a bonafide student of Class ${className} ${section}.`,
      `During ${p.possessiveLower} stay in the school, ${p.subjectLower} had been a ${String(form.conduct).toLowerCase()}, disciplined`,
      `and hardworking student. ${p.possessive} date of birth according to school record is ${shortDate(student.dob)}.`,
      `To the best of my knowledge ${p.subjectLower} bears a good moral character. I wish ${p.subjectLower} every success in life.`,
    ]
  } else if (type === 'bonafide') {
    lines = [`This is to certify that ${student.name}, ${p.relation} of ${student.fatherName || student.guardian}, is a bonafide`, `student of this school studying in Class ${className}-${section} during ${academicYear(form.academicYear || school.academicYear)}.`, `Date of Birth: ${shortDate(student.dob)}. Purpose: ${form.purpose === 'Other' ? form.customPurpose : form.purpose}.`]
  } else if (type === 'study') {
    lines = [`This is to certify that ${student.name}, Admission No. ${student.roll}, ${p.relation} of`, `${student.fatherName || student.guardian}, is studying in Class ${className}-${section} during academic year`, `${academicYear(form.academicYear || school.academicYear)}. Purpose: ${form.purpose === 'Other' ? form.customPurpose : form.purpose}.`]
  } else {
    lines = [`This is to certify that ${student.name} of Class ${className}-${section} participated in`, `${form.sportName} at ${form.competitionLevel} level and secured ${form.position} position.`, `Event Date: ${longDate(form.eventDate)}. We congratulate the student for this achievement.`]
  }
  const body = pdf.splitTextToSize(lines.join('\n\n'), width - 40)
  pdf.text(body, 20, 76, { lineHeightFactor: type === 'tc' ? 1.45 : 1.8 })
  pdf.setFont('helvetica', 'bold')
  pdf.text('Prepared / Checked By', 24, 255)
  pdf.text(settings.principalName || 'Principal', width - 25, 255, { align: 'right' })
  pdf.setFont('helvetica', 'normal')
  pdf.text('School Seal & Signature', width - 25, 262, { align: 'right' })
  pdf.save(`${certificateNumber}-${student.name.replace(/\s+/g, '-')}.pdf`)
}

function CertificateForm({ type, students, certificates, attendance, academics, documents, school, settings, onSave, onStatus }) {
  const [student, setStudent] = useState(null)
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(null)
  const [allowDuplicate, setAllowDuplicate] = useState(false)
  const [form, setForm] = useState({
    issueDate: today(), dateOfLeaving: today(), promotionDate: '', academicYear: school.academicYear || '2026-27',
    conduct: 'Good', purpose: 'Bank', customPurpose: '', reason: 'Higher Education', remarks: '',
    nationality: 'Indian', religion: '', caste: '', category: 'General', classOfAdmission: '',
    subjects: 'As per school curriculum', failed: 'No', lastExam: '', result: 'Pass', feeConcession: 'No',
    workingDays: '', daysPresent: '', ncc: 'No', coCurricular: '', feesPaidUpTo: '', libraryDues: 'Yes', otherDues: 'No',
    sportName: '', competitionLevel: 'School', position: '1st', eventDate: today(), principalName: settings.principalName || '',
    regNo: '', srNo: '', studentName: '', gender: 'MALE', fatherName: '', motherName: '', dob: '', previousSchool: '',
    occupation: 'LABOUR', occupationCustom: '', casteCustom: '', religionCustom: '', nationalityCustom: '',
    recognition: settings.recognition || 'Recognised by U.P. Government', customRecognition: settings.customRecognition || '', affiliationNo: settings.affiliationNo || '',
    bottomText: settings.defaultBottomText || tcBottomText, sig1Label: settings.sig1Label || 'Prepared By', sig2Label: settings.sig2Label || 'Checked By', sig3Label: settings.sig3Label || 'Principal',
    characterSerial: '', characterSchoolName: settings.schoolName || school.schoolName || '', characterLocation: settings.place || school.city || school.address || '',
    characterRecognition: settings.recognition || '(RECOGNISED BY GOVT.)', characterSession: school.academicYear || '2026-27',
    characterStudentName: '', characterFatherName: '', characterSrNo: '', characterAddress: '', characterClass: '', characterSection: '',
    characterDob: '', characterDobWords: '', characterConductText: 'hard working and sincere', characterPrincipalLabel: 'Principal',
    characterFooterSchool: settings.schoolName || school.schoolName || '', characterFooterLocation: settings.place || school.city || school.address || '',
    academicHistory: [],
  })
  const existing = useMemo(() => Object.entries(certificates || {}).map(([id, row]) => ({ id, ...row })).find(row => row.studentId === student?.id && row.certificateType === type && !row.isDuplicate), [certificates, student, type])
  const photoUrl = student ? profilePhoto(student) || documents?.[student.id]?.photo?.url || documents?.[student.id]?.photo?.data || '' : ''
  const certificateNumber = saved?.certificateNumber || numberForPreview(type)
  const selectStudent = item => {
    const marks = Object.values(attendance || {}).reduce((count, day) => count + (day[item.id] === 'P' ? 1 : 0), 0)
    const currentClass = numericClass(classParts(item.className).className) || 1
    const startClass = Math.max(1, currentClass >= 9 ? 9 : currentClass)
    const year = Number(String(school.academicYear || '2026').match(/\d{4}/)?.[0] || new Date().getFullYear())
    const history = Array.from({ length: Math.max(1, currentClass - startClass + 1) }, (_, index) => {
      const isLast = index === Math.max(1, currentClass - startClass + 1) - 1
      return {
        className: String(startClass + index),
        dateAdmission: index === 0 ? item.admissionDate || '' : '',
        datePromotion: isLast ? '' : `${year - (currentClass - startClass) + index + 1}-03-31`,
        dateTc: isLast ? today() : '',
        reason: isLast ? 'FOR HIGHER EDUCATION' : '-',
        session: `${year - (currentClass - startClass) + index}-${year - (currentClass - startClass) + index + 1}`,
        result: 'PASS',
        character: 'GOOD',
      }
    })
    setStudent(item)
    setSaved(null)
    setAllowDuplicate(false)
    setForm(current => ({
      ...current,
      regNo: current.regNo || String(item.roll || admissionNo(item) || ''),
      srNo: current.srNo || serialOnly(numberForPreview('tc')),
      studentName: item.name || '',
      gender: String(item.gender || 'MALE').toUpperCase(),
      fatherName: item.fatherName || item.guardian || '',
      motherName: item.motherName || '',
      dob: item.dob || '',
      address: item.address || '',
      characterSerial: current.characterSerial || serialOnly(numberForPreview('character')),
      characterStudentName: item.name || '',
      characterFatherName: item.fatherName || item.guardian || '',
      characterSrNo: String(item.roll || admissionNo(item) || ''),
      characterAddress: item.address || '',
      characterClass: classParts(item.className).className,
      characterSection: classParts(item.className).section,
      characterDob: item.dob || '',
      characterDobWords: dateInWords(item.dob || ''),
      classOfAdmission: classParts(item.className).className,
      daysPresent: String(marks),
      workingDays: String(Object.keys(attendance || {}).length),
      academicHistory: history,
    }))
  }
  const save = async () => {
    if (!student || (existing && !allowDuplicate)) return null
    setSaving(true)
    try {
      const record = await onSave({
        certificateType: type, studentId: student.id, studentName: student.name, admissionNo: student.roll,
        className: student.className, issueDate: form.issueDate, data: form, isDuplicate: Boolean(existing && allowDuplicate),
        originalCertificateId: existing?.id || '', printCount: 0, status: 'Generated',
      })
      setSaved(record)
      return record
    } finally { setSaving(false) }
  }
  const ensureSaved = async () => saved || save()
  const download = async () => {
    const record = await ensureSaved()
    if (!record) return
    await downloadCertificatePdf(type, student, form, school, settings, record.certificateNumber, record.isDuplicate, photoUrl, academics?.[student.id] || {})
    await onStatus(record.id, 'Downloaded', { printCount: record.printCount || 0 })
  }
  const print = async () => {
    const record = await ensureSaved()
    if (!record) return
    await onStatus(record.id, 'Printed', { printCount: Number(record.printCount || 0) + 1 })
    setPreview(true)
    setTimeout(() => safePrint('.certificate-preview-shell'), 350)
  }
  const whatsapp = async () => {
    const record = await ensureSaved()
    if (!record) return
    const phone = String(student.phone || '').replace(/\D/g, '')
    const message = encodeURIComponent(`${titles[type]} ${record.certificateNumber} has been generated for ${student.name}.`)
    window.open(`https://wa.me/${phone.length === 10 ? `91${phone}` : phone}?text=${message}`, '_blank', 'noopener,noreferrer')
  }
  const field = (label, content, full = false) => <label className={full ? 'full' : ''}>{label}{content}</label>
  const updateHistory = (index, key, value) => setForm(current => ({ ...current, academicHistory: current.academicHistory.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row) }))
  const addHistoryRow = () => setForm(current => ({ ...current, academicHistory: [...(current.academicHistory || []), { className: '1', dateAdmission: '', datePromotion: '', dateTc: '', reason: '-', session: school.academicYear || '2026-2027', result: 'PASS', character: 'GOOD' }] }))
  const deleteHistoryRow = index => setForm(current => ({ ...current, academicHistory: current.academicHistory.filter((_, rowIndex) => rowIndex !== index) }))
  const moveHistoryRow = (index, offset) => setForm(current => {
    const rows = [...(current.academicHistory || [])]
    const next = index + offset
    if (next < 0 || next >= rows.length) return current
    ;[rows[index], rows[next]] = [rows[next], rows[index]]
    return { ...current, academicHistory: rows }
  })
  return <>
    <div className="certificate-generator-heading"><button className="text-button" onClick={() => setStudent(null)}>Step 1 · {certificateTypes.find(item => item.id === type)?.name}</button><span>Step 2 · Search student</span><span>Step 3 · Fill details</span><span>Step 4 · Preview &amp; issue</span></div>
    <StudentFinder students={students} value={student} onSelect={selectStudent} />
    {!student ? <div className="empty-state certificate-empty"><Search size={28} /><strong>Select a student to begin</strong><p>Name, admission number and profile details will auto-fill.</p></div> : <>
      {existing && <section className="duplicate-warning"><div><strong>Certificate already issued on {longDate(existing.issueDate)}</strong><span>{existing.certificateNumber}</span></div><label><input type="checkbox" checked={allowDuplicate} onChange={event => { setAllowDuplicate(event.target.checked); setSaved(null) }} /> Generate Duplicate with watermark</label></section>}
      <div className="certificate-workspace">
        <section className="panel certificate-form-panel">
          <div className="panel-header"><div><h3>{titles[type]}</h3><p>Student data is filled from Admissions. Extra fields remain editable.</p></div></div>
          <div className="form-grid">
            {field('Admission Number', <input readOnly value={student.roll} />)}
            {field('Student Name', <input readOnly value={student.name} />)}
            {field('Father Name', <input readOnly value={student.fatherName || student.guardian || ''} />)}
            {field('Class / Section', <input readOnly value={student.className} />)}
            {field('Issue Date', <DatePicker value={form.issueDate} onChange={value => setForm({ ...form, issueDate: value })} />)}
            {type === 'character' && <>
              {field('Serial No', <input value={form.characterSerial} onChange={event => setForm({ ...form, characterSerial: event.target.value })} />)}
              {field('Session', <input value={form.characterSession} onChange={event => setForm({ ...form, characterSession: event.target.value })} />)}
              {field('School Name', <input value={form.characterSchoolName} onChange={event => setForm({ ...form, characterSchoolName: event.target.value })} />, true)}
              {field('School Location', <input value={form.characterLocation} onChange={event => setForm({ ...form, characterLocation: event.target.value })} />, true)}
              {field('Recognition Text', <input value={form.characterRecognition} onChange={event => setForm({ ...form, characterRecognition: event.target.value })} />, true)}
              {field('Student Name', <input value={form.characterStudentName} onChange={event => setForm({ ...form, characterStudentName: event.target.value })} />)}
              {field('Father / Guardian', <input value={form.characterFatherName} onChange={event => setForm({ ...form, characterFatherName: event.target.value })} />)}
              {field('S.R.No.', <input value={form.characterSrNo} onChange={event => setForm({ ...form, characterSrNo: event.target.value })} />)}
              {field('Class', <input value={form.characterClass} onChange={event => setForm({ ...form, characterClass: event.target.value })} />)}
              {field('Section', <input value={form.characterSection} onChange={event => setForm({ ...form, characterSection: event.target.value })} />)}
              {field('Date of Birth', <DatePicker value={form.characterDob} onChange={value => setForm({ ...form, characterDob: value, characterDobWords: dateInWords(value) })} />)}
              {field('DOB in Words', <input value={form.characterDobWords} onChange={event => setForm({ ...form, characterDobWords: event.target.value })} />, true)}
              {field('Conduct Text', <input value={form.characterConductText} onChange={event => setForm({ ...form, characterConductText: event.target.value })} placeholder="hard working and sincere" />, true)}
              {field('Residence Address', <textarea value={form.characterAddress || ''} onChange={event => setForm({ ...form, characterAddress: event.target.value })} />, true)}
              {field('Footer School', <input value={form.characterFooterSchool} onChange={event => setForm({ ...form, characterFooterSchool: event.target.value })} />)}
              {field('Footer Location', <input value={form.characterFooterLocation} onChange={event => setForm({ ...form, characterFooterLocation: event.target.value })} />)}
              {field('Principal Label', <input value={form.characterPrincipalLabel} onChange={event => setForm({ ...form, characterPrincipalLabel: event.target.value })} />)}
            </>}
            {type === 'tc' && <>
              {field('Reg. No', <input value={form.regNo} onChange={event => setForm({ ...form, regNo: event.target.value })} />)}
              {field('Sr. No', <input value={form.srNo} onChange={event => setForm({ ...form, srNo: event.target.value })} />)}
              {field('TC Date', <DatePicker value={form.issueDate} onChange={value => setForm({ ...form, issueDate: value })} />)}
              {field('Recognition / Board', <select value={form.recognition} onChange={event => setForm({ ...form, recognition: event.target.value })}>{recognitionOptions.map(item => <option key={item}>{item}</option>)}</select>, true)}
              {form.recognition === 'Write Custom Text...' && field('Custom Recognition Text', <input value={form.customRecognition} onChange={event => setForm({ ...form, customRecognition: event.target.value })} placeholder="Type exact recognition text" />, true)}
              {field('Affiliation No', <input value={form.affiliationNo} onChange={event => setForm({ ...form, affiliationNo: event.target.value })} placeholder="Shows below school name for affiliated boards" />)}
              {field('Student Name', <input value={form.studentName} onChange={event => setForm({ ...form, studentName: event.target.value })} />)}
              {field('Gender', <select value={form.gender} onChange={event => setForm({ ...form, gender: event.target.value })}><option>MALE</option><option>FEMALE</option><option>OTHER</option></select>)}
              {field('Father Name', <input value={form.fatherName} onChange={event => setForm({ ...form, fatherName: event.target.value })} />)}
              {field('Mother Name', <input value={form.motherName} onChange={event => setForm({ ...form, motherName: event.target.value })} />)}
              {field('Date of Birth', <DatePicker value={form.dob} onChange={value => setForm({ ...form, dob: value })} />)}
              {field('DOB in Words', <input readOnly value={dateInWords(form.dob)} />)}
              {field('Nationality', <select value={form.nationality} onChange={event => setForm({ ...form, nationality: event.target.value })}><option>INDIAN</option><option>OTHER</option></select>)}
              {form.nationality === 'OTHER' && field('Custom Nationality', <input value={form.nationalityCustom} onChange={event => setForm({ ...form, nationalityCustom: event.target.value })} />)}
              {field('Parent Occupation', <select value={form.occupation} onChange={event => setForm({ ...form, occupation: event.target.value })}>{occupations.map(item => <option key={item}>{item}</option>)}</select>)}
              {form.occupation === 'OTHER' && field('Custom Occupation', <input value={form.occupationCustom} onChange={event => setForm({ ...form, occupationCustom: event.target.value })} />)}
              {field('Caste', <select value={form.caste} onChange={event => setForm({ ...form, caste: event.target.value })}>{casteOptions.map(item => <option key={item}>{item}</option>)}</select>)}
              {form.caste === 'OTHER' && field('Custom Caste', <input value={form.casteCustom} onChange={event => setForm({ ...form, casteCustom: event.target.value })} />)}
              {field('Religion', <select value={form.religion} onChange={event => setForm({ ...form, religion: event.target.value })}>{religionOptions.map(item => <option key={item}>{item}</option>)}</select>)}
              {form.religion === 'OTHER' && field('Custom Religion', <input value={form.religionCustom} onChange={event => setForm({ ...form, religionCustom: event.target.value })} />)}
              {field('Previous School', <input value={form.previousSchool || ''} onChange={event => setForm({ ...form, previousSchool: event.target.value })} />)}
              {field('Complete Address', <textarea value={form.address || ''} onChange={event => setForm({ ...form, address: event.target.value })} />, true)}
              <div className="full tc-history-editor">
                <div className="panel-header"><div><h3>Class History Table</h3><p>Each cell is editable. Blank fields print as dash.</p></div><button type="button" className="secondary-button" onClick={addHistoryRow}>+ Add Row</button></div>
                <div className="table-scroll"><table><thead><tr><th>Class</th><th>Admission</th><th>Promotion</th><th>TC Date</th><th>Reason</th><th>Session</th><th>Result</th><th>Character</th><th>Move</th><th></th></tr></thead><tbody>{(form.academicHistory || []).map((row, index) => <tr key={index}><td><select value={row.className || row.class || ''} onChange={event => updateHistory(index, 'className', event.target.value)}>{classHistoryClasses.map(item => <option key={item}>{item}</option>)}</select></td><td><DatePicker value={row.dateAdmission || row.admissionDate || ''} onChange={value => updateHistory(index, 'dateAdmission', value)} /></td><td><DatePicker value={row.datePromotion || row.promotionDate || ''} onChange={value => updateHistory(index, 'datePromotion', value)} /></td><td><DatePicker value={row.dateTc || row.tcDate || ''} onChange={value => updateHistory(index, 'dateTc', value)} /></td><td><select value={row.reason || '-'} onChange={event => updateHistory(index, 'reason', event.target.value)}>{leavingReasons.map(item => <option key={item}>{item}</option>)}</select></td><td><select value={row.session || ''} onChange={event => updateHistory(index, 'session', event.target.value)}>{sessions.map(item => <option key={item}>{item}</option>)}</select></td><td><select value={row.result || 'PASS'} onChange={event => updateHistory(index, 'result', event.target.value)}><option>PASS</option><option>FAIL</option><option>APPEARED</option><option>PROMOTED</option><option>DETAINED</option><option>-</option></select></td><td><select value={row.character || 'GOOD'} onChange={event => updateHistory(index, 'character', event.target.value)}><option>GOOD</option><option>VERY GOOD</option><option>EXCELLENT</option><option>SATISFACTORY</option><option>-</option></select></td><td><button type="button" className="icon-button" onClick={() => moveHistoryRow(index, -1)}>↑</button><button type="button" className="icon-button" onClick={() => moveHistoryRow(index, 1)}>↓</button></td><td><button type="button" className="icon-button danger" onClick={() => deleteHistoryRow(index)}><Trash2 size={13} /></button></td></tr>)}</tbody></table></div>
              </div>
              {field('Bottom Text', <textarea value={form.bottomText} onChange={event => setForm({ ...form, bottomText: event.target.value })} />, true)}
              {field('Signature 1 Label', <input value={form.sig1Label} onChange={event => setForm({ ...form, sig1Label: event.target.value })} />)}
              {field('Signature 2 Label', <input value={form.sig2Label} onChange={event => setForm({ ...form, sig2Label: event.target.value })} />)}
              {field('Signature 3 Label', <input value={form.sig3Label} onChange={event => setForm({ ...form, sig3Label: event.target.value })} />)}
              {field('Remarks', <textarea value={form.remarks} onChange={event => setForm({ ...form, remarks: event.target.value })} />, true)}
            </>}
            {type === 'bonafide' && <>{field('Purpose', <select value={form.purpose} onChange={event => setForm({ ...form, purpose: event.target.value })}><option>Bank</option><option>Passport</option><option>Scholarship</option><option>Loan</option><option>Other</option></select>)}{field('Conduct', <select value={form.conduct} onChange={event => setForm({ ...form, conduct: event.target.value })}><option>Good</option><option>Very Good</option><option>Excellent</option></select>)}{form.purpose === 'Other' && field('Custom Purpose', <input value={form.customPurpose} onChange={event => setForm({ ...form, customPurpose: event.target.value })} />, true)}</>}
            {type === 'study' && <>{field('Purpose', <select value={form.purpose} onChange={event => setForm({ ...form, purpose: event.target.value })}><option>Education</option><option>Scholarship</option><option>Bank</option><option>Passport</option><option>Other</option></select>)}{form.purpose === 'Other' && field('Custom Purpose', <input value={form.customPurpose} onChange={event => setForm({ ...form, customPurpose: event.target.value })} />, true)}</>}
            {type === 'sports' && <>{field('Sport / Activity', <input required value={form.sportName} onChange={event => setForm({ ...form, sportName: event.target.value })} placeholder="Football, Athletics..." />)}{field('Competition Level', <select value={form.competitionLevel} onChange={event => setForm({ ...form, competitionLevel: event.target.value })}><option>School</option><option>District</option><option>State</option><option>National</option></select>)}{field('Position Achieved', <select value={form.position} onChange={event => setForm({ ...form, position: event.target.value })}><option>1st</option><option>2nd</option><option>3rd</option><option>Participant</option></select>)}{field('Date of Event', <DatePicker value={form.eventDate} onChange={value => setForm({ ...form, eventDate: value })} />)}</>}
          </div>
          <div className="certificate-actions"><button className="secondary-button" onClick={() => setPreview(true)}><Eye size={15} /> Preview</button><button className="secondary-button" disabled={Boolean(existing && !allowDuplicate)} onClick={download}><Download size={15} /> Download PDF</button><button className="secondary-button" disabled={Boolean(existing && !allowDuplicate)} onClick={print}><Printer size={15} /> Print</button><button className="secondary-button" disabled={Boolean(existing && !allowDuplicate)} onClick={whatsapp}><MessageCircle size={15} /> WhatsApp</button><button className="primary-button" disabled={saving || Boolean(saved) || Boolean(existing && !allowDuplicate)} onClick={save}><Save size={15} /> {saved ? saved.certificateNumber : saving ? 'Saving...' : existing && !allowDuplicate ? 'Already Issued' : 'Save Certificate'}</button></div>
        </section>
        <div className="certificate-inline-preview"><CertificatePaper type={type} student={student} form={form} school={school} settings={settings} certificateNumber={certificateNumber} photoUrl={photoUrl} academics={academics} duplicate={Boolean(existing && allowDuplicate)} /></div>
      </div>
    </>}
    {preview && <PreviewModal type={type} student={student} form={form} school={school} settings={settings} certificateNumber={certificateNumber} photoUrl={photoUrl} academics={academics} duplicate={Boolean(existing && allowDuplicate)} onClose={() => setPreview(false)} onPrint={() => safePrint('.certificate-preview-shell')} />}
  </>
}

function CertificateOverview({ certificates, students, documents, school, settings, academics, fees = {}, examData = { exams: {}, dateSheet: {} }, onOpen, onDelete, onStatus }) {
  const rows = Object.entries(certificates || {}).map(([id, row]) => ({ id, ...row })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  const [preview, setPreview] = useState(null)
  return <>
    <section className="certificate-type-grid">{certificateTypes.map(({ id, name, description, icon: Icon }) => <article className="certificate-type-card" key={id}><div className={`certificate-type-icon type-${id}`}><Icon size={24} /></div><div><h3>{name}</h3><p>{description}</p></div><strong>{rows.filter(row => row.certificateType === id).length} generated</strong><button className="primary-button" onClick={() => onOpen(id)}>Generate <span>?</span></button></article>)}</section>
    <section className="panel certificate-history">
      <div className="panel-header"><div><h3>Certificate History</h3><p>Recent generated and duplicate certificates</p></div><button className="secondary-button" onClick={() => onOpen('register')}><FileText size={15} /> Full Register</button></div>
    <div className="table-scroll"><table><thead><tr><th>Certificate No.</th><th>Student</th><th>Type</th><th>Class</th><th>Issue Date</th><th>Actions</th></tr></thead><tbody>{rows.slice(0, 10).map(row => { const student = students.find(item => item.id === row.studentId); const photoUrl = profilePhoto(student) || documents?.[row.studentId]?.photo?.url || documents?.[row.studentId]?.photo?.data || ''; return <tr key={row.id}><td><code>{row.certificateNumber}</code>{row.isDuplicate && <small className="duplicate-label">Duplicate</small>}</td><td>{row.studentName || student?.name || 'Deleted student'}</td><td>{certificateTypes.find(item => item.id === row.certificateType)?.name || row.certificateType}</td><td>{row.className || student?.className || '-'}</td><td>{longDate(row.issueDate)}</td><td className="action-cell"><button className="icon-button" title="View" onClick={() => setPreview({ row, student, photoUrl })}><Eye size={14} /></button>{student && <button className="icon-button" title="Print" onClick={async () => { setPreview({ row, student, photoUrl }); await onStatus(row.id, 'Printed', { printCount: Number(row.printCount || 0) + 1 }); setTimeout(() => safePrint('.certificate-preview-shell'), 350) }}><Printer size={14} /></button>}<button className="icon-button danger" title="Delete" onClick={() => onDelete(row.id)}><Trash2 size={14} /></button></td></tr> })}{!rows.length && <tr><td colSpan="6"><div className="empty-state">No certificates generated yet.</div></td></tr>}</tbody></table></div>
    </section>
    {preview && <PreviewModal type={preview.row.certificateType} student={preview.student} form={preview.row.data} school={school} settings={settings} certificateNumber={preview.row.certificateNumber} photoUrl={preview.photoUrl} academics={academics} duplicate={preview.row.isDuplicate} exam={Object.values(examData.exams || {}).find(exam => exam.id === (preview.row.examId || preview.row.data?.examId)) || { name: preview.row.data?.examName || 'Examination' }} dateRows={preview.student ? admitRowsForStudent(preview.student, preview.row.examId || preview.row.data?.examId, examData.dateSheet) : []} pendingAmount={preview.student ? pendingFeeForStudent(preview.student, fees) : 0} showPendingFee={Boolean(preview.row.data?.showPendingFee)} onClose={() => setPreview(null)} onPrint={() => safePrint('.certificate-preview-shell')} />}
  </>
}

function CertificateSettings({ settings, school, onSave }) {
  const [form, setForm] = useState({
    color: '#052659', font: 'Georgia', borderStyle: 'solid', principalName: '', vicePrincipalName: '',
    affiliationNo: '', schoolCode: '', place: '', city: school.city || '', state: '', pincode: '',
    recognition: 'Recognised by U.P. Government', customRecognition: '', establishedYear: '',
    defaultBottomText: tcBottomText, sig1Label: 'Prepared By', sig2Label: 'Checked By', sig3Label: 'Principal',
    ...settings,
  })
  const [logoFile, setLogoFile] = useState(null)
  const [saved, setSaved] = useState(false)
  const submit = async event => {
    event.preventDefault()
    await onSave(form, logoFile)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }
  return <form className="panel certificate-settings" onSubmit={submit}>
    <div className="panel-header"><div><h3>Certificate Settings</h3><p>These details automatically appear on every certificate.</p></div></div>
    <div className="form-grid">
      <label>School Logo / Seal<input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => setLogoFile(event.target.files?.[0] || null)} /></label>
      <label>School Name<input value={form.schoolName || school.schoolName || ''} onChange={event => setForm({ ...form, schoolName: event.target.value })} /></label>
      <label className="full">School Address<textarea value={form.address || school.address || ''} onChange={event => setForm({ ...form, address: event.target.value })} /></label>
      <label>School Phone<input value={form.phone || school.phone || ''} onChange={event => setForm({ ...form, phone: event.target.value })} /></label>
      <label>School Email<input type="email" value={form.email || school.email || ''} onChange={event => setForm({ ...form, email: event.target.value })} /></label>
      <label>City<input value={form.city || ''} onChange={event => setForm({ ...form, city: event.target.value })} /></label>
      <label>State<input value={form.state || ''} onChange={event => setForm({ ...form, state: event.target.value })} /></label>
      <label>Pincode<input value={form.pincode || ''} onChange={event => setForm({ ...form, pincode: event.target.value })} /></label>
      <label>Principal Name<input value={form.principalName} onChange={event => setForm({ ...form, principalName: event.target.value })} /></label>
      <label>Vice Principal Name<input value={form.vicePrincipalName || ''} onChange={event => setForm({ ...form, vicePrincipalName: event.target.value })} /></label>
      <label>Affiliation No.<input value={form.affiliationNo} onChange={event => setForm({ ...form, affiliationNo: event.target.value })} /></label>
      <label>School Code<input value={form.schoolCode} onChange={event => setForm({ ...form, schoolCode: event.target.value })} /></label>
      <label>Established Year<input value={form.establishedYear || ''} onChange={event => setForm({ ...form, establishedYear: event.target.value })} /></label>
      <label>Place / City<input value={form.place || school.city || ''} onChange={event => setForm({ ...form, place: event.target.value })} /></label>
      <label className="full">Recognition / Board<select value={form.recognition} onChange={event => setForm({ ...form, recognition: event.target.value })}>{recognitionOptions.map(item => <option key={item}>{item}</option>)}</select></label>
      {form.recognition === 'Write Custom Text...' && <label className="full">Custom Recognition<input value={form.customRecognition || ''} onChange={event => setForm({ ...form, customRecognition: event.target.value })} /></label>}
      <label className="full">Default TC Bottom Text<textarea value={form.defaultBottomText || ''} onChange={event => setForm({ ...form, defaultBottomText: event.target.value })} /></label>
      <label>Signature 1 Label<input value={form.sig1Label || ''} onChange={event => setForm({ ...form, sig1Label: event.target.value })} /></label>
      <label>Signature 2 Label<input value={form.sig2Label || ''} onChange={event => setForm({ ...form, sig2Label: event.target.value })} /></label>
      <label>Signature 3 Label<input value={form.sig3Label || ''} onChange={event => setForm({ ...form, sig3Label: event.target.value })} /></label>
    </div>
    <button className="primary-button"><Save size={15} /> {saved ? 'Settings Saved' : 'Save Settings'}</button>
  </form>
}

function CertificateRegister({ certificates, students, documents, school, settings, academics, fees = {}, examData = { exams: {}, dateSheet: {} }, onDelete, onStatus }) {
  const [type, setType] = useState('All')
  const [search, setSearch] = useState('')
  const [preview, setPreview] = useState(null)
  const rows = Object.entries(certificates || {}).map(([id, row]) => ({ id, ...row })).filter(row => (type === 'All' || row.certificateType === type) && `${row.certificateNumber} ${row.studentName} ${row.admissionNo}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  return <>
    <section className="panel certificate-register-filters"><label>Certificate Type<select value={type} onChange={event => setType(event.target.value)}><option>All</option>{certificateTypes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Search<div className="certificate-search-input"><Search size={15} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Certificate, student or admission no." /></div></label></section>
    <section className="panel table-panel"><div className="table-scroll"><table><thead><tr><th>#</th><th>Certificate No.</th><th>Student</th><th>Type</th><th>Class</th><th>Issued</th><th>Prints</th><th>Actions</th></tr></thead><tbody>{rows.map((row, index) => { const student = students.find(item => item.id === row.studentId); const photoUrl = profilePhoto(student) || documents?.[row.studentId]?.photo?.url || documents?.[row.studentId]?.photo?.data || ''; return <tr key={row.id}><td>{index + 1}</td><td><code>{row.certificateNumber}</code>{row.isDuplicate && <small className="duplicate-label">Duplicate</small>}</td><td>{row.studentName || student?.name || '-'}</td><td>{certificateTypes.find(item => item.id === row.certificateType)?.name || row.certificateType}</td><td>{row.className || student?.className || '-'}</td><td>{longDate(row.issueDate)}</td><td>{row.printCount || 0}</td><td className="action-cell"><button className="icon-button" title="View" onClick={() => setPreview({ row, student, photoUrl })}><Eye size={14} /></button>{student && <button className="icon-button" title="Download PDF" onClick={async () => { await downloadCertificatePdf(row.certificateType, student, row.data, school, settings, row.certificateNumber, row.isDuplicate, photoUrl, academics?.[student.id] || {}); await onStatus(row.id, 'Downloaded') }}><Download size={14} /></button>}<button className="icon-button danger" title="Delete" onClick={() => onDelete(row.id)}><Trash2 size={14} /></button></td></tr> })}{!rows.length && <tr><td colSpan="8"><div className="empty-state">No certificates match these filters.</div></td></tr>}</tbody></table></div></section>
    {preview && <PreviewModal type={preview.row.certificateType} student={preview.student} form={preview.row.data} school={school} settings={settings} certificateNumber={preview.row.certificateNumber} photoUrl={preview.photoUrl} academics={academics} duplicate={preview.row.isDuplicate} exam={Object.values(examData.exams || {}).find(exam => exam.id === (preview.row.examId || preview.row.data?.examId)) || { name: preview.row.data?.examName || 'Examination' }} dateRows={preview.student ? admitRowsForStudent(preview.student, preview.row.examId || preview.row.data?.examId, examData.dateSheet) : []} pendingAmount={preview.student ? pendingFeeForStudent(preview.student, fees) : 0} showPendingFee={Boolean(preview.row.data?.showPendingFee)} onClose={() => setPreview(null)} onPrint={() => safePrint('.certificate-preview-shell')} />}
  </>
}

export default function CertificateManager({ students, fees = {}, attendance, academics, documents, school, certificates, settings, examData = { exams: {}, dateSheet: {}, admitCards: {} }, onSave, onSaveSettings, onSaveExam, onSaveDateSheet, onDeleteDateSheet, onSaveAdmitCards, onDelete, onStatus }) {
  const [page, setPage] = useState('overview')
  const typePage = certificateTypes.some(item => item.id === page)
  return <div className="certificate-module">
    <div className="section-actions"><div><h2>Certificate Center</h2><p>Create, print and track official student certificates.</p></div><button className="secondary-button" onClick={() => setPage('settings')}><Settings size={16} /> Settings</button></div>
    <div className="certificate-menu"><button className={page === 'overview' ? 'active' : ''} onClick={() => setPage('overview')}><FileText size={16} /> Overview</button>{certificateTypes.map(({ id, name, icon: Icon }) => <button key={id} className={page === id ? 'active' : ''} onClick={() => setPage(id)}><Icon size={16} /> {name}</button>)}<button className={page === 'register' ? 'active' : ''} onClick={() => setPage('register')}><IdCard size={16} /> Register</button></div>
    {page === 'overview' && <CertificateOverview certificates={certificates} students={students} documents={documents} school={school} settings={settings} academics={academics} fees={fees} examData={examData} onOpen={setPage} onDelete={onDelete} onStatus={onStatus} />}
    {page === 'admit' && <AdmitCardManager students={students} fees={fees} school={school} settings={settings} examData={examData} onSaveExam={onSaveExam} onSaveDateSheet={onSaveDateSheet} onDeleteDateSheet={onDeleteDateSheet} onSaveAdmitCards={onSaveAdmitCards} />}
    {typePage && page !== 'admit' && <CertificateForm type={page} students={students} certificates={certificates} attendance={attendance} academics={academics} documents={documents} school={school} settings={settings} onSave={onSave} onStatus={onStatus} />}
    {page === 'settings' && <CertificateSettings settings={settings} school={school} onSave={onSaveSettings} />}
    {page === 'register' && <CertificateRegister certificates={certificates} students={students} documents={documents} school={school} settings={settings} academics={academics} fees={fees} examData={examData} onDelete={onDelete} onStatus={onStatus} />}
  </div>
}

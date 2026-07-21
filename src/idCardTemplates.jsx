// Fixed ID card designs, offered alongside the existing free-form layout editor.
//
// The editor lets you drag any field anywhere, which is powerful but means every school has to
// design its own card. These are finished designs: 54 x 86 mm portrait, front and back, driven
// by the same person/school records the editor already uses.
//
// Fields the reference designs showed but this ERP may not have filled in - blood group, house,
// transport route - are dropped when empty rather than printed as "House: —". A card is a
// document a child carries; a blank labelled row on it looks like a mistake.
//
// Six designs come from one layout themed with CSS variables. Every card keeps
// id="id-card-preview" and class "id-card-preview" because the PNG, JPG, PDF and print paths
// in IDCardManager all select on those.

import React from 'react'
import './idCardTemplates.css'

const initialsOf = (value = '') =>
  String(value).split(/\s+/).map(part => part[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'ID'

// Only rows with a real value survive. Keeps empty optional fields off the printed card.
const rowsFor = (person, form) => {
  const all = person.type === 'visitor'
    ? [
      ['Pass No.', person.employeeId],
      ['Purpose', person.visitorPurpose],
      ['Date / Time', person.visitorTime],
      ['Contact', person.contact],
      ['Valid Upto', form.expiryDate],
    ]
    : person.type === 'student'
      ? [
        ['Admission No.', person.admissionNo],
        ['Roll No.', person.rollNumber],
        ['Date of Birth', person.dob],
        ['Blood Group', person.bloodGroup],
        ['House', person.house],
        ['Valid Upto', form.expiryDate],
      ]
      : [
        ['Employee ID', person.employeeId],
        ['Designation', person.designation],
        ['Department', person.department],
        ['Blood Group', person.bloodGroup],
        ['Contact', person.contact],
        ['Valid Upto', form.expiryDate],
      ]
  return all.filter(([, value]) => value)
}

const backRowsFor = (person, school) => {
  const all = person.type === 'student'
    ? [
      ['Father / Guardian', person.fatherName],
      ['Emergency Contact', person.contact || school.phone],
      ['Transport Route', person.transportRoute],
      ['Student ID', person.admissionNo || person.id],
    ]
    : [
      ['Contact', person.contact || school.phone],
      ['Email', person.email || school.email],
      ['Address', person.address || school.address],
      ['ID', person.employeeId || person.admissionNo || person.id],
    ]
  return all.filter(([, value]) => value)
}

const TITLE = { student: 'Student Identity Card', teacher: 'Teacher Identity Card', staff: 'Staff Identity Card', visitor: 'Visitor Pass' }

export function IdCardDesign({ design, side, person, school, form, qr, watermark = true }) {
  const logo = school.logo || school.logoURL || school.logoUrl || ''
  const session = school.academicYear || ''
  const motto = school.motto || ''
  const rows = rowsFor(person, form)
  const backRows = backRowsFor(person, school)

  return <div id="id-card-preview" className={`id-card-preview idc idc-${design} ${side === 'back' ? 'back-side' : ''}`}>
    {side === 'front' ? <div className="idc-front">
      <div className="idc-head">
        <div className="idc-school-row">
          <div className="idc-logo">{logo ? <img src={logo} alt="" /> : <span>{initialsOf(school.schoolName)}</span>}</div>
          <div>
            <div className="idc-school-name">{school.schoolName || 'School Name'}</div>
            <div className="idc-school-address">{[school.address, school.phone].filter(Boolean).join(' · ')}</div>
          </div>
        </div>
        <div className="idc-session">{TITLE[person.type] || 'Identity Card'}{session ? ` · ${session}` : ''}</div>
      </div>

      <div className="idc-photo-frame">
        <div className="idc-photo">{person.photo ? <img src={person.photo} alt="" /> : <span>{initialsOf(person.name)}</span>}</div>
      </div>

      <div className="idc-name">{person.name}</div>
      {(person.classSection || person.designation) && <div className="idc-class-row">
        <span className="idc-class">{person.type === 'student' ? `${person.className} – ${person.section}` : person.designation}</span>
      </div>}

      <div className="idc-info">{rows.map(([label, value]) => <div key={label}>
        <span>{label}</span><b>{value}</b>
      </div>)}</div>

      <div className="idc-foot">{motto || school.schoolName || ''}</div>
    </div> : <div className="idc-back">
      <div className="idc-back-title">{person.type === 'student' ? 'Student Verification' : 'Identity Verification'}</div>
      {qr && <div className="idc-qr">{qr}</div>}
      <div className="idc-scan">Scan to verify record</div>
      <div className="idc-back-info">{backRows.map(([label, value]) => <div key={label}>
        <span>{label}</span><b>{value}</b>
      </div>)}</div>
      <p className="idc-notice">
        If found, please return this card to the school office. This card is non-transferable and
        must be carried during school hours.
      </p>
      <div className="idc-signature">{school.principalName ? `${school.principalName} · Authorised Signatory` : 'Authorised Signatory'}</div>
      <div className="idc-back-foot">{school.email || school.phone || school.schoolName || ''}</div>
      {watermark && logo && <div className="idc-watermark"><img src={logo} alt="" /></div>}
    </div>}
  </div>
}

// 'custom' keeps the existing drag-and-drop layout editor. It stays the default so a school
// that already designed its card sees no change.
export const ID_DESIGNS = [
  { id: 'custom', label: 'Custom Layout', note: 'Editor' },
  { id: 'executive', label: 'Executive Navy' },
  { id: 'platinum', label: 'Platinum Minimal' },
  { id: 'maroon', label: 'Academic Maroon' },
  { id: 'classic', label: 'Classic Blue' },
  { id: 'blocks', label: 'Colour Blocks' },
  { id: 'fresh', label: 'Fresh Green' },
]

export const isFixedDesign = id => Boolean(id) && id !== 'custom' && ID_DESIGNS.some(item => item.id === id)

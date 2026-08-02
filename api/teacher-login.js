// Staff login: school code + mobile + date of birth. Har jaanch yahin rehti
// hai; Firebase/Supabase ke raaste _staff-store.js me hain.
const { createStore, digits, phone10 } = require('./_staff-store')

const splitCsv = value => Array.isArray(value) ? value.filter(Boolean) : String(value || '').split(',').map(s => s.trim()).filter(Boolean)

const dateKey = value => {
  if (!value) return ''
  if (typeof value === 'number') return new Date(value).toISOString().slice(0, 10)
  const raw = String(value)
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  const match = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
  return raw
}
const dobVariants = dob => {
  const key = dateKey(dob)
  const [year, month, day] = key.split('-')
  if (!year || !month || !day) return [digits(dob), String(dob || '')].filter(Boolean)
  return [...new Set([`${day}${month}${year}`, `${day}-${month}-${year}`, `${day}/${month}/${year}`, `${year}${month}${day}`, key, digits(dob)])]
}
const verifyDobPassword = (input, dob) => {
  const clean = digits(input)
  if (!clean) return false
  return dobVariants(dob).some(variant => clean === digits(variant) || String(input || '') === variant)
}

function buildStaffProfile(id, e, schoolId) {
  return {
    uid: id,
    employeeId: id,
    employeeCode: e.employeeCode || '',
    name: `${e.firstName || ''} ${e.lastName || ''}`.trim() || 'Staff',
    firstName: e.firstName || '',
    lastName: e.lastName || '',
    phone: e.phone || '',
    email: e.email || '',
    department: e.department || 'Staff',
    designation: e.designation || e.employeeRole || '',
    subject: e.subject || '',
    classes: splitCsv(e.assignedClasses || e.classes),
    sections: splitCsv(e.assignedSections || e.sections),
    photoUrl: e.photoUrl || '',
    joiningDate: e.joiningDate || '',
    dob: e.dob || '',
    role: 'staff',
    schoolId,
  }
}

// Phone se staff dhoondhna. Pehle unified staff collection (har employee, koi
// bhi department), phir purana teachers collection (jo "Create Teacher Login"
// se bane the).
function findByPhone(school, phone) {
  const staff = school.staff || {}
  const inStaff = Object.entries(staff).find(([, e]) => phone10(e.phone) === phone && e.active !== false)
  if (inStaff) return { match: inStaff, source: 'staff' }
  const teachers = school.teachers || {}
  const inTeachers = Object.entries(teachers).find(([, t]) => phone10(t.phone) === phone && t.isActive !== false)
  return inTeachers ? { match: inTeachers, source: 'teachers' } : null
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const store = createStore()
    const body = req.body || {}
    const schoolCode = String(body.schoolCode || '').trim().toUpperCase()
    const phone = phone10(body.phone)
    const password = String(body.password || '')

    if (schoolCode.length < 4) return res.status(400).json({ error: 'Enter your school code.' })
    if (phone.length !== 10) return res.status(400).json({ error: 'Mobile number must be 10 digits.' })
    if (!password) return res.status(400).json({ error: 'Enter your date of birth.' })

    const schoolId = await store.schoolIdByCode(schoolCode)
    if (!schoolId) return res.status(404).json({ error: 'Invalid school code.' })
    const school = await store.staffCollections(schoolId)
    if (!school) return res.status(404).json({ error: 'Invalid school code.' })

    const found = findByPhone(school, phone)
    if (!found) return res.status(404).json({ error: 'No staff member found with this mobile number. Contact your school admin.' })

    const [id, record] = found.match
    if (!verifyDobPassword(password, record.dob || record.dateOfBirth || '')) {
      return res.status(401).json({ error: 'Date of birth does not match our records. Contact your school admin.' })
    }

    const profile = buildStaffProfile(id, record, schoolId)

    await store.linkStaffIndex(schoolId, id, {
      role: profile.department === 'Teacher' ? 'teacher' : 'staff',
      source: found.source,
    })

    // Firebase par { token } (custom token), Supabase par { tokenHash } (magic
    // link). Client dono ko authAdapter ke ek hi function ko de deta hai.
    const grant = await store.grantSession(schoolId, id, profile)

    return res.status(200).json({ ok: true, ...grant, schoolId, employee: profile })
  } catch (error) {
    console.error('staff-login error:', error)
    return res.status(500).json({ error: error.message || 'Login failed. Try again.' })
  }
}

module.exports.__internals = { findByPhone, buildStaffProfile, verifyDobPassword, dobVariants, dateKey }

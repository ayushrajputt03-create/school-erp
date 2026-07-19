const { getApps, getApp, initializeApp, cert } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { getDatabase } = require('firebase-admin/database')

function getAdminApp() {
  if (getApps().length) return getApp()
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || ''
  if (!raw) throw new Error('Server config missing: FIREBASE_SERVICE_ACCOUNT_JSON not set.')
  let credentials
  try { credentials = JSON.parse(raw) } catch { throw new Error('Server config error: FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.') }
  if (!credentials.project_id) throw new Error('Server config error: service account missing project_id.')
  return initializeApp({
    credential: cert(credentials),
    databaseURL: process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL,
  })
}

const digits = value => String(value || '').replace(/\D/g, '')
// Match Indian mobile numbers by their last 10 digits so "07290810294", "+917290810294"
// and "7290810294" all compare equal — this is the data-mismatch that broke staff login.
const phone10 = value => { const d = digits(value); return d.length > 10 ? d.slice(-10) : d }
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

// Only the staff and teachers collections are needed to authenticate a login. Reading
// schools/{id} pulled every student, fee, attendance and certificate record along with them.
async function loadStaffCollections(database, schoolId) {
  const [staffSnap, teachersSnap] = await Promise.all([
    database.ref(`schools/${schoolId}/staff`).once('value'),
    database.ref(`schools/${schoolId}/teachers`).once('value'),
  ])
  if (!staffSnap.exists() && !teachersSnap.exists()) return null
  return { staff: staffSnap.val() || {}, teachers: teachersSnap.val() || {} }
}

// Fallback for a school whose schoolCodes entry is missing. The old version downloaded the whole
// schools tree - every school's entire dataset - to compare one string per school. This lists the
// ids shallowly and then reads just profile/schoolCode from each.
async function findSchoolIdByScan(app, database, code) {
  const databaseUrl = process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL
  const accessToken = await app.options.credential.getAccessToken()
  const listed = await fetch(`${databaseUrl}/schools.json?shallow=true&access_token=${accessToken.access_token}`)
  if (!listed.ok) throw new Error(`Could not list schools (${listed.status})`)
  const ids = Object.keys(await listed.json() || {})
  const codes = await Promise.all(ids.map(async id => [id, (await database.ref(`schools/${id}/profile/schoolCode`).once('value')).val()]))
  const hit = codes.find(([, value]) => String(value || '').toUpperCase() === code)
  return hit ? hit[0] : null
}

async function findSchool(database, schoolCode, app) {
  const code = String(schoolCode || '').trim().toUpperCase()
  const codeSnap = await database.ref(`schoolCodes/${code}`).once('value')
  const mapping = codeSnap.val()
  if (mapping?.schoolId) {
    const school = await loadStaffCollections(database, mapping.schoolId)
    if (school) return { schoolId: mapping.schoolId, school }
  }
  const scannedId = await findSchoolIdByScan(app, database, code).catch(() => null)
  if (!scannedId) return null
  const school = await loadStaffCollections(database, scannedId)
  return school ? { schoolId: scannedId, school } : null
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

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const app = getAdminApp()
    const database = getDatabase(app)
    const body = req.body || {}
    const schoolCode = String(body.schoolCode || '').trim().toUpperCase()
    const phone = phone10(body.phone)
    const password = String(body.password || '')

    if (schoolCode.length < 4) return res.status(400).json({ error: 'Enter your school code.' })
    if (phone.length !== 10) return res.status(400).json({ error: 'Mobile number must be 10 digits.' })
    if (!password) return res.status(400).json({ error: 'Enter your date of birth.' })

    const found = await findSchool(database, schoolCode, app)
    if (!found) return res.status(404).json({ error: 'Invalid school code.' })
    const { schoolId, school } = found

    // Search the unified staff collection (every employee, any department) by phone.
    const staff = school.staff || {}
    let match = Object.entries(staff).find(([, e]) => phone10(e.phone) === phone && e.active !== false)
    let source = 'staff'
    // Fallback: legacy teachers collection (accounts made by the old "Create Teacher Login").
    if (!match) {
      const teachers = school.teachers || {}
      match = Object.entries(teachers).find(([, t]) => phone10(t.phone) === phone && t.isActive !== false)
      source = 'teachers'
    }
    if (!match) return res.status(404).json({ error: 'No staff member found with this mobile number. Contact your school admin.' })

    const [id, record] = match
    if (!verifyDobPassword(password, record.dob || record.dateOfBirth || '')) {
      return res.status(401).json({ error: 'Date of birth does not match our records. Contact your school admin.' })
    }

    const profile = buildStaffProfile(id, record, schoolId)

    // Grant this staff member read access to their school (rules key on teachersIndex).
    await database.ref(`teachersIndex/${id}`).update({ schoolId, teacherId: id, role: profile.department === 'Teacher' ? 'teacher' : 'staff', source })

    const auth = getAuth(app)
    const customToken = await auth.createCustomToken(id, { role: 'staff', schoolId, department: profile.department })

    return res.status(200).json({ ok: true, token: customToken, schoolId, employee: profile })
  } catch (error) {
    console.error('staff-login error:', error)
    return res.status(500).json({ error: error.message || 'Login failed. Try again.' })
  }
}

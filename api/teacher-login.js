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

async function findSchool(database, schoolCode) {
  const code = String(schoolCode || '').trim().toUpperCase()
  const codeSnap = await database.ref(`schoolCodes/${code}`).once('value')
  const mapping = codeSnap.val()
  if (mapping?.schoolId) {
    const schoolSnap = await database.ref(`schools/${mapping.schoolId}`).once('value')
    const school = schoolSnap.val()
    if (school) return { schoolId: mapping.schoolId, school }
  }
  const schoolsSnap = await database.ref('schools').once('value')
  const schools = schoolsSnap.val() || {}
  const found = Object.entries(schools).find(([, school]) => String(school?.profile?.schoolCode || '').toUpperCase() === code)
  return found ? { schoolId: found[0], school: found[1] } : null
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
    const phone = digits(body.phone)
    const password = String(body.password || '')

    if (schoolCode.length < 4) return res.status(400).json({ error: 'Enter your school code.' })
    if (phone.length !== 10) return res.status(400).json({ error: 'Mobile number must be 10 digits.' })
    if (!password) return res.status(400).json({ error: 'Enter your date of birth.' })

    const found = await findSchool(database, schoolCode)
    if (!found) return res.status(404).json({ error: 'Invalid school code.' })
    const { schoolId, school } = found

    const teachers = school.teachers || {}
    const match = Object.entries(teachers).find(([, t]) => digits(t.phone) === phone && t.isActive !== false)
    if (!match) return res.status(404).json({ error: 'No teacher found with this mobile number. Contact your school admin.' })
    const [teacherUid, teacher] = match

    if (!verifyDobPassword(password, teacher.dob || teacher.dateOfBirth || '')) {
      return res.status(401).json({ error: 'Incorrect date of birth. Try again.' })
    }

    const customToken = await getAuth(app).createCustomToken(teacherUid, { role: 'teacher', schoolId })

    return res.status(200).json({ ok: true, token: customToken, schoolId, teacherUid })
  } catch (error) {
    console.error('teacher-login error:', error)
    return res.status(500).json({ error: error.message || 'Login failed. Try again.' })
  }
}

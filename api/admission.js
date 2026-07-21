const { getApps, getApp, initializeApp, cert } = require('firebase-admin/app')
const { getDatabase } = require('firebase-admin/database')
const crypto = require('crypto')

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

const now = () => Date.now()
const digits = value => String(value || '').replace(/\D/g, '')
const clean = (value, max) => String(value || '').trim().slice(0, max)

// This is the only public write path in the app, so the limits live here rather than in database
// rules - RTDB rules can validate the shape of a write but cannot rate limit one.
const MAX_PER_PHONE_PER_HOUR = 3
const MAX_PENDING_PER_SCHOOL = 200

const isFutureDate = value => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return true
  const endOfToday = new Date()
  endOfToday.setHours(23, 59, 59, 999)
  return parsed.getTime() > endOfToday.getTime()
}

// Only ever exposes the school's display identity. Anything else about the school stays behind
// authentication - a visitor with a QR link must not be able to learn more than which school
// they are applying to.
async function publicSchoolIdentity(database, schoolId) {
  const [nameSnap, logoSnap, altLogoSnap, subscriptionSnap] = await Promise.all([
    database.ref(`schools/${schoolId}/profile/schoolName`).once('value'),
    database.ref(`schools/${schoolId}/profile/logoURL`).once('value'),
    database.ref(`schools/${schoolId}/profile/logo`).once('value'),
    database.ref(`schools/${schoolId}/subscription/status`).once('value'),
  ])
  const schoolName = nameSnap.val()
  if (!schoolName) return null
  const status = String(subscriptionSnap.val() || 'trial').toLowerCase()
  return {
    schoolName,
    logo: logoSnap.val() || altLogoSnap.val() || '',
    open: status !== 'suspended' && status !== 'cancelled',
  }
}

module.exports = async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (request.method === 'OPTIONS') return response.status(200).end()
  if (request.method !== 'POST') return response.status(405).json({ ok: false, error: 'Method not allowed' })

  try {
    const database = getDatabase(getAdminApp())
    const body = request.body || {}
    const action = String(body.action || '')
    const schoolId = clean(body.schoolId, 128)
    if (!schoolId) throw new Error('Missing school.')

    if (action === 'school') {
      const identity = await publicSchoolIdentity(database, schoolId)
      if (!identity) return response.status(200).json({ ok: true, found: false })
      return response.status(200).json({ ok: true, found: true, ...identity })
    }

    if (action === 'submit') {
      // Honeypot: hidden from real users by CSS, so anything in it means a bot filled every
      // field. Report success without writing, so the bot has no signal that it was caught.
      // Logged because a silent drop is indistinguishable from a lost submission otherwise -
      // the first version of this field was called "website", which Chrome autofilled for real
      // parents and discarded their applications with no trace anywhere.
      if (clean(body.applicantRef, 200)) {
        console.warn('[admission] honeypot triggered, submission dropped', { schoolId })
        return response.status(200).json({ ok: true })
      }

      const identity = await publicSchoolIdentity(database, schoolId)
      if (!identity) throw new Error('This admission link is not valid.')
      if (!identity.open) throw new Error('Admissions are currently closed for this school.')

      const studentName = clean(body.studentName, 120)
      const dob = clean(body.dob, 10)
      const parentPhone = digits(body.parentPhone).slice(-10)
      if (studentName.length < 2) throw new Error('Enter the student\'s full name.')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) throw new Error('Choose a valid date of birth.')
      if (isFutureDate(dob)) throw new Error('Date of birth cannot be in the future.')
      if (parentPhone.length !== 10) throw new Error('Enter a valid 10 digit mobile number.')
      if (!clean(body.classAppliedFor, 40)) throw new Error('Select the class being applied for.')

      const throttleRef = database.ref(`schools/${schoolId}/admissionThrottle/${parentPhone}`)
      const throttle = (await throttleRef.once('value')).val() || {}
      const windowStart = now() - 60 * 60 * 1000
      const recent = Number(throttle.windowStartedAt || 0) > windowStart ? Number(throttle.count || 0) : 0
      if (recent >= MAX_PER_PHONE_PER_HOUR) throw new Error('Too many applications from this number. Please try again later.')

      const pendingSnap = await database.ref(`schools/${schoolId}/admissionRequests`).orderByChild('status').equalTo('pending').once('value')
      if (Object.keys(pendingSnap.val() || {}).length >= MAX_PENDING_PER_SCHOOL) {
        throw new Error('This school is not accepting more applications right now. Please contact the school.')
      }

      const id = `adm_req_${now()}_${crypto.randomBytes(4).toString('hex')}`
      await database.ref(`schools/${schoolId}/admissionRequests/${id}`).set({
        id,
        studentName,
        dob,
        gender: clean(body.gender, 20),
        classAppliedFor: clean(body.classAppliedFor, 40),
        fatherName: clean(body.fatherName, 120),
        motherName: clean(body.motherName, 120),
        parentPhone,
        parentEmail: clean(body.parentEmail, 120),
        address: clean(body.address, 300),
        previousSchool: clean(body.previousSchool, 160),
        // Set here, never taken from the request body, so a crafted payload cannot arrive
        // pre-approved.
        status: 'pending',
        source: 'public-qr',
        submittedAt: now(),
        reviewedBy: null,
        reviewedByName: null,
        reviewedAt: null,
        rejectionNote: null,
      })
      await throttleRef.set({
        count: recent + 1,
        windowStartedAt: recent ? throttle.windowStartedAt : now(),
        updatedAt: now(),
      })
      return response.status(200).json({ ok: true })
    }

    throw new Error('Unknown admission action.')
  } catch (error) {
    console.error('Admission API error', error)
    return response.status(400).json({ ok: false, error: error.message })
  }
}

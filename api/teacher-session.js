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

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const authHeader = req.headers.authorization || ''
    const idToken = authHeader.replace('Bearer ', '')
    if (!idToken) return res.status(401).json({ error: 'Missing authorization token' })

    const app = getAdminApp()
    const decoded = await getAuth(app).verifyIdToken(idToken)
    const db = getDatabase(app)
    const uid = decoded.uid

    const [indexSnap, userSnap] = await Promise.all([
      db.ref(`teachersIndex/${uid}`).once('value'),
      db.ref(`users/${uid}`).once('value'),
    ])
    const index = indexSnap.val() || {}
    const user = userSnap.val() || {}
    const schoolId = index.schoolId || user.schoolId
    if (!schoolId) return res.status(404).json({ error: 'No teacher account found. Contact your school admin.' })

    // Attendance is the one node here that grows without bound - roughly students x school days,
    // so a full year is orders of magnitude larger than every other node combined. The teacher
    // app only renders the current month (its live listener is bounded the same way), so bound
    // this initial payload too. Uses the existing attendance .indexOn ["date"].
    const monthStartDate = new Date()
    const monthStart = `${monthStartDate.getFullYear()}-${String(monthStartDate.getMonth() + 1).padStart(2, '0')}-01`
    const [staffSnap, teacherSnap, profileSnap, studentsSnap, homeworkSnap, noticesSnap, attendanceSnap] = await Promise.all([
      db.ref(`schools/${schoolId}/staff/${uid}`).once('value'),
      db.ref(`schools/${schoolId}/teachers/${uid}`).once('value'),
      db.ref(`schools/${schoolId}/profile`).once('value'),
      db.ref(`schools/${schoolId}/students`).once('value'),
      db.ref(`schools/${schoolId}/homework`).once('value'),
      db.ref(`schools/${schoolId}/notices`).once('value'),
      db.ref(`schools/${schoolId}/attendance`).orderByChild('date').startAt(monthStart).once('value'),
    ])

    const splitCsv = v => Array.isArray(v) ? v.filter(Boolean) : String(v || '').split(',').map(s => s.trim()).filter(Boolean)
    const record = staffSnap.val() || teacherSnap.val()
    if (!record) return res.status(404).json({ error: 'Staff profile not found in school data.' })
    const teacher = {
      ...record,
      name: record.name || `${record.firstName || ''} ${record.lastName || ''}`.trim() || 'Staff',
      department: record.department || 'Staff',
      classes: splitCsv(record.assignedClasses || record.classes),
      sections: splitCsv(record.assignedSections || record.sections),
    }

    return res.status(200).json({
      ok: true,
      schoolId,
      teacher: { ...teacher, uid },
      profile: profileSnap.val() || {},
      students: studentsSnap.val() || {},
      homework: homeworkSnap.val() || {},
      notices: noticesSnap.val() || {},
      attendance: attendanceSnap.val() || {},
    })
  } catch (error) {
    console.error('teacher-session error:', error)
    return res.status(500).json({ error: error.message || 'Teacher session could not be loaded.' })
  }
}

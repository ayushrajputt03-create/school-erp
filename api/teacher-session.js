const admin = require('firebase-admin')

function getAdminApp() {
  if (admin.apps.length) return admin.app()
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || ''
  if (!raw) throw new Error('Server config missing: FIREBASE_SERVICE_ACCOUNT_JSON not set.')
  let credentials
  try {
    credentials = JSON.parse(raw)
  } catch {
    throw new Error('Server config error: FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.')
  }
  return admin.initializeApp({
    credential: admin.credential.cert(credentials),
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
    const decoded = await admin.auth(app).verifyIdToken(idToken)
    const db = admin.database(app)
    const uid = decoded.uid

    const [indexSnap, userSnap] = await Promise.all([
      db.ref(`teachersIndex/${uid}`).once('value'),
      db.ref(`users/${uid}`).once('value'),
    ])
    const index = indexSnap.val() || {}
    const user = userSnap.val() || {}
    const schoolId = index.schoolId || user.schoolId
    if (!schoolId) return res.status(404).json({ error: 'No teacher account found. Contact your school admin.' })

    const [teacherSnap, profileSnap, studentsSnap, homeworkSnap, noticesSnap, attendanceSnap] = await Promise.all([
      db.ref(`schools/${schoolId}/teachers/${uid}`).once('value'),
      db.ref(`schools/${schoolId}/profile`).once('value'),
      db.ref(`schools/${schoolId}/students`).once('value'),
      db.ref(`schools/${schoolId}/homework`).once('value'),
      db.ref(`schools/${schoolId}/notices`).once('value'),
      db.ref(`schools/${schoolId}/attendance`).once('value'),
    ])

    const teacher = teacherSnap.val()
    if (!teacher) return res.status(404).json({ error: 'Teacher profile not found in school data.' })

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

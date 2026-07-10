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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const app = getAdminApp()
    const adminAuth = getAuth(app)
    const db = getDatabase(app)

    const authHeader = req.headers.authorization || ''
    const idToken = authHeader.replace('Bearer ', '')
    if (!idToken) return res.status(401).json({ error: 'Missing authorization token' })

    let caller
    try { caller = await adminAuth.verifyIdToken(idToken) } catch { return res.status(401).json({ error: 'Invalid token' }) }

    const { schoolId, email, password, teacherData } = req.body || {}
    if (!schoolId || !email || !password || !teacherData) return res.status(400).json({ error: 'Missing required fields: schoolId, email, password, teacherData' })

    if (caller.uid !== schoolId) return res.status(403).json({ error: 'You can only create teachers for your own school.' })

    let teacherUid
    try {
      const existingUser = await adminAuth.getUserByEmail(email).catch(() => null)
      if (existingUser) {
        teacherUid = existingUser.uid
      } else {
        const newUser = await adminAuth.createUser({
          email,
          password,
          displayName: teacherData.name || `${teacherData.firstName || ''} ${teacherData.lastName || ''}`.trim(),
        })
        teacherUid = newUser.uid
      }
    } catch (authError) {
      return res.status(400).json({ error: `Failed to create auth account: ${authError.message}` })
    }

    const teacherRecord = {
      ...teacherData,
      uid: teacherUid,
      email,
      role: 'teacher',
      schoolId,
      isActive: true,
      createdAt: teacherData.createdAt || Date.now(),
      updatedAt: Date.now(),
    }

    await db.ref(`schools/${schoolId}/teachers/${teacherUid}`).set(teacherRecord)
    await db.ref(`teachersIndex/${teacherUid}`).set({
      schoolId,
      teacherId: teacherUid,
      role: 'teacher',
    })

    return res.status(200).json({ ok: true, teacherUid, message: 'Teacher account created successfully.' })
  } catch (error) {
    console.error('create-teacher error:', error)
    return res.status(500).json({ error: error.message })
  }
}

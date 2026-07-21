const { getApps, getApp, initializeApp, cert } = require('firebase-admin/app')
const { getDatabase } = require('firebase-admin/database')
const ExcelJS = require('exceljs')
const { Resend } = require('resend')

function getAdminApp() {
  if (getApps().length) return getApp()
  const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}')
  return initializeApp({
    credential: cert(credentials),
    databaseURL: process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL,
  })
}

function addSheet(workbook, name, rows) {
  const sheet = workbook.addWorksheet(name)
  if (!rows.length) {
    sheet.addRow(['No records'])
    return
  }
  const keys = [...new Set(rows.flatMap(row => Object.keys(row)))]
  sheet.columns = keys.map(key => ({ header: key, key, width: 20 }))
  rows.forEach(row => sheet.addRow(row))
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17233A' } }
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
}

async function createWorkbook(database, schoolId) {
  const [studentsSnap, feesSnap, attendanceSnap] = await Promise.all([
    database.ref(`schools/${schoolId}/students`).once('value'),
    database.ref(`schools/${schoolId}/fees`).once('value'),
    database.ref(`schools/${schoolId}/attendance`).once('value'),
  ])
  const students = studentsSnap.val() || {}
  const fees = feesSnap.val() || {}
  const attendance = attendanceSnap.val() || {}
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Northstar School OS'
  addSheet(workbook, 'Students', Object.entries(students).map(([id, row]) => ({ id, ...row })))
  addSheet(workbook, 'Fees', Object.entries(fees).map(([id, row]) => ({ id, ...row })))
  addSheet(workbook, 'Attendance', Object.entries(attendance).map(([id, row]) => ({ id, ...row })))
  return workbook.xlsx.writeBuffer()
}

module.exports = async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' })
  if (!process.env.CRON_SECRET || request.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return response.status(401).json({ error: 'Unauthorized' })
  }
  const required = ['FIREBASE_SERVICE_ACCOUNT_JSON', 'RESEND_API_KEY', 'BACKUP_FROM_EMAIL']
  const missing = required.filter(key => !process.env[key])
  if (!process.env.FIREBASE_DATABASE_URL && !process.env.VITE_FIREBASE_DATABASE_URL) missing.push('FIREBASE_DATABASE_URL')
  if (missing.length) return response.status(503).json({ error: `Missing environment variables: ${missing.join(', ')}` })

  const app = getAdminApp()
  const database = getDatabase(app)
  const resend = new Resend(process.env.RESEND_API_KEY)
  // Enumerating schools with a full read pulls every student, fee, attendance and certificate
  // record in the database, just to reach each school's backupSettings. List the ids shallowly
  // and read only the two nodes actually needed per school. Falls back to the old full read if
  // the shallow call is unavailable, so the backup can never silently stop running.
  const databaseUrl = process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL
  let schools = null
  try {
    const accessToken = await app.options.credential.getAccessToken()
    const listed = await fetch(`${databaseUrl}/schools.json?shallow=true&access_token=${accessToken.access_token}`)
    if (!listed.ok) throw new Error(`shallow list failed (${listed.status})`)
    const ids = Object.keys(await listed.json() || {})
    const entries = await Promise.all(ids.map(async schoolId => {
      const [settingsSnap, nameSnap] = await Promise.all([
        database.ref(`schools/${schoolId}/backupSettings`).once('value'),
        database.ref(`schools/${schoolId}/profile/schoolName`).once('value'),
      ])
      return [schoolId, { backupSettings: settingsSnap.val() || {}, profile: { schoolName: nameSnap.val() || '' } }]
    }))
    schools = Object.fromEntries(entries)
  } catch (listError) {
    console.warn('[backup] shallow school listing unavailable, falling back to full read:', listError.message)
    schools = (await database.ref('schools').once('value')).val() || {}
  }
  const results = []

  for (const [schoolId, school] of Object.entries(schools)) {
    const settings = school.backupSettings || {}
    if (!settings.enabled || !settings.email) continue
    try {
      const workbook = await createWorkbook(database, schoolId)
      await resend.emails.send({
        from: process.env.BACKUP_FROM_EMAIL,
        to: settings.email,
        subject: `${school.profile?.schoolName || school.name || 'School'} monthly data backup`,
        html: `<p>Your NXT School ERP monthly backup is attached.</p><p>School: <strong>${school.profile?.schoolName || school.name || schoolId}</strong></p>`,
        attachments: [{ filename: `northstar-backup-${new Date().toISOString().slice(0, 10)}.xlsx`, content: Buffer.from(workbook).toString('base64') }],
      })
      await database.ref(`schools/${schoolId}/backupSettings/lastSentAt`).set(Date.now())
      results.push({ schoolId, status: 'sent' })
    } catch (error) {
      results.push({ schoolId, status: 'failed', error: error.message })
    }
  }

  return response.status(200).json({ ok: true, processed: results.length, results })
}

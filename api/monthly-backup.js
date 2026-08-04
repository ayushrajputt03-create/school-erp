// Monthly backup cron. Kis school ko bhejna hai aur mail kaisi banegi — bas
// itna yahan hai. Data kahan se aata hai wo _backup-store.js jaanta hai, taaki
// Firebase/Supabase badalne par ye file chhune ki zarurat na pade.
const ExcelJS = require('exceljs')
const { Resend } = require('resend')
const { createStore, SHEETS } = require('./_backup-store')

const SHEET_TITLES = { students: 'Students', fees: 'Fees', attendance: 'Attendance' }

function addSheet(workbook, name, rows) {
  const sheet = workbook.addWorksheet(name)
  if (!rows.length) {
    sheet.addRow(['No records'])
    return
  }
  const keys = [...new Set(rows.flatMap(row => Object.keys(row)))]
  sheet.columns = keys.map(key => ({ header: key, key, width: 20 }))
  // Postgres se aane wali rows me nested object/array hote hain (fee_items,
  // payments). ExcelJS unhe "[object Object]" likh deta hai — backup se wo
  // data gayab. JSON string me kam se kam wapas padha ja sakta hai.
  rows.forEach(row => sheet.addRow(Object.fromEntries(Object.entries(row).map(([key, value]) =>
    [key, value && typeof value === 'object' ? JSON.stringify(value) : value]))))
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17233A' } }
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
}

async function createWorkbook(store, schoolId) {
  const data = await store.schoolData(schoolId)
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Northstar School OS'
  for (const node of SHEETS) addSheet(workbook, SHEET_TITLES[node] || node, data[node] || [])
  return workbook.xlsx.writeBuffer()
}

async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' })
  if (!process.env.CRON_SECRET || request.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return response.status(401).json({ error: 'Unauthorized' })
  }

  let store
  try { store = createStore() } catch (error) { return response.status(503).json({ error: error.message }) }

  // Backend ke apne env store batata hai; mail wale dono par ek jaise hain.
  const missing = [...store.requiredEnv, 'RESEND_API_KEY', 'BACKUP_FROM_EMAIL'].filter(key => !process.env[key])
  if (store.backend === 'firebase' && !process.env.FIREBASE_DATABASE_URL && !process.env.VITE_FIREBASE_DATABASE_URL) {
    missing.push('FIREBASE_DATABASE_URL')
  }
  if (missing.length) return response.status(503).json({ error: `Missing environment variables: ${missing.join(', ')}` })

  const resend = new Resend(process.env.RESEND_API_KEY)
  const schools = await store.listSchools()
  const results = []

  for (const { schoolId, schoolName, backupSettings } of schools) {
    if (!backupSettings.enabled || !backupSettings.email) continue
    try {
      const workbook = await createWorkbook(store, schoolId)
      await resend.emails.send({
        from: process.env.BACKUP_FROM_EMAIL,
        to: backupSettings.email,
        subject: `${schoolName || 'School'} monthly data backup`,
        html: `<p>Your NXT School ERP monthly backup is attached.</p><p>School: <strong>${schoolName || schoolId}</strong></p>`,
        attachments: [{ filename: `northstar-backup-${new Date().toISOString().slice(0, 10)}.xlsx`, content: Buffer.from(workbook).toString('base64') }],
      })
      await store.markSent(schoolId, Date.now())
      results.push({ schoolId, status: 'sent' })
    } catch (error) {
      results.push({ schoolId, status: 'failed', error: error.message })
    }
  }

  return response.status(200).json({ ok: true, backend: store.backend, processed: results.length, results })
}

// Vercel handler ko default export hi chahiye; createWorkbook saath me isliye
// jaata hai ki test asli xlsx bana kar dekh sake — sirf store test karne se ye
// nahi pata chalta ki sheet me sach me kuch aaya ya nahi.
module.exports = handler
module.exports.createWorkbook = createWorkbook

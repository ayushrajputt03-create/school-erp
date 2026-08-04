// Staff dashboard ka pehla payload.
//
// Ye fallback hai: client pehle seedha padhne ki koshish karta hai, aur na
// chale to yahan aata hai. Isliye schoolId kabhi request se nahi leta — token
// se nikaale gaye uid par jo school juda hai, wahi. Bina iske ye route har
// school ka data kisi bhi logged-in staff ko de sakta tha.
const { createStore } = require('./_staff-store')

const splitCsv = v => Array.isArray(v) ? v.filter(Boolean) : String(v || '').split(',').map(s => s.trim()).filter(Boolean)

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const idToken = (req.headers.authorization || '').replace('Bearer ', '')
    if (!idToken) return res.status(401).json({ error: 'Missing authorization token' })

    const store = createStore()
    const caller = await store.verifyCaller(idToken)
    if (!caller) return res.status(401).json({ error: 'Invalid token' })

    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const bundle = await store.staffSession(caller.uid, { monthStart })
    if (!bundle) return res.status(404).json({ error: 'No teacher account found. Contact your school admin.' })
    if (!bundle.record) return res.status(404).json({ error: 'Staff profile not found in school data.' })

    const record = bundle.record
    return res.status(200).json({
      ok: true,
      backend: store.backend,
      schoolId: bundle.schoolId,
      teacher: {
        ...record,
        uid: caller.uid,
        name: record.name || `${record.firstName || ''} ${record.lastName || ''}`.trim() || 'Staff',
        department: record.department || 'Staff',
        classes: splitCsv(record.assignedClasses || record.classes),
        sections: splitCsv(record.assignedSections || record.sections),
      },
      profile: bundle.profile,
      students: bundle.students,
      homework: bundle.homework,
      notices: bundle.notices,
      attendance: bundle.attendance,
    })
  } catch (error) {
    console.error('teacher-session error:', error)
    return res.status(500).json({ error: error.message || 'Teacher session could not be loaded.' })
  }
}

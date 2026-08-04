// "Create Teacher Login" — admin employee form se chalata hai.
//
// Kya banta hai, ye backend par nirbhar hai (_staff-store.js dekho):
//   Firebase — email + password ka asli auth khaata
//   Supabase — kuch naya nahi; login pehle se `staff` row ke mobile + DOB se
//              chalta hai, RPC bas auth user pehle se bana deta hai
// Dono soorat me admin ko ek hi jawab milta hai.
const { createStore } = require('./_staff-store')

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const store = createStore()

    const idToken = (req.headers.authorization || '').replace('Bearer ', '')
    if (!idToken) return res.status(401).json({ error: 'Missing authorization token' })
    const caller = await store.verifyCaller(idToken)
    if (!caller) return res.status(401).json({ error: 'Invalid token' })

    const { schoolId, email, password, staffId, teacherData } = req.body || {}
    if (!schoolId || !teacherData) return res.status(400).json({ error: 'Missing required fields: schoolId, teacherData' })
    // schoolId body se aata hai par jaancha token se jaata hai — warna koi bhi
    // logged-in school kisi doosre school me teacher bana sakta tha.
    if (caller.uid !== schoolId) return res.status(403).json({ error: 'You can only create teachers for your own school.' })
    // Firebase raaste par asli auth khaata banta hai, to email+password chahiye.
    // Supabase par login staff row se chalta hai, to staffId chahiye.
    if (store.backend === 'firebase' && (!email || !password)) {
      return res.status(400).json({ error: 'Missing required fields: email, password' })
    }
    if (store.backend === 'supabase' && !staffId) {
      return res.status(400).json({ error: 'Employee ko pehle save karo, phir login banao.' })
    }

    const result = await store.ensureStaffLogin(schoolId, { email, password, staffId, profile: teacherData })
    return res.status(200).json({
      ok: true,
      teacherUid: result.staffId,
      backend: store.backend,
      message: 'Teacher account created successfully.',
    })
  } catch (error) {
    console.error('create-teacher error:', error)
    return res.status(500).json({ error: error.message })
  }
}

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

const digits = value => String(value || '').replace(/\D/g, '')
const now = () => Date.now()
const hashPassword = value => crypto.createHash('sha256').update(String(value || '')).digest('hex')
const tokenFor = () => crypto.randomBytes(32).toString('hex')
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
  return dobVariants(dob).some(variant => clean === digits(variant) || String(input || '') === variant)
}
const normalizeStudentsList = value => {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (value && typeof value === 'object') return Object.keys(value).filter(key => value[key])
  return []
}
const publicSchool = school => {
  const profile = school?.profile || {}
  return {
    schoolName: profile.schoolName || school?.name || 'School',
    schoolCode: profile.schoolCode || '',
    logoURL: profile.logoURL || profile.logo || '',
    address: [profile.address, profile.city, profile.state, profile.pincode].filter(Boolean).join(', '),
    phone: profile.schoolContactNo || profile.phone || '',
    email: profile.schoolEmail || profile.email || '',
    website: profile.schoolWebsite || '',
    academicYear: profile.academicYear || '2026-27',
    upi: profile.upiId || profile.upi || '',
    bankName: profile.bankName || '',
    bankAccount: profile.bankAccount || '',
    bankIfsc: profile.bankIfsc || '',
  }
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

function studentParentPhone(row) {
  const raw = digits(row.parent_login_phone || row.parentLoginPhone || row.father_phone || row.fatherPhone || row.guardian_phone || row.guardianPhone || row.phone || row.mobile || row.contactNumber || row.mother_phone || row.motherPhone)
  return raw.length > 10 ? raw.slice(-10) : raw
}

async function ensureParent(database, schoolId, school, phone) {
  const rawDigits = digits(phone)
  const parentId = rawDigits.length > 10 ? rawDigits.slice(-10) : rawDigits
  const parentRef = database.ref(`schools/${schoolId}/parents/${parentId}`)
  const parentSnap = await parentRef.once('value')
  let parent = parentSnap.val()
  const students = school.students || {}
  const linkedIds = Object.entries(students)
    .filter(([, row]) => studentParentPhone(row) === parentId)
    .map(([id]) => id)
  if (!linkedIds.length && !parent) return null

  if (!parent) {
    const firstStudent = students[linkedIds[0]] || {}
    parent = {
      id: parentId,
      phone: parentId,
      name: firstStudent.father_name || firstStudent.fatherName || firstStudent.guardian_name || firstStudent.guardian || 'Parent',
      email: firstStudent.father_email || '',
      address: firstStudent.address || '',
      students: Object.fromEntries(linkedIds.map(id => [id, true])),
      schoolCode: school.profile?.schoolCode || '',
      mustChangePassword: true,
      language: 'english',
      status: 'active',
      createdAt: now(),
      updatedAt: now(),
    }
    await parentRef.set(parent)
  } else {
    const current = normalizeStudentsList(parent.students)
    const merged = [...new Set([...current, ...linkedIds])]
    parent = { ...parent, id: parentId, phone: parent.phone || parentId, students: Object.fromEntries(merged.map(id => [id, true])), updatedAt: now() }
    await parentRef.update({ students: parent.students, updatedAt: parent.updatedAt })
  }
  return { parentId, parent }
}

function sanitizeStudent(id, row = {}) {
  return {
    id,
    name: row.full_name || row.name || '',
    admissionNo: row.admission_number || row.admissionNo || '',
    className: `${row.class_name || row.class || ''}${row.section ? `-${row.section}` : ''}`,
    class: row.class_name || row.class || '',
    section: row.section || '',
    rollNumber: row.roll_number || row.rollNumber || row.admission_number || '',
    dob: row.dob || row.date_of_birth || row.dateOfBirth || '',
    fatherName: row.father_name || row.fatherName || row.guardian_name || '',
    motherName: row.mother_name || row.motherName || '',
    phone: studentParentPhone(row),
    photoURL: row.photo_url || row.photoURL || row.photo || '',
    address: row.address || '',
    transportRequired: row.transport_required || row.transportRequired || Boolean(row.routeId || row.route_id),
    routeId: row.route_id || row.routeId || '',
    routeName: row.route_name || row.routeName || '',
    stopName: row.stop_name || row.stopName || '',
    pickupTime: row.pickup_time || row.pickupTime || '',
    dropTime: row.drop_time || row.dropTime || '',
  }
}

function filterNotices(notices, student) {
  return Object.entries(notices || {}).map(([id, row]) => ({ id, ...row }))
    .filter(row => {
      const text = `${row.audience || ''} ${row.target || ''} ${row.className || ''}`.toLowerCase()
      return !text || text.includes('all') || text.includes(String(student.class || '').toLowerCase()) || text.includes(String(student.className || '').toLowerCase())
    })
    .sort((a, b) => (b.createdAt || b.publishAt || 0) - (a.createdAt || a.publishAt || 0))
    .slice(0, 60)
}

function buildDataPayload(schoolId, school, parentId, parent, selectedStudentId = '') {
  const studentIds = normalizeStudentsList(parent.students)
  const students = studentIds.map(id => school.students?.[id] ? sanitizeStudent(id, school.students[id]) : null).filter(Boolean)
  const selected = students.find(row => row.id === selectedStudentId) || students[0]
  if (!selected) throw new Error('No linked student found for this parent.')

  const attendance = Object.entries(school.attendance || {}).map(([id, row]) => ({ id, ...row }))
    .filter(row => (row.studentId || row.student_id) === selected.id)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
  const fees = Object.entries(school.fees || {}).map(([id, row]) => ({ id, ...row }))
    .filter(row => (row.studentId || row.student_id) === selected.id)
    .sort((a, b) => (b.paidAt || b.updatedAt || 0) - (a.paidAt || a.updatedAt || 0))
  const homework = Object.entries(school.homework || {}).map(([id, row]) => ({ id, ...row }))
    .filter(row => String(row.className || row.class || '') === String(selected.class || '') && String(row.section || '') === String(selected.section || ''))
    .sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')))
  const reportCards = Object.entries(school.reportCards || {}).map(([id, row]) => ({ id, ...row }))
    .filter(row => (row.studentId || row.student_id) === selected.id && (row.status === 'published' || row.published || row.locked))
  const certificates = Object.entries(school.certificates || {}).map(([id, row]) => ({ id, ...row }))
    .filter(row => (row.studentId || row.student_id) === selected.id)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  const certificateRequests = Object.entries(school.certificateRequests || {}).map(([id, row]) => ({ id, ...row }))
    .filter(row => row.parentId === parentId && row.studentId === selected.id)
  const messages = Object.entries(school.parentMessages || {}).map(([id, row]) => ({ id, ...row }))
    .filter(row => row.parentId === parentId)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  const notifications = Object.entries(school.parentNotifications || {}).map(([id, row]) => ({ id, ...row }))
    .filter(row => row.parentId === parentId)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  const transportAllocations = Object.entries(school.transport?.allocations || {}).map(([id, row]) => ({ id, ...row }))
  const allocation = transportAllocations.find(row => row.studentId === selected.id) || {}
  const route = school.transport?.routes?.[allocation.routeId || selected.routeId] || {}
  const vehicle = school.transport?.vehicles?.[allocation.vehicleId || route.vehicleId] || {}
  const driver = school.transport?.drivers?.[allocation.driverId || vehicle.driverId || route.driverId] || {}
  const todayKey = new Date().toISOString().slice(0, 10)
  const transportAttendance = Object.values(school.transport?.attendance || {}).filter(row => row.date === todayKey && (row.records || []).some(item => item.studentId === selected.id))

  return {
    schoolId,
    school: publicSchool(school),
    parent: { id: parentId, name: parent.name || 'Parent', phone: parent.phone, email: parent.email || '', address: parent.address || '', language: parent.language || 'english', mustChangePassword: Boolean(parent.mustChangePassword) },
    students,
    selectedStudent: selected,
    attendance,
    fees,
    homework,
    notices: filterNotices(school.notices, selected),
    reportCards,
    certificates,
    certificateRequests,
    messages,
    notifications,
    timetable: school.timetable || {},
    transport: { allocation, route, vehicle, driver, today: transportAttendance },
    library: {
      fines: Object.entries(school.library?.fines || {}).map(([id, row]) => ({ id, ...row })).filter(row => row.studentId === selected.id),
      issues: Object.entries(school.library?.issues || {}).map(([id, row]) => ({ id, ...row })).filter(row => row.studentId === selected.id),
    },
    fetchedAt: now(),
  }
}

async function requireSession(database, body) {
  const { schoolId, parentId, sessionToken } = body || {}
  if (!schoolId || !parentId || !sessionToken) throw new Error('Parent session expired. Please login again.')
  const sessionSnap = await database.ref(`schools/${schoolId}/parentSessions/${parentId}/${sessionToken}`).once('value')
  const session = sessionSnap.val()
  if (!session || session.expiresAt < now()) throw new Error('Parent session expired. Please login again.')
  const schoolSnap = await database.ref(`schools/${schoolId}`).once('value')
  const school = schoolSnap.val()
  if (!school) throw new Error('School not found.')
  const parentSnap = await database.ref(`schools/${schoolId}/parents/${parentId}`).once('value')
  const parent = parentSnap.val()
  if (!parent || parent.status === 'inactive') throw new Error('Parent account is inactive.')
  return { schoolId, parentId, school, parent }
}

module.exports = async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' })
  try {
    const app = getAdminApp()
    const database = getDatabase(app)
    const body = request.body || {}
    const action = body.action

    if (action === 'login') {
      const schoolCode = String(body.schoolCode || '').trim().toUpperCase()
      const phone = digits(body.phone)
      const password = String(body.password || '')
      if (schoolCode.length < 6) throw new Error('Invalid School Code')
      if (phone.length !== 10) throw new Error('Phone number must be 10 digits.')
      const found = await findSchool(database, schoolCode)
      if (!found) throw new Error('Invalid School Code')
      const { schoolId, school } = found
      const ensured = await ensureParent(database, schoolId, school, phone)
      if (!ensured) {
        const studentCount = Object.keys(school.students || {}).length
        const target = phone
        const matchByPhone = Object.entries(school.students || {}).filter(([, row]) => {
          const allVals = Object.values(row).map(v => String(v || ''))
          return allVals.some(v => v.includes(target))
        }).map(([id, row]) => `${id}:${row.full_name || row.name || '?'}|plp=${row.parent_login_phone || ''}|fp=${row.father_phone || ''}|gp=${row.guardian_phone || ''}|ph=${row.phone || ''}`)
        const kunal = Object.entries(school.students || {}).filter(([, row]) => String(row.full_name || row.name || '').toLowerCase().includes('kunal')).map(([id, row]) => `${id}:${JSON.stringify(Object.entries(row).filter(([k]) => k.toLowerCase().includes('phone')).reduce((o, [k, v]) => ({...o, [k]: v}), {}))}`)
        throw new Error(`Phone not registered. [${studentCount} students, target=${target}, phoneMatch=${matchByPhone.length ? matchByPhone.join(';') : 'NONE'}, kunal=${kunal.length ? kunal.join(';') : 'NOT_FOUND'}]`)
      }
      const { parentId, parent } = ensured
      if (parent.status === 'inactive') throw new Error('Parent account is inactive. Contact school.')
      const attemptsRef = database.ref(`schools/${schoolId}/parentLoginAttempts/${parentId}`)
      const attemptsSnap = await attemptsRef.once('value')
      const attempts = attemptsSnap.val() || {}
      if (attempts.lockUntil && attempts.lockUntil > now()) throw new Error('Too many wrong attempts. Try again after 15 minutes.')
      const linkedIds = normalizeStudentsList(parent.students)
      const linkedStudents = linkedIds.map(id => school.students?.[id]).filter(Boolean)
      const rawDob = row => row.dob || row.date_of_birth || row.dateOfBirth || ''
      const eldest = linkedStudents.sort((a, b) => String(dateKey(rawDob(a))).localeCompare(String(dateKey(rawDob(b)))))[0] || {}
      const validCustom = parent.passwordHash && hashPassword(password) === parent.passwordHash
      const validDob = verifyDobPassword(password, rawDob(eldest))
      if (!validCustom && !validDob) {
        const failed = Number(attempts.failed || 0) + 1
        await attemptsRef.set({ failed, lockUntil: failed >= 5 ? now() + 15 * 60 * 1000 : 0, updatedAt: now() })
        throw new Error("Incorrect password. Default is child's DOB (e.g., 15032008)")
      }
      await attemptsRef.remove()
      const sessionToken = tokenFor()
      await database.ref(`schools/${schoolId}/parentSessions/${parentId}/${sessionToken}`).set({ createdAt: now(), expiresAt: now() + 30 * 60 * 1000 })
      await database.ref(`schools/${schoolId}/parents/${parentId}`).update({ lastLogin: now(), updatedAt: now() })
      return response.status(200).json({ ok: true, sessionToken, schoolId, parentId, mustChangePassword: Boolean(parent.mustChangePassword), data: buildDataPayload(schoolId, school, parentId, parent) })
    }

    if (action === 'data') {
      const context = await requireSession(database, body)
      await database.ref(`schools/${context.schoolId}/parentSessions/${context.parentId}/${body.sessionToken}/expiresAt`).set(now() + 30 * 60 * 1000)
      return response.status(200).json({ ok: true, data: buildDataPayload(context.schoolId, context.school, context.parentId, context.parent, body.studentId) })
    }

    if (action === 'setPassword') {
      const context = await requireSession(database, body)
      const password = String(body.password || '')
      if (!/[A-Z]/.test(password) || !/\d/.test(password) || password.length < 8) throw new Error('Password must be 8+ chars with 1 capital and 1 number.')
      const firstStudentId = normalizeStudentsList(context.parent.students)[0]
      const firstRow = context.school.students?.[firstStudentId] || {}
      const dob = firstRow.dob || firstRow.date_of_birth || firstRow.dateOfBirth || ''
      if (verifyDobPassword(password, dob)) throw new Error('New password cannot be same as DOB.')
      await database.ref(`schools/${context.schoolId}/parents/${context.parentId}`).update({ passwordHash: hashPassword(password), mustChangePassword: false, passwordSetAt: now(), updatedAt: now() })
      return response.status(200).json({ ok: true })
    }

    if (action === 'forgot') {
      const schoolCode = String(body.schoolCode || '').trim().toUpperCase()
      const phone = digits(body.phone)
      const found = await findSchool(database, schoolCode)
      if (!found) throw new Error('Invalid School Code')
      const ensured = await ensureParent(database, found.schoolId, found.school, phone)
      if (!ensured) throw new Error('Phone number not registered. Contact school.')
      await database.ref(`schools/${found.schoolId}/parents/${ensured.parentId}`).update({ passwordHash: null, mustChangePassword: true, updatedAt: now() })
      return response.status(200).json({ ok: true, message: "Password reset to child's date of birth." })
    }

    if (action === 'message') {
      const context = await requireSession(database, body)
      const id = `msg_${now()}`
      await database.ref(`schools/${context.schoolId}/parentMessages/${id}`).set({
        id,
        parentId: context.parentId,
        parentName: context.parent.name || 'Parent',
        studentId: body.studentId,
        subject: String(body.subject || '').trim(),
        message: String(body.message || '').trim(),
        status: 'open',
        createdAt: now(),
      })
      return response.status(200).json({ ok: true })
    }

    if (action === 'certificateRequest') {
      const context = await requireSession(database, body)
      const student = context.school.students?.[body.studentId] || {}
      const id = `cert_req_${now()}`
      await database.ref(`schools/${context.schoolId}/certificateRequests/${id}`).set({
        id,
        parentId: context.parentId,
        parentName: context.parent.name || 'Parent',
        studentId: body.studentId,
        studentName: student.full_name || student.name || '',
        certificateType: body.certificateType,
        purpose: body.purpose,
        status: 'pending',
        createdAt: now(),
      })
      return response.status(200).json({ ok: true })
    }

    if (action === 'updateProfile') {
      const context = await requireSession(database, body)
      await database.ref(`schools/${context.schoolId}/parents/${context.parentId}`).update({
        name: String(body.name || context.parent.name || '').trim(),
        email: String(body.email || '').trim(),
        address: String(body.address || '').trim(),
        language: body.language === 'hindi' ? 'hindi' : 'english',
        updatedAt: now(),
      })
      return response.status(200).json({ ok: true })
    }

    if (action === 'markRead') {
      const context = await requireSession(database, body)
      const ids = Array.isArray(body.ids) ? body.ids : []
      const updates = {}
      ids.forEach(id => { updates[`schools/${context.schoolId}/parentNotifications/${id}/isRead`] = true })
      if (ids.length) await database.ref().update(updates)
      return response.status(200).json({ ok: true })
    }

    throw new Error('Unknown parent portal action.')
  } catch (error) {
    console.error('Parent portal API error', error)
    return response.status(400).json({ ok: false, error: error.message })
  }
}

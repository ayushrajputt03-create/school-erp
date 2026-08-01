const crypto = require('crypto')
// Har database raasta _parent-store.js me hai - Firebase ke liye ek roop,
// Supabase ke liye doosra, dono ka ek hi interface. Is file me sirf niyam hain:
// password kaise banta hai, session kitni der chalta hai, kaunsa bachcha kis
// parent ka hai. Wo niyam dono backend par bilkul ek jaise chalte hain.
const { createStore, digits } = require('./_parent-store')

const now = () => Date.now()
// Parent passwords are hashed with scrypt (Node built-in, memory-hard, per-user random salt).
// The previous scheme was an unsalted single-round SHA-256, which a leaked database would give
// up to an offline GPU attack almost immediately - especially with the DOB default. Stored form
// is "scrypt$N$r$p$saltHex$keyHex"; anything not matching that prefix is treated as a legacy
// SHA-256 digest, verified once and then transparently upgraded on the next successful login.
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 }

const hashPassword = value => new Promise((resolve, reject) => {
  const salt = crypto.randomBytes(16)
  crypto.scrypt(String(value || ''), salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p }, (error, derived) => {
    if (error) return reject(error)
    resolve(`scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('hex')}$${derived.toString('hex')}`)
  })
})

const isLegacyHash = stored => Boolean(stored) && !String(stored).startsWith('scrypt$')

const timingSafeEqualHex = (a, b) => {
  const left = Buffer.from(String(a), 'hex')
  const right = Buffer.from(String(b), 'hex')
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

const verifyPassword = (value, stored) => new Promise(resolve => {
  if (!stored) return resolve(false)
  const parts = String(stored).split('$')
  if (parts[0] !== 'scrypt' || parts.length !== 6) {
    const legacy = crypto.createHash('sha256').update(String(value || '')).digest('hex')
    return resolve(timingSafeEqualHex(legacy, stored))
  }
  const [, N, r, p, saltHex, keyHex] = parts
  const expected = Buffer.from(keyHex, 'hex')
  crypto.scrypt(String(value || ''), Buffer.from(saltHex, 'hex'), expected.length, { N: Number(N), r: Number(r), p: Number(p) }, (error, derived) => {
    if (error) return resolve(false)
    resolve(derived.length === expected.length && crypto.timingSafeEqual(derived, expected))
  })
})
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
    sessionStartMonth: profile.sessionStartMonth || null,
    upi: profile.upiId || profile.upi || '',
    bankName: profile.bankName || '',
    bankAccount: profile.bankAccount || '',
    bankIfsc: profile.bankIfsc || '',
  }
}

async function findSchool(store, schoolCode) {
  const schoolId = await store.schoolIdByCode(String(schoolCode || '').trim().toUpperCase())
  return schoolId ? { schoolId } : null
}

function studentParentPhone(row) {
  const raw = digits(row.parent_login_phone || row.parentLoginPhone || row.father_phone || row.fatherPhone || row.guardian_phone || row.guardianPhone || row.phone || row.mobile || row.contactNumber || row.mother_phone || row.motherPhone)
  return raw.length > 10 ? raw.slice(-10) : raw
}

// Resolves a phone to its parent account and that parent's children WITHOUT reading the school's
// students node. Previously every parent login downloaded schools/{id}/students in full just to
// find rows whose phone matched - on a large school that is megabytes per login attempt.
//
// Two cheap sources give us the child ids instead:
//   parents/{phone}.students            - the parent account, once it exists
//   parentStudentIndex/{phone}/{id}     - written by admissions, and backfilled for old records
// Only the resolved ids are then fetched individually.
async function ensureParent(store, schoolId, phone, schoolCode = '') {
  const rawDigits = digits(phone)
  const parentId = rawDigits.length > 10 ? rawDigits.slice(-10) : rawDigits
  if (!parentId) return null
  const [existing, index] = await Promise.all([
    store.parent(schoolId, parentId),
    store.parentStudentIndex(schoolId, parentId),
  ])
  let parent = existing
  const knownIds = normalizeStudentsList(parent?.students)
  const indexedIds = normalizeStudentsList(index)
  const linkedIds = [...new Set([...knownIds, ...indexedIds])]
  // Neither an account nor an index entry: this phone is genuinely not registered. We do not fall
  // back to scanning students - see backfillParentStudentIndex in App.jsx, which populates the
  // index for legacy records the next time an admin opens the workspace.
  if (!linkedIds.length) return null

  const students = await store.studentsByIds(schoolId, linkedIds)
  const presentIds = Object.keys(students)
  if (!presentIds.length) return null

  if (!parent) {
    const firstStudent = students[presentIds[0]] || {}
    parent = {
      id: parentId,
      phone: parentId,
      name: firstStudent.father_name || firstStudent.fatherName || firstStudent.guardian_name || firstStudent.guardian || 'Parent',
      email: firstStudent.father_email || '',
      address: firstStudent.address || '',
      students: Object.fromEntries(presentIds.map(id => [id, true])),
      schoolCode: schoolCode || '',
      mustChangePassword: true,
      language: 'english',
      status: 'active',
      createdAt: now(),
      updatedAt: now(),
    }
    await store.createParent(schoolId, parentId, parent)
  } else if (presentIds.length !== knownIds.length || presentIds.some(id => !knownIds.includes(id))) {
    // Only write when the child list actually changed, so a normal login stays read-only.
    parent = { ...parent, id: parentId, phone: parent.phone || parentId, students: Object.fromEntries(presentIds.map(id => [id, true])), updatedAt: now() }
    await store.updateParent(schoolId, parentId, { students: parent.students, updatedAt: parent.updatedAt })
  }
  return { parentId, parent, students }
}

// EMERGENCY ONLY - never called on the login path, and must stay that way. This is the old
// behaviour: scan every student in the school and match on any of the ~11 phone-ish fields.
// It exists so the index can be rebuilt by hand if backfillParentStudentIndex has not run and a
// parent cannot log in. Reading the whole students node is exactly the cost this change removed,
// so call it deliberately, once, from a one-off script - not from a request handler.
async function scanStudentsForParentPhone(store, schoolId, phone) {
  const rawDigits = digits(phone)
  const parentId = rawDigits.length > 10 ? rawDigits.slice(-10) : rawDigits
  return Object.entries(await store.allStudents(schoolId) || {})
    .filter(([, row]) => studentParentPhone(row) === parentId)
    .map(([id]) => id)
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
    admissionDate: row.admission_date || row.admissionDate || '',
    feeGroup: row.fee_group || row.feeGroup || 'REGULAR',
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

// Photos live outside the student row (studentPhotos/{schoolId}/{studentId}) once they have been
// migrated off it, so photo_url comes back empty and photo_inline is true. Fetch those few
// separately - a parent has one to three children, so this is a handful of reads. Students whose
// photo is still inline, or on a Storage URL, are already resolved and are skipped.
async function withStudentPhotos(store, schoolId, students, rows) {
  const needing = students.filter(student => !student.photoURL && rows[student.id]?.photo_inline === true)
  if (!needing.length) return students
  const fetched = await Promise.all(needing.map(async student => {
    try {
      return [student.id, await store.photoUrl(schoolId, student.id)]
    } catch {
      return [student.id, '']
    }
  }))
  const photos = Object.fromEntries(fetched.filter(([, value]) => value))
  return students.map(student => photos[student.id] ? { ...student, photoURL: photos[student.id] } : student)
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

// Build the parent dashboard payload using SCOPED reads instead of downloading the whole school.
// Per-student data (fees, attendance, report cards, certificates) is fetched by studentId;
// per-parent data (messages, notifications) by parentId. Only genuinely school-wide data
// (notices, timetable, transport, library, homework) is read as a whole node â€” none of which
// grows per-student like fees/attendance do. `preloadedStudents` lets the login flow reuse the
// students it already read.
async function buildDataPayload(store, schoolId, parentId, parent, selectedStudentId = '', preloadedStudents = null) {
  const studentIds = normalizeStudentsList(parent.students)

  let studentRows = {}
  if (preloadedStudents) {
    studentIds.forEach(id => { if (preloadedStudents[id]) studentRows[id] = preloadedStudents[id] })
  } else {
    studentRows = await store.studentsByIds(schoolId, studentIds)
  }
  const students = await withStudentPhotos(store, schoolId, Object.entries(studentRows).map(([id, row]) => sanitizeStudent(id, row)), studentRows)
  const selected = students.find(row => row.id === selectedStudentId) || students[0]
  if (!selected) throw new Error('No linked student found for this parent.')

  const byStudent = node => store.byStudent(schoolId, node, selected.id)
  const byParent = node => store.byParent(schoolId, node, parentId)
  const [profile, feesMap, feeStructures, attendanceMap, reportMap, certMap, certReqMap, leaveReqMap, msgMap, notifMap, homeworkMap, noticesMap, timetable, transport, library] = await Promise.all([
    store.profile(schoolId),
    byStudent('fees'),
    store.node(schoolId, 'feeManager/structures'),
    byStudent('attendance'),
    byStudent('reportCards'),
    byStudent('certificates'),
    byStudent('certificateRequests'),
    byStudent('leaveRequests'),
    byParent('parentMessages'),
    byParent('parentNotifications'),
    store.node(schoolId, 'homework'),
    store.node(schoolId, 'notices'),
    store.node(schoolId, 'timetable'),
    store.node(schoolId, 'transport'),
    store.node(schoolId, 'library'),
  ])

  const rows = value => Object.entries(value || {}).map(([id, row]) => ({ id, ...row }))

  const attendance = rows(attendanceMap).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
  const fees = rows(feesMap).sort((a, b) => (b.paidAt || b.updatedAt || 0) - (a.paidAt || a.updatedAt || 0))
  const homework = rows(homeworkMap)
    .filter(row => String(row.className || row.class || '') === String(selected.class || '') && String(row.section || '') === String(selected.section || ''))
    .sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')))
  const reportCards = rows(reportMap).filter(row => row.status === 'published' || row.published || row.locked)
  const certificates = rows(certMap).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  const certificateRequests = rows(certReqMap).filter(row => row.parentId === parentId)
  const leaveRequests = rows(leaveReqMap).filter(row => row.parentId === parentId).sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0))
  const messages = rows(msgMap).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  const notifications = rows(notifMap).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

  const bus = transport || {}
  const transportAllocations = rows(bus.allocations)
  const allocation = transportAllocations.find(row => row.studentId === selected.id) || {}
  const route = bus.routes?.[allocation.routeId || selected.routeId] || {}
  const vehicle = bus.vehicles?.[allocation.vehicleId || route.vehicleId] || {}
  const driver = bus.drivers?.[allocation.driverId || vehicle.driverId || route.driverId] || {}
  const todayKey = new Date().toISOString().slice(0, 10)
  const transportAttendance = Object.values(bus.attendance || {}).filter(row => row.date === todayKey && (row.records || []).some(item => item.studentId === selected.id))

  const books = library || {}

  return {
    schoolId,
    school: publicSchool({ profile: profile || {} }),
    parent: { id: parentId, name: parent.name || 'Parent', phone: parent.phone, email: parent.email || '', address: parent.address || '', language: parent.language || 'english', mustChangePassword: Boolean(parent.mustChangePassword) },
    students,
    selectedStudent: selected,
    attendance,
    fees,
    // Fee structure config is tiny and lets the portal compute the multi-month pending
    // breakdown with the exact same shared logic the admin app uses.
    feeStructures: feeStructures || {},
    homework,
    notices: filterNotices(noticesMap, selected),
    reportCards,
    certificates,
    certificateRequests,
    leaveRequests,
    messages,
    notifications,
    timetable: timetable || {},
    transport: { allocation, route, vehicle, driver, today: transportAttendance },
    library: {
      fines: rows(books.fines).filter(row => row.studentId === selected.id),
      issues: rows(books.issues).filter(row => row.studentId === selected.id),
    },
    fetchedAt: now(),
  }
}

async function requireSession(store, body) {
  const { schoolId, parentId, sessionToken } = body || {}
  if (!schoolId || !parentId || !sessionToken) throw new Error('Parent session expired. Please login again.')
  const session = await store.session(schoolId, parentId, sessionToken)
  if (!session || session.expiresAt < now()) throw new Error('Parent session expired. Please login again.')
  const parent = await store.parent(schoolId, parentId)
  if (!parent || parent.status === 'inactive') throw new Error('Parent account is inactive.')
  return { schoolId, parentId, parent }
}

module.exports = async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' })
  try {
    const store = createStore()
    const body = request.body || {}
    const action = body.action

    if (action === 'login') {
      const schoolCode = String(body.schoolCode || '').trim().toUpperCase()
      const phone = digits(body.phone)
      const password = String(body.password || '')
      if (schoolCode.length < 6) throw new Error('Invalid School Code')
      if (phone.length !== 10) throw new Error('Phone number must be 10 digits.')
      const found = await findSchool(store, schoolCode)
      if (!found) throw new Error('Invalid School Code')
      const { schoolId } = found
      const ensured = await ensureParent(store, schoolId, phone, schoolCode)
      if (!ensured) throw new Error('Phone number not registered. Contact school.')
      const { parentId, parent, students } = ensured
      if (parent.status === 'inactive') throw new Error('Parent account is inactive. Contact school.')
      const attempts = await store.loginAttempts(schoolId, parentId)
      if (attempts.lockUntil && attempts.lockUntil > now()) throw new Error('Too many wrong attempts. Try again after 15 minutes.')
      const linkedIds = normalizeStudentsList(parent.students)
      const linkedStudents = linkedIds.map(id => students[id]).filter(Boolean)
      const rawDob = row => row.dob || row.date_of_birth || row.dateOfBirth || ''
      const eldest = linkedStudents.sort((a, b) => String(dateKey(rawDob(a))).localeCompare(String(dateKey(rawDob(b)))))[0] || {}
      const validCustom = await verifyPassword(password, parent.passwordHash)
      const validDob = verifyDobPassword(password, rawDob(eldest))
      if (!validCustom && !validDob) {
        const failed = Number(attempts.failed || 0) + 1
        await store.setLoginAttempts(schoolId, parentId, { failed, lockUntil: failed >= 5 ? now() + 15 * 60 * 1000 : 0, updatedAt: now() })
        throw new Error("Incorrect password. Default is child's DOB (e.g., 15032008)")
      }
      await store.clearLoginAttempts(schoolId, parentId)
      // Transparent upgrade: a parent who just authenticated against a legacy SHA-256 digest gets
      // re-hashed with scrypt here, so the old format disappears as people log in. No reset needed.
      if (validCustom && isLegacyHash(parent.passwordHash)) {
        await store.updateParent(schoolId, parentId, { passwordHash: await hashPassword(password) }).catch(() => {})
      }
      const sessionToken = tokenFor()
      await store.setSession(schoolId, parentId, sessionToken, { createdAt: now(), expiresAt: now() + 30 * 60 * 1000 })
      await store.updateParent(schoolId, parentId, { lastLogin: now(), updatedAt: now() })
      return response.status(200).json({ ok: true, sessionToken, schoolId, parentId, mustChangePassword: Boolean(parent.mustChangePassword), data: await buildDataPayload(store, schoolId, parentId, parent, '', students) })
    }

    if (action === 'data') {
      const context = await requireSession(store, body)
      await store.touchSession(context.schoolId, context.parentId, body.sessionToken, now() + 30 * 60 * 1000)
      return response.status(200).json({ ok: true, data: await buildDataPayload(store, context.schoolId, context.parentId, context.parent, body.studentId) })
    }

    if (action === 'setPassword') {
      const context = await requireSession(store, body)
      const password = String(body.password || '')
      if (!/[A-Z]/.test(password) || !/\d/.test(password) || password.length < 8) throw new Error('Password must be 8+ chars with 1 capital and 1 number.')
      const firstStudentId = normalizeStudentsList(context.parent.students)[0]
      const firstRow = (firstStudentId ? await store.student(context.schoolId, firstStudentId) : null) || {}
      const dob = firstRow.dob || firstRow.date_of_birth || firstRow.dateOfBirth || ''
      if (verifyDobPassword(password, dob)) throw new Error('New password cannot be same as DOB.')
      await store.updateParent(context.schoolId, context.parentId, { passwordHash: await hashPassword(password), mustChangePassword: false, passwordSetAt: now(), updatedAt: now() })
      return response.status(200).json({ ok: true })
    }

    if (action === 'forgot') {
      const schoolCode = String(body.schoolCode || '').trim().toUpperCase()
      const phone = digits(body.phone)
      const found = await findSchool(store, schoolCode)
      if (!found) throw new Error('Invalid School Code')
      const ensured = await ensureParent(store, found.schoolId, phone, schoolCode)
      if (!ensured) throw new Error('Phone number not registered. Contact school.')
      await store.updateParent(found.schoolId, ensured.parentId, { passwordHash: null, mustChangePassword: true, updatedAt: now() })
      return response.status(200).json({ ok: true, message: "Password reset to child's date of birth." })
    }

    if (action === 'message') {
      const context = await requireSession(store, body)
      const id = `msg_${now()}`
      await store.push(context.schoolId, 'parentMessages', id, {
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
      const context = await requireSession(store, body)
      const student = (await store.student(context.schoolId, body.studentId)) || {}
      const id = `cert_req_${now()}`
      await store.push(context.schoolId, 'certificateRequests', id, {
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

    if (action === 'leaveRequest') {
      const context = await requireSession(store, body)
      const studentId = String(body.studentId || '')
      // The session proves who the parent is, so the child must be checked against that parent's
      // own list - otherwise any signed-in parent could file a request against another student.
      if (!normalizeStudentsList(context.parent.students).includes(studentId)) {
        throw new Error('That student is not linked to this parent account.')
      }
      const fromDate = dateKey(body.fromDate)
      const toDate = dateKey(body.toDate) || fromDate
      const reason = String(body.reason || '').trim()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) throw new Error('Choose a valid start date.')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(toDate)) throw new Error('Choose a valid end date.')
      if (toDate < fromDate) throw new Error('End date cannot be before the start date.')
      if (reason.length < 3) throw new Error('Please write a short reason for the leave.')
      const student = (await store.student(context.schoolId, studentId)) || {}
      const id = `leave_req_${now()}_${crypto.randomBytes(3).toString('hex')}`
      await store.push(context.schoolId, 'leaveRequests', id, {
        id,
        parentId: context.parentId,
        parentName: context.parent.name || 'Parent',
        studentId,
        studentName: student.full_name || student.name || '',
        admissionNo: student.admission_number || '',
        // Denormalised so a teacher can query their own classes directly - see the classSection
        // index. Stored in the same "9-A" shape TeacherApp's classSectionOptions() produces.
        classSection: `${student.class_name || student.class || ''}-${student.section || 'A'}`,
        fromDate,
        toDate,
        reason: reason.slice(0, 500),
        status: 'pending',
        submittedAt: now(),
      })
      return response.status(200).json({ ok: true })
    }

    if (action === 'updateProfile') {
      const context = await requireSession(store, body)
      await store.updateParent(context.schoolId, context.parentId, {
        name: String(body.name || context.parent.name || '').trim(),
        email: String(body.email || '').trim(),
        address: String(body.address || '').trim(),
        language: body.language === 'hindi' ? 'hindi' : 'english',
        updatedAt: now(),
      })
      return response.status(200).json({ ok: true })
    }

    if (action === 'markRead') {
      const context = await requireSession(store, body)
      await store.markNotificationsRead(context.schoolId, Array.isArray(body.ids) ? body.ids : [])
      return response.status(200).json({ ok: true })
    }

    throw new Error('Unknown parent portal action.')
  } catch (error) {
    console.error('Parent portal API error', error)
    return response.status(400).json({ ok: false, error: error.message })
  }
}

// Exposed for tests only. ensureParent decides which store calls a parent login makes, and the
// property worth guarding is a negative one - that it never asks for the whole students node -
// which can only be asserted against the real implementation.
module.exports.__internals = {
  ensureParent, scanStudentsForParentPhone, buildDataPayload, requireSession, findSchool,
  hashPassword, verifyPassword, verifyDobPassword, dobVariants, dateKey, sanitizeStudent,
}

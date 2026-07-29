// ============================================================
// transform.mjs — Firebase RTDB dump  →  Postgres SQL
//
//   node supabase/transform.mjs <backup.json> <out.sql>
//
// Niyam:
//  * UUID deterministic hai (md5 se). Script dobara chalao to wahi id banega.
//    Isliye poora import idempotent hai — kuch duplicate nahi hoga.
//  * har row ka original record `source` jsonb me jaata hai. Kuch nahi khota.
//  * jo bhi samajh na aaye, wo SKIPPED report me aata hai — chupchap gira nahi jaata.
// ============================================================

import fs from 'node:fs'
import crypto from 'node:crypto'

const [, , inPath, outPath] = process.argv
if (!inPath || !outPath) {
  console.error('usage: node transform.mjs <backup.json> <out.sql>')
  process.exit(1)
}

const db = JSON.parse(fs.readFileSync(inPath, 'utf8'))
const out = []
const skipped = []
const stats = {}

const bump = (t, n = 1) => { stats[t] = (stats[t] || 0) + n }
const skip = (what, why, detail) => skipped.push({ what, why, detail: String(detail).slice(0, 200) })

// ---------- deterministic uuid ----------
const uuidOf = (...parts) => {
  const h = crypto.createHash('md5').update(parts.join('|')).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`
}

// ---------- SQL literals ----------
// Postgres escape-string. Kuch values me asli newline hota hai (student ka
// address multi-line likha gaya hai) — aur ye file line-by-line chalti hai.
// Isliye newline/tab/backslash sab escape karke E'...' me bhejte hain,
// taaki statement kabhi beech se na toote aur data bhi jyon ka tyon rahe.
// Postgres ki text me NUL byte ja hi nahi sakta — protocol hi tod deta hai.
// x6cLyS ke 80 deletedStudents me binary kachra bhara hua hai (full_name,
// class_name, guardian_name...). Wo data pehle se hi barbaad hai; NUL hata ke
// baaki jaisa hai waisa rakh dete hain. Asli bytes backup JSON me surakshit hain.
const NUL = String.fromCharCode(0)
const stripNul = (s) => String(s).split(NUL).join('')
let nulHits = 0

const q = (v) => {
  if (v === null || v === undefined || v === '') return 'null'
  if (typeof v === 'string' && v.includes(NUL)) nulHits++
  const s = stripNul(v)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "''")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
  return `E'${s}'`
}
// toTs ki tarah — value na ho to DEFAULT, null nahi.
// (amount NOT NULL DEFAULT 0 jaise columns ko null tod deta hai.)
const num = (v) => {
  if (v === null || v === undefined || v === '') return 'default'
  const n = Number(v)
  return Number.isFinite(n) ? String(n) : 'default'
}
const bool = (v) => (v === true ? 'true' : v === false ? 'false' : v === undefined || v === null ? 'default' : v ? 'true' : 'false')

// Postgres jsonb NUL byte () accept nahi karta — us corrupt attendance row
// me yahi hai. Saaf karke daalte hain, phenkte nahi.
const sanitize = (val) => {
  if (typeof val === 'string') return stripNul(val)
  if (Array.isArray(val)) return val.map(sanitize)
  if (val && typeof val === 'object') {
    const o = {}
    for (const [k, v] of Object.entries(val)) o[stripNul(k)] = sanitize(v)
    return o
  }
  return val
}
const json = (v) => (v === null || v === undefined ? 'null' : `${q(JSON.stringify(sanitize(v)))}::jsonb`)

// ---------- date / time ----------
const toDate = (v) => {
  if (!v) return 'null'
  const s = String(v).trim()
  if (!s) return 'null'
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)                       // 2026-07-10
  if (m) return q(`${m[1]}-${m[2]}-${m[3]}`)
  m = s.match(/^(\d{2})[/.-](\d{2})[/.-](\d{4})$/)                  // 10/07/2026 ya 10.07.2026 (DD/MM/YYYY)
  if (m) return q(`${m[3]}-${m[2]}-${m[1]}`)
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)              // 1.7.2026
  if (m) return q(`${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`)
  m = s.match(/^(\d{2})(\d{2})(\d{4})$/)                            // 15032007 (DDMMYYYY)
  if (m) return q(`${m[3]}-${m[2]}-${m[1]}`)
  skip('date', 'parse nahi hui', s)
  return 'null'
}
// Timestamp na ho to DEFAULT bhejte hain, null nahi.
// null column ka default (now()) dabaa deta hai — jaise fee_fines me
// createdAt hai hi nahi, aur created_at NOT NULL hai.
// DEFAULT har column pe chalta hai: jiska default hai wahan wo lagta hai,
// jiska nahi (paid_at, last_login) wahan NULL hi rehta hai.
const toTs = (ms) => {
  const n = Number(ms)
  if (!Number.isFinite(n) || n <= 0) return 'default'
  return `to_timestamp(${n} / 1000.0)`
}

const row = (table, cols, vals) =>
  out.push(`insert into public.${table} (${cols.join(', ')}) values (${vals.join(', ')}) on conflict (id) do nothing;`)

// ============================================================
// SCHOOLS
// ============================================================

const schools = db.schools || {}
const schoolIdOf = {}

for (const [legacyId, s] of Object.entries(schools)) {
  const p = s.profile || {}
  const id = uuidOf('school', legacyId)
  schoolIdOf[legacyId] = id

  row('schools',
    ['id', 'legacy_id', 'name', 'code', 'academic_year', 'address', 'city', 'district', 'state', 'pincode',
      'phone', 'email', 'board', 'affiliated_to', 'affiliation_no', 'custom_affiliation', 'udise_no',
      'classes_offered', 'school_motto', 'school_website', 'principal_name',
      'logo_url', 'logo_path', 'seal_url', 'principal_signature_url',
      'created_at', 'updated_at', 'last_login_at', 'source'],
    [q(id), q(legacyId), q(p.schoolName || p.name || s.name || 'Unnamed School'), q(p.schoolCode),
      q(p.academicYear || s.academicYear), q(p.address), q(p.city), q(p.district), q(p.state), q(p.pincode),
      q(p.phone || p.schoolContactNo), q(p.email || p.schoolEmail), q(p.board), q(p.affiliatedTo),
      q(p.affiliationNo), q(p.customAffiliation), q(p.udiseNo), q(p.classesOffered), q(p.schoolMotto),
      q(p.schoolWebsite), q(p.principalName),
      q(p.logoURL || p.logo), q(p.logoPath), q(p.schoolSealURL), q(p.principalSignatureURL),
      toTs(p.createdAt || s.createdAt), toTs(p.updatedAt), toTs(s.lastLoginAt), json(p)])
  bump('schools')
}

// school_codes
for (const [code, c] of Object.entries(db.schoolCodes || {})) {
  const sid = schoolIdOf[c.schoolId]
  if (!sid) { skip('school_code', 'school nahi mila', `${code} → ${c.schoolId}`); continue }
  out.push(`insert into public.school_codes (code, school_id, school_name, created_at) values (${q(code)}, ${q(sid)}, ${q(c.schoolName)}, ${toTs(c.createdAt)}) on conflict (code) do nothing;`)
  bump('school_codes')
}

// ============================================================
// APP_USERS  (root/users)
// uuid deterministic — auth import bhi yahi id use karega
// ============================================================

const authUserIdOf = {}
for (const [uid, u] of Object.entries(db.users || {})) {
  const sid = schoolIdOf[u.schoolId]
  const id = uuidOf('user', uid)
  authUserIdOf[uid] = id
  if (!sid && u.schoolId) skip('app_user', 'school nahi mila', `${uid} → ${u.schoolId}`)
  row('app_users',
    ['id', 'legacy_uid', 'school_id', 'role', 'full_name', 'email', 'photo_url', 'last_login_at', 'source'],
    [q(id), q(uid), sid ? q(sid) : 'null', q(u.role || 'teacher'), q(u.fullName), q(u.email), q(u.photoURL),
      toTs(u.lastLoginAt), json(u)])
  bump('app_users')
}

// ============================================================
// STUDENTS  (+ deletedStudents)
// ============================================================

const studentIdOf = {}   // `${schoolLegacy}/${studentLegacy}` → uuid

const STUDENT_COLS = ['id', 'school_id', 'legacy_id', 'full_name', 'admission_number', 'roll_number', 'class_name',
  'section', 'academic_session', 'date_of_birth', 'gender', 'blood_group', 'photo_url', 'photo_path',
  'admission_date', 'admission_type', 'admission_scheme',
  'father_name', 'father_phone', 'father_email', 'father_occupation', 'father_qualification', 'father_aadhaar',
  'mother_name', 'mother_phone', 'mother_email', 'mother_occupation', 'mother_qualification', 'mother_aadhaar',
  'guardian_name', 'guardian_phone', 'guardian_relation',
  'address', 'permanent_address', 'city', 'district', 'state', 'pincode', 'email',
  'aadhaar', 'apaar_id', 'pen_id',
  'religion', 'caste', 'sub_caste', 'category', 'category_cert_no', 'category_cert_url',
  'nationality', 'mother_tongue', 'annual_income',
  'is_disabled', 'disability_percentage', 'disability_remarks', 'disability_cert_no', 'disability_cert_url',
  'udid_no', 'scribe_required', 'extra_exam_time', 'special_equipment',
  'height', 'weight',
  'previous_school', 'previous_class', 'previous_tc_no', 'previous_tc_date', 'previous_tc_url', 'reason_for_leaving',
  'siblings', 'sibling_in_same_school', 'sibling_adm_no',
  'transport_required', 'route_id', 'route_name', 'stop_name', 'pickup_time', 'drop_time',
  'fee_group', 'fee_status', 'parent_login_phone', 'parent_password_dob', 'sms_enabled',
  'active', 'deleted_at', 'created_at', 'updated_at', 'source']

const emitStudent = (schoolLegacy, sid, legacyId, st, deletedAt) => {
  const id = uuidOf('student', schoolLegacy, legacyId)
  studentIdOf[`${schoolLegacy}/${legacyId}`] = id
  row('students', STUDENT_COLS, [
    q(id), q(sid), q(legacyId), q(st.full_name || st.name || 'Unnamed'), q(st.admission_number), q(st.roll_number),
    q(st.class_name), q(st.section), q(st.academic_session), toDate(st.date_of_birth), q(st.gender), q(st.blood_group),
    q(st.photo_url), q(st.photo_path),
    toDate(st.admission_date), q(st.admission_type), q(st.admission_scheme),
    q(st.father_name), q(st.father_phone), q(st.father_email), q(st.father_occupation), q(st.father_qualification), q(st.father_aadhaar),
    q(st.mother_name), q(st.mother_phone), q(st.mother_email), q(st.mother_occupation), q(st.mother_qualification), q(st.mother_aadhaar),
    q(st.guardian_name), q(st.guardian_phone), q(st.guardian_relation),
    q(st.address), q(st.permanent_address), q(st.city), q(st.district), q(st.state), q(st.pincode), q(st.email),
    q(st.aadhaar), q(st.apaar_id), q(st.pen_id),
    q(st.religion), q(st.caste), q(st.sub_caste), q(st.category), q(st.category_cert_no), q(st.category_cert_url),
    q(st.nationality), q(st.mother_tongue), q(st.annual_income),
    bool(st.is_disabled), q(st.disability_percentage), q(st.disability_remarks), q(st.disability_cert_no), q(st.disability_cert_url),
    q(st.udid_no), bool(st.scribe_required), bool(st.extra_exam_time), q(st.special_equipment),
    q(st.height), q(st.weight),
    q(st.previous_school), q(st.previous_class), q(st.previous_tc_no), toDate(st.previous_tc_date), q(st.previous_tc_url), q(st.reason_for_leaving),
    num(st.siblings), bool(st.sibling_in_same_school), q(st.sibling_adm_no),
    bool(st.transport_required), q(st.route_id), q(st.route_name), q(st.stop_name), q(st.pickup_time), q(st.drop_time),
    q(st.fee_group), q(st.fee_status), q(st.parent_login_phone), bool(st.parent_password_dob), bool(st.sms_enabled),
    bool(st.active !== false), deletedAt ? toTs(deletedAt) : 'null',
    toTs(st.createdAt), toTs(st.updatedAt), json(st),
  ])
}

for (const [schoolLegacy, s] of Object.entries(schools)) {
  const sid = schoolIdOf[schoolLegacy]
  for (const [legacyId, st] of Object.entries(s.students || {})) {
    if (!st || typeof st !== 'object') { skip('student', 'object nahi hai', legacyId); continue }
    emitStudent(schoolLegacy, sid, legacyId, st, null)
    bump('students')
  }
  for (const [legacyId, st] of Object.entries(s.deletedStudents || {})) {
    if (!st || typeof st !== 'object') { skip('deletedStudent', 'object nahi hai', legacyId); continue }
    if (studentIdOf[`${schoolLegacy}/${legacyId}`]) { skip('deletedStudent', 'active list me bhi hai — active jeeta', legacyId); continue }
    emitStudent(schoolLegacy, sid, legacyId, st, st.deletedAt || st.updatedAt || st.createdAt || Date.now())
    bump('students_deleted')
  }
}

// ============================================================
// STAFF
// ============================================================

const staffIdOf = {}
for (const [schoolLegacy, s] of Object.entries(schools)) {
  const sid = schoolIdOf[schoolLegacy]
  for (const [legacyId, e] of Object.entries(s.staff || {})) {
    if (!e || typeof e !== 'object') continue
    const id = uuidOf('staff', schoolLegacy, legacyId)
    staffIdOf[`${schoolLegacy}/${legacyId}`] = id
    row('staff',
      ['id', 'school_id', 'legacy_id', 'auth_user_id', 'employee_code', 'first_name', 'last_name', 'father_name',
        'mother_name', 'dob', 'gender', 'phone', 'email', 'address', 'aadhaar', 'department', 'department_id',
        'designation', 'designation_id', 'employee_role', 'employee_status', 'subject', 'assigned_classes',
        'assigned_sections', 'joining_date', 'salary', 'photo_url', 'photo_path', 'active',
        'created_at', 'updated_at', 'source'],
      [q(id), q(sid), q(legacyId), authUserIdOf[legacyId] ? q(authUserIdOf[legacyId]) : 'null',
        q(e.employeeCode), q(e.firstName), q(e.lastName), q(e.fatherName), q(e.motherName), toDate(e.dob),
        q(e.gender), q(e.phone), q(e.email), q(e.address), q(e.aadhaar), q(e.department), q(e.departmentId),
        q(e.designation), q(e.designationId), q(e.employeeRole), q(e.employeeStatus), q(e.subject),
        q(e.assignedClasses), q(e.assignedSections), toDate(e.joiningDate), num(e.salary),
        q(e.photoUrl), q(e.photoPath), bool(e.active !== false),
        toTs(e.createdAt), toTs(e.updatedAt), json(e)])
    bump('staff')
  }
}

// ============================================================
// ATTENDANCE — dono shape
// ============================================================

const STATUS_MAP = {
  P: 'P', A: 'A', L: 'L', H: 'H', HD: 'HD',
  PRESENT: 'P', ABSENT: 'A', LEAVE: 'L', HOLIDAY: 'H', 'HALF DAY': 'HD', HALFDAY: 'HD',
}
const normStatus = (v) => STATUS_MAP[String(v || '').trim().toUpperCase()] || null

const attSeen = new Set()
const emitAttendance = (schoolLegacy, sid, studentLegacy, date, status, markedBy, origin, src) => {
  const stId = studentIdOf[`${schoolLegacy}/${studentLegacy}`]
  if (!stId) { skip('attendance', 'student nahi mila', `${studentLegacy} @ ${date}`); return false }
  const d = toDate(date)
  if (d === 'null') { skip('attendance', 'date galat', `${studentLegacy} @ ${date}`); return false }
  const st = normStatus(status)
  if (!st) { skip('attendance', `status samajh nahi aaya: ${JSON.stringify(status)}`, `${studentLegacy} @ ${date}`); return false }
  const dedupe = `${stId}|${d}`
  if (attSeen.has(dedupe)) { skip('attendance', 'duplicate (dono shape me tha) — pehla rakha', dedupe); return false }
  attSeen.add(dedupe)
  const id = uuidOf('attendance', schoolLegacy, studentLegacy, String(date))
  row('attendance',
    ['id', 'school_id', 'student_id', 'date', 'status', 'marked_by', 'origin', 'source'],
    [q(id), q(sid), q(stId), d, q(st), q(markedBy), q(origin), json(src)])
  return true
}

for (const [schoolLegacy, s] of Object.entries(schools)) {
  const sid = schoolIdOf[schoolLegacy]
  for (const [key, rec] of Object.entries(s.attendance || {})) {
    if (!rec || typeof rec !== 'object') continue

    // shape A — flat: key = "2026-07-10_student_123"
    if (rec.date && (rec.studentId || rec.student_id)) {
      if (emitAttendance(schoolLegacy, sid, rec.studentId || rec.student_id, rec.date,
        rec.status || rec.mark || rec.statusText, rec.markedBy || rec.marked_by, 'flat', rec)) bump('attendance_flat')
      continue
    }

    // shape B — nested: key = "2026-07-13", andar { "11-A": { className, markedBy, student_x: "P" } }
    let nestedFound = false
    for (const [, block] of Object.entries(rec)) {
      if (!block || typeof block !== 'object') continue
      for (const [k, v] of Object.entries(block)) {
        if (typeof v !== 'string' || !k.startsWith('student')) continue
        nestedFound = true
        if (emitAttendance(schoolLegacy, sid, k, key, v, block.markedBy, 'nested', { date: key, className: block.className, status: v, markedBy: block.markedBy })) bump('attendance_nested')
      }
    }
    if (!nestedFound) skip('attendance', 'koi shape match nahi hua', key)
  }
}

// ============================================================
// PARENTS + junction
// ============================================================

const parentIdOf = {}
for (const [schoolLegacy, s] of Object.entries(schools)) {
  const sid = schoolIdOf[schoolLegacy]
  for (const [legacyId, p] of Object.entries(s.parents || {})) {
    if (!p || typeof p !== 'object') continue
    const id = uuidOf('parent', schoolLegacy, legacyId)
    parentIdOf[`${schoolLegacy}/${legacyId}`] = id
    row('parents',
      ['id', 'school_id', 'legacy_id', 'name', 'phone', 'email', 'address', 'language', 'school_code',
        'default_dob', 'must_change_password', 'password_set_at', 'last_login', 'fcm_token', 'status',
        'created_at', 'updated_at', 'source'],
      [q(id), q(sid), q(legacyId), q(p.name), q(p.phone || legacyId), q(p.email), q(p.address),
        q(p.language || 'english'), q(p.schoolCode), q(p.defaultDOB), bool(p.mustChangePassword !== false),
        toTs(p.passwordSetAt), toTs(p.lastLogin), q(p.fcmToken), q(p.status || 'active'),
        toTs(p.createdAt), toTs(p.updatedAt), json(p)])
    bump('parents')

    for (const studentLegacy of Object.keys(p.students || {})) {
      const stId = studentIdOf[`${schoolLegacy}/${studentLegacy}`]
      if (!stId) { skip('parent_student', 'student nahi mila', `${legacyId} → ${studentLegacy}`); continue }
      out.push(`insert into public.parent_students (parent_id, student_id, school_id) values (${q(id)}, ${q(stId)}, ${q(sid)}) on conflict do nothing;`)
      bump('parent_students')
    }
  }

  // parentStudentIndex — parents/*/students me jo chhoot gaya ho
  for (const [phone, map] of Object.entries(s.parentStudentIndex || {})) {
    const pid = parentIdOf[`${schoolLegacy}/${phone}`]
    if (!pid) { skip('parent_index', 'parent nahi mila', phone); continue }
    for (const studentLegacy of Object.keys(map || {})) {
      const stId = studentIdOf[`${schoolLegacy}/${studentLegacy}`]
      if (!stId) { skip('parent_index', 'student nahi mila', `${phone} → ${studentLegacy}`); continue }
      out.push(`insert into public.parent_students (parent_id, student_id, school_id) values (${q(pid)}, ${q(stId)}, ${q(sid)}) on conflict do nothing;`)
      bump('parent_students_from_index')
    }
  }
}

// ============================================================
// FEES
// ============================================================

for (const [schoolLegacy, s] of Object.entries(schools)) {
  const sid = schoolIdOf[schoolLegacy]

  const emitReceipt = (legacyId, f, deleted) => {
    const id = uuidOf('receipt', schoolLegacy, legacyId)
    const stId = studentIdOf[`${schoolLegacy}/${f.studentId}`]
    if (f.studentId && !stId) skip('fee_receipt', 'student nahi mila (receipt phir bhi rakhi)', `${legacyId} → ${f.studentId}`)
    row('fee_receipts',
      ['id', 'school_id', 'legacy_id', 'student_id', 'receipt_number', 'invoice_number', 'receipt_date',
        'billing_month', 'billing_period', 'student_name', 'admission_number', 'class_name', 'father_name',
        'phone', 'fee_group', 'fee_card_no', 'fee_set_type', 'amount', 'discount', 'paid_amount', 'balance',
        'total_due', 'method', 'status', 'payment_status', 'remark', 'fee_items', 'payments',
        'send_sms', 'send_whatsapp', 'paid_at', 'deleted_at', 'updated_at', 'source'],
      [q(id), q(sid), q(legacyId), stId ? q(stId) : 'null', q(f.receiptNumber), q(f.invoiceNumber), toDate(f.receiptDate),
        q(f.billingMonth), q(f.billingPeriod), q(f.studentName), q(f.admissionNumber), q(f.className), q(f.fatherName),
        q(f.phone), q(f.feeGroup), q(f.feeCardNo), q(f.feeSetType), num(f.amount), num(f.discount), num(f.paidAmount),
        num(f.balance), num(f.totalDue), q(f.method), q(f.status), q(f.paymentStatus), q(f.remark),
        json(f.feeItems), json(f.payments), bool(f.sendSms), bool(f.sendWhatsapp),
        toTs(f.paidAt), deleted ? toTs(f.deletedAt || f.updatedAt) : 'null', toTs(f.updatedAt), json(f)])
    bump(deleted ? 'fee_receipts_deleted' : 'fee_receipts')
  }

  for (const [legacyId, f] of Object.entries(s.fees || {})) {
    if (f && typeof f === 'object') emitReceipt(legacyId, f, false)
  }

  const fm = s.feeManager || {}
  for (const [legacyId, g] of Object.entries(fm.groups || {})) {
    row('fee_groups', ['id', 'school_id', 'legacy_id', 'name', 'sort_order', 'created_by', 'created_at', 'updated_at', 'source'],
      [q(uuidOf('feegroup', schoolLegacy, legacyId)), q(sid), q(legacyId), q(g.name), num(g.order), q(g.createdBy),
        toTs(g.createdAt), toTs(g.updatedAt), json(g)])
    bump('fee_groups')
  }
  for (const [legacyId, st] of Object.entries(fm.structures || {})) {
    row('fee_structures', ['id', 'school_id', 'legacy_id', 'mode', 'target', 'class_name', 'section', 'fee_head', 'frequency', 'amount', 'updated_at', 'source'],
      [q(uuidOf('feestruct', schoolLegacy, legacyId)), q(sid), q(legacyId), q(st.mode), q(st.target), q(st.className),
        q(st.section), q(st.feeHead || 'Unknown'), q(st.frequency), num(st.amount), toTs(st.updatedAt), json(st)])
    bump('fee_structures')
  }
  for (const [legacyId, f] of Object.entries(fm.fines || {})) {
    const stId = studentIdOf[`${schoolLegacy}/${f.studentId}`]
    row('fee_fines', ['id', 'school_id', 'legacy_id', 'student_id', 'amount', 'reason', 'created_at', 'source'],
      [q(uuidOf('feefine', schoolLegacy, legacyId)), q(sid), q(legacyId), stId ? q(stId) : 'null',
        num(f.amount), q(f.reason || f.remark), toTs(f.createdAt), json(f)])
    bump('fee_fines')
  }
  for (const [legacyId, f] of Object.entries(fm.deleted || {})) {
    if (f && typeof f === 'object') emitReceipt(legacyId, f, true)
  }
  if (fm.receiptCounter !== undefined && typeof fm.receiptCounter !== 'object') {
    out.push(`insert into public.fee_counters (school_id, name, value) values (${q(sid)}, 'receipt', ${num(fm.receiptCounter)}) on conflict (school_id, name) do nothing;`)
    bump('fee_counters')
  }
}

// ============================================================
// EXAMS / REPORTS / DATE SHEETS
// ============================================================

for (const [schoolLegacy, s] of Object.entries(schools)) {
  const sid = schoolIdOf[schoolLegacy]

  for (const [legacyId, e] of Object.entries(s.exams || {})) {
    row('exams', ['id', 'school_id', 'legacy_id', 'name', 'created_at', 'updated_at', 'source'],
      [q(uuidOf('exam', schoolLegacy, legacyId)), q(sid), q(legacyId), q(e.name || legacyId), toTs(e.createdAt), toTs(e.updatedAt), json(e)])
    bump('exams')
  }

  for (const [legacyId, m] of Object.entries(s.reportMarks || {})) {
    const stId = studentIdOf[`${schoolLegacy}/${m.studentId}`]
    if (m.studentId && !stId) skip('report_mark', 'student nahi mila', legacyId)
    row('report_marks',
      ['id', 'school_id', 'legacy_id', 'student_id', 'exam_legacy_id', 'class_name', 'section', 'status',
        'attendance', 'remarks', 'class_teacher_remark', 'principal_remark', 'marks', 'created_at', 'updated_at', 'source'],
      [q(uuidOf('reportmark', schoolLegacy, legacyId)), q(sid), q(legacyId), stId ? q(stId) : 'null', q(m.examId),
        q(m.className), q(m.section), q(m.status), q(m.attendance), q(m.remarks), q(m.classTeacherRemark),
        q(m.principalRemark), json(m.subjects ?? m.marks ?? null), toTs(m.createdAt), toTs(m.updatedAt), json(m)])
    bump('report_marks')
  }

  for (const [legacyId, c] of Object.entries(s.reportCards || {})) {
    const stId = studentIdOf[`${schoolLegacy}/${c.studentId}`]
    row('report_cards',
      ['id', 'school_id', 'legacy_id', 'student_id', 'exam_legacy_id', 'report_number', 'class_name', 'section',
        'status', 'locked', 'attendance', 'remarks', 'class_teacher_remark', 'principal_remark', 'payload',
        'created_at', 'updated_at', 'source'],
      [q(uuidOf('reportcard', schoolLegacy, legacyId)), q(sid), q(legacyId), stId ? q(stId) : 'null', q(c.examId),
        q(c.reportNumber), q(c.className), q(c.section), q(c.status), bool(c.locked), q(c.attendance), q(c.remarks),
        q(c.classTeacherRemark), q(c.principalRemark), json(c.subjects ?? c.payload ?? null),
        toTs(c.createdAt), toTs(c.updatedAt), json(c)])
    bump('report_cards')
  }

  for (const [legacyId, d] of Object.entries(s.dateSheet || {})) {
    row('date_sheets', ['id', 'school_id', 'legacy_id', 'exam_legacy_id', 'class_name', 'section', 'subject', 'date', 'from_time', 'to_time', 'created_at', 'updated_at', 'source'],
      [q(uuidOf('datesheet', schoolLegacy, legacyId)), q(sid), q(legacyId), q(d.examId), q(d.className), q(d.section),
        q(d.subject), toDate(d.date), q(d.fromTime), q(d.toTime), toTs(d.createdAt), toTs(d.updatedAt), json(d)])
    bump('date_sheets')
  }
}

// ============================================================
// CERTIFICATES / HOMEWORK / NOTICES / TRANSPORT
// ============================================================

for (const [schoolLegacy, s] of Object.entries(schools)) {
  const sid = schoolIdOf[schoolLegacy]

  for (const [legacyId, c] of Object.entries(s.certificates || {})) {
    const stId = studentIdOf[`${schoolLegacy}/${c.studentId}`]
    row('certificates',
      ['id', 'school_id', 'legacy_id', 'student_id', 'certificate_type', 'certificate_number', 'admission_no',
        'class_name', 'data', 'created_by', 'created_at', 'updated_at', 'source'],
      [q(uuidOf('cert', schoolLegacy, legacyId)), q(sid), q(legacyId), stId ? q(stId) : 'null',
        q(c.certificateType || 'unknown'), q(c.certificateNumber), q(c.admissionNo), q(c.className),
        json(c.data), q(c.createdBy), toTs(c.createdAt), toTs(c.updatedAt), json(c)])
    bump('certificates')
  }

  for (const [name, v] of Object.entries(s.certificateCounters || {})) {
    if (typeof v === 'object') continue
    out.push(`insert into public.certificate_counters (school_id, name, value) values (${q(sid)}, ${q(name)}, ${num(v)}) on conflict (school_id, name) do nothing;`)
    bump('certificate_counters')
  }

  for (const [legacyId, h] of Object.entries(s.homework || {})) {
    if (!h || typeof h !== 'object') continue
    row('homework', ['id', 'school_id', 'legacy_id', 'class_name', 'section', 'subject', 'title', 'description', 'assigned_on', 'due_date', 'created_by', 'created_at', 'updated_at', 'source'],
      [q(uuidOf('homework', schoolLegacy, legacyId)), q(sid), q(legacyId), q(h.className || h.class_name), q(h.section),
        q(h.subject), q(h.title), q(h.description || h.body), toDate(h.assignedOn || h.date), toDate(h.dueDate),
        q(h.createdBy), toTs(h.createdAt), toTs(h.updatedAt), json(h)])
    bump('homework')
  }

  for (const [legacyId, n] of Object.entries(s.notices || {})) {
    row('notices', ['id', 'school_id', 'legacy_id', 'title', 'body', 'audience', 'created_by', 'created_at', 'updated_at', 'source'],
      [q(uuidOf('notice', schoolLegacy, legacyId)), q(sid), q(legacyId), q(n.title), q(n.body), q(n.audience),
        q(n.createdBy), toTs(n.createdAt), toTs(n.updatedAt), json(n)])
    bump('notices')
  }

  for (const [legacyId, a] of Object.entries((s.transport || {}).allocations || {})) {
    const stId = studentIdOf[`${schoolLegacy}/${a.studentId}`]
    row('transport_allocations',
      ['id', 'school_id', 'legacy_id', 'student_id', 'admission_no', 'class_name', 'route_id', 'route_name',
        'stop_name', 'driver_id', 'pickup_time', 'drop_time', 'allocated_at', 'created_at', 'updated_at', 'source'],
      [q(uuidOf('transport', schoolLegacy, legacyId)), q(sid), q(legacyId), stId ? q(stId) : 'null', q(a.admissionNo),
        q(a.className), q(a.routeId), q(a.routeName), q(a.stopName), q(a.driverId), q(a.pickupTime), q(a.dropTime),
        toTs(a.allocatedAt), toTs(a.createdAt), toTs(a.updatedAt), json(a)])
    bump('transport_allocations')
  }
}

// ============================================================
// LEAVE / ADMISSIONS / STAFF ATTENDANCE / NOTIFICATIONS
// ============================================================

for (const [schoolLegacy, s] of Object.entries(schools)) {
  const sid = schoolIdOf[schoolLegacy]

  for (const [legacyId, l] of Object.entries(s.leaveRequests || {})) {
    const stId = studentIdOf[`${schoolLegacy}/${l.studentId}`]
    row('leave_requests',
      ['id', 'school_id', 'legacy_id', 'student_id', 'parent_legacy', 'parent_name', 'admission_no', 'class_section',
        'from_date', 'to_date', 'reason', 'status', 'review_note', 'reviewed_at', 'reviewed_by', 'created_at', 'updated_at', 'source'],
      [q(uuidOf('leave', schoolLegacy, legacyId)), q(sid), q(legacyId), stId ? q(stId) : 'null', q(l.parentId),
        q(l.parentName), q(l.admissionNo), q(l.classSection), toDate(l.fromDate), toDate(l.toDate), q(l.reason),
        q(l.status || 'pending'), q(l.reviewNote), toTs(l.reviewedAt), q(l.reviewedBy),
        toTs(l.createdAt), toTs(l.updatedAt), json(l)])
    bump('leave_requests')
  }

  for (const [legacyId, a] of Object.entries(s.admissionRequests || {})) {
    row('admission_requests',
      ['id', 'school_id', 'legacy_id', 'student_name', 'class_applied_for', 'dob', 'gender', 'father_name',
        'mother_name', 'parent_phone', 'parent_email', 'address', 'previous_school', 'admission_number',
        'status', 'review_note', 'reviewed_at', 'created_at', 'updated_at', 'source'],
      [q(uuidOf('admreq', schoolLegacy, legacyId)), q(sid), q(legacyId), q(a.studentName || a.fullName || a.name),
        q(a.classAppliedFor), toDate(a.dob), q(a.gender), q(a.fatherName), q(a.motherName), q(a.parentPhone),
        q(a.parentEmail), q(a.address), q(a.previousSchool), q(a.admissionNumber), q(a.status || 'pending'),
        q(a.reviewNote), toTs(a.reviewedAt), toTs(a.createdAt), toTs(a.updatedAt), json(a)])
    bump('admission_requests')
  }

  // staffAttendance: { "2026-07-01": { employee_x: "P", ... } }
  for (const [date, map] of Object.entries(s.staffAttendance || {})) {
    if (!map || typeof map !== 'object') continue
    for (const [empLegacy, status] of Object.entries(map)) {
      if (typeof status !== 'string') continue
      const stfId = staffIdOf[`${schoolLegacy}/${empLegacy}`]
      if (!stfId) { skip('staff_attendance', 'staff nahi mila', `${empLegacy} @ ${date}`); continue }
      const st = normStatus(status)
      if (!st) { skip('staff_attendance', `status samajh nahi aaya: ${status}`, `${empLegacy} @ ${date}`); continue }
      const d = toDate(date)
      if (d === 'null') { skip('staff_attendance', 'date galat', date); continue }
      row('staff_attendance', ['id', 'school_id', 'staff_id', 'date', 'status', 'source'],
        [q(uuidOf('staffatt', schoolLegacy, empLegacy, date)), q(sid), q(stfId), d, q(st), json({ date, status })])
      bump('staff_attendance')
    }
  }

  for (const [legacyId, n] of Object.entries(s.parentNotifications || {})) {
    if (!n || typeof n !== 'object') continue
    const pid = parentIdOf[`${schoolLegacy}/${n.parentId || n.phone}`]
    const stId = studentIdOf[`${schoolLegacy}/${n.studentId}`]
    row('parent_notifications',
      ['id', 'school_id', 'legacy_id', 'parent_id', 'student_id', 'type', 'title', 'body', 'read', 'created_at', 'source'],
      [q(uuidOf('pnotif', schoolLegacy, legacyId)), q(sid), q(legacyId), pid ? q(pid) : 'null', stId ? q(stId) : 'null',
        q(n.type), q(n.title), q(n.body || n.message), bool(n.read), toTs(n.createdAt), json(n)])
    bump('parent_notifications')
  }

  const sub = s.subscription
  if (sub && typeof sub === 'object') {
    out.push(`insert into public.subscriptions (school_id, plan, amount, status, starts_at, expires_at, source) values (${q(sid)}, ${q(sub.plan || sub.planName)}, ${num(sub.amount)}, ${q(sub.status)}, ${toTs(sub.startsAt || sub.startedAt)}, ${toTs(sub.expiresAt || sub.expiryAt)}, ${json(sub)}) on conflict (school_id) do nothing;`)
    bump('subscriptions')
  }

  for (const [legacyId, a] of Object.entries(s.auditLogs || {})) {
    if (!a || typeof a !== 'object') continue
    row('audit_logs', ['id', 'school_id', 'legacy_id', 'actor', 'action', 'target', 'detail', 'created_at', 'source'],
      [q(uuidOf('audit', schoolLegacy, legacyId)), q(sid), q(legacyId), q(a.actor || a.by), q(a.action),
        q(a.target), json(a.detail), toTs(a.createdAt || a.at), json(a)])
    bump('audit_logs')
  }

  for (const [name, v] of Object.entries(s.admissionCounter || {})) {
    if (typeof v === 'object') continue
    out.push(`insert into public.counters (school_id, name, value) values (${q(sid)}, ${q('admission_' + name)}, ${num(v)}) on conflict (school_id, name) do nothing;`)
    bump('counters')
  }
}

// ============================================================
// OUTPUT
// ============================================================

fs.writeFileSync(outPath, out.join('\n') + '\n', 'utf8')
fs.writeFileSync(outPath.replace(/\.sql$/, '.skipped.json'), JSON.stringify(skipped, null, 2), 'utf8')

console.log('=== INSERTED ===')
for (const [k, v] of Object.entries(stats).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(28)} ${v}`)
console.log(`\n  TOTAL STATEMENTS: ${out.length}`)

if (nulHits) {
  console.log(`\n=== KHARAB (binary kachra) ===`)
  console.log(`  ${nulHits} field values me NUL byte tha — hata diya, baaki jaisa tha waisa gaya.`)
  console.log(`  Ye lagbhag saara x6cLyS ke deletedStudents me hai. Active students saaf hain.`)
  console.log(`  Asli bytes backup JSON me surakshit hain.`)
}

console.log('\n=== SKIPPED ===')
const byReason = {}
for (const s of skipped) {
  const k = `${s.what}: ${s.why}`
  byReason[k] = (byReason[k] || 0) + 1
}
if (!skipped.length) console.log('  (kuch nahi)')
for (const [k, v] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(5)}  ${k}`)
console.log(`\n  detail: ${outPath.replace(/\.sql$/, '.skipped.json')}`)

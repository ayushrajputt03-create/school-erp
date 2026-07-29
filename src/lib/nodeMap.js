/**
 * RTDB ke node naam -> Postgres table ka naksha.
 *
 * Har table me `source` jsonb hai jisme poora original RTDB record pada hai.
 * Adapter usi ko document maanta hai, aur typed columns sirf index/query ke
 * liye hain. Isse app ko bilkul wahi shakal milti hai jo aaj Firebase se milti
 * hai — 168 call sites ko haath lagane ki zarurat nahi padti.
 *
 * `project` batata hai ki document ke kaunse field kis column me jaane chahiye,
 * taaki likhne ke baad bhi query/RLS sahi chalti rahe.
 */

const num = (v) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const bool = (v) => (v === true || v === 'true' ? true : v === false || v === 'false' ? false : null)

/** '2026-07-10' / '10.07.2026' / '10/07/2026' -> '2026-07-10', warna null */
export const toDate = (v) => {
  if (!v) return null
  const s = String(v).trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (m) return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`
  return null
}

const ts = (v) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? new Date(n).toISOString() : null
}

/** Attendance/staff ke status ko ek roop me laata hai */
export const normStatus = (v) => {
  const s = String(v ?? '').trim().toUpperCase()
  const map = {
    P: 'P', A: 'A', L: 'L', H: 'H', HD: 'HD',
    PRESENT: 'P', ABSENT: 'A', LEAVE: 'L', HOLIDAY: 'H', HALFDAY: 'HD', 'HALF DAY': 'HD',
  }
  return map[s] || null
}

/**
 * node   : RTDB me schools/{id}/<yahan> kya likha hai
 * table  : Postgres table
 * key    : legacy id kis column me hai
 * project: document se columns nikalne wala function
 * sub    : jin nodes ke andar ek aur parat hai (feeManager/groups/{id})
 */
export const NODES = {
  students: {
    table: 'students',
    key: 'legacy_id',
    // `select *` in tables ke 85 column bhejta hai, jabki rowToDoc sirf source,
    // photo_path, photo_url aur deleted_at padhta hai — baaki sab source ki hi
    // nakal hai jo taar par jaake phenk di jaati hai. deletedStudents (544 rows)
    // isi wajah se 9.8 second le raha tha.
    select: 'legacy_id, source, photo_path, photo_url, deleted_at',
    softDelete: { column: 'deleted_at', activeOnly: true },
    project: (d) => ({
      full_name: d.full_name || d.name || 'Unnamed',
      admission_number: d.admission_number ?? null,
      roll_number: d.roll_number ?? null,
      class_name: d.class_name ?? null,
      section: d.section ?? null,
      academic_session: d.academic_session ?? null,
      date_of_birth: toDate(d.date_of_birth),
      admission_date: toDate(d.admission_date),
      gender: d.gender ?? null,
      father_name: d.father_name ?? null,
      father_phone: d.father_phone ?? null,
      mother_name: d.mother_name ?? null,
      guardian_name: d.guardian_name ?? null,
      guardian_phone: d.guardian_phone ?? null,
      parent_login_phone: d.parent_login_phone ?? null,
      fee_group: d.fee_group ?? null,
      fee_status: d.fee_status ?? null,
      photo_path: d.photo_path ?? null,
      photo_url: d.photo_url ?? null,
      active: d.active !== false,
      updated_at: ts(d.updatedAt) || new Date().toISOString(),
    }),
  },

  deletedStudents: {
    table: 'students',
    key: 'legacy_id',
    select: 'legacy_id, source, photo_path, photo_url, deleted_at',
    softDelete: { column: 'deleted_at', deletedOnly: true },
    project: (d) => ({
      full_name: d.full_name || d.name || 'Unnamed',
      admission_number: d.admission_number ?? null,
      class_name: d.class_name ?? null,
      section: d.section ?? null,
      deleted_at: ts(d.deletedAt) || new Date().toISOString(),
    }),
  },

  staff: {
    table: 'staff',
    key: 'legacy_id',
    project: (d) => ({
      employee_code: d.employeeCode ?? null,
      first_name: d.firstName ?? null,
      last_name: d.lastName ?? null,
      phone: d.phone ?? null,
      email: d.email ?? null,
      department: d.department ?? null,
      designation: d.designation ?? null,
      employee_role: d.employeeRole ?? null,
      assigned_classes: d.assignedClasses ?? null,
      assigned_sections: d.assignedSections ?? null,
      dob: toDate(d.dob),
      joining_date: toDate(d.joiningDate),
      salary: num(d.salary),
      photo_path: d.photoPath ?? null,
      photo_url: d.photoUrl ?? null,
      active: d.active !== false,
    }),
  },

  attendance: {
    table: 'attendance',
    // RTDB key = `${date}_${studentId}` — wahi idempotency yahan bhi.
    //
    // Student ka legacy id join se aata hai, source se nahi: jo rows RTDB ke
    // nested shape se aayi thi ({date}/{class}/{studentId}) unke source me
    // studentId hai hi nahi — wo parent key me pada tha. Sirf source pe bharosa
    // karne se un sabki key `date_undefined` ban jaati thi aur wo ek doosre ko
    // daba deti thi (662 rows ki jagah 625 dikhte the).
    select: '*, student:students(legacy_id)',
    keyFromRow: (row, d) => `${row.date}_${row.student?.legacy_id || d.studentId || d.student_id}`,
    // App har attendance record par ye teen field expect karta hai, chahe wo
    // kisi bhi shape se aayi ho.
    fill: (row) => ({
      date: row.date,
      status: row.status,
      studentId: row.student?.legacy_id ?? null,
      markedBy: row.marked_by ?? null,
    }),
    resolve: { studentFrom: (d) => d.studentId || d.student_id },
    conflict: 'school_id,student_id,date',
    project: (d) => ({
      date: toDate(d.date),
      status: normStatus(d.status ?? d.mark ?? d.statusText),
      marked_by: d.markedBy || d.marked_by || null,
      origin: 'flat',
    }),
  },

  parents: {
    table: 'parents',
    key: 'legacy_id',
    project: (d) => ({
      name: d.name ?? null,
      phone: d.phone || d.id || null,
      email: d.email ?? null,
      address: d.address ?? null,
      school_code: d.schoolCode ?? null,
      default_dob: d.defaultDOB ?? null,
      must_change_password: d.mustChangePassword !== false,
      status: d.status || 'active',
    }),
  },

  fees: {
    table: 'fee_receipts',
    key: 'legacy_id',
    // Delete ki hui receipts feeManager/deleted me jaati hain, fees me nahi.
    // Bina iske hisaab do receipt zyada dikhata tha.
    softDelete: { column: 'deleted_at', activeOnly: true },
    resolve: { studentFrom: (d) => d.studentId },
    project: (d) => ({
      receipt_number: d.receiptNumber ?? null,
      invoice_number: d.invoiceNumber ?? null,
      receipt_date: toDate(d.receiptDate),
      billing_month: d.billingMonth ?? null,
      billing_period: d.billingPeriod ?? null,
      student_name: d.studentName ?? null,
      admission_number: d.admissionNumber ?? null,
      class_name: d.className ?? null,
      amount: num(d.amount) ?? 0,
      discount: num(d.discount) ?? 0,
      paid_amount: num(d.paidAmount) ?? 0,
      balance: num(d.balance) ?? 0,
      total_due: num(d.totalDue) ?? 0,
      method: d.method ?? null,
      status: d.status ?? null,
      payment_status: d.paymentStatus ?? null,
      fee_items: d.feeItems ?? null,
      payments: d.payments ?? null,
      paid_at: ts(d.paidAt),
    }),
  },

  certificates: {
    table: 'certificates',
    key: 'legacy_id',
    resolve: { studentFrom: (d) => d.studentId },
    project: (d) => ({
      certificate_type: d.certificateType || 'unknown',
      certificate_number: d.certificateNumber ?? null,
      admission_no: d.admissionNo ?? null,
      class_name: d.className ?? null,
      data: d.data ?? null,
    }),
  },

  homework: {
    table: 'homework',
    key: 'legacy_id',
    project: (d) => ({
      class_name: d.className || d.class_name || null,
      section: d.section ?? null,
      subject: d.subject ?? null,
      title: d.title ?? null,
      assigned_on: toDate(d.assignedOn || d.date),
      due_date: toDate(d.dueDate),
    }),
  },

  notices: {
    table: 'notices',
    key: 'legacy_id',
    project: (d) => ({ title: d.title ?? null, body: d.body ?? null, audience: d.audience ?? null }),
  },

  admissionRequests: {
    table: 'admission_requests',
    key: 'legacy_id',
    project: (d) => ({
      student_name: d.studentName || d.fullName || d.name || null,
      class_applied_for: d.classAppliedFor ?? null,
      parent_phone: d.parentPhone ?? null,
      dob: toDate(d.dob),
      status: d.status || 'pending',
    }),
  },

  leaveRequests: {
    table: 'leave_requests',
    key: 'legacy_id',
    resolve: { studentFrom: (d) => d.studentId },
    project: (d) => ({
      from_date: toDate(d.fromDate),
      to_date: toDate(d.toDate),
      reason: d.reason ?? null,
      status: d.status || 'pending',
      class_section: d.classSection ?? null,
    }),
  },

  reportMarks: {
    table: 'report_marks',
    key: 'legacy_id',
    resolve: { studentFrom: (d) => d.studentId },
    project: (d) => ({ exam_legacy_id: d.examId ?? null, class_name: d.className ?? null, section: d.section ?? null, status: d.status ?? null }),
  },

  reportCards: {
    table: 'report_cards',
    key: 'legacy_id',
    resolve: { studentFrom: (d) => d.studentId },
    project: (d) => ({ exam_legacy_id: d.examId ?? null, report_number: d.reportNumber ?? null, class_name: d.className ?? null, locked: bool(d.locked) ?? false }),
  },

  reportExams: {
    table: 'exams',
    key: 'legacy_id',
    project: (d) => ({ name: d.name || 'Exam' }),
  },

  exams: {
    table: 'exams',
    key: 'legacy_id',
    project: (d) => ({ name: d.name || 'Exam' }),
  },

  dateSheet: {
    table: 'date_sheets',
    key: 'legacy_id',
    project: (d) => ({
      exam_legacy_id: d.examId ?? null,
      class_name: d.className ?? null,
      section: d.section ?? null,
      subject: d.subject ?? null,
      date: toDate(d.date),
      from_time: d.fromTime ?? null,
      to_time: d.toTime ?? null,
    }),
  },

  parentNotifications: {
    table: 'parent_notifications',
    key: 'legacy_id',
    project: (d) => ({ type: d.type ?? null, title: d.title ?? null, body: d.body || d.message || null, read: bool(d.read) ?? false }),
  },
}

/** feeManager/groups/{id} jaise do-parat wale nodes */
export const SUB_NODES = {
  'feeManager/groups': {
    table: 'fee_groups',
    key: 'legacy_id',
    project: (d) => ({ name: d.name || 'Group', sort_order: num(d.order) ?? 0 }),
  },
  'feeManager/structures': {
    table: 'fee_structures',
    key: 'legacy_id',
    project: (d) => ({
      mode: d.mode ?? null,
      target: d.target ?? null,
      class_name: d.className ?? null,
      section: d.section ?? null,
      fee_head: d.feeHead || 'Unknown',
      frequency: d.frequency ?? null,
      amount: num(d.amount) ?? 0,
    }),
  },
  'feeManager/fines': {
    table: 'fee_fines',
    key: 'legacy_id',
    project: (d) => ({ amount: num(d.amount) ?? 0, reason: d.reason || d.name || null }),
  },
}

/** Ye nodes kisi table me nahi hain — kv me jaate hain, RTDB jaisa hi vyavhaar */
export const isKvNode = (node) => !NODES[node] && !Object.keys(SUB_NODES).some((k) => k.startsWith(`${node}/`))

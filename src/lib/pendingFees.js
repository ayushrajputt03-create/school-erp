// Multi-month pending fees calculation shared by the admin Fee Manager list, the
// student profile Fees tab and the Parent Portal. Pure module - no Firebase, no React -
// so the exact same numbers show everywhere and the logic is testable in plain Node.
//
// Fee rows come from two writers with different month formats:
//   - quick payments store billingMonth/billingPeriod as "YYYY-MM"
//   - Fee Manager receipts store billingMonth as a month NAME ("July") plus
//     billingPeriod as "YYYY-MM" derived from the receipt date
// so month matching accepts both, and legacy name-only rows fall back to the
// receipt/paid date for the year.

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
// Pending months track the recurring tuition only. One-time or optional heads
// (exam, annual, transport, admission, development) must never mark a month
// paid or inflate the expected monthly due.
const TUITION_HEADS = ['Monthly Tuition Fee', 'Tuition Fee']

const classParts = value => {
  const raw = String(value || '').trim()
  const slash = raw.match(/^(.+?)\s*\/\s*([A-Za-z0-9]+)$/)
  if (slash) return { className: slash[1].trim(), section: slash[2].trim() }
  const dash = raw.match(/^(.+?)\s*[-–—]\s*([A-Za-z0-9]+)$/)
  if (dash) return { className: dash[1].trim(), section: dash[2].trim() }
  const space = raw.match(/^(.+?)\s+([A-Za-z])$/)
  if (space) return { className: space[1].trim(), section: space[2].trim() }
  return { className: raw || '', section: '' }
}

// Monthly tuition amount configured for this student in feeManager.structures.
// Only tuition heads count - transport/computer/exam/fines never inflate the expected due.
export const monthlyFeeFor = (student, structures) => {
  const parts = classParts(student?.className)
  const feeGroup = String(student?.feeGroup || 'REGULAR').toUpperCase()
  return Object.values(structures || {})
    .filter(row => String(row.frequency || '') === 'Monthly' && TUITION_HEADS.includes(String(row.feeHead || '')))
    .filter(row => {
      const sameClass = !row.className || String(row.className) === String(parts.className)
      const sameSection = !row.section || String(row.section) === String(parts.section)
      if (row.mode === 'By Student Wise') return String(row.target) === String(student?.id)
      if (row.mode === 'Class Wise') return sameClass && sameSection
      return String(row.target || '').toUpperCase() === feeGroup && sameClass && sameSection
    })
    .reduce((sum, row) => sum + Number(row.amount || 0), 0)
}

// When no fee structure matches the student's class (structures are only configured
// for some classes), fall back to the tuition heads on the student's own most
// recent receipt so record-less months still get an expected due.
const monthlyFeeFromRows = rows => {
  let best = 0
  let bestAt = -1
  for (const row of rows) {
    const items = Array.isArray(row.feeItems) ? row.feeItems : []
    const sum = items
      .filter(item => TUITION_HEADS.includes(String(item.head || '')))
      .reduce((total, item) => total + Number(item.due || 0), 0)
    const at = Number(row.paidAt || 0)
    if (sum > 0 && at >= bestAt) {
      best = sum
      bestAt = at
    }
  }
  return best
}

// Tuition portion of a fee row. Itemised receipts expose heads via feeItems, but
// payment is receipt-level, so paid money is attributed to tuition first (schools
// collect tuition before optional heads). Quick payments carry no items and are
// treated as pure tuition. A receipt with items but no tuition head (exam-only,
// admission-only...) contributes nothing and never marks a month as paid.
const tuitionShareOf = row => {
  const items = Array.isArray(row.feeItems) ? row.feeItems : []
  if (!items.length) return null
  return items
    .filter(item => TUITION_HEADS.includes(String(item.head || '')))
    .reduce((sum, item) => sum + Number(item.due || 0), 0)
}
const tuitionPaidOf = row => {
  const paid = Number(row.paidAmount ?? row.amount ?? 0)
  const share = tuitionShareOf(row)
  return share === null ? paid : Math.min(paid, share)
}
const rowCoversTuition = row => {
  const share = tuitionShareOf(row)
  return share === null || share > 0
}

const belongsToStudent = (row, student) => {
  if (String(row.studentId || '') === String(student.id)) return true
  const admission = String(student.roll || student.admissionNo || '')
  return Boolean(admission) && String(row.admissionNumber || row.admissionNo || '') === admission
}

const rowMatchesMonth = (row, key, name, year) => {
  if (String(row.billingPeriod || '') === key) return true
  if (String(row.billingMonth || '') === key) return true
  if (String(row.billingMonth || '') === name) {
    // A row carrying an explicit period that didn't match above belongs to another year.
    if (row.billingPeriod) return false
    const rowYear = Number(String(row.receiptDate || '').slice(0, 4)) || (row.paidAt ? new Date(row.paidAt).getFullYear() : 0)
    return !rowYear || rowYear === year
  }
  return false
}

// Month a fee row was billed for, as a first-of-month Date. Understands "YYYY-MM"
// periods, "YYYY-MM" billingMonth values and legacy month-name rows (year taken
// from the receipt/paid date).
const rowBilledMonth = row => {
  const period = firstOfMonth(row.billingPeriod) || firstOfMonth(row.billingMonth)
  if (period) return period
  const monthIndex = MONTH_NAMES.indexOf(String(row.billingMonth || ''))
  if (monthIndex < 0) return null
  const year = Number(String(row.receiptDate || '').slice(0, 4)) || (row.paidAt ? new Date(row.paidAt).getFullYear() : 0)
  return year ? new Date(year, monthIndex, 1) : null
}

const firstOfMonth = value => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})/)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  if (!year || month < 1 || month > 12) return null
  return new Date(year, month - 1, 1)
}

// Returns { pendingMonthsCount, pendingMonths: [{ month, monthKey, amountDue, amountPaid, status }],
// totalPendingAmount, monthlyFee }. Walks every month from the later of the academic year start
// (April) and the student's admission month up to the current month. A month counts as pending
// when no matching fee row says "paid" and the amount collected is short of the monthly fee.
export function getPendingFeesSummary({ student, fees = {}, structures = {}, academicYear, monthlyFee, now = new Date() }) {
  if (!student) return { pendingMonthsCount: 0, pendingMonths: [], totalPendingAmount: 0, monthlyFee: 0 }
  const allRows = Array.isArray(fees) ? fees : Object.values(fees || {})
  const studentRows = allRows.filter(row => row && belongsToStudent(row, student))
  const configuredFee = monthlyFee !== undefined && monthlyFee !== null && Number.isFinite(Number(monthlyFee))
    ? Number(monthlyFee)
    : monthlyFeeFor(student, structures)
  const fee = configuredFee > 0 ? configuredFee : monthlyFeeFromRows(studentRows)

  const fallbackStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  const startYear = Number(String(academicYear || '').match(/\d{4}/)?.[0] || fallbackStart)
  let cursor = new Date(startYear, 3, 1)
  // Never clamp the walk to the admission date: the app records admissionDate as the
  // day the record was entered (form/import default is today), while schools bill
  // every student from the session start (April) and back-date receipts. Clamping
  // hid all pre-entry months, so only the current month ever showed as pending.
  // Rows billed before April (previous-session dues) still extend the walk back.
  for (const row of studentRows) {
    const billed = rowBilledMonth(row)
    if (billed && billed < cursor) cursor = billed
  }
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const pendingMonths = []
  while (cursor <= currentMonth) {
    const year = cursor.getFullYear()
    const name = MONTH_NAMES[cursor.getMonth()]
    const key = `${year}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
    const monthRows = studentRows.filter(row => rowMatchesMonth(row, key, name, year))
    const amountPaid = monthRows.reduce((sum, row) => sum + tuitionPaidOf(row), 0)
    const markedPaid = monthRows.some(row => rowCoversTuition(row) && String(row.status || '').toLowerCase() === 'paid')
    if (!markedPaid) {
      // Without a configured monthly fee the expected due for record-less months is unknown,
      // so only the recorded unpaid balance on tuition-carrying rows can be reported.
      const amountDue = fee > 0
        ? Math.max(0, fee - amountPaid)
        : monthRows.filter(rowCoversTuition).reduce((sum, row) => sum + Number(row.balance || 0), 0)
      if (amountDue > 0) {
        pendingMonths.push({
          month: `${name} ${year}`,
          monthKey: key,
          amountDue,
          amountPaid,
          status: amountPaid > 0 ? 'partial' : 'unpaid',
        })
      }
    }
    cursor = new Date(year, cursor.getMonth() + 1, 1)
  }

  return {
    pendingMonthsCount: pendingMonths.length,
    pendingMonths,
    totalPendingAmount: pendingMonths.reduce((sum, item) => sum + item.amountDue, 0),
    monthlyFee: fee,
  }
}

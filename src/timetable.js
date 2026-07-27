// Shared timetable logic: normalisation, conflict detection and the derived views.
//
// Storage shape (schools/{schoolId}/timetable):
//   {classSection}/{day}/{periodNumber} = { subject, teacherId, teacherName, startTime, endTime, room }
//
// teacherName is denormalised on purpose so a class grid, a teacher's own grid and the workload
// table all render without joining against staff. teacherId stays the source of truth for every
// lookup - the name is display only and is refreshed whenever a slot is saved.
//
// Legacy shape (what schools already have on disk):
//   {classSection} = [ { id, day, time, subject, teacher, room } ]
// Firebase turns a sparse array into an object keyed by index, so the same data can arrive as
// either an array or {0:{...},1:{...}}. Everything here reads both, and no legacy field is
// dropped in the process: `teacher` (free text) becomes teacherName, `time` becomes startTime,
// and `room` carries over untouched.

export const TIMETABLE_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Grid height. Schools that run fewer periods simply leave the tail rows empty - an empty slot
// is never written, so unused periods cost nothing in storage or egress.
export const PERIODS_PER_DAY = 8

export const PERIOD_NUMBERS = Array.from({ length: PERIODS_PER_DAY }, (_, index) => index + 1)

const emptySlot = () => ({ subject: '', teacherId: '', teacherName: '', startTime: '', endTime: '', room: '' })

export function isEmptySlot(slot) {
  if (!slot) return true
  return !slot.subject && !slot.teacherId && !slot.teacherName
}

function cleanSlot(raw) {
  if (!raw || typeof raw !== 'object') return null
  const slot = {
    ...emptySlot(),
    subject: String(raw.subject || '').trim(),
    teacherId: String(raw.teacherId || '').trim(),
    teacherName: String(raw.teacherName || '').trim(),
    startTime: String(raw.startTime || '').trim(),
    endTime: String(raw.endTime || '').trim(),
    room: String(raw.room || '').trim(),
  }
  return isEmptySlot(slot) ? null : slot
}

// A legacy row is recognisable by carrying its own day/time rather than being keyed by them.
const isLegacyRow = value => Boolean(value) && typeof value === 'object' && ('time' in value || 'day' in value)

// Legacy rows have no period number - they were keyed by wall-clock time. Sorting the distinct
// times for the class and numbering them gives a stable grid where the same period number means
// the same time slot on every day, which is what the conflict check needs.
function migrateLegacyClass(rows) {
  const times = [...new Set(rows.map(row => row.time).filter(Boolean))].sort()
  const periodOfTime = new Map(times.map((time, index) => [time, index + 1]))
  const result = {}
  rows.forEach(row => {
    if (!TIMETABLE_DAYS.includes(row.day)) return
    const period = periodOfTime.get(row.time) || 1
    const slot = cleanSlot({
      subject: row.subject,
      // The old field was a free-text label ("NK", "Mr Sharma") with no link to a staff record.
      // Keep it visible as the name and leave teacherId empty so the admin can re-pick the real
      // teacher; blanking it here would silently lose information the school typed in.
      teacherName: row.teacher,
      startTime: row.time,
      room: row.room,
    })
    if (!slot) return
    result[row.day] = result[row.day] || {}
    result[row.day][period] = slot
  })
  return result
}

function normalizeClass(value) {
  if (!value || typeof value !== 'object') return {}
  const entries = Object.values(value)
  const keyedByDay = Object.keys(value).some(key => TIMETABLE_DAYS.includes(key))
  if (!keyedByDay) return migrateLegacyClass(entries.filter(isLegacyRow))

  const result = {}
  TIMETABLE_DAYS.forEach(day => {
    const dayValue = value[day]
    if (!dayValue || typeof dayValue !== 'object') return
    Object.entries(dayValue).forEach(([period, raw]) => {
      const periodNumber = Number(period)
      if (!Number.isInteger(periodNumber) || periodNumber < 1) return
      const slot = cleanSlot(raw)
      if (!slot) return
      result[day] = result[day] || {}
      result[day][periodNumber] = slot
    })
  })
  return result
}

// Returns { [className]: { [day]: { [periodNumber]: slot } } } for either storage shape.
export function normalizeTimetable(raw) {
  if (!raw || typeof raw !== 'object') return {}
  return Object.fromEntries(
    Object.entries(raw)
      .map(([className, value]) => [className, normalizeClass(value)])
      .filter(([, days]) => Object.keys(days).length > 0),
  )
}

// True when the stored class still uses the legacy array shape, so the caller knows it has to
// rewrite the whole class node instead of patching a single slot.
export function isLegacyClass(raw, className) {
  const value = raw?.[className]
  if (!value || typeof value !== 'object') return false
  return !Object.keys(value).some(key => TIMETABLE_DAYS.includes(key))
}

export function getSlot(timetable, className, day, period) {
  return timetable?.[className]?.[day]?.[period] || null
}

// The one rule that makes a timetable valid: a teacher cannot stand in two rooms at once.
// Scans the already-loaded timetable - no extra read - and returns the clashing class, or null.
export function findTeacherConflict(timetable, { className, day, period, teacherId }) {
  if (!teacherId) return null
  for (const [otherClass, days] of Object.entries(timetable || {})) {
    if (otherClass === className) continue
    const slot = days?.[day]?.[period]
    if (slot && slot.teacherId === teacherId) return { className: otherClass, slot }
  }
  return null
}

// Every period this teacher teaches, across all classes, as { [day]: { [period]: slot+className } }.
export function teacherSchedule(timetable, teacherId) {
  const result = {}
  if (!teacherId) return result
  Object.entries(timetable || {}).forEach(([className, days]) => {
    Object.entries(days || {}).forEach(([day, periods]) => {
      Object.entries(periods || {}).forEach(([period, slot]) => {
        if (slot?.teacherId !== teacherId) return
        result[day] = result[day] || {}
        result[day][Number(period)] = { ...slot, className }
      })
    })
  })
  return result
}

// Periods per week per teacher, for spotting overload and free staff. Slots whose teacher was
// never linked to a staff record (legacy free-text names) are grouped under a null id so they
// still show up as work that needs reassigning rather than vanishing from the totals.
export function teacherWorkload(timetable) {
  const totals = new Map()
  Object.entries(timetable || {}).forEach(([className, days]) => {
    Object.values(days || {}).forEach(periods => {
      Object.values(periods || {}).forEach(slot => {
        if (!slot || (!slot.teacherId && !slot.teacherName)) return
        const key = slot.teacherId || `name:${slot.teacherName}`
        const entry = totals.get(key) || {
          teacherId: slot.teacherId || '',
          teacherName: slot.teacherName || 'Unassigned',
          linked: Boolean(slot.teacherId),
          periods: 0,
          classes: new Set(),
        }
        entry.periods += 1
        entry.classes.add(className)
        if (slot.teacherName) entry.teacherName = slot.teacherName
        totals.set(key, entry)
      })
    })
  })
  return [...totals.values()]
    .map(entry => ({ ...entry, classes: [...entry.classes].sort() }))
    .sort((a, b) => b.periods - a.periods || a.teacherName.localeCompare(b.teacherName))
}

// Staff who can actually be assigned. Only accounts with a teacher login are offered: the
// teacher's own timetable view is scoped by auth uid, so assigning someone without a login
// would produce a schedule they could never open.
export function assignableTeachers(teachers) {
  return Object.entries(teachers || {})
    .map(([uid, record]) => {
      const name = record?.name
        || [record?.firstName, record?.lastName].filter(Boolean).join(' ').trim()
        || record?.email
        || ''
      return { id: record?.uid || uid, name, email: record?.email || '', isActive: record?.isActive !== false }
    })
    .filter(teacher => teacher.id && teacher.name && teacher.isActive)
    .sort((a, b) => a.name.localeCompare(b.name))
}

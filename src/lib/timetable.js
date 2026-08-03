/**
 * timetable — timetable ka saara sochne wala hissa, bina database ke.
 *
 * Yahan koi Supabase call nahi hai. Grid banana, clash dhoondhna, teacher ka
 * hafta nikalna, period ki timing jaanchna — sab yahin, taaki inhe seedhe test
 * kiya ja sake aur UI sirf dikhane ka kaam kare.
 *
 * Do shapes aati hain, dono seedhe database ki row hain:
 *   period = { id, period_number, start_time, end_time, is_break, label }
 *   slot   = { id, class_name, section, day_of_week, period_id, subject,
 *              teacher_id, teacher_name, room }
 */

// day_of_week database me 1..6 hai (1 = Monday). Number isliye ki din ka kram
// khud number me chhupa hai — naam se sort karne par Friday pehle aa jaata.
export const TIMETABLE_DAYS = [
  { value: 1, name: 'Monday', short: 'Mon' },
  { value: 2, name: 'Tuesday', short: 'Tue' },
  { value: 3, name: 'Wednesday', short: 'Wed' },
  { value: 4, name: 'Thursday', short: 'Thu' },
  { value: 5, name: 'Friday', short: 'Fri' },
  { value: 6, name: 'Saturday', short: 'Sat' },
]

const DAY_BY_VALUE = new Map(TIMETABLE_DAYS.map(day => [day.value, day]))

export const dayName = value => DAY_BY_VALUE.get(Number(value))?.name || ''
export const dayShort = value => DAY_BY_VALUE.get(Number(value))?.short || ''

/* ------------------------------------------------------------------ */
/* time                                                                */
/* ------------------------------------------------------------------ */

// Postgres `time` "09:00:00" ke roop me aata hai, aur <input type="time">
// "09:00" deta hai. Dono ko ek hi tarah padhna hai.
const parseTime = value => {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value || '').trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

/** Minutes se wapas "HH:MM" — <input type="time"> isi shakal me maangta hai. */
export const toInputTime = value => {
  const minutes = parseTime(value)
  if (minutes === null) return ''
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

/** "09:00:00" -> "9:00 AM". Print aur teacher view dono isi shakal me dikhate hain. */
export function formatTime(value) {
  const minutes = parseTime(value)
  if (minutes === null) return ''
  const hours24 = Math.floor(minutes / 60)
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12
  return `${hours12}:${String(minutes % 60).padStart(2, '0')} ${hours24 < 12 ? 'AM' : 'PM'}`
}

/** "9:00 - 9:45 AM" nahi, dono taraf poora — 12:00 ke aas-paas AM/PM badalta hai. */
export const formatRange = (start, end) => {
  const from = formatTime(start)
  const to = formatTime(end)
  return from && to ? `${from} - ${to}` : from || to || ''
}

/** Grid ki pehli column: "Period 1 (9:00 AM - 9:45 AM)". */
export function periodLabel(period) {
  if (!period) return ''
  const name = period.label?.trim() || (period.is_break ? 'Break' : `Period ${period.period_number}`)
  const range = formatRange(period.start_time, period.end_time)
  return range ? `${name} (${range})` : name
}

/* ------------------------------------------------------------------ */
/* periods                                                             */
/* ------------------------------------------------------------------ */

/** Hamesha ghadi ke hisaab se, period_number se nahi — number galat kram me ho sakta hai. */
export const sortPeriods = periods =>
  [...(periods || [])].sort((a, b) => {
    const diff = (parseTime(a.start_time) ?? 0) - (parseTime(b.start_time) ?? 0)
    return diff || Number(a.period_number || 0) - Number(b.period_number || 0)
  })

/**
 * Period Settings save karne se pehle ki jaanch.
 *
 * Database do cheezein pehle se rokta hai: duplicate period_number, aur ulta
 * time. Jo wo nahi rok sakta wo hai **overlap** — Period 1 = 9:00-9:45 aur
 * Period 2 = 9:30-10:15 dono alag-alag row ke naate bilkul valid hain, par ek
 * saath ho hi nahi sakte. Isliye ye jaanch yahan hai.
 *
 * Lauta hua array me har entry { index, message } hai — form usi row par
 * error dikha deta hai.
 */
export function validatePeriods(periods) {
  const rows = periods || []
  const errors = []
  const seenNumbers = new Map()

  rows.forEach((period, index) => {
    const number = Number(period.period_number)
    const start = parseTime(period.start_time)
    const end = parseTime(period.end_time)

    if (!Number.isInteger(number) || number < 1) {
      errors.push({ index, message: 'Period number must be 1 or higher.' })
    } else if (seenNumbers.has(number)) {
      errors.push({ index, message: `Period ${number} already exists (row ${seenNumbers.get(number) + 1}).` })
    } else {
      seenNumbers.set(number, index)
    }

    if (start === null) errors.push({ index, message: 'Enter a start time.' })
    if (end === null) errors.push({ index, message: 'Enter an end time.' })
    if (start !== null && end !== null && end <= start) {
      errors.push({ index, message: 'End time must be after the start time.' })
    }
  })

  // Overlap: sorted list me har period apne se pehle wale ke khatam hone ke
  // baad hi shuru ho sakta hai. Gap chalega (recess), overlap nahi.
  const timed = rows
    .map((period, index) => ({ index, period, start: parseTime(period.start_time), end: parseTime(period.end_time) }))
    .filter(row => row.start !== null && row.end !== null && row.end > row.start)
    .sort((a, b) => a.start - b.start)

  for (let i = 1; i < timed.length; i += 1) {
    const previous = timed[i - 1]
    const current = timed[i]
    if (current.start < previous.end) {
      errors.push({
        index: current.index,
        message: `This period overlaps "${periodLabel(previous.period)}".`,
      })
    }
  }

  return errors
}

/* ------------------------------------------------------------------ */
/* grid                                                                */
/* ------------------------------------------------------------------ */

/**
 * Ek class-section ke slots ko grid me badalta hai: grid[periodId][day] = slot.
 * Builder aur read-only view dono yahi padhte hain, isliye dono hamesha ek
 * jaisa dikhte hain.
 */
export function buildGrid(slots) {
  const grid = {}
  for (const slot of slots || []) {
    if (!slot?.period_id) continue
    const day = Number(slot.day_of_week)
    if (!DAY_BY_VALUE.has(day)) continue
    grid[slot.period_id] = grid[slot.period_id] || {}
    grid[slot.period_id][day] = slot
  }
  return grid
}

export const isEmptySlot = slot => !slot?.subject?.trim() && !slot?.teacher_id && !slot?.teacher_name?.trim()

/** "10-A" — class aur section poore app me isi tarah joda jaata hai. */
export const classKey = (className, section) => `${className || ''}-${section || ''}`

/* ------------------------------------------------------------------ */
/* clash                                                               */
/* ------------------------------------------------------------------ */

/**
 * Ek teacher ek waqt par ek hi jagah ho sakta hai.
 *
 * Ye jaanch school bhar ke us din+period ke slots par chalti hai (sirf us
 * class ke nahi), isliye caller ko wahi slots dene hote hain. Asli rok
 * database ke partial unique index par hai — ye sirf save se pehle saaf
 * warning dikhane ke liye hai, taaki admin ko Postgres ka error na dekhna pade.
 *
 * Lautata hai clashing slot, ya null.
 */
export function findTeacherClash(slots, { className, section, day, periodId, teacherId }) {
  if (!teacherId) return null
  const key = classKey(className, section)
  for (const slot of slots || []) {
    if (slot.teacher_id !== teacherId) continue
    if (Number(slot.day_of_week) !== Number(day)) continue
    if (slot.period_id !== periodId) continue
    // Wahi cell dobara save karna clash nahi hai.
    if (classKey(slot.class_name, slot.section) === key) continue
    return slot
  }
  return null
}

/** Poore grid ki ek saath jaanch — save button dabane par sab clash ek baar me. */
export function findAllClashes(pendingSlots, existingSlots, { className, section }) {
  const key = classKey(className, section)
  // Us class ke purane slots hata do: unki jagah yahi naye slots aa rahe hain.
  const others = (existingSlots || []).filter(slot => classKey(slot.class_name, slot.section) !== key)
  const clashes = []
  // Naye slots aapas me bhi takra sakte hain, isliye jaanche hue slots bhi
  // aage ki jaanch me shaamil karte jaate hain.
  const pool = [...others]
  for (const slot of pendingSlots || []) {
    if (isEmptySlot(slot) || !slot.teacher_id) { pool.push(slot); continue }
    // Slot ki apni class dekhni hai, builder ki nahi. Builder wali bhejne par
    // pending slots ka classKey hamesha match kar jaata aur findTeacherClash
    // unhe "apni hi cell" samajh kar chhod deta — do sections ko ek hi teacher
    // ek waqt par de dena chup-chaap nikal jaata.
    const clash = findTeacherClash(pool, {
      className: slot.class_name, section: slot.section,
      day: slot.day_of_week, periodId: slot.period_id, teacherId: slot.teacher_id,
    })
    if (clash) clashes.push({ slot, clash })
    pool.push(slot)
  }
  return clashes
}

/* ------------------------------------------------------------------ */
/* teacher views                                                       */
/* ------------------------------------------------------------------ */

/**
 * Ek teacher ka poora hafta, din aur time ke kram me — "Monday 9:00 AM,
 * Class 10-A, Maths" wali list isi se banti hai.
 *
 * periods ki zarurat time ke liye hai: slot me sirf period_id hota hai.
 */
export function teacherWeek(slots, periods, teacherId) {
  if (!teacherId) return []
  const periodById = new Map((periods || []).map(period => [period.id, period]))
  return (slots || [])
    .filter(slot => slot.teacher_id === teacherId)
    .map(slot => {
      const period = periodById.get(slot.period_id) || null
      return {
        slot,
        period,
        day: Number(slot.day_of_week),
        dayName: dayName(slot.day_of_week),
        time: period ? formatRange(period.start_time, period.end_time) : '',
        className: classKey(slot.class_name, slot.section),
      }
    })
    .sort((a, b) =>
      a.day - b.day
      || (parseTime(a.period?.start_time) ?? 0) - (parseTime(b.period?.start_time) ?? 0)
      || Number(a.period?.period_number || 0) - Number(b.period?.period_number || 0))
}

/**
 * Hafte me kis teacher ke kitne period — overload aur khaali staff dono
 * dikhane ke liye. Jin slots ka teacher kabhi staff record se juda hi nahi
 * (sirf naam pada hai) unhe alag se ginte hain, warna wo kaam totals se gayab
 * ho jaata aur kisi ko pata hi nahi chalta ki use reassign karna hai.
 */
export function teacherWorkload(slots) {
  const totals = new Map()
  for (const slot of slots || []) {
    if (isEmptySlot(slot)) continue
    if (!slot.teacher_id && !slot.teacher_name?.trim()) continue
    const key = slot.teacher_id || `name:${slot.teacher_name.trim()}`
    const entry = totals.get(key) || {
      teacherId: slot.teacher_id || '',
      teacherName: slot.teacher_name?.trim() || 'Unassigned',
      linked: Boolean(slot.teacher_id),
      periods: 0,
      classes: new Set(),
    }
    entry.periods += 1
    entry.classes.add(classKey(slot.class_name, slot.section))
    if (slot.teacher_name?.trim()) entry.teacherName = slot.teacher_name.trim()
    totals.set(key, entry)
  }
  return [...totals.values()]
    .map(entry => ({ ...entry, classes: [...entry.classes].sort() }))
    .sort((a, b) => b.periods - a.periods || a.teacherName.localeCompare(b.teacherName))
}

/**
 * Wo staff jinhe timetable me lagaya ja sakta hai.
 *
 * `staff` node ke record me naam kai shakal me pada hai (name / full_name /
 * firstName+lastName), isliye teeno dekhe jaate hain — ek hi par bharosa karne
 * se aadhe teacher dropdown se gayab ho jaate hain.
 */
export function assignableTeachers(staff) {
  const records = Array.isArray(staff) ? staff : Object.entries(staff || {}).map(([id, r]) => ({ id, ...r }))
  return records
    .map(record => {
      const name = record.name
        || record.full_name
        || [record.firstName || record.first_name, record.lastName || record.last_name].filter(Boolean).join(' ').trim()
        || record.email
        || ''
      return {
        id: record.id || record.uid || '',
        name: name.trim(),
        subject: record.subject || '',
        active: record.active !== false && record.isActive !== false,
      }
    })
    .filter(teacher => teacher.id && teacher.name && teacher.active)
    .sort((a, b) => a.name.localeCompare(b.name))
}

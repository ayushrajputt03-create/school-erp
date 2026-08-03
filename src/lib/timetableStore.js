/**
 * timetableStore — timetable ka database wala hissa.
 *
 * Ye jaan-boojh kar dataAdapter/nodeMap se bahar hai. Adapter ka subscribe kisi
 * ek row ke badalne par poora node dobara padhta hai; timetable me 16 class ×
 * 5 section × 6 din × 8 period = ~3,840 rows ban sakti hain, aur har khule tab
 * ko apna refetch milta. Yahan har query pehle se scoped hai — ek class ka
 * hafta ~48 rows, ek teacher ka hafta ~30 rows.
 *
 * Isi wajah se yahan realtime listener bhi nahi hai. Timetable saal me ek-do
 * baar banta hai, minute-minute par nahi badalta; jo screen use dekh rahi hai
 * wahi zarurat padne par dobara load kar leti hai.
 */

import { supabase } from './supabaseClient.js'
import { schoolUuid } from './dataAdapter.js'
import { sortPeriods } from './timetable.js'

// Slot ki har wo field jo UI padhta hai. `*` maangne ka koi faayda nahi —
// created_at/updated_at kabhi dikhaye nahi jaate aur har row par bekaar jaate.
const SLOT_COLUMNS = 'id, class_name, section, day_of_week, period_id, subject, teacher_id, teacher_name, room'
const PERIOD_COLUMNS = 'id, period_number, start_time, end_time, is_break, label'

const fail = (error, what) => { throw new Error(friendlyError(error, what)) }

/**
 * Nayi row ka id yahan banta hai, database me nahi.
 *
 * upsert par PostgREST saari rows ko ek jaisa column set deta hai: ek row me
 * bhi `id` hua to jinme nahi hai unme `id: null` chala jaata hai, aur wo
 * not-null constraint todta hai. Yaani "id sirf purani rows me bhejo" wala
 * tareeka kaam karta hi nahi — naya period/slot kabhi save nahi hota.
 * Har row ko pehle se id de dene par ye sawal hi khatam.
 */
const newId = () => crypto.randomUUID()

/**
 * Postgres ka kaccha error admin ke kisi kaam ka nahi. Do maamle aam hain, aur
 * dono ka matlab saaf hai — wahi bata dete hain.
 */
function friendlyError(error, what) {
  const code = error?.code
  // 23505 = unique_violation. timetable par do unique niyam hain, aur constraint
  // ke naam se pata chal jaata hai kaun sa toota.
  if (code === '23505') {
    if (String(error.message).includes('teacher_clash')) {
      return 'This teacher is already assigned to another class in the same period on the same day. Remove that assignment first, or pick a different teacher.'
    }
    if (String(error.message).includes('class_slot')) {
      return 'This class-section already has a subject in this period.'
    }
    if (String(error.message).includes('periods_school_number')) {
      return 'That period number already exists.'
    }
  }
  // 23514 = check_violation — sirf ulta time ya galat din se aa sakta hai.
  if (code === '23514') return 'Invalid time or day. End time must be after the start time.'
  return error?.message || `${what} failed.`
}

/* ------------------------------------------------------------------ */
/* periods                                                             */
/* ------------------------------------------------------------------ */

/** School ke saare periods, ghadi ke kram me. */
export async function loadPeriods(schoolLegacyId) {
  const school = await schoolUuid(schoolLegacyId)
  if (!school) return []
  const { data, error } = await supabase
    .from('periods').select(PERIOD_COLUMNS).eq('school_id', school)
  if (error) fail(error, 'Loading periods')
  return sortPeriods(data || [])
}

/**
 * Period Settings ka save.
 *
 * Poori list ek saath aati hai (form me jo rows dikh rahi hain, wahi sach hai),
 * isliye jo rows form se hata di gayi hain unhe database se bhi hataana padta
 * hai. Delete pehle chalta hai: agar admin ne period 3 ka number 2 kar diya aur
 * purana 2 hata diya, to pehle upsert karne par unique (school, number) tak ra
 * jaata.
 *
 * Period delete karne par uske slots bhi jaate hain (FK par ON DELETE CASCADE)
 * — isliye caller ko pehle bata dena chahiye ki kitne slots ud jaayenge.
 */
export async function savePeriods(schoolLegacyId, rows) {
  const school = await schoolUuid(schoolLegacyId)
  if (!school) throw new Error('School not found.')

  const keep = (rows || []).filter(row => row.id).map(row => row.id)
  let removal = supabase.from('periods').delete().eq('school_id', school)
  // .not('id','in',()) khaali list par galat SQL banata hai, isliye tabhi lagate
  // hain jab sach me kuch bachaana ho.
  if (keep.length) removal = removal.not('id', 'in', `(${keep.join(',')})`)
  const { error: deleteError } = await removal
  if (deleteError) fail(deleteError, 'Removing old periods')

  if (!rows?.length) return []

  const payload = rows.map(row => ({
    id: row.id || newId(),
    school_id: school,
    period_number: Number(row.period_number),
    start_time: row.start_time,
    end_time: row.end_time,
    is_break: Boolean(row.is_break),
    label: row.label?.trim() || null,
  }))

  const { data, error } = await supabase
    .from('periods').upsert(payload, { onConflict: 'id' }).select(PERIOD_COLUMNS)
  if (error) fail(error, 'Saving periods')
  return sortPeriods(data || [])
}

/**
 * In periods par kitne slots tike hue hain.
 *
 * Period hataane par uske saare slots FK cascade se chup-chaap ud jaate hain.
 * Admin ko pehle dikhna chahiye ki kitna kaam ja raha hai — "Period 4 hataane
 * par 37 slots bhi jaayenge" — warna ek galat click se poora hafta saaf.
 * Rows nahi, sirf ginti aati hai (head: true), isliye ye lagbhag muft hai.
 */
export async function countSlotsForPeriods(schoolLegacyId, periodIds) {
  const ids = [...new Set((periodIds || []).filter(Boolean))]
  if (!ids.length) return 0
  const school = await schoolUuid(schoolLegacyId)
  if (!school) return 0
  const { count, error } = await supabase
    .from('timetable_slots').select('id', { count: 'exact', head: true })
    .eq('school_id', school).in('period_id', ids)
  if (error) fail(error, 'Counting slots')
  return count || 0
}

/* ------------------------------------------------------------------ */
/* teachers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Dropdown ke liye teachers — seedhe `staff` table se, App ke staff node se
 * nahi.
 *
 * Wajah: timetable_slots.teacher_id staff ka **uuid** hai, par poore app me
 * staff apne purane RTDB id (legacy_id) se keyed hai. App wala node deta to
 * har save par legacy_id ko uuid me badalna padta, aur ek bhi jagah bhoolne
 * par FK chup-chaap NULL ho jaata. Yahan se uuid hi seedha aata hai.
 *
 * legacy_id bhi saath aata hai kyunki teacher ka apna portal usi se khud ko
 * pehchanta hai.
 */
export async function loadTeachers(schoolLegacyId) {
  const school = await schoolUuid(schoolLegacyId)
  if (!school) return []
  const { data, error } = await supabase
    .from('staff').select('id, legacy_id, full_name, first_name, last_name, subject')
    .eq('school_id', school).eq('active', true)
  if (error) fail(error, 'Loading teachers')
  return (data || [])
    .map(row => ({
      id: row.id,
      legacyId: row.legacy_id,
      name: (row.full_name || [row.first_name, row.last_name].filter(Boolean).join(' ')).trim(),
      subject: row.subject || '',
    }))
    .filter(teacher => teacher.name)
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Teacher portal ke purane uid (legacy_id) se uska uuid. */
export async function staffUuidOf(schoolLegacyId, staffLegacyId) {
  if (!staffLegacyId) return null
  const school = await schoolUuid(schoolLegacyId)
  if (!school) return null
  const { data } = await supabase
    .from('staff').select('id').eq('school_id', school).eq('legacy_id', staffLegacyId).maybeSingle()
  return data?.id || null
}

/* ------------------------------------------------------------------ */
/* slots — padhna                                                      */
/* ------------------------------------------------------------------ */

/** Ek class-section ka poora hafta. ~48 rows. */
export async function loadClassTimetable(schoolLegacyId, className, section) {
  const school = await schoolUuid(schoolLegacyId)
  if (!school || !className || !section) return []
  const { data, error } = await supabase
    .from('timetable_slots').select(SLOT_COLUMNS)
    .eq('school_id', school).eq('class_name', className).eq('section', section)
  if (error) fail(error, 'Loading timetable')
  return data || []
}

/** Ek teacher ka poora hafta, saari classes milaakar. ~30 rows. */
export async function loadTeacherTimetable(schoolLegacyId, teacherId) {
  const school = await schoolUuid(schoolLegacyId)
  if (!school || !teacherId) return []
  const { data, error } = await supabase
    .from('timetable_slots').select(SLOT_COLUMNS)
    .eq('school_id', school).eq('teacher_id', teacherId)
  if (error) fail(error, 'Loading teacher timetable')
  return data || []
}

/**
 * Clash jaanchne ke liye jitna kam se kam data chahiye, utna hi.
 *
 * Poore school ke slots laana yahan sabse seedha hota, par wo ~3,840 rows hai
 * har save par. Sach ye hai ki clash sirf un teachers se ho sakta hai jo is
 * grid me lage hue hain — baaki kisi se takrane ka sawaal hi nahi. Ek class ke
 * grid me 8-12 teacher hote hain, aur har teacher ka poora hafta ~30 rows, to
 * ye query ~300 rows par ruk jaati hai.
 */
export async function loadSlotsForTeachers(schoolLegacyId, teacherIds) {
  const ids = [...new Set((teacherIds || []).filter(Boolean))]
  if (!ids.length) return []
  const school = await schoolUuid(schoolLegacyId)
  if (!school) return []
  const { data, error } = await supabase
    .from('timetable_slots').select(SLOT_COLUMNS)
    .eq('school_id', school).in('teacher_id', ids)
  if (error) fail(error, 'Checking for clashes')
  return data || []
}

/* ------------------------------------------------------------------ */
/* slots — likhna                                                      */
/* ------------------------------------------------------------------ */

/**
 * Ek class-section ka poora grid save karta hai.
 *
 * Purani saari rows delete karke nayi daalne ka tareeka yahan jaan-boojh kar
 * NAHI liya gaya: agar upsert beech me fail ho gaya (jaise teacher clash), to
 * class ka timetable delete ho chuka hota aur naya aaya nahi hota — school ka
 * banaya hua kaam ud jaata. Isliye pehle sirf wahi rows hataayi jaati hain jo
 * sach me khaali ki gayi hain, aur baaki upsert hoti hain. Upsert fail hone par
 * purana data waise ka waisa bacha rehta hai.
 *
 * slots me har entry: { id?, day_of_week, period_id, subject, teacher_id, teacher_name, room }
 */
export async function saveClassTimetable(schoolLegacyId, className, section, slots) {
  const school = await schoolUuid(schoolLegacyId)
  if (!school) throw new Error('School not found.')

  const filled = (slots || []).filter(slot => slot.subject?.trim())
  const keep = filled.filter(slot => slot.id).map(slot => slot.id)

  let removal = supabase.from('timetable_slots').delete()
    .eq('school_id', school).eq('class_name', className).eq('section', section)
  if (keep.length) removal = removal.not('id', 'in', `(${keep.join(',')})`)
  const { error: deleteError } = await removal
  if (deleteError) fail(deleteError, 'Removing old slots')

  if (!filled.length) return []

  const payload = filled.map(slot => ({
    id: slot.id || newId(),
    school_id: school,
    class_name: className,
    section,
    day_of_week: Number(slot.day_of_week),
    period_id: slot.period_id,
    subject: slot.subject.trim(),
    // Khaali string uuid column me nahi jaati — teacher na chuna ho to NULL.
    teacher_id: slot.teacher_id || null,
    // Naam ke saath hi save hota hai taaki staff record hatne par bhi cell
    // khaali na dikhe (schema me isi liye rakha gaya hai).
    teacher_name: slot.teacher_name?.trim() || null,
    room: slot.room?.trim() || null,
  }))

  const { data, error } = await supabase
    .from('timetable_slots').upsert(payload, { onConflict: 'id' }).select(SLOT_COLUMNS)
  if (error) fail(error, 'Saving timetable')
  return data || []
}

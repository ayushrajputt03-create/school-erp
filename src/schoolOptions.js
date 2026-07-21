export const indianStates = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands',
  'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh',
  'Lakshadweep', 'Puducherry',
]

export const recognitionOptions = [
  'Affiliated to CBSE (New Delhi)', 'Affiliated to ICSE/ISC', 'Affiliated to NIOS',
  'Recognised by U.P. Government', 'Recognised by Delhi Government', 'Recognised by Haryana Government',
  'Recognised by Punjab Government', 'Recognised by Rajasthan Government', 'Recognised by Bihar Government',
  'Recognised by M.P. Government', 'Recognised by Maharashtra Government', 'Recognised by Gujarat Government',
  'Recognised by Karnataka Government', 'Recognised by Tamil Nadu Government', 'Recognised by West Bengal Government',
  'Recognised by Andhra Pradesh Government', 'Recognised by Telangana Government', 'Recognised by Kerala Government',
  'Recognised by Assam Government', 'Recognised by Jharkhand Government', 'Recognised by Uttarakhand Government',
  'Recognised by Himachal Pradesh Government', 'Recognised by J&K Government', 'Recognised by Chhattisgarh Government',
  'Recognised by Odisha Government', 'Affiliated to UP Board (UPMSP)', 'Affiliated to Bihar Board (BSEB)',
  'Affiliated to MP Board (MPBSE)', 'Affiliated to Rajasthan Board (RBSE)', 'Affiliated to Haryana Board (HBSE)',
  'Affiliated to Punjab Board (PSEB)', 'Affiliated to Gujarat Board (GSEB)', 'Affiliated to Maharashtra Board (MSBSHSE)',
  'Affiliated to Karnataka Board (KSEEB)', 'Affiliated to Tamil Nadu Board (TNSED)', 'Affiliated to Kerala Board (KBPE)',
  'Affiliated to West Bengal Board (WBBSE)', 'Affiliated to Odisha Board (BSE Odisha)', 'Write Custom...',
]

export const boardOptions = ['CBSE', 'ICSE', 'State Board', 'NIOS', 'Other']
// Single source of truth for class names — order matters (used for sorting everywhere).
export const classOptions = ['Playway', 'Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
// Alias so any module can import the canonical list under a clear name.
export const CLASS_LIST = classOptions
// Streams apply only to senior classes (11 & 12).
export const STREAM_OPTIONS = ['Science', 'Commerce', 'Arts']
export const isSeniorClass = cls => cls === '11' || cls === '12'
export const sectionOptions = ['A', 'B', 'C', 'D', 'E']

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
// Most Indian schools open the session in April, but some start in March. Stored on the
// school profile as a 1-indexed month so the raw database value reads naturally (4 = April).
export const DEFAULT_SESSION_START_MONTH = 4
export const sessionStartMonthOptions = [3, 4, 5, 6]
// Profiles saved before this setting existed have no sessionStartMonth, so they must keep
// behaving exactly as before - April.
export const sessionStartMonthOf = profile => {
  const month = Number(profile?.sessionStartMonth)
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : DEFAULT_SESSION_START_MONTH
}
// The twelve months of a session in order, e.g. April..March or March..February.
export const sessionMonthNames = startMonth => {
  const start = (Number(startMonth) || DEFAULT_SESSION_START_MONTH) - 1
  return Array.from({ length: 12 }, (_, offset) => MONTH_NAMES[(start + offset) % 12])
}
// Generated rather than hardcoded so the list never runs out and always contains whatever
// session a school already has saved. Covers the previous sessions too, which the session
// switcher needs in order to look back.
export const academicYearsAround = (year = new Date().getFullYear(), back = 5, forward = 5) =>
  Array.from({ length: back + forward + 1 }, (_, index) => {
    const start = year - back + index
    return `${start}-${String(start + 1).slice(-2)}`
  })
export const academicYears = academicYearsAround()
export const feeGroups = ['Regular', 'RTE', 'EWS', 'DG', 'Staff Ward', 'Sibling', 'Scholarship', 'No Fee', 'Custom']

export const generateSchoolCode = schoolName => {
  const words = String(schoolName || '').trim().split(/\s+/).filter(Boolean)
  let prefix = 'SCHOOL'
  if (words.length >= 2) {
    prefix = words.slice(0, 2).map(word => word.substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, '')).join('')
  } else if (words[0]) {
    prefix = words[0].substring(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, '')
  }
  const suffix = Math.floor(Math.random() * 900) + 100
  return `${prefix || 'SCH'}${suffix}`
}

export const ageOnDate = (dob, target = '2026-03-31') => {
  if (!dob) return ''
  const birth = new Date(`${dob}T00:00:00`)
  const asOn = new Date(`${target}T00:00:00`)
  if (Number.isNaN(birth.getTime())) return ''
  let years = asOn.getFullYear() - birth.getFullYear()
  let months = asOn.getMonth() - birth.getMonth()
  if (asOn.getDate() < birth.getDate()) months -= 1
  if (months < 0) { years -= 1; months += 12 }
  return `${Math.max(0, years)} Years ${Math.max(0, months)} Months`
}

export const formatAadhaar = value => String(value || '').replace(/\D/g, '').slice(0, 12).replace(/(\d{4})(?=\d)/g, '$1 ').trim()
export const onlyDigits = (value, max) => String(value || '').replace(/\D/g, '').slice(0, max)

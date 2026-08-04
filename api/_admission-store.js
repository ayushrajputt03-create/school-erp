// ============================================================
// _admission-store.js — public admission form ka data layer
//
// _parent-store.js / _staff-store.js jaisa hi bantwara: niyam admission.js me
// rehte hain (honeypot, validation, throttle ki ginti, pending ki limit) aur
// raaste yahan. admission.js ko ye jaanne ki zarurat nahi ki neeche Firebase
// hai ya Supabase.
//
// Ye file isliye bani ki cutover me `api/admission.js` chhoot gaya tha. Wo
// seedha firebase-admin use kar raha tha, to public form ki har nayi request
// FIREBASE me ja rahi thi jabki admin ka "Admission Requests" Supabase se
// padhta hai — request submit hoti thi, receipt bhi milti thi, par kabhi
// dikhti nahi thi. Kuch kho nahi raha tha, galat database me ja raha tha.
//
// Ek zaroori baat Supabase wale raaste ke liye: admin app in rows ko adapter se
// padhta hai, aur `admissionRequests` node ka koi `fill` nahi hai — yaani poora
// document `source` jsonb se banta hai. Isliye typed column ke SAATH `source`
// me poora RTDB-shaped record likhna zaroori hai, warna admin ko khaali row
// dikhegi.
//
// USE_SUPABASE=false karte hi sab wapas Firebase par.
// ============================================================

const useSupabase = String(process.env.USE_SUPABASE ?? process.env.VITE_USE_SUPABASE ?? '') === 'true'

/* ------------------------------------------------------------------ */
/* Firebase (rollback ka raasta)                                       */
/* ------------------------------------------------------------------ */

function firebaseStore() {
  const { getApps, getApp, initializeApp, cert } = require('firebase-admin/app')
  const { getDatabase } = require('firebase-admin/database')

  const app = (() => {
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
  })()

  const database = getDatabase(app)
  const read = async path => (await database.ref(path).once('value')).val()

  return {
    backend: 'firebase',

    async schoolIdentity(schoolId) {
      const [schoolName, logoURL, logo, status] = await Promise.all([
        read(`schools/${schoolId}/profile/schoolName`),
        read(`schools/${schoolId}/profile/logoURL`),
        read(`schools/${schoolId}/profile/logo`),
        read(`schools/${schoolId}/subscription/status`),
      ])
      if (!schoolName) return null
      const state = String(status || 'trial').toLowerCase()
      return {
        schoolName,
        logo: logoURL || logo || '',
        open: state !== 'suspended' && state !== 'cancelled',
      }
    },

    async throttleFor(schoolId, phone) {
      return (await read(`schools/${schoolId}/admissionThrottle/${phone}`)) || {}
    },

    async saveThrottle(schoolId, phone, value) {
      await database.ref(`schools/${schoolId}/admissionThrottle/${phone}`).set(value)
    },

    async pendingCount(schoolId) {
      const snap = await database.ref(`schools/${schoolId}/admissionRequests`)
        .orderByChild('status').equalTo('pending').once('value')
      return Object.keys(snap.val() || {}).length
    },

    async createRequest(schoolId, id, doc) {
      await database.ref(`schools/${schoolId}/admissionRequests/${id}`).set(doc)
    },
  }
}

/* ------------------------------------------------------------------ */
/* Supabase (aaj ka live raasta)                                       */
/* ------------------------------------------------------------------ */

function supabaseStore() {
  const { createClient } = require('@supabase/supabase-js')
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Server config missing: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set.')

  // service-role, isliye RLS lagti nahi. Public form ke liye yahi chahiye —
  // aane wala parent logged in nahi hota, aur `admission_requests` ki saari
  // policies sirf `authenticated` ke liye hain. Authz is handler ka apna kaam
  // hai: sirf ek pending request banti hai, aur kuch padha nahi jaata.
  const db = createClient(url, key, { auth: { persistSession: false } })

  const uuidCache = new Map()
  const schoolUuid = async legacyId => {
    if (uuidCache.has(legacyId)) return uuidCache.get(legacyId)
    const { data } = await db.from('schools').select('id').eq('legacy_id', legacyId).maybeSingle()
    const id = data?.id ?? null
    if (id) uuidCache.set(legacyId, id)
    return id
  }

  return {
    backend: 'supabase',

    async schoolIdentity(schoolLegacyId) {
      const { data: school } = await db.from('schools')
        .select('id, name, logo_url, source').eq('legacy_id', schoolLegacyId).maybeSingle()
      if (!school) return null

      const profile = school.source?.profile || school.source || {}
      const schoolName = school.name || profile.schoolName
      if (!schoolName) return null

      const { data: subscription } = await db.from('subscriptions')
        .select('status').eq('school_id', school.id).maybeSingle()
      const state = String(subscription?.status || 'trial').toLowerCase()

      return {
        schoolName,
        logo: school.logo_url || profile.logoURL || profile.logo || '',
        open: state !== 'suspended' && state !== 'cancelled',
      }
    },

    async throttleFor(schoolLegacyId, phone) {
      const id = await schoolUuid(schoolLegacyId)
      if (!id) return {}
      const { data } = await db.from('kv').select('value')
        .eq('school_id', id).eq('path', 'admissionThrottle').maybeSingle()
      return data?.value?.[phone] || {}
    },

    async saveThrottle(schoolLegacyId, phone, value) {
      const id = await schoolUuid(schoolLegacyId)
      if (!id) return
      // Poora node padh-badal ke likhna yahan galat hota: ek hi kv row me har
      // phone ka throttle hai, aur do parent ek saath apply karein to ek dusre
      // ka record mit jaata. kv_deep_set sirf apni key badalta hai.
      const { error } = await db.rpc('kv_deep_set', {
        p_school: id, p_path: 'admissionThrottle', p_keys: [phone], p_value: value,
      })
      if (error) throw new Error(error.message)
    },

    async pendingCount(schoolLegacyId) {
      const id = await schoolUuid(schoolLegacyId)
      if (!id) return 0
      const { count, error } = await db.from('admission_requests')
        .select('legacy_id', { count: 'exact', head: true })
        .eq('school_id', id).eq('status', 'pending')
      if (error) throw new Error(error.message)
      return count || 0
    },

    async createRequest(schoolLegacyId, id, doc) {
      const school = await schoolUuid(schoolLegacyId)
      if (!school) throw new Error('This admission link is not valid.')

      const { error } = await db.from('admission_requests').insert({
        school_id: school,
        legacy_id: id,
        // `source` hi asli document hai — admin app isi se poori row banata hai
        // (admissionRequests node ka koi fill nahi hai). Typed column sirf
        // query/RLS/index ke liye hain.
        source: doc,
        student_name: doc.studentName,
        class_applied_for: doc.classAppliedFor,
        dob: doc.dob,
        gender: doc.gender || null,
        father_name: doc.fatherName || null,
        mother_name: doc.motherName || null,
        parent_phone: doc.parentPhone,
        parent_email: doc.parentEmail || null,
        address: doc.address || null,
        previous_school: doc.previousSchool || null,
        status: 'pending',
      })
      if (error) throw new Error(error.message)
    },
  }
}

function createStore() {
  return useSupabase ? supabaseStore() : firebaseStore()
}

module.exports = { createStore, useSupabase }

/**
 * dataAdapter — Firebase RTDB jaisa interface, Supabase Postgres ke upar.
 *
 * App me 168 jagah `databaseRequest(path, token)` chalta hai aur 15 jagah
 * `listen(path, handler)`. Un sabko badalne ke bajaye yahan wahi teen function
 * dobara likhe gaye hain. Call sites jaise hain waise rehte hain.
 *
 * Har table me `source` jsonb hai jisme poora RTDB record pada hai — usi ko
 * document maana jaata hai. Typed columns (class_name, date, status...) sirf
 * index, query aur RLS ke liye hain, aur har write pe dobara bhar diye jaate hain.
 *
 * Kuch bhi bigad jaye to VITE_USE_SUPABASE=false karke deploy kar do —
 * app turant Firebase pe wapas chala jayega.
 */

// Extension jaan-boojh kar likhi hai — Vite ke bina Node me bhi ye module
// chalta hai, taaki adapter browser ke bahar test ho sake.
import { supabase } from './supabaseClient.js'
import { NODES, SUB_NODES, isKvNode } from './nodeMap.js'

/* ------------------------------------------------------------------ */
/* school legacy id -> uuid                                            */
/* ------------------------------------------------------------------ */

const schoolCache = new Map()

// timetableStore isi cache ko dobara istemal karta hai — apni alag lookup
// likhne par har module school ka uuid alag se poochta aur ek hi baat ke liye
// baar-baar query jaati.
export async function schoolUuid(legacyId) {
  if (!legacyId) return null
  if (schoolCache.has(legacyId)) return schoolCache.get(legacyId)
  const { data, error } = await supabase.from('schools').select('id').eq('legacy_id', legacyId).maybeSingle()
  if (error) throw new Error(error.message)
  const id = data?.id ?? null
  if (id) schoolCache.set(legacyId, id)
  return id
}

const studentCache = new Map()

// Ulti disha: uuid -> legacy_id. Realtime payload me student ka sirf uuid aata
// hai (join wahan hota hi nahi), par attendance ki key legacy id se banti hai.
const studentLegacyCache = new Map()

async function studentUuid(schoolId, legacyId) {
  if (!schoolId || !legacyId) return null
  const cacheKey = `${schoolId}/${legacyId}`
  if (studentCache.has(cacheKey)) return studentCache.get(cacheKey)
  const { data } = await supabase
    .from('students').select('id').eq('school_id', schoolId).eq('legacy_id', legacyId).maybeSingle()
  const id = data?.id ?? null
  if (id) { studentCache.set(cacheKey, id); studentLegacyCache.set(id, legacyId) }
  return id
}

/**
 * uuid se legacy id. Ek row ki query hai, aur cache ho jaati hai — poore node
 * ko dobara padhne se ye har haal me sasta hai.
 */
async function studentLegacyId(uuid) {
  if (!uuid) return null
  if (studentLegacyCache.has(uuid)) return studentLegacyCache.get(uuid)
  const { data } = await supabase.from('students').select('legacy_id').eq('id', uuid).maybeSingle()
  const legacy = data?.legacy_id ?? null
  if (legacy) studentLegacyCache.set(uuid, legacy)
  return legacy
}

/* ------------------------------------------------------------------ */
/* student-photos: private bucket -> signed URL                        */
/* ------------------------------------------------------------------ */

// `school-assets` public hai (logo, seal, signature) — uska path seedha
// <img src> ban jaata hai. Par `student-photos` PRIVATE hai, isliye bachche ki
// photo ka bare path browser me bekaar hai. Signed URL banana padta hai, wahi
// jo parent portal server-side banata hai (api/_parent-store.js).
const PHOTO_TTL_SECONDS = 60 * 60

// Cache TTL se 5 minute pehle mar jaata hai, taaki beech-rasta expire hui URL
// kabhi render na ho.
const PHOTO_CACHE_MS = (PHOTO_TTL_SECONDS - 300) * 1000

const photoCache = new Map()

/** paths -> Map(path, signedUrl). Ek hi round trip me poori class sign hoti hai. */
async function signPhotoPaths(paths) {
  const now = Date.now()
  const out = new Map()
  const pending = []

  for (const path of paths) {
    const hit = photoCache.get(path)
    if (hit && hit.expiresAt > now) out.set(path, hit.url)
    else if (!pending.includes(path)) pending.push(path)
  }
  if (!pending.length) return out

  const { data, error } = await supabase.storage
    .from('student-photos')
    .createSignedUrls(pending, PHOTO_TTL_SECONDS)

  // Photo na dikhe to initials fallback chal jaata hai — isliye yahan throw
  // nahi karte, warna ek missing file poori student list gira degi.
  if (error) return out

  for (const row of data || []) {
    if (!row?.path || !row?.signedUrl) continue
    photoCache.set(row.path, { url: row.signedUrl, expiresAt: now + PHOTO_CACHE_MS })
    out.set(row.path, row.signedUrl)
  }
  return out
}

/**
 * Student ki photo bucket me daalta hai aur uska path lautata hai.
 *
 * Ye pehle tha hi nahi — padhne ka raasta bana tha, likhne ka nahi. App
 * `useFirebaseStorage` dekhta hai, jis par `&& !useSupabase` laga hai, to
 * Supabase par wo hamesha false hota tha aur har photo base64 fallback me
 * chali jaati thi. Wo base64 `studentPhotos/{school}/{id}` par likhne ki
 * koshish karta tha, jise adapter mana kar deta hai — yaani Supabase par har
 * student photo ka save toota hua tha.
 *
 * Path wahi rakha gaya hai jo migration ne banaya aur jis par storage ki RLS
 * tiki hui hai: pehla folder school ka uuid hona chahiye, warna insert policy
 * rok degi.
 *
 * Signed URL lauta to diya jaata hai (turant dikhane ke liye) par use kabhi
 * students.photo_url me mat likhna — wo ek ghante me mar jaata hai. Column me
 * sirf photo_path jaata hai; padhte waqt har baar naya sign hota hai.
 */
export async function uploadStudentPhoto(schoolLegacyId, studentLegacyId, file) {
  const schoolId = await schoolUuid(schoolLegacyId)
  if (!schoolId) throw new Error('School not found — photo could not be uploaded.')
  if (!file) throw new Error('No file selected.')

  const path = `${schoolId}/students/${studentLegacyId}.jpg`
  const { error } = await supabase.storage
    .from('student-photos')
    .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: true })
  if (error) throw new Error(`Photo upload failed: ${error.message}`)

  // Photo badalne par path wahi rehta hai, isliye cache me padi purani signed
  // URL nayi photo ko chhupa deti — screen par purani hi photo dikhti rehti.
  photoCache.delete(path)

  const signed = await signPhotoPaths([path])
  return { path, url: signed.get(path) || '', size: file.size, updatedAt: Date.now() }
}

/** Photo hataana — student delete ya photo replace ke waqt. */
export async function deleteStudentPhoto(schoolLegacyId, studentLegacyId) {
  const schoolId = await schoolUuid(schoolLegacyId)
  if (!schoolId) return
  const path = `${schoolId}/students/${studentLegacyId}.jpg`
  photoCache.delete(path)
  await supabase.storage.from('student-photos').remove([path])
}

/* ------------------------------------------------------------------ */
/* path parsing                                                        */
/* ------------------------------------------------------------------ */

/** 'schools/abc/students/xyz' -> { root:'schools', schoolLegacy:'abc', node:'students', rest:['xyz'] } */
function parsePath(path) {
  const parts = String(path || '').split('/').filter(Boolean)
  if (parts[0] === 'schools') {
    return { root: 'schools', schoolLegacy: parts[1] || null, node: parts[2] || null, rest: parts.slice(3) }
  }
  return { root: parts[0] || null, rest: parts.slice(1) }
}

/* ------------------------------------------------------------------ */
/* row  <->  RTDB document                                             */
/* ------------------------------------------------------------------ */

/**
 * DB row se wahi object banata hai jo app aaj Firebase se paata hai.
 * `source` base hai; upar se wo cheezein chadhti hain jo migration ne badli
 * (photo Storage me chali gayi, deleted flag, wagairah).
 */
function rowToDoc(row, def) {
  if (!row) return null
  const doc = { ...(row.source || {}) }

  if (row.photo_path !== undefined && row.photo_path !== null) doc.photo_path = row.photo_path
  if (row.photo_url !== undefined) doc.photo_url = row.photo_url ?? ''
  if (def?.table === 'students' && row.deleted_at) doc.deletedAt = new Date(row.deleted_at).getTime()

  // jin fields ka sach column me hai (source me nahi), unhe upar se chadha do
  if (def?.fill) {
    for (const [k, v] of Object.entries(def.fill(row))) {
      if (v !== null && v !== undefined) doc[k] = v
    }
  }

  return doc
}

// Sirf in do tables me photo ke column hain; rowToDoc unhe alag se chadhata hai.
// Baaki kisi table me ye column hai hi nahi, aur maang lene par PostgREST 400 dega.
const PHOTO_TABLES = new Set(['students', 'staff'])

/**
 * Jab node apna `select` nahi bataata, to `*` maangne ka koi matlab nahi hai:
 * rowToDoc doc poora `source` se banata hai, aur typed column tabhi padhta hai
 * jab node me `fill` ho. Bina fill wale node ke saare typed column taar par
 * bekaar jaate hain — fee_receipts me ye row ka aadha hissa tha (3,044 B se
 * 1,448 B, kyunki feeItems `fee_items` column me aur `source.feeItems` me,
 * dono jagah pada hai).
 *
 * Ye badlav lossless hai: jo column pehle doc me pahunchte hi nahi the, wahi
 * hataye ja rahe hain.
 */
function defaultSelect(def) {
  // fill() row ke kaunse column padhta hai, ye yahan se pata nahi chal sakta —
  // isliye aise node ko narrow karna surakshit nahi. Wo apna select khud bataye.
  if (def.fill) return '*'
  const cols = [def.key || 'legacy_id', 'source']
  if (PHOTO_TABLES.has(def.table)) cols.push('photo_path', 'photo_url')
  // rowToDoc students ke deleted_at ko deletedAt banata hai
  if (def.table === 'students') cols.push('deleted_at')
  return cols.join(', ')
}

/**
 * Realtime se poori row aati hai (REPLICA IDENTITY FULL), par node ne shayad
 * sirf kuch column maange the. Patch ka doc bilkul wahi banna chahiye jo
 * refetch se banta — warna attendanceLive jaise narrow node me achanak poora
 * `source` ghus jaata aur do raaste do alag shakal dete.
 *
 * `*` wale nodes par kuch nahi badalta.
 */
function narrowToSelect(row, def) {
  const select = def.select || defaultSelect(def)
  if (!row || select.includes('*')) return row

  const cols = select.split(',').map((c) => c.trim()).filter(Boolean)
  const out = {}
  for (const col of cols) {
    // 'student:students(legacy_id)' jaisa embed alag se bharta hai
    if (col.includes('(')) continue
    const name = col.split(':').pop()
    if (name in row) out[name] = row[name]
  }
  // keyFromRow / resolve ko ye chahiye hote hain chahe select me na hon
  for (const extra of ['student_id', 'deleted_at']) {
    if (extra in row && !(extra in out)) out[extra] = row[extra]
  }
  return out
}

/** def ka select student ka legacy id join se laata hai ya nahi */
const needsStudentJoin = (def) => /student\s*:\s*students\s*\(/.test(def.select || '')

function docsKeyedById(rows, def) {
  const out = {}
  for (const row of rows) {
    const doc = rowToDoc(row, def)
    // attendance jaise nodes ki key column me nahi hoti — document + row se banti
    // hai (`${date}_${studentId}`), aur app usi shakal ki ummeed karta hai.
    const key = def.keyFromRow
      ? def.keyFromRow(row, doc)
      : def.keyFrom
        ? def.keyFrom(doc)
        : (row[def.key] ?? row.legacy_id ?? row.id)
    out[key] = doc
  }
  return out
}

/* ------------------------------------------------------------------ */
/* kv (jin nodes ki apni table nahi)                                   */
/* ------------------------------------------------------------------ */

function digInto(value, pathParts) {
  let cur = value
  for (const p of pathParts) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return null
    cur = cur[p]
  }
  return cur ?? null
}

function setDeep(obj, pathParts, value) {
  if (!pathParts.length) return value
  const [head, ...tail] = pathParts
  const base = obj && typeof obj === 'object' ? { ...obj } : {}
  base[head] = setDeep(base[head], tail, value)
  return base
}

function deleteDeep(obj, pathParts) {
  if (!pathParts.length || !obj || typeof obj !== 'object') return obj
  const [head, ...tail] = pathParts
  const base = { ...obj }
  if (!tail.length) delete base[head]
  else base[head] = deleteDeep(base[head], tail)
  return base
}

async function kvGet(schoolId, node, rest) {
  const { data, error } = await supabase
    .from('kv').select('value').eq('school_id', schoolId).eq('path', node).maybeSingle()
  if (error) throw new Error(error.message)
  const value = data?.value ?? null
  return rest.length ? digInto(value, rest) : value
}

async function kvWrite(schoolId, node, rest, body, method) {
  const { data } = await supabase.from('kv').select('value').eq('school_id', schoolId).eq('path', node).maybeSingle()
  const current = data?.value ?? {}

  let next
  if (method === 'DELETE') {
    next = rest.length ? deleteDeep(current, rest) : {}
  } else if (method === 'PUT') {
    next = rest.length ? setDeep(current, rest, body) : body
  } else {
    // PATCH — RTDB ki tarah sirf diye gaye keys merge hote hain
    const target = rest.length ? digInto(current, rest) : current
    const merged = { ...(target && typeof target === 'object' ? target : {}), ...(body || {}) }
    next = rest.length ? setDeep(current, rest, merged) : merged
  }

  const { error } = await supabase
    .from('kv').upsert({ school_id: schoolId, path: node, value: next ?? {} }, { onConflict: 'school_id,path' })
  if (error) throw new Error(error.message)
  return body ?? null
}

/* ------------------------------------------------------------------ */
/* composite nodes (feeManager, transport)                             */
/* ------------------------------------------------------------------ */

const COMPOSITE = {
  feeManager: ['groups', 'structures', 'fines'],
  transport: ['allocations'],
}

async function compositeGet(schoolId, node, rest) {
  const parts = {}
  for (const sub of COMPOSITE[node]) {
    const def = SUB_NODES[`${node}/${sub}`]
    if (def) {
      const { data, error } = await supabase.from(def.table).select(def.select || defaultSelect(def)).eq('school_id', schoolId)
      if (error) throw new Error(error.message)
      parts[sub] = docsKeyedById(data || [], def)
    }
  }
  // jo sub-keys table me nahi hain (receiptCounter, deleted…) wo kv se
  const extra = await kvGet(schoolId, node, [])
  const merged = { ...(extra && typeof extra === 'object' ? extra : {}), ...parts }
  return rest.length ? digInto(merged, rest) : merged
}

/* ------------------------------------------------------------------ */
/* table read / write                                                  */
/* ------------------------------------------------------------------ */

function applySoftDelete(query, def) {
  if (!def.softDelete) return query
  if (def.softDelete.activeOnly) return query.is('deleted_at', null)
  if (def.softDelete.deletedOnly) return query.not('deleted_at', 'is', null)
  return query
}

const QUERY_COLUMN = {
  date: 'date', status: 'status', studentId: 'student_id', className: 'class_name',
  // TeacherApp leave requests apni class tak seemit rakhta hai — ye chhoot
  // jaata to har teacher ko poore school ki requests dikhtin
  classSection: 'class_section',
}

const unquote = (v) => (v == null ? v : String(v).replace(/^"|"$/g, ''))

/**
 * ?orderBy=...&startAt=... ko { col, eq, start, end } me todta hai.
 *
 * Do jagah chahiye: query banane ke liye (applyRestQuery) aur realtime se aayi
 * ek row ko parakhne ke liye (rowMatchesQuery) — ki wo is listener ke daayre me
 * aati bhi hai ya nahi. Dono ek hi jagah se parse karte hain taaki patch aur
 * refetch kabhi alag natija na dein.
 */
function parseRestQuery(rawQuery) {
  if (!rawQuery) return null
  const params = new URLSearchParams(rawQuery)
  const orderBy = unquote(params.get('orderBy'))
  if (!orderBy) return null
  const col = QUERY_COLUMN[orderBy]
  if (!col) return null
  return {
    col,
    eq: unquote(params.get('equalTo')),
    start: unquote(params.get('startAt')),
    end: unquote(params.get('endAt')),
  }
}

/** RTDB REST ka ?orderBy=...&startAt=... yahan bhi chale */
function applyRestQuery(query, def, rawQuery) {
  const f = parseRestQuery(rawQuery)
  if (!f) return query
  let q = query
  if (f.eq != null) q = q.eq(f.col, f.eq)
  if (f.start != null) q = q.gte(f.col, f.start)
  if (f.end != null) q = q.lte(f.col, f.end)
  return q
}

/**
 * Wahi filter, par ek row par — Postgres ke bajaye yahan.
 *
 * date/status/class_name sab text ya date hain, aur PostgREST bhi inhe string
 * hi bhejta hai, isliye string compare wahi natija deta hai jo gte/lte deta.
 */
function rowMatchesQuery(row, filter) {
  if (!filter) return true
  const v = row?.[filter.col]
  if (v === null || v === undefined) return false
  const s = String(v)
  if (filter.eq != null && s !== String(filter.eq)) return false
  if (filter.start != null && s < String(filter.start)) return false
  if (filter.end != null && s > String(filter.end)) return false
  return true
}

/**
 * Ek record par filter lagata hai.
 *
 * Zyadatar nodes ki key legacy_id column me hai. Attendance ki nahi — uski
 * key `${date}_${studentId}` hai aur usse date + student_id nikalna padta hai.
 * Padhne aur mitane, dono ko yahi chahiye, isliye ek hi jagah.
 *
 * Jawab `{ query }` me lapeta hua aata hai, seedha builder nahi. Wajah:
 * PostgREST ka builder khud thenable hai — use seedha lautate to `await`
 * karte hi query chal jaati aur aage .maybeSingle() rehta hi nahi.
 */
async function applyKeyFilter(query, def, schoolId, legacyId) {
  if (!def.keyFromRow && !def.keyFrom) {
    return { query: query.eq(def.key || 'legacy_id', legacyId) }
  }
  const idx = String(legacyId).indexOf('_')
  if (idx <= 0) return { query: null }
  const date = legacyId.slice(0, idx)
  const sid = await studentUuid(schoolId, legacyId.slice(idx + 1))
  if (!sid) return { query: null }
  return { query: query.eq('date', date).eq('student_id', sid) }
}

async function tableGet(schoolId, def, rest, options) {
  let query = supabase.from(def.table).select(def.select || defaultSelect(def)).eq('school_id', schoolId)
  query = applySoftDelete(query, def)

  if (rest.length) {
    const filtered = await applyKeyFilter(query, def, schoolId, rest[0])
    if (!filtered.query) return null
    const { data, error } = await filtered.query.maybeSingle()
    if (error) throw new Error(error.message)
    const doc = rowToDoc(data, def)
    return rest.length > 1 ? digInto(doc, rest.slice(1)) : doc
  }

  query = applyRestQuery(query, def, options?.query)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return docsKeyedById(data || [], def)
}

async function tableWrite(schoolId, node, def, rest, body, method) {
  // DELETE
  if (method === 'DELETE') {
    if (!rest.length) throw new Error(`Poora node delete karna support nahi hai: ${node}`)
    await deleteOne(schoolId, def, rest[0])
    return null
  }

  // multi-key PATCH: { "id1": {...}, "id2": {...} } — attendance isi tarah save hoti hai
  if (!rest.length && method === 'PATCH' && body && typeof body === 'object') {
    const results = {}
    for (const [childKey, childBody] of Object.entries(body)) {
      // RTDB me { key: null } bhejna us record ko mitana hota hai
      if (childBody === null) {
        await deleteOne(schoolId, def, childKey)
        continue
      }
      results[childKey] = await writeOne(schoolId, def, childKey, childBody, 'PATCH')
    }
    return results
  }

  if (!rest.length) throw new Error(`Poora node overwrite karna support nahi hai: ${node}`)
  return writeOne(schoolId, def, rest[0], body, method, rest.slice(1))
}

async function deleteOne(schoolId, def, legacyId) {
  const { query } = await applyKeyFilter(
    supabase.from(def.table).delete().eq('school_id', schoolId),
    def, schoolId, legacyId
  )
  if (!query) return
  const { error } = await query
  if (error) throw new Error(friendlyDeleteError(error, def))
}

/**
 * Postgres ka foreign-key error admin ke kisi kaam ka nahi hota. Sabse aam
 * maamla: student ki fee receipts hain, isliye use permanently delete nahi kar
 * sakte (constraint ON DELETE RESTRICT hai — pehle SET NULL thi aur receipt ka
 * payer chup-chaap ud jaata tha).
 */
function friendlyDeleteError(error, def) {
  // 23503 = foreign_key_violation
  if (error.code !== '23503') return error.message
  if (def.table === 'students') {
    return 'Is student ke fee receipts jude hue hain, isliye record permanently delete nahi ho sakta. Hisaab ka record bachaye rakhna zaroori hai — student trash me hi rahega.'
  }
  return `Is record se dusre records jude hue hain, isliye delete nahi ho sakta. (${error.message})`
}

async function writeOne(schoolId, def, legacyId, body, method, innerPath = []) {
  const keyCol = def.key || 'legacy_id'

  // purana document uthao — PATCH usi ke upar merge hota hai
  let existing = null
  if (def.key) {
    const { data } = await supabase
      .from(def.table).select('*').eq('school_id', schoolId).eq(keyCol, legacyId).maybeSingle()
    existing = data
  }
  const prevDoc = existing?.source || {}

  let doc
  if (innerPath.length) {
    doc = setDeep(prevDoc, innerPath, body)
  } else if (method === 'PUT') {
    doc = body && typeof body === 'object' ? body : { value: body }
  } else {
    doc = { ...prevDoc, ...(body && typeof body === 'object' ? body : {}) }
  }

  const row = {
    school_id: schoolId,
    source: doc,
    ...def.project(doc),
  }
  if (def.key) row[keyCol] = legacyId

  // attendance jaise nodes student_id se bandhe hain
  if (def.resolve?.studentFrom) {
    const studentLegacy = def.resolve.studentFrom(doc)
    const sid = await studentUuid(schoolId, studentLegacy)
    if (sid) row.student_id = sid
    else if (def.table === 'attendance') throw new Error(`Student nahi mila: ${studentLegacy}`)
  }

  const onConflict = def.conflict || `school_id,${keyCol}`
  const { error } = await supabase.from(def.table).upsert(row, { onConflict })
  if (error) throw new Error(error.message)
  return doc
}

/* ------------------------------------------------------------------ */
/* root nodes (schools ke bahar)                                       */
/* ------------------------------------------------------------------ */

async function rootGet(root, rest) {
  if (root === 'schoolCodes') {
    const code = rest[0]
    if (!code) return null
    const { data } = await supabase.from('school_codes').select('code, school_name, school_id').eq('code', code).maybeSingle()
    if (!data) return null
    const { data: school } = await supabase.from('schools').select('legacy_id').eq('id', data.school_id).maybeSingle()
    return { schoolId: school?.legacy_id ?? null, schoolName: data.school_name }
  }

  if (root === 'users' || root === 'teachersIndex') {
    const uid = rest[0]
    if (!uid) return null
    const { data } = await supabase
      .from('app_users').select('legacy_uid, role, full_name, email, school_id, source').eq('legacy_uid', uid).maybeSingle()
    if (!data) return null
    const { data: school } = data.school_id
      ? await supabase.from('schools').select('legacy_id').eq('id', data.school_id).maybeSingle()
      : { data: null }
    const base = data.source || {}
    return root === 'teachersIndex'
      ? { teacherId: uid, role: data.role, schoolId: school?.legacy_id ?? null }
      : { ...base, uid, role: data.role, fullName: data.full_name, email: data.email, schoolId: school?.legacy_id ?? null }
  }

  if (root === 'schoolMembers') {
    const [schoolLegacy, uid] = rest
    const { data } = await supabase.from('app_users').select('role').eq('legacy_uid', uid).maybeSingle()
    if (!data) return null
    return { userId: uid, role: data.role, status: 'active', schoolId: schoolLegacy }
  }

  if (root === 'studentPhotos') {
    const [schoolLegacy, studentLegacy] = rest
    const schoolId = await schoolUuid(schoolLegacy)
    if (!schoolId) return null
    let q = supabase.from('students').select('legacy_id, photo_path, photo_url').eq('school_id', schoolId)

    // photo_url purane inline/base64 aur bahar hosted photos ke liye hai — wo
    // waisi ki waisi chalti hai. photo_path private bucket ka hai, use sign karo.
    if (studentLegacy) {
      const { data } = await q.eq('legacy_id', studentLegacy).maybeSingle()
      if (data?.photo_url) return data.photo_url
      if (!data?.photo_path) return null
      const signed = await signPhotoPaths([data.photo_path])
      return signed.get(data.photo_path) ?? null
    }

    const { data } = await q.not('photo_path', 'is', null)
    const rows = data || []
    const signed = await signPhotoPaths(rows.filter(r => !r.photo_url && r.photo_path).map(r => r.photo_path))
    const out = {}
    for (const r of rows) {
      // Sign fail ho gaya to key hi mat daalo — bare path <img> ko toda hua
      // icon dikhata hai, jabki gayab key par initials fallback aata hai.
      const url = r.photo_url || signed.get(r.photo_path)
      if (url) out[r.legacy_id] = url
    }
    return out
  }

  return null
}

/* ------------------------------------------------------------------ */
/* public API — Firebase wale signature ke saath                       */
/* ------------------------------------------------------------------ */

/**
 * RTDB ka "multi-path update": khaali path par PATCH, jiski har key poora path
 * hoti hai —
 *   { "schools/s1/attendance/2026-07-29_stu1": {...},
 *     "schools/s1/students/stu1/lastSeen": 123,
 *     "schools/s1/homework/hw9": null }        <- null matlab mitao
 *
 * Poore app me likhne ka sabse aam tareeka yahi hai (akele App.jsx me 21 jagah),
 * isliye iske bina flag palatte hi lagbhag har save toot jaata.
 *
 * Ek farak jaan lena zaroori hai: RTDB ye saara update ek saath karta hai —
 * ya sab lagta hai ya kuch nahi. Yahan har path apni alag likhaayi hai, to
 * beech me fail hone par kuch path lag chuke honge. Isliye error me wo saaf
 * likha jaata hai, ki aadha lagne par pata to chale.
 */
async function multiPathPatch(body) {
  const entries = Object.entries(body || {})
  if (!entries.length) return null

  const done = []
  const failed = []

  // ek-ek karke bhejte to ek class ki attendance (40 bachche) me 80 roundtrip
  // lag jaate. Alag-alag path ek doosre se judte nahi, isliye thode saath me.
  const LIMIT = 6
  for (let i = 0; i < entries.length; i += LIMIT) {
    await Promise.all(entries.slice(i, i + LIMIT).map(async ([childPath, value]) => {
      try {
        value === null
          ? await databaseRequest(childPath, null, { method: 'DELETE' })
          : await databaseRequest(childPath, null, { method: 'PUT', body: value })
        done.push(childPath)
      } catch (error) {
        failed.push(`${childPath}: ${error.message}`)
      }
    }))
  }

  if (failed.length) {
    throw new Error(
      `${failed.length}/${entries.length} path nahi likhe ja sake ` +
      `(${done.length} lag chuke hain):\n${failed.join('\n')}`
    )
  }
  return body
}

export async function databaseRequest(path, _token, options = {}) {
  if (!supabase) throw new Error('Supabase client taiyaar nahi hai')
  const method = (options.method || 'GET').toUpperCase()
  const { root, schoolLegacy, node, rest = [] } = parsePath(path)

  if (!root && method === 'PATCH') return multiPathPatch(options.body)

  if (root !== 'schools') {
    if (method !== 'GET') throw new Error(`${root} par likhna adapter me support nahi hai`)
    return rootGet(root, rest)
  }

  const schoolId = await schoolUuid(schoolLegacy)
  if (!schoolId) return null

  // schools/{id} — poora school (login ke waqt)
  if (!node) {
    const { data } = await supabase.from('schools').select('*').eq('id', schoolId).maybeSingle()
    if (!data) return null
    return { ...(data.source || {}), name: data.name, profile: { ...(data.source || {}), schoolName: data.name, schoolCode: data.code, logoURL: data.logo_url } }
  }

  // schools/{id}/profile
  if (node === 'profile') {
    if (method === 'GET') {
      const { data } = await supabase.from('schools').select('*').eq('id', schoolId).maybeSingle()
      if (!data) return null
      return {
        ...(data.source || {}),
        schoolName: data.name,
        schoolCode: data.code,
        academicYear: data.academic_year,
        logoURL: data.logo_url,
        logo: data.logo_url,
        schoolSealURL: data.seal_url,
        principalSignatureURL: data.principal_signature_url,
      }
    }
    const { data: cur } = await supabase.from('schools').select('source').eq('id', schoolId).maybeSingle()
    const doc = { ...(cur?.source || {}), ...(options.body || {}) }
    const { error } = await supabase.from('schools').update({
      source: doc,
      name: doc.schoolName || doc.name,
      code: doc.schoolCode,
      academic_year: doc.academicYear,
      address: doc.address, city: doc.city, state: doc.state, pincode: doc.pincode,
      phone: doc.phone || doc.schoolContactNo, email: doc.email || doc.schoolEmail,
      principal_name: doc.principalName,
      logo_url: doc.logoURL || doc.logo,
      seal_url: doc.schoolSealURL,
      principal_signature_url: doc.principalSignatureURL,
    }).eq('id', schoolId)
    if (error) throw new Error(error.message)
    return options.body ?? null
  }

  // schools/{id}/<scalar>  jaise lastLoginAt
  const SCALARS = { lastLoginAt: 'last_login_at', academicYear: 'academic_year', name: 'name' }
  if (SCALARS[node] && !rest.length) {
    if (method === 'GET') {
      const { data } = await supabase.from('schools').select(SCALARS[node]).eq('id', schoolId).maybeSingle()
      return data?.[SCALARS[node]] ?? null
    }
    const value = options.body
    await supabase.from('schools').update({ [SCALARS[node]]: node === 'lastLoginAt' ? new Date(Number(value) || Date.now()).toISOString() : value }).eq('id', schoolId)
    return value
  }

  if (COMPOSITE[node]) {
    if (method === 'GET') return compositeGet(schoolId, node, rest)
    const subKey = `${node}/${rest[0]}`
    if (SUB_NODES[subKey]) return tableWrite(schoolId, subKey, SUB_NODES[subKey], rest.slice(1), options.body, method)
    return kvWrite(schoolId, node, rest, options.body, method)
  }

  const def = NODES[node]
  if (def) {
    if (method === 'GET') return tableGet(schoolId, def, rest, options)
    return tableWrite(schoolId, node, def, rest, options.body, method)
  }

  // jiski table nahi — kv
  if (isKvNode(node)) {
    if (method === 'GET') return kvGet(schoolId, node, rest)
    return kvWrite(schoolId, node, rest, options.body, method)
  }

  throw new Error(`Ye path adapter me nahi mila: ${path}`)
}

/* ------------------------------------------------------------------ */
/* realtime                                                            */
/* ------------------------------------------------------------------ */

const snapshotOf = (value) => ({
  val: () => value,
  exists: () => value !== null && value !== undefined,
  numChildren: () => (value && typeof value === 'object' ? Object.keys(value).length : 0),
  forEach: (fn) => {
    if (!value || typeof value !== 'object') return
    for (const [key, child] of Object.entries(value)) fn({ key, val: () => child })
  },
})

/**
 * Ek school ke liye EK realtime channel, sabke beech baanta hua.
 *
 * Pehle har subscribe apna channel banata tha — login par 14 listener matlab
 * 14 channel, har ek ka apna subscribe. Supabase me ek channel par kai table
 * sun sakte hain, to ek hi kaafi hai.
 */
const rooms = new Map() // schoolId -> { listeners: Map<table, Set<fn>>, channels: [], pending: Set, timer }

/**
 * realtime-js ka pakka niyam: `subscribe()` ke BAAD us channel par `.on()` lagana
 * seedha error deta hai ("cannot add postgres_changes callbacks after subscribe").
 * Isliye ek school = ek channel nahi ho sakta, kyunki listeners alag-alag waqt
 * par aate hain (har subscribe pehle apna data padhta hai, phir judta hai).
 *
 * Isliye jo table ek hi window me maange jaate hain unhe ikattha karke EK
 * channel banate hain. Login ke saare listener lagbhag saath hi aate hain, to
 * 14 channel ki jagah ek-do bante hain. Baad me koi naya table aaye to uske
 * liye alag channel ban jaata hai — galat kabhi nahi hota, bas ek channel extra.
 */
function room(schoolId) {
  let r = rooms.get(schoolId)
  if (!r) { r = { listeners: new Map(), channels: [], pending: new Set(), timer: null }; rooms.set(schoolId, r) }
  return r
}

function flush(schoolId) {
  const r = rooms.get(schoolId)
  if (!r || !r.pending.size) return
  const tables = [...r.pending]
  r.pending.clear()

  const channel = supabase.channel(`nxt:${schoolId}:${r.channels.length}`)
  for (const table of tables) {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: `school_id=eq.${schoolId}` },
      (payload) => { for (const l of r.listeners.get(table) || []) l.onChange(payload) }
    )
  }

  /**
   * Connection toota to beech ke events kabhi nahi aayenge, aur ab listeners
   * apni copy patch karke chalte hain — wo copy chup-chaap purani reh jaati.
   * Isliye dobara jud'ne par ek poora refetch, sirf tabhi jab sach me toota ho.
   *
   * Normal chalne me ye kabhi nahi chalta, to iska koi kharcha nahi hai.
   */
  let broke = false
  channel.subscribe((status) => {
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') { broke = true; return }
    if (status !== 'SUBSCRIBED' || !broke) return
    broke = false
    for (const table of tables) {
      for (const l of r.listeners.get(table) || []) l.onResync()
    }
  })
  r.channels.push(channel)
}

function listenOnTable(schoolId, table, listener) {
  const r = room(schoolId)
  if (!r.listeners.has(table)) {
    r.listeners.set(table, new Set())
    r.pending.add(table)
    clearTimeout(r.timer)
    r.timer = setTimeout(() => flush(schoolId), 50)
  }
  r.listeners.get(table).add(listener)

  return () => {
    r.listeners.get(table)?.delete(listener)
    if ([...r.listeners.values()].some((s) => s.size)) return
    clearTimeout(r.timer)
    rooms.delete(schoolId)
    for (const ch of r.channels) supabase.removeChannel(ch)
  }
}

/**
 * RTDB ke onValue jaisa. Farak sirf itna ki Supabase me realtime
 * har table pe alag se chaalu karna padta hai — table pe koi bhi badlav
 * aane pe hum poora node dobara padh ke handler ko de dete hain.
 */
export function subscribe(path, handler, options = {}) {
  let cancelled = false
  let unsubs = []
  let timer = null
  let running = false
  let again = false

  // Aakhri value jo handler ko di gayi. Patch isi ke upar lagta hai, isliye
  // ise hamesha wahi rakhna hai jo screen par hai.
  let current = null
  // { schoolId, def, filter } — null matlab is path ko patch nahi kar sakte,
  // aur purana poora-refetch wala raasta hi chalega.
  let patchCtx = null
  let deliverTimer = null
  let readPromise = Promise.resolve()
  let chain = Promise.resolve()

  const deliver = () => {
    clearTimeout(deliverTimer)
    // 40 row ki attendance save ek-ek karke aati hai; har row par React ko
    // dobara render karana bekaar hai. Bytes to bach hi gaye, render bhi bacha lo.
    deliverTimer = setTimeout(() => {
      if (!cancelled) handler(snapshotOf(current))
    }, 100)
  }

  const read = async () => {
    if (running) { again = true; return }   // ek hi waqt me do refetch nahi
    running = true
    try {
      const value = await databaseRequest(path, null, options)
      current = value
      if (!cancelled) handler(snapshotOf(value))
    } catch (error) {
      current = null
      console.error(`[adapter] ${path} padhne me dikkat:`, error.message)
      if (!cancelled) handler(snapshotOf(null))
    } finally {
      running = false
      if (again && !cancelled) { again = false; read() }
    }
  }

  /**
   * Purana raasta: kisi bhi ek row ke badalne par poora node dobara padhna.
   * Ab ye sirf fallback hai — jab patch pakka na ho paye ya connection toota ho.
   */
  const refetch = () => {
    if (cancelled) return
    clearTimeout(timer)
    timer = setTimeout(() => { readPromise = read() }, 250)
  }

  /**
   * Realtime se aayi row ko seedha local copy me lagata hai — poora node dobara
   * nahi padhta.
   *
   * REPLICA IDENTITY FULL ki wajah se payload me poori row already hai, to
   * network par kuch aur maangne ki zarurat hai hi nahi. Yahi is poore badlav
   * ka matlab hai: ek attendance row badalne par 662 rows ke bajaye 0 rows.
   *
   * true = laga diya. false = pakka nahi hai, bulane wala refetch kar le.
   */
  const applyPatch = async (payload) => {
    if (!patchCtx || cancelled) return false
    const { schoolId, def, filter } = patchCtx
    if (payload?.table !== def.table) return false
    if (!current || typeof current !== 'object' || Array.isArray(current)) return false

    /**
     * DELETE par patch nahi ho sakta, aur ye Postgres ki nahi Supabase ki seema
     * hai: `old` me sirf primary key aata hai (`{id}`), poori row nahi — chahe
     * table par REPLICA IDENTITY FULL laga ho. Wajah RLS: mit chuki row par
     * policy jaanchi nahi ja sakti, to Realtime baaki columns bhejta hi nahi.
     *
     * Hamari keys `legacy_id` / `date_studentId` hain, uuid nahi — aur row ab DB
     * me hai nahi ki poochh lein. Isliye yahan poora refetch, jaisa pehle tha.
     *
     * Iska asar kam hai: app me student "delete" asal me soft delete hai, jo
     * UPDATE (deleted_at) banke aata hai aur wo patch ho jaata hai.
     */
    if (payload.eventType === 'DELETE') return false

    const raw = payload.new
    if (!raw || typeof raw !== 'object') return false
    // filter server par laga hua hai, phir bhi doosre school ki row aa jaye to
    // use chhoona nahi — ignore karna sahi hai, refetch nahi.
    if (raw.school_id && raw.school_id !== schoolId) return true

    let row = narrowToSelect(raw, def)
    if (needsStudentJoin(def)) {
      const legacy = await studentLegacyId(raw.student_id)
      if (!legacy) return false
      row = { ...row, student: { legacy_id: legacy } }
    }

    const doc = rowToDoc(row, def)
    const key = def.keyFromRow
      ? def.keyFromRow(row, doc)
      : def.keyFrom
        ? def.keyFrom(doc)
        : (row[def.key] ?? row.legacy_id ?? row.id)
    // 'date_undefined' jaisi adhoori key node ko chup-chaap kharab kar degi
    if (key == null || String(key).includes('undefined')) return false

    // Row ab is listener ke daayre me nahi rahi — delete hui, trash me gayi,
    // ya date/class filter se bahar chali gayi. Teeno ka matlab ek hi hai.
    const gone =
      !rowMatchesQuery(raw, filter) ||
      (def.softDelete?.activeOnly && raw.deleted_at != null) ||
      (def.softDelete?.deletedOnly && raw.deleted_at == null)

    if (gone) {
      if (!(key in current)) return true
      const next = { ...current }
      delete next[key]
      current = next
    } else {
      current = { ...current, [key]: doc }
    }
    deliver()
    return true
  }

  const onChange = (payload) => {
    if (cancelled) return
    if (!patchCtx) { refetch(); return }
    // Ek-ek karke, aur kisi chal rahe read ke baad — warna patch lagakar bhi
    // purana jawab uske upar aa sakta hai.
    chain = chain
      .then(() => readPromise)
      .then(() => applyPatch(payload))
      .then((ok) => { if (!ok) refetch() })
      .catch(() => refetch())
  }

  const start = async () => {
    readPromise = read()
    await readPromise
    if (cancelled) return

    const { schoolLegacy, node, rest = [] } = parsePath(path)
    const def = NODES[node]
    const tables = def
      ? [def.table]
      : COMPOSITE[node]
        ? COMPOSITE[node].map((s) => SUB_NODES[`${node}/${s}`]?.table).filter(Boolean)
        : ['kv']
    if (!tables.length) return

    const schoolId = await schoolUuid(schoolLegacy)
    if (!schoolId || cancelled) return

    // Patch sirf tab jab poora node sun rahe hain aur uski ek hi table hai.
    // kv ek hi row me poora blob rakhta hai aur COMPOSITE kai table jodta hai —
    // dono me row ko key par mapping seedhi nahi hai, wahan refetch hi theek hai.
    if (def && !rest.length) {
      patchCtx = { schoolId, def, filter: parseRestQuery(options?.query) }
    }

    const listener = { onChange, onResync: refetch }
    for (const table of tables) unsubs.push(listenOnTable(schoolId, table, listener))
  }

  start()

  return () => {
    cancelled = true
    clearTimeout(timer)
    clearTimeout(deliverTimer)
    unsubs.forEach((fn) => fn())
    unsubs = []
  }
}

/* ------------------------------------------------------------------ */
/* atomic counters                                                     */
/* ------------------------------------------------------------------ */

/**
 * Agla fee receipt number pakka karta hai.
 *
 * Firebase me ye RTDB ka runTransaction tha. Yahan Postgres ka function hai
 * (`insert ... on conflict do update`), jo ek hi statement me chalta hai —
 * do log ek saath receipt banayen to dono ko alag number milta hai.
 *
 * seedFloor wo sabse bada number hai jo is client ko dikh raha hai. Counter
 * usse peeche kabhi nahi jaata, isliye purani receipt ka number dobara nahi milta.
 */
export async function reserveReceiptNumber(schoolLegacyId, seedFloor) {
  const schoolId = await schoolUuid(schoolLegacyId)
  if (!schoolId) throw new Error('School nahi mila — receipt number nahi mil saka')
  const { data, error } = await supabase.rpc('reserve_receipt_sequence', {
    p_school: schoolId,
    p_seed: Math.max(0, Number(seedFloor) || 0),
  })
  if (error) throw new Error(error.message)
  return Number(data)
}

/**
 * Admission aur certificate ka agla number.
 *
 * Ye dono cutover me chhoot gaye the — App.jsx me abhi bhi Firebase RTDB ke
 * REST par ETag/If-Match wala loop chal raha tha, aur us URL par Supabase ka
 * token 401 deta hai. Isliye Supabase par har admission "Could not generate
 * admission number." par mar raha tha.
 *
 * Receipt se ek farak hai: yahan seedFloor par bharosa nahi kiya jaata. RPC
 * khud `students` / `certificates` se sabse bada number nikalta hai, kyunki
 * production me dono school ka admissionCounter 0 par pada hai — sirf counter
 * dekhte to 771 students wale school ko agla number 1 milta.
 *
 * name: 'admission' | `certificate:${type}`
 */
export async function reserveCounter(schoolLegacyId, name, seedFloor = 0) {
  const schoolId = await schoolUuid(schoolLegacyId)
  if (!schoolId) throw new Error('School nahi mila — number nahi mil saka')
  const { data, error } = await supabase.rpc('reserve_counter', {
    p_school: schoolId,
    p_name: name,
    p_seed: Math.max(0, Number(seedFloor) || 0),
  })
  if (error) throw new Error(error.message)
  const next = Number(data)
  if (!Number.isFinite(next) || next <= 0) throw new Error(`${name} ka number nahi mil saka`)
  return next
}

/* ------------------------------------------------------------------ */
/* owner console (super admin)                                         */
/* ------------------------------------------------------------------ */

/**
 * Owner console har school ka data maangta hai, jo RLS jaanbujh kar rokti hai —
 * aur ayushrajputt03@gmail.com khud bhi ek school ka owner hai, to use bina
 * kisi khaas intezaam ke sirf apna hi school dikhta.
 *
 * Har table ki RLS me "ya super admin ho" jodne ke bajaye migration 0019 me teen
 * SECURITY DEFINER function hain jo utna hi karte hain jitna console ko chahiye.
 * Baaki poore app ki RLS jaisi thi waisi hai.
 */
const rpc = async (name, args) => {
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw new Error(error.message)
  return data
}

/** { [schoolLegacyId]: { profile, subscription, payments, createdAt, students, staff, teachers } } */
export const superAdminSchools = () => rpc('super_admin_schools')

/** RTDB jaisa multi-path update, par yahan poora ek hi transaction me lagta hai */
export const superAdminPatch = (changes) => rpc('super_admin_patch', { p_changes: changes || {} })

export const superAdminTouchLogin = (legacyUid, name) =>
  rpc('super_admin_touch_login', { p_legacy_uid: legacyUid || null, p_name: name || null })

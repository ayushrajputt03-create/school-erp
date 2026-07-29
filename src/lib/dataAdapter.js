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

async function schoolUuid(legacyId) {
  if (!legacyId) return null
  if (schoolCache.has(legacyId)) return schoolCache.get(legacyId)
  const { data, error } = await supabase.from('schools').select('id').eq('legacy_id', legacyId).maybeSingle()
  if (error) throw new Error(error.message)
  const id = data?.id ?? null
  if (id) schoolCache.set(legacyId, id)
  return id
}

const studentCache = new Map()

async function studentUuid(schoolId, legacyId) {
  if (!schoolId || !legacyId) return null
  const cacheKey = `${schoolId}/${legacyId}`
  if (studentCache.has(cacheKey)) return studentCache.get(cacheKey)
  const { data } = await supabase
    .from('students').select('id').eq('school_id', schoolId).eq('legacy_id', legacyId).maybeSingle()
  const id = data?.id ?? null
  if (id) studentCache.set(cacheKey, id)
  return id
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
      const { data, error } = await supabase.from(def.table).select('*').eq('school_id', schoolId)
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

/** RTDB REST ka ?orderBy=...&startAt=... yahan bhi chale */
function applyRestQuery(query, def, rawQuery) {
  if (!rawQuery) return query
  const params = new URLSearchParams(rawQuery)
  const unquote = (v) => (v == null ? v : String(v).replace(/^"|"$/g, ''))
  const orderBy = unquote(params.get('orderBy'))
  if (!orderBy) return query

  const COLUMN = { date: 'date', status: 'status', studentId: 'student_id', className: 'class_name' }
  const col = COLUMN[orderBy]
  if (!col) return query

  const eq = unquote(params.get('equalTo'))
  const start = unquote(params.get('startAt'))
  const end = unquote(params.get('endAt'))

  let q = query
  if (eq != null) q = q.eq(col, eq)
  if (start != null) q = q.gte(col, start)
  if (end != null) q = q.lte(col, end)
  return q
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
  let query = supabase.from(def.table).select(def.select || '*').eq('school_id', schoolId)
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
  if (error) throw new Error(error.message)
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
    if (studentLegacy) {
      const { data } = await q.eq('legacy_id', studentLegacy).maybeSingle()
      return data?.photo_url || data?.photo_path || null
    }
    const { data } = await q.not('photo_path', 'is', null)
    const out = {}
    for (const r of data || []) out[r.legacy_id] = r.photo_url || r.photo_path
    return out
  }

  return null
}

/* ------------------------------------------------------------------ */
/* public API — Firebase wale signature ke saath                       */
/* ------------------------------------------------------------------ */

export async function databaseRequest(path, _token, options = {}) {
  if (!supabase) throw new Error('Supabase client taiyaar nahi hai')
  const method = (options.method || 'GET').toUpperCase()
  const { root, schoolLegacy, node, rest = [] } = parsePath(path)

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
 * RTDB ke onValue jaisa. Farak sirf itna ki Supabase me realtime
 * har table pe alag se chaalu karna padta hai — table pe koi bhi badlav
 * aane pe hum poora node dobara padh ke handler ko de dete hain.
 */
export function subscribe(path, handler, options = {}) {
  let cancelled = false
  let channel = null

  const refetch = async () => {
    try {
      const value = await databaseRequest(path, null, options)
      if (!cancelled) handler(snapshotOf(value))
    } catch (error) {
      console.error(`[adapter] ${path} padhne me dikkat:`, error.message)
      if (!cancelled) handler(snapshotOf(null))
    }
  }

  const start = async () => {
    await refetch()
    if (cancelled) return

    const { schoolLegacy, node } = parsePath(path)
    const def = NODES[node]
    const tables = def
      ? [def.table]
      : COMPOSITE[node]
        ? COMPOSITE[node].map((s) => SUB_NODES[`${node}/${s}`]?.table).filter(Boolean)
        : ['kv']
    if (!tables.length) return

    const schoolId = await schoolUuid(schoolLegacy)
    if (!schoolId || cancelled) return

    channel = supabase.channel(`nxt:${path}`)
    for (const table of tables) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `school_id=eq.${schoolId}` },
        () => { refetch() }
      )
    }
    channel.subscribe()
  }

  start()

  return () => {
    cancelled = true
    if (channel) supabase.removeChannel(channel)
  }
}

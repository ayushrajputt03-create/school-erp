const crypto = require('crypto')

let client

const clientIp = request => String(request.headers['x-forwarded-for'] || request.socket?.remoteAddress || '')
  .split(',')[0].trim() || 'unknown'
const fingerprint = value => crypto.createHash('sha256').update(String(value)).digest('hex')

async function assertRateLimit({ request, scope, identity = '', limit, windowMs }) {
  const key = fingerprint(`${scope}:${scope.endsWith('-account') ? '' : clientIp(request)}:${identity}`)
  let allowed
  if (String(process.env.USE_SUPABASE ?? process.env.VITE_USE_SUPABASE) === 'true') {
    if (!client) {
      const { createClient } = require('@supabase/supabase-js')
      client = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } })
    }
    const { data, error } = await client.rpc('consume_security_rate_limit', {
      p_key: key, p_limit: limit, p_window: Math.ceil(windowMs / 1000),
    })
    if (error) throw new Error('Authentication service temporarily unavailable.')
    allowed = data
  } else {
    const { getDatabase } = require('firebase-admin/database')
    const now = Date.now()
    const result = await getDatabase().ref(`securityRateLimits/${key}`).transaction(current => {
      if (!current || current.expiresAt <= now) return { count: 1, expiresAt: now + windowMs }
      return { ...current, count: current.count + 1 }
    })
    allowed = result.snapshot.val().count <= limit
  }
  if (!allowed) {
    const error = new Error('Too many attempts. Please wait and try again.')
    error.statusCode = 429
    throw error
  }
}

module.exports = { assertRateLimit }

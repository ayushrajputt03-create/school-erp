const COOKIE = 'erp_parent_session'

function readSession(request) {
  const value = String(request.headers.cookie || '').split(';').map(part => part.trim())
    .find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1)
  if (!value) return {}
  try {
    const session = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    if (!session.schoolId || !session.parentId || !session.sessionToken) return {}
    return session
  } catch { return {} }
}

function writeSession(response, session, request) {
  const secure = process.env.VERCEL || request.headers['x-forwarded-proto'] === 'https'
  const value = session ? Buffer.from(JSON.stringify(session)).toString('base64url') : ''
  response.setHeader('Set-Cookie', `${COOKIE}=${value}; Path=/api/parent-portal; HttpOnly; SameSite=Strict; Max-Age=${session ? 1800 : 0}${secure ? '; Secure' : ''}`)
}

function assertSameOrigin(request) {
  const origin = request.headers.origin
  if (!origin) return
  const host = request.headers.host
  if (new URL(origin).host !== host) throw new Error('Request origin is not allowed.')
}

module.exports = { readSession, writeSession, assertSameOrigin }

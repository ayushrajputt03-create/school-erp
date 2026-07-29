// ============================================================
// db.mjs — Supabase Postgres connection, sab scripts ke liye ek jagah
//
// Password .env.local ke SUPABASE_DB_PASSWORD se aata hai — kacchha,
// bina kisi encoding ke. Isliye @ # $ % kuch bhi ho, kabhi nahi tootega.
// (URL me daalte to @ line ko beech se tod deta.)
// ============================================================

import fs from 'node:fs'
import pg from 'pg'

export const PROJECT_REF = 'fxriwwuaxuiomqzklzvk'
export const REGION = 'ap-south-1'

// naye projects ke liye aws-1, purane ke liye aws-0 — dono try karenge
const POOLER_HOSTS = [`aws-0-${REGION}.pooler.supabase.com`, `aws-1-${REGION}.pooler.supabase.com`]

export function loadEnv() {
  const envPath = new URL('../.env.local', import.meta.url)
  if (!fs.existsSync(envPath)) return
  for (const raw of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const k = line.slice(0, eq).trim()
    let v = line.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!(k in process.env)) process.env[k] = v
  }
}

/**
 * Pooler ke dono hosts try karta hai, jo chale wahi client lauta deta hai.
 * Error message se password hamesha hata diya jaata hai.
 */
export async function connect({ timeoutMs = 20000 } = {}) {
  loadEnv()
  const password = process.env.SUPABASE_DB_PASSWORD
  if (!password) {
    throw new Error('SUPABASE_DB_PASSWORD .env.local me nahi mila')
  }

  const errors = []
  for (const host of POOLER_HOSTS) {
    const client = new pg.Client({
      host,
      port: 5432,
      user: `postgres.${PROJECT_REF}`,
      password,
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: timeoutMs,
    })
    try {
      await client.connect()
      return { client, host }
    } catch (err) {
      errors.push(`${host}: ${scrub(err.message, password)}`)
      await client.end().catch(() => {})
    }
  }
  throw new Error('koi bhi pooler host connect nahi hua:\n  ' + errors.join('\n  '))
}

export function scrub(text, secret) {
  if (!secret) return text
  return String(text).split(secret).join('***')
}

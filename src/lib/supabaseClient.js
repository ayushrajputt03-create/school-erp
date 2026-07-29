import { createClient } from '@supabase/supabase-js'

// Sirf publishable/anon key. service_role kabhi yahan nahi - wo browser me
// pahunch gayi to poori RLS bekaar ho jayegi aur saara data khul jayega.
//
// Vite me import.meta.env, Node me process.env - taaki adapter ko browser ke
// bahar bhi test kiya ja sake.
const env = (typeof import.meta !== 'undefined' && import.meta.env) || (typeof process !== 'undefined' ? process.env : {})

const url = env.VITE_SUPABASE_URL
const anonKey = env.VITE_SUPABASE_ANON_KEY

export const supabaseReady = Boolean(url && anonKey)

export const supabase = supabaseReady
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: 'nxt-erp-auth',
      },
      realtime: { params: { eventsPerSecond: 5 } },
    })
  : null

/**
 * Ek hi jagah se pata chalta hai ki app Supabase pe hai ya Firebase pe.
 * Jab tak VITE_USE_SUPABASE 'true' na ho, kuch nahi badalta.
 * Gadbad hone pe ise 'false' karke deploy kar do - turant Firebase pe wapas.
 */
export const useSupabase = env.VITE_USE_SUPABASE === 'true' && supabaseReady

if (env.VITE_USE_SUPABASE === 'true' && !supabaseReady) {
  console.error(
    '[supabase] VITE_USE_SUPABASE=true hai par VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY nahi mile. Firebase pe hi chal raha hai.'
  )
}

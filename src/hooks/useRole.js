import { useMemo } from 'react'

// The session adapter resolves this from public.app_users.role, which is also the RLS source.
export default function useRole(session) {
  return useMemo(() => String(session?.role || 'staff').trim().toLowerCase(), [session?.role])
}

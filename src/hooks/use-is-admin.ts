'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

/**
 * Whether the signed-in user holds an active admin role, for UI only (the
 * admin routes and actions check it server-side). One cached read per user
 * per 10 minutes, shared by every caller: the navbar re-read admin_roles on
 * every mount (2026-10-20 usage audit).
 */
export function useIsAdmin(userId: string | null | undefined): boolean {
  const { data } = useQuery({
    queryKey: ['is-admin', userId],
    enabled: !!userId,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data: row } = await createClient()
        .from('admin_roles')
        .select('role')
        .eq('user_id', userId!)
        .eq('is_active', true)
        .maybeSingle()
      return !!row
    },
  })
  return !!userId && data === true
}

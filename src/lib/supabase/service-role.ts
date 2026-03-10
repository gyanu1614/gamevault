import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Service Role Client - USE WITH EXTREME CAUTION
 *
 * This client bypasses ALL RLS policies and has full database access.
 * Only use in server-side code with proper authorization checks.
 * NEVER expose this client to the client-side.
 */
export function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase service role credentials')
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

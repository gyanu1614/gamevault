/**
 * Supabase Service Role Client
 *
 * Use ONLY in:
 * - Server Actions performing admin/system operations
 * - API routes that need to bypass RLS (webhooks, crons)
 * - The Stripe Connect library
 *
 * NEVER import this in client components or expose to the browser.
 * The service role key has full DB access — treat it like a root password.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

let serviceClient: ReturnType<typeof createSupabaseClient<Database>> | null = null

/**
 * createServiceRoleClient — returns a singleton Supabase client
 * authenticated with the service role key (bypasses all RLS).
 */
export function createServiceRoleClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      '[Supabase] SUPABASE_SERVICE_ROLE_KEY is not set. ' +
      'Add it to your .env.local file.'
    )
  }

  // Reuse singleton to avoid connection pool exhaustion in cron routes
  if (!serviceClient) {
    serviceClient = createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession:   false,
        },
      }
    )
  }

  return serviceClient
}

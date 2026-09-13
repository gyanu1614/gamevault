import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Cookie-free anon Supabase client, for reads of PUBLIC data only.
 *
 * The cookie-bound server client (./server.ts) calls cookies(), a dynamic API
 * that opts the whole route out of static rendering and makes the read unsafe
 * to memoize. Public reads that want ISR or unstable_cache must go through
 * this client instead — it carries no session, so it sees exactly what an
 * anonymous visitor sees under RLS.
 *
 * Do NOT use this for anything user-specific: with no session it has no auth
 * context, so RLS policies keyed on auth.uid() will (correctly) return nothing.
 *
 * Deliberately untyped, exactly like src/lib/sab/priceCache.ts: several tables
 * these public reads touch (sab_*, blog_posts, the games SEO columns) are not
 * in the generated database.types.ts, which is stale against the live schema.
 * Callers keep the explicit row types / casts they already carry.
 */
export function createAnonClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

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

/** Header that folds a read's cache tags into its Data Cache key (see below). */
export const CACHE_TAGS_KEY_HEADER = 'x-dropmarket-cache-tags'

export interface TaggedFetchOptions {
  /** Cache tags every response carries in Next's Data Cache. */
  tags: string[]
  /**
   * Seconds the cached response may be served before a background refresh.
   * Omit to inherit the route segment's `revalidate` — the right default: a
   * fetch with a SHORTER window than its page caps the page's ISR interval
   * (Next takes the minimum across a render's reads).
   */
  revalidate?: number | false
}

/**
 * Wrap a fetch so every request is stored in Next's Data Cache under `tags`.
 *
 * Why this exists (2026-10-05): on Next 14 an un-annotated server `fetch` on a
 * static route is cached ("auto cache") with the PAGE's revalidate window and
 * only the page's implicit path tags. supabase-js fetches are un-annotated, so
 * every anon read landed in the Data Cache untagged: `revalidateTag(...)`
 * re-rendered the page but the re-render was served the OLD query responses —
 * Adopt Me pet pages kept old prices for up to 7 days after a publish.
 *
 * Two details matter:
 *   • `next.tags` makes the stored response carry the tags the publish step
 *     revalidates (and tags the page render with them too).
 *   • The tags are ALSO sent as a request header, which is part of Next's
 *     fetch cache key. The same query read under different tag sets (a list
 *     page vs. an item page) therefore gets separate entries — a tag can only
 *     ever invalidate data that was stored under it — and every entry written
 *     before this wrapper (untagged) is orphaned rather than served.
 *     PostgREST ignores the header.
 */
export function taggedFetch(
  { tags, revalidate }: TaggedFetchOptions,
  baseFetch?: typeof fetch,
): typeof fetch {
  const tagList = [...new Set(tags)]
  return (input, init) => {
    const headers = new Headers(init?.headers)
    headers.set(CACHE_TAGS_KEY_HEADER, tagList.join(','))
    const prevNext = (init as { next?: Record<string, unknown> } | undefined)?.next
    const next: Record<string, unknown> = { ...prevNext, tags: tagList }
    if (revalidate !== undefined) next.revalidate = revalidate
    // Resolved per call: Next patches the global fetch after module load.
    return (baseFetch ?? fetch)(input, { ...init, headers, next } as RequestInit)
  }
}

/**
 * The anon client for reads whose freshness is driven by `revalidateTag`:
 * every query response it fetches is cached under `tags` (see taggedFetch).
 * Use it for public data that an on-demand publish step refreshes — values
 * hub prices and content (src/lib/values/read-client.ts builds the tag sets).
 *
 * Do not call it inside an `unstable_cache` callback: Next 14 runs those with
 * fetchCache 'force-no-store', so the tags would be dropped silently — tag the
 * `unstable_cache` entry instead.
 */
export function createTaggedAnonClient(options: TaggedFetchOptions) {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: taggedFetch(options) },
    },
  )
}

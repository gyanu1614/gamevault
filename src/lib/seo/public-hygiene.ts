/**
 * SEO Phase 1 — public data hygiene.
 *
 * Test/demo accounts (profiles.is_test = true) must never surface on
 * public/indexable pages: their listings, ratings and seller names would
 * make DropMarket look immature to crawlers and PSPs. This module is the
 * single source of the "which sellers to hide" set, mirroring the existing
 * getPausedSellerIds() pattern so callers can `.not('seller_id', 'in', ...)`.
 *
 * Server-only (uses the server Supabase client). Fails open to an empty
 * list on error so a hiccup never blanks a whole marketplace page.
 */

import { createAnonClient } from '@/lib/supabase/anon'
import { unstable_cache } from 'next/cache'
import { TEST_SELLERS_TAG } from '@/lib/revalidation/tags'

/** Ids of test/demo seller accounts to exclude from public listing queries. */
export async function getTestSellerIds(): Promise<string[]> {
  return readTestSellerIds()
}

// Step 7b — identical on every prerendered category page: one tagged cache
// entry per build/hour instead of one read per page. Test flags change rarely
// (admin); the nightly full revalidate covers the rest.
const readTestSellerIds = unstable_cache(
  async (): Promise<string[]> => {
    try {
      // Cookie-free (Step 7a): called from ISR pages via getCategoryStats.
      const supabase = createAnonClient()
      const { data, error } = await (supabase
        .from('profiles') as any)
        .select('id')
        .eq('is_test', true)
      if (error || !data) return []
      return (data as { id: string }[]).map((r) => r.id).filter(Boolean)
    } catch {
      return []
    }
  },
  ['test-seller-ids'],
  { tags: [TEST_SELLERS_TAG], revalidate: 3600 },
)

/**
 * Apply the test-seller exclusion to a Supabase listings query. No-op when
 * there are no test sellers (keeps the query clean). Chainable.
 *
 *   let q = supabase.from('listings').select('*').eq('status', 'active')
 *   q = excludeTestSellers(q, testIds)
 */
export function excludeTestSellers<T>(query: T, testSellerIds: string[]): T {
  if (testSellerIds.length === 0) return query
  // Supabase PostgREST `in` list — quote nothing (uuids are safe literals).
  return (query as any).not('seller_id', 'in', `(${testSellerIds.join(',')})`)
}

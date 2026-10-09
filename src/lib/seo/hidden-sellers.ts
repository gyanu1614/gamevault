import { getPausedSellerIds } from '@/lib/actions/seller-presence'
import { getTestSellerIds } from '@/lib/seo/public-hygiene'
import { requestMemo } from '@/lib/revalidation/request-memo'

/**
 * Sellers whose listings never show on a public page: Offline Mode (paused)
 * ∪ test/demo accounts, paused first. Both halves are tagged unstable_cache
 * reads (PAUSED_SELLERS_TAG / TEST_SELLERS_TAG); this is memoised per render.
 *
 * Resolve it OUTSIDE any unstable_cache callback and pass the ids in: called
 * inside one, Next 14.2 skips the inner data cache and reads the database on
 * every miss of the outer entry (see lib/revalidation/request-memo.ts).
 */
export const getHiddenSellerIds = requestMemo(async (): Promise<string[]> => {
  const [paused, test] = await Promise.all([getPausedSellerIds(), getTestSellerIds()])
  return Array.from(new Set([...paused, ...test]))
})

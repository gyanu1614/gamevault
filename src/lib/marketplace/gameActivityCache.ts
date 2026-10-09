import { unstable_cache } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { COLLECTED_ORDER_STATUSES } from '@/lib/admin/status-sets'
import { GAME_DIRECTORY_TAG } from '@/lib/revalidation/tags'
import { getTestSellerIds } from '@/lib/seo/public-hygiene'
import { type FooterGameSignals } from './footerGameRanking'
import { GAME_DIRECTORY_TAG as ADMIN_GAME_DIRECTORY_TAG } from './gameDirectoryCache'

/**
 * Per-game marketplace activity for the footer directory order
 * (footerGameRanking.ts). Renders on EVERY page via the root layout, so:
 *   - cookie-free: a service-role client (orders are not anon-readable), only
 *     aggregate counts leave this function — no row is ever rendered;
 *   - unstable_cache'd for a day under the game-directory tags (the nightly
 *     /api/cron/revalidate-listing-pages revalidates GAME_DIRECTORY_TAG);
 *   - fails open: any error (or no service key, e.g. a local build) returns
 *     empty signals and the footer keeps its curated sort_order.
 * Test sellers (profiles.is_test) are excluded from both counts.
 */

const WINDOW_DAYS = 30

type ActivityRow = { game_id: string | null; orders_30d: number | string | null; active_listings: number | string | null }

/**
 * `testSellers` is resolved by the caller, outside the unstable_cache callback
 * (inside it, Next 14.2 skips the test-seller read's own cache and this footer
 * — on every page — read public_profiles on every miss). Left out, it is read
 * here (direct callers / scripts).
 */
export async function readGameActivity(
  now: Date = new Date(),
  testSellerIds?: readonly string[],
): Promise<FooterGameSignals> {
  try {
    const db = createServiceRoleClient()
    const testSellers = testSellerIds ?? (await getTestSellerIds())
    const since = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

    // ONE aggregate (footer_game_activity, service-role only) instead of
    // paging up to 30k order + listing rows to count them here.
    const [activity, trend] = await Promise.all([
      db.rpc('footer_game_activity' as never, {
        p_since: since,
        p_statuses: [...COLLECTED_ORDER_STATUSES],
        p_exclude_sellers: [...testSellers],
      } as never) as unknown as PromiseLike<{ data: ActivityRow[] | null; error: unknown }>,
      db
        .from('games')
        .select('id, trend_peak_playing')
        .eq('is_active', true)
        .not('trend_peak_playing', 'is', null),
    ])
    if (activity.error) throw activity.error

    const orders30d: Record<string, number> = {}
    const activeListings: Record<string, number> = {}
    for (const row of activity.data ?? []) {
      if (!row.game_id) continue
      const o = Number(row.orders_30d ?? 0)
      const l = Number(row.active_listings ?? 0)
      if (o > 0) orders30d[row.game_id] = o
      if (l > 0) activeListings[row.game_id] = l
    }

    const trendPeak: Record<string, number> = {}
    for (const row of (trend.data ?? []) as { id: string; trend_peak_playing: number | null }[]) {
      if (row.trend_peak_playing) trendPeak[row.id] = row.trend_peak_playing
    }

    return { orders30d, activeListings, trendPeak }
  } catch (e) {
    console.error('[footer] game activity read failed; using curated order', e)
    return {}
  }
}

export async function getCachedGameActivity(): Promise<FooterGameSignals> {
  const testSellers = await getTestSellerIds().catch((): string[] => []) // fails open, as before
  return unstable_cache(() => readGameActivity(new Date(), testSellers), ['footer-game-activity'], {
    tags: [GAME_DIRECTORY_TAG, ADMIN_GAME_DIRECTORY_TAG],
    revalidate: 86400,
  })()
}

import { unstable_cache } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { COLLECTED_ORDER_STATUSES } from '@/lib/admin/status-sets'
import { GAME_DIRECTORY_TAG } from '@/lib/revalidation/tags'
import { getTestSellerIds } from '@/lib/seo/public-hygiene'
import { tallyByGame, type FooterGameSignals } from './footerGameRanking'
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

const PAGE = 1000
/** Upper bound on rows paged per read — this is an ordering hint, not a report. */
const MAX_PAGES = 30
const WINDOW_DAYS = 30

type Page<T> = { data: T[] | null; error: unknown }

async function pageAll<T>(fetchPage: (from: number, to: number) => PromiseLike<Page<T>>): Promise<T[]> {
  const rows: T[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE
    const { data, error } = await fetchPage(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }
  return rows
}

function inList(ids: string[]): string {
  return `(${ids.join(',')})`
}

export async function readGameActivity(now: Date = new Date()): Promise<FooterGameSignals> {
  try {
    const db = createServiceRoleClient()
    const testSellers = await getTestSellerIds()
    const since = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

    const [orders, listings, trend] = await Promise.all([
      pageAll<{ listings: { game_id: string | null } | null }>((from, to) => {
        let q = db
          .from('orders')
          .select('id, listings:listings!orders_listing_id_fkey!inner(game_id)')
          .in('status', [...COLLECTED_ORDER_STATUSES])
          .gte('created_at', since)
        if (testSellers.length) q = q.not('seller_id', 'in', inList(testSellers))
        return q.order('id').range(from, to) as unknown as PromiseLike<
          Page<{ listings: { game_id: string | null } | null }>
        >
      }),
      pageAll<{ game_id: string | null }>((from, to) => {
        let q = db.from('listings').select('id, game_id').eq('status', 'active')
        if (testSellers.length) q = q.not('seller_id', 'in', inList(testSellers))
        return q.order('id').range(from, to) as unknown as PromiseLike<Page<{ game_id: string | null }>>
      }),
      db
        .from('games')
        .select('id, trend_peak_playing')
        .eq('is_active', true)
        .not('trend_peak_playing', 'is', null),
    ])

    const trendPeak: Record<string, number> = {}
    for (const row of (trend.data ?? []) as { id: string; trend_peak_playing: number | null }[]) {
      if (row.trend_peak_playing) trendPeak[row.id] = row.trend_peak_playing
    }

    return {
      orders30d: tallyByGame(orders.map((o) => o.listings?.game_id)),
      activeListings: tallyByGame(listings.map((l) => l.game_id)),
      trendPeak,
    }
  } catch (e) {
    console.error('[footer] game activity read failed; using curated order', e)
    return {}
  }
}

export const getCachedGameActivity = unstable_cache(readGameActivity, ['footer-game-activity'], {
  tags: [GAME_DIRECTORY_TAG, ADMIN_GAME_DIRECTORY_TAG],
  revalidate: 86400,
})

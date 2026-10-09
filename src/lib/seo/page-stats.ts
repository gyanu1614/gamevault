/**
 * page-stats — shared live-listing stats for money-page SEO surfaces.
 *
 * ONE query per (game, category) pair returns everything the metadata,
 * JSON-LD, and on-page intro line need, so the numbers can never drift
 * between the <title>, the AggregateOffer, and the visible copy.
 *
 * Wrapped in React `cache()` so generateMetadata and the page component
 * share a single fetch within the same request.
 */

import { createCategoryListingsReadClient } from '@/lib/listings/read-client'
import { getPausedSellerIds } from '@/lib/actions/seller-presence'
import { getTestSellerIds } from '@/lib/seo/public-hygiene'
import { parseDeliveryMinutes } from '@/lib/utils/delivery-time'
import { requestMemo } from '@/lib/revalidation/request-memo'

export interface CategoryStats {
  /** Number of active listings. */
  count: number
  /** Cheapest active listing price (USD). Null when count === 0. */
  lowPrice: number | null
  /** Most expensive active listing price (USD). Null when count === 0. */
  highPrice: number | null
  /** Human label for the average stated delivery, e.g. "15 minutes". */
  avgDeliveryLabel: string | null
}

const EMPTY_STATS: CategoryStats = {
  count: 0,
  lowPrice: null,
  highPrice: null,
  avgDeliveryLabel: null,
}

// formatStatPrice lives in a pure module (no server imports) so client-safe
// models can share it; re-exported here for existing callers.
export { formatStatPrice } from './page-stats-format'

/** "15 minutes" / "1 hour" / "3 hours" from an average minute count. */
function formatAvgDelivery(avgMinutes: number): string {
  if (!Number.isFinite(avgMinutes) || avgMinutes <= 0) return 'under 1 hour'
  if (avgMinutes < 60) {
    const n = Math.max(1, Math.round(avgMinutes))
    return `${n} ${n === 1 ? 'minute' : 'minutes'}`
  }
  const hours = Math.max(1, Math.round(avgMinutes / 60))
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`
}

/**
 * Live stats for all ACTIVE listings in a (game, category) pair.
 * Single lightweight select — price + delivery_time only.
 *
 * `hiddenSellerIds` (paused ∪ test, lib/seo/hidden-sellers) lets a caller that
 * loops categories (the game hub) resolve the set once; left out, it is read
 * here through the per-render memoised loaders. Pass the SAME array to every
 * call of a render — React cache() keys arguments by identity.
 */
export const getCategoryStats = requestMemo(
  async (gameId: string, categoryId: string, hiddenSellerIds?: readonly string[]): Promise<CategoryStats> => {
    // Cookie-free (Step 7a): this runs inside ISR pages' metadata and body.
    // Tagged with the category, so a listing mutation refreshes the numbers
    // and not just the page shell (lib/listings/read-client).
    const supabase = createCategoryListingsReadClient([categoryId])
    // Parity with the visible grids: Offline-Mode sellers are hidden on
    // the page, so their listings must not inflate the advertised
    // count/low price either. (The flexible-currency minQty>=100 client
    // filter is intentionally NOT mirrored here — stats describe the
    // full active book.)
    // SEO hygiene: exclude BOTH offline (paused) and test/demo sellers so the
    // advertised count / low price / delivery in titles + JSON-LD reflect only
    // real, buyable listings.
    const hidden = hiddenSellerIds ?? (await readHiddenSellerIds())
    let query = supabase
      .from('listings')
      .select('price, delivery_time')
      .eq('game_id', gameId)
      .eq('game_category_id', categoryId)
      .eq('status', 'active')
    if (hidden.length > 0) {
      query = query.not('seller_id', 'in', `(${hidden.join(',')})`)
    }
    const { data, error } = await query as any

    if (error || !data) return EMPTY_STATS

    const rows = (data as Array<{ price: number | null; delivery_time: string | null }>)
      .filter((r) => Number(r.price) > 0)
    if (rows.length === 0) return EMPTY_STATS

    let low = Infinity
    let high = -Infinity
    let minutesSum = 0
    for (const row of rows) {
      const price = Number(row.price)
      if (price < low) low = price
      if (price > high) high = price
      minutesSum += parseDeliveryMinutes(row.delivery_time)
    }

    return {
      count: rows.length,
      lowPrice: low,
      highPrice: high,
      avgDeliveryLabel: formatAvgDelivery(minutesSum / rows.length),
    }
  },
)

/** Paused ∪ test, paused first — same order as lib/seo/hidden-sellers. */
async function readHiddenSellerIds(): Promise<string[]> {
  const [pausedSellerIds, testSellerIds] = await Promise.all([getPausedSellerIds(), getTestSellerIds()])
  return Array.from(new Set([...pausedSellerIds, ...testSellerIds]))
}

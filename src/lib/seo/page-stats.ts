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

import * as React from 'react'
import { createClient } from '@/lib/supabase/server'
import { getPausedSellerIds } from '@/lib/actions/seller-presence'
import { getTestSellerIds } from '@/lib/seo/public-hygiene'
import { parseDeliveryMinutes } from '@/lib/utils/delivery-time'

// React.cache exists at runtime in Next 14's bundled React, but the
// project's stable @types/react only declares it in canary typings —
// read it off the namespace with a no-op fallback so tsc stays green.
const requestMemo: <T extends (...args: any[]) => any>(fn: T) => T =
  (React as any).cache ?? ((fn: any) => fn)

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

/**
 * Format a USD price for titles/descriptions. Whole dollars drop the
 * cents; sub-dollar prices (per-unit currency rates) keep up to four
 * decimals with trailing zeros trimmed so "$0.0045" reads correctly
 * instead of rounding to "$0.00".
 */
export function formatStatPrice(price: number): string {
  if (!Number.isFinite(price) || price <= 0) return '0'
  if (price >= 1) {
    return Number.isInteger(price) ? price.toFixed(0) : price.toFixed(2)
  }
  return price.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
}

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
 */
export const getCategoryStats = requestMemo(
  async (gameId: string, categoryId: string): Promise<CategoryStats> => {
    const supabase = await createClient()
    // Parity with the visible grids: Offline-Mode sellers are hidden on
    // the page, so their listings must not inflate the advertised
    // count/low price either. (The flexible-currency minQty>=100 client
    // filter is intentionally NOT mirrored here — stats describe the
    // full active book.)
    const [pausedSellerIds, testSellerIds] = await Promise.all([
      getPausedSellerIds(),
      getTestSellerIds(),
    ])
    // SEO hygiene: exclude BOTH offline (paused) and test/demo sellers so the
    // advertised count / low price / delivery in titles + JSON-LD reflect only
    // real, buyable listings.
    const hiddenSellerIds = Array.from(new Set([...pausedSellerIds, ...testSellerIds]))
    let query = supabase
      .from('listings')
      .select('price, delivery_time')
      .eq('game_id', gameId)
      .eq('category_id', categoryId)
      .eq('status', 'active')
    if (hiddenSellerIds.length > 0) {
      query = query.not('seller_id', 'in', `(${hiddenSellerIds.join(',')})`)
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

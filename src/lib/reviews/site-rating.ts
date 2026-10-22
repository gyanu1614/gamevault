import { unstable_cache } from 'next/cache'

import { createAnonClient } from '@/lib/supabase/anon'

/**
 * The checkout's "Buyer Rating" card (owner 2026-10-21): the average star
 * rating buyers gave our sellers, over every visible review. Real data only —
 * below MIN_REVIEWS the card is not shown at all, never padded or faked.
 *
 * Cookie-free (anon client: visible reviews are public under RLS) and cached
 * for an hour, so a checkout render costs no database read on a warm cache.
 * Reads one integer column, capped, so the cost stays flat as reviews grow.
 */

export const MIN_REVIEWS = 10
const MAX_ROWS = 5000

export interface SiteRating {
  average: number
  count: number
}

/** Pure: the rounded average of 1–5 star ratings, or null below the floor. */
export function summariseRatings(ratings: readonly number[], min = MIN_REVIEWS): SiteRating | null {
  const valid = ratings.filter((r) => Number.isFinite(r) && r >= 1 && r <= 5)
  if (valid.length < min) return null
  const average = Math.round((valid.reduce((s, r) => s + r, 0) / valid.length) * 10) / 10
  return { average, count: valid.length }
}

export const getSiteRating = unstable_cache(
  async (): Promise<SiteRating | null> => {
    const { data, error } = await createAnonClient()
      .from('reviews')
      .select('rating')
      .eq('is_visible', true)
      .limit(MAX_ROWS)
    // A failed read hides the card; it never shows a made-up number.
    if (error || !data) return null
    return summariseRatings(data.map((r: { rating: number }) => Number(r.rating)))
  },
  ['site-buyer-rating'],
  { revalidate: 3600 },
)

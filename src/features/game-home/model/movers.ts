import { TREND_MIN_PCT } from '@/lib/values/trends'
import type { FeedItem } from '../types'

export interface MoverRow {
  slug: string
  name: string
  imageUrl: string | null
  href: string | null
  pct: number
  /** The form the move is for ("FR"), or null. */
  label: string | null
}

const row = (i: FeedItem): MoverRow => ({ slug: i.slug, name: i.name, imageUrl: i.imageUrl, href: i.href, pct: i.trendPct!, label: i.trendLabel })

/**
 * Biggest Price Moves: the 7-day % already on the value-list rows
 * (lib/values/trends.ts), biggest up and biggest down. Items worth under
 * `minUsd` are left out, so a $0.01 → $0.03 "+200%" never leads the section;
 * moves under the list's own floor don't count. Null when fewer than two
 * items moved (the section hides).
 */
export function pickMovers(items: readonly FeedItem[], n = 3, minUsd = 1): { rising: MoverRow[]; falling: MoverRow[] } | null {
  const moved = items.filter(
    (i) => i.trendPct != null && Math.abs(i.trendPct) >= TREND_MIN_PCT && i.valueUsd != null && i.valueUsd >= minUsd,
  )
  if (moved.length < 2) return null
  const rising = moved
    .filter((i) => i.trendPct! > 0)
    .sort((a, b) => b.trendPct! - a.trendPct!)
    .slice(0, n)
    .map(row)
  const falling = moved
    .filter((i) => i.trendPct! < 0)
    .sort((a, b) => a.trendPct! - b.trendPct!)
    .slice(0, n)
    .map(row)
  return { rising, falling }
}

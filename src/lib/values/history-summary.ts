import { formatUsd } from '@/lib/value-listings/format'

/**
 * Value pages draw their price chart in the browser only, so crawlers see an
 * empty box. This says what the chart shows, as one server-rendered line:
 * the move over the last 30 days (or since the first price), the low and the
 * high, and how many daily prices back it. Needs 5+ points; fewer is too
 * thin to quote. Unique per item, which is what lifts these pages out of
 * "discovered, not indexed" (SEO research 2026-10-15).
 */
export function priceHistorySummary(subject: string, points: { date: string; price: number }[] | undefined): string | null {
  if (!points || points.length < 5) return null
  const last = points[points.length - 1]
  const cutoff = Date.parse(last.date) - 30 * 86_400_000
  const recent = points.filter((p) => Date.parse(p.date) >= cutoff && p.price > 0)
  if (recent.length < 5) return null
  const first = recent[0]
  const days = Math.round((Date.parse(last.date) - Date.parse(first.date)) / 86_400_000) + 1
  const change = (last.price - first.price) / first.price
  const pct = Math.round(Math.abs(change) * 100)
  const move = pct === 0 ? 'no change' : `${change > 0 ? 'up' : 'down'} ${pct}%`
  const prices = recent.map((p) => p.price)
  return `Over the last ${days} days the ${subject} moved from ${formatUsd(first.price)} to ${formatUsd(last.price)} (${move}), with a low of ${formatUsd(Math.min(...prices))} and a high of ${formatUsd(Math.max(...prices))} across ${recent.length} daily prices.`
}

/**
 * The 7-day price change every value card shows (MM2 since 2026-10-05; Steal
 * a Brainrot and Adopt Me from 2026-10-23). One rule: compare each item's
 * snapshot on the newest history day with its snapshot on the oldest day
 * inside the window; no change unless both days exist. Pure.
 */
export const TREND_DAYS = 7
/** Moves smaller than this are shown as no move at all. */
export const TREND_MIN_PCT = 0.05

/** The first day the window looks back to from `toDate` (YYYY-MM-DD). */
export function trendWindowStart(toDate: string, days: number = TREND_DAYS): string {
  const d = new Date(`${toDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

/** Percent change from `first` to `last`, rounded to 0.1; null when it can't be told or is under the floor. */
export function visibleTrend(first: number | null | undefined, last: number | null | undefined): number | null {
  if (first == null || last == null || !(first > 0) || !Number.isFinite(last)) return null
  const pct = ((last - first) / first) * 100
  return Math.abs(pct) >= TREND_MIN_PCT ? Math.round(pct * 10) / 10 : null
}

/**
 * Two days of snapshot rows → change per key. `rows` hold both days (any
 * order); keys present on only one day get nothing.
 */
export function changesBetween<T>(
  rows: readonly T[],
  { fromDate, toDate, keyOf, dateOf, valueOf }: {
    fromDate: string
    toDate: string
    keyOf: (r: T) => string
    dateOf: (r: T) => string
    valueOf: (r: T) => number | null
  },
): Map<string, number> {
  const first = new Map<string, number>()
  const last = new Map<string, number>()
  for (const r of rows) {
    const v = valueOf(r)
    if (v == null || !Number.isFinite(v)) continue
    if (dateOf(r) === fromDate) first.set(keyOf(r), v)
    else if (dateOf(r) === toDate) last.set(keyOf(r), v)
  }
  const out = new Map<string, number>()
  for (const [key, from] of first) {
    const pct = visibleTrend(from, last.get(key))
    if (pct != null) out.set(key, pct)
  }
  return out
}

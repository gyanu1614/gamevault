/**
 * The ONE "did this price change?" rule for every value game (T1, 2026-10-04).
 *
 * Why a threshold. A daily crawl re-averages live listings, so most prices
 * wobble by a cent or two every run. Before this rule every wobble rebuilt the
 * item page (an ISR write of ~400 KB of HTML + RSC, ~50 write units) and Adopt
 * Me / Steal an Egg rebuilt EVERY item page of the game on every run. A price
 * now counts as changed only when it moves more than
 *
 *     max(minRelative × |published|, minAbsoluteUsd)      default 3% / $0.05
 *
 * against the LAST PUBLISHED value (the `values_published_prices` snapshot),
 * not against the previous run. That matters: run-over-run, a +2%/day drift
 * would never publish; against the published value it does on day two.
 *
 * Sub-threshold moves are still STORED (the game's own price tables and the
 * daily history row) — they are just not pushed to pages. A page rebuilt for
 * any other reason shows them.
 *
 * Pure module: no DB, no Next. The DB side is published-snapshot.ts.
 */

export type PriceChangeRule = {
  /** Fraction of the published price, e.g. 0.03 = 3%. */
  minRelative: number
  /** Absolute floor in USD, so cheap items do not flap on cents. */
  minAbsoluteUsd: number
}

export const DEFAULT_PRICE_CHANGE_RULE: PriceChangeRule = Object.freeze({
  minRelative: 0.03,
  minAbsoluteUsd: 0.05,
})

const finite = (v: number | null | undefined): number | null =>
  v == null || !Number.isFinite(v) ? null : v

/**
 * True when `next` differs from the published `previous` by MORE than the
 * rule's step. A value appearing or disappearing is always a change.
 */
export function isPublishablePriceChange(
  previous: number | null | undefined,
  next: number | null | undefined,
  rule: PriceChangeRule = DEFAULT_PRICE_CHANGE_RULE,
): boolean {
  const a = finite(previous)
  const b = finite(next)
  if (a == null && b == null) return false
  if (a == null || b == null) return true
  const step = Math.max(rule.minRelative * Math.abs(a), rule.minAbsoluteUsd)
  // Rounded to a hundredth of a cent so float noise (1.05 - 1.0 = 0.0500000004)
  // cannot turn "exactly on the threshold" into a change.
  return Math.round(Math.abs(b - a) * 10_000) > Math.round(step * 10_000)
}

/**
 * One published price row: an item (page slug) + a variant (Adopt Me form,
 * SAB mutation, or 'default'), with the numbers the page shows. Field names
 * are free-form (`average`, `cheapest`, `market`…) — every field present on
 * either side is compared.
 */
export type PublishedPrice = {
  itemSlug: string
  variant: string
  prices: Record<string, number | null>
}

export type PriceDiff = {
  /** Item slugs (once each, sorted) whose page must be revalidated. */
  changedSlugs: string[]
  /** Rows to write into the snapshot: only the ones that moved (or are new). */
  upserts: PublishedPrice[]
  /** Snapshot rows whose price no longer exists. */
  deletes: Array<{ itemSlug: string; variant: string }>
  /** True when an empty snapshot was filled without reporting changes. */
  seeded: boolean
}

const keyOf = (r: { itemSlug: string; variant: string }) => `${r.itemSlug}\u0000${r.variant}`

export type DiffOptions = {
  /**
   * An empty snapshot means "first run since the migration", not "every price
   * is new": the pages already show these prices (the last run revalidated the
   * whole game). Seed silently instead of rebuilding every page once more.
   * Default true.
   */
  seedWhenEmpty?: boolean
}

export function diffPublishedPrices(
  snapshot: readonly PublishedPrice[],
  current: readonly PublishedPrice[],
  rule: PriceChangeRule = DEFAULT_PRICE_CHANGE_RULE,
  options: DiffOptions = {},
): PriceDiff {
  if (snapshot.length === 0 && (options.seedWhenEmpty ?? true)) {
    return { changedSlugs: [], upserts: [...current], deletes: [], seeded: true }
  }

  const published = new Map(snapshot.map((r) => [keyOf(r), r]))
  const seen = new Set<string>()
  const changed = new Set<string>()
  const upserts: PublishedPrice[] = []

  for (const row of current) {
    const key = keyOf(row)
    seen.add(key)
    const before = published.get(key)
    const fields = new Set([...Object.keys(row.prices), ...Object.keys(before?.prices ?? {})])
    const moved =
      !before ||
      [...fields].some((f) => isPublishablePriceChange(before.prices[f], row.prices[f], rule))
    if (moved) {
      changed.add(row.itemSlug)
      upserts.push(row)
    }
  }

  const deletes: PriceDiff['deletes'] = []
  for (const row of snapshot) {
    if (seen.has(keyOf(row))) continue
    // Only a row that actually carried a price is a visible change.
    if (Object.values(row.prices).some((v) => finite(v) != null)) changed.add(row.itemSlug)
    deletes.push({ itemSlug: row.itemSlug, variant: row.variant })
  }

  return { changedSlugs: [...changed].sort(), upserts, deletes, seeded: false }
}

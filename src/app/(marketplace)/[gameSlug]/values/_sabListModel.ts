/**
 * The Steal a Brainrot value list's rows and its filter + sort, shared by the
 * server (which renders the default view's first page, lib/values/lazy-list.ts)
 * and the client (which applies the visitor's view once the full list
 * arrives), so both always agree on what "page 1" is.
 */

/**
 * One mutation option for the in-card switcher. Prices are the REAL reputable
 * cheapest/average for that mutation (null → the card shows "No Sales"; we never
 * estimate). `income` is that mutation's income per second, `multiplier` its
 * income multiplier vs default.
 */
export type CardMutation = {
  slug: string
  name: string
  multiplier: number | null
  income: number | null
  cheapest_usd: number | null
  average_usd: number | null
}

export type BrainrotDirectoryItem = {
  id: string
  name: string
  slug: string
  rarity: string
  obtainability: string
  base_income_per_second: number | string | null
  image_url: string | null
  display_price_usd: number | string | null
  display_price_label: string
  display_price_source: string
  confidence_label: string
  /** Every mutation this item has metadata for, with real per-mutation prices
   * (absent/null = no sales). Drives the in-card mutation switcher. */
  mutations?: CardMutation[]
  /**
   * Low/high of the real listings behind the value. Retained for items not yet
   * priced by the reputable path (fallback range display).
   */
  market_low_usd?: number | null
  market_high_usd?: number | null
  /**
   * Reputable-seller prices: cheapest (lowest 100+ review listing) and average
   * (typical reputable price). When present these are the buyer-facing pair —
   * the row shows "Cheapest $X" and the headline "Market price" is the average.
   */
  cheapest_usd?: number | null
  average_usd?: number | null
  /**
   * Listings/sales we actually observed behind this item's price. Legacy
   * popularity proxy — kept as the tiebreaker; the primary Popular ordering is
   * now popularity_rank.
   */
  sample_size?: number | null
  /**
   * Real marketplace popularity rank (1 = most popular), from Eldorado's
   * usePopularItems ordering. The Popular tab sorts by this; null-rank items
   * (never seen in the popular feed) sort after all ranked items.
   */
  popularity_rank?: number | null
}

export type SabSort = 'value-desc' | 'name' | 'income-desc' | 'income-asc'

/** 24 = a multiple of every grid width (2/3/4/6), so the last row always fills. */
export const SAB_PAGE_SIZE = 24
export const SAB_DEFAULT_VIEW = 'popular'
export const SAB_DEFAULT_OBTAIN = 'all'
export const SAB_DEFAULT_SORT: SabSort = 'value-desc'

export function asNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function compareIncome(
  a: BrainrotDirectoryItem,
  b: BrainrotDirectoryItem,
  direction: 'asc' | 'desc',
): number {
  const aIncome = asNumber(a.base_income_per_second)
  const bIncome = asNumber(b.base_income_per_second)

  if (aIncome == null && bIncome == null) return a.name.localeCompare(b.name)
  if (aIncome == null) return 1
  if (bIncome == null) return -1

  return direction === 'asc' ? aIncome - bIncome : bIncome - aIncome
}

/** Highest value first, unpriced items last (never sorted as if they were $0). */
export function compareValue(a: BrainrotDirectoryItem, b: BrainrotDirectoryItem): number {
  const av = asNumber(a.display_price_usd)
  const bv = asNumber(b.display_price_usd)
  if (av == null && bv == null) return a.name.localeCompare(b.name)
  if (av == null) return 1
  if (bv == null) return -1
  return bv - av
}

export function filterSortBrainrots(
  brainrots: BrainrotDirectoryItem[],
  { query, view, obtainability, sort }: { query: string; view: string; obtainability: string; sort: SabSort },
): BrainrotDirectoryItem[] {
  // A search looks through everything, not just the popular ordering.
  const effectiveView = query.trim().length > 0 && view === 'popular' ? 'all' : view
  const normalizedQuery = query.trim().toLowerCase()

  const filtered = brainrots.filter((brainrot) => {
    const matchesQuery =
      !normalizedQuery ||
      `${brainrot.name} ${brainrot.rarity} ${brainrot.obtainability}`
        .toLowerCase()
        .includes(normalizedQuery)

    const matchesRarity =
      effectiveView === 'popular' ||
      effectiveView === 'all' ||
      brainrot.rarity === effectiveView

    const matchesObtainability =
      obtainability === 'all' || brainrot.obtainability === obtainability

    return matchesQuery && matchesRarity && matchesObtainability
  })

  // Popular = a BLEND of real marketplace popularity AND cash value, so the
  // tab surfaces items that are both traded a lot AND worth something — not
  // popular-but-worthless junk. We rank each item on both axes independently
  // (popularity_rank from Eldorado's usePopularItems; value rank from the
  // corrected market price) and sort by the AVERAGE of the two rank positions.
  // An item strong on both (e.g. #4 popular, #6 valuable) beats one that is
  // wildly popular but near-worthless (#2 popular, #300 valuable). Items
  // missing a rank on either axis take that axis's worst position, so they
  // sink behind anything ranked on both.
  if (effectiveView === 'popular') {
    const n = filtered.length
    // Value rank: 0 = most valuable. Unpriced items get the worst position.
    const byValue = [...filtered].sort(compareValue)
    const valueRank = new Map<string, number>()
    byValue.forEach((item, i) => valueRank.set(item.id, i))

    // Popularity rank: Eldorado's is 1-based and sparse (not every item is in
    // the feed). Rerank the ones that ARE present into a dense 0-based order,
    // so the two axes are on the same scale; absent items take the worst.
    const byPop = [...filtered]
      .filter((item) => item.popularity_rank != null)
      .sort((a, b) => (a.popularity_rank as number) - (b.popularity_rank as number))
    const popRank = new Map<string, number>()
    byPop.forEach((item, i) => popRank.set(item.id, i))

    const blended = (item: BrainrotDirectoryItem) => {
      const pr = popRank.has(item.id) ? popRank.get(item.id)! : n
      const vr = valueRank.has(item.id) ? valueRank.get(item.id)! : n
      return (pr + vr) / 2
    }

    return [...filtered].sort((a, b) => {
      const diff = blended(a) - blended(b)
      if (diff !== 0) return diff
      // Tie-break: more observed activity, then higher value.
      const act = (asNumber(b.sample_size) ?? 0) - (asNumber(a.sample_size) ?? 0)
      return act !== 0 ? act : compareValue(a, b)
    })
  }

  return [...filtered].sort((a, b) => {
    if (sort === 'income-desc') return compareIncome(a, b, 'desc')
    if (sort === 'income-asc') return compareIncome(a, b, 'asc')
    if (sort === 'name') return a.name.localeCompare(b.name)
    return compareValue(a, b)
  })
}

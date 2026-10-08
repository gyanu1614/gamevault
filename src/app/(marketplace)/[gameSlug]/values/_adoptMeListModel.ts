/**
 * The Adopt Me value list's rows and its filter + sort, shared by the server
 * (which renders the default view's first page, lib/values/lazy-list.ts) and
 * the client (which applies the visitor's view once the full list arrives),
 * so both always agree on what "page 1" is.
 */

import type { Variant } from '../calculator/_adoptMeCalcTypes'

/* ── Row shape ──────────────────────────────────────────────────────────────── */
export interface AdoptMeVariantValue {
  variant: Variant
  tradeValue: number | null
  /** Headline cash = reputable market (average) when present, else legacy value. */
  cashUsd: number | null
  /** Lowest reputable-seller price (100+ reviews). Null until priced. */
  cheapestUsd: number | null
  /** Reputable market price (median of cheapest reputable listings). */
  averageUsd: number | null
  isEstimated: boolean
  confidence: string
}
export interface AdoptMePetItem {
  slug: string
  name: string
  rarity: string
  imageUrl: string | null
  topTradeValue: number
  /** Market demand rank (1 = most in-demand). Drives the Popular ordering;
   *  null-rank pets sort after ranked ones. */
  demandRank: number | null
  /** True when a /adopt-me/values/{slug} page exists — only then is the row a link. */
  hasPage: boolean
  values: Record<Variant, AdoptMeVariantValue | undefined>
}

export type AdoptMeView = 'popular' | 'all' | string
export type AdoptMeSort = 'value-desc' | 'value-asc' | 'cash-desc' | 'cash-asc' | 'name'

export const ADOPT_ME_PAGE_SIZE = 25
/** The top few by demand get a "Popular" tag on their card. */
export const ADOPT_ME_POPULAR_COUNT = 12
export const ADOPT_ME_DEFAULT_VARIANT: Variant = 'FR'
export const ADOPT_ME_DEFAULT_VIEW: AdoptMeView = 'popular'
export const ADOPT_ME_DEFAULT_SORT: AdoptMeSort = 'value-desc'

/**
 * Demand-first ordering: lower demand_rank = more popular (rank 1 first);
 * null-rank pets fall to the end, tiebroken by top trade value. This is the
 * Popular ORDERING — Popular is not a 12-item cut, it runs the WHOLE list
 * most-in-demand first and pages through everything (mirrors SAB).
 */
export function byDemand(a: AdoptMePetItem, b: AdoptMePetItem): number {
  const ar = a.demandRank ?? Infinity
  const br = b.demandRank ?? Infinity
  if (ar !== br) return ar - br
  return b.topTradeValue - a.topTradeValue
}

export function popularPetSlugs(pets: AdoptMePetItem[]): string[] {
  return [...pets].sort(byDemand).slice(0, ADOPT_ME_POPULAR_COUNT).map((p) => p.slug)
}

export function filterSortPets(
  pets: AdoptMePetItem[],
  { query, view, sort, variant }: { query: string; view: AdoptMeView; sort: AdoptMeSort; variant: Variant },
): AdoptMePetItem[] {
  const q = query.trim().toLowerCase()
  // Popular is an ORDERING, not a filter — it keeps the full list and only
  // changes the sort, so paging carries through every pet. A rarity chip still
  // filters to that rarity; 'all' is the whole list A-Z/by-sort.
  const list = pets.filter((p) => {
    if (q && !p.name.toLowerCase().includes(q)) return false
    if (view === 'popular' || view === 'all') return true
    return p.rarity === view
  })
  return [...list].sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name)
    if (sort === 'cash-desc' || sort === 'cash-asc') {
      // Cheapest is the buyer-facing headline; sort on it, unpriced last.
      const ac = a.values[variant]?.cheapestUsd ?? a.values[variant]?.cashUsd ?? -1
      const bc = b.values[variant]?.cheapestUsd ?? b.values[variant]?.cashUsd ?? -1
      return sort === 'cash-asc' ? ac - bc : bc - ac
    }
    // Default (value-desc) in the Popular view means "most in demand first".
    if (view === 'popular' && sort === 'value-desc') return byDemand(a, b)
    const av = a.values[variant]?.tradeValue ?? -1
    const bv = b.values[variant]?.tradeValue ?? -1
    return sort === 'value-asc' ? av - bv : bv - av
  })
}

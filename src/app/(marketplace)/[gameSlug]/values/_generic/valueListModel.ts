/**
 * The generic value list's rows and its filter + sort, shared by the server
 * (which renders the default view's first page, lib/values/lazy-list.ts) and
 * the client (which applies the visitor's view once the full list arrives),
 * so both always agree on what "page 1" is.
 */

import { matchesValueListTab, type ValueListTab } from '@/lib/values/hub-config'

/** One list row (light: no obtain/history). */
export interface ValueListRow {
  id: string
  slug: string
  name: string
  rarity: string | null
  itemType: string | null
  imageUrl: string | null
  /** The item page, or null when the item has none (commons, unpriced). */
  href: string | null
  cheapestUsd: number | null
  marketUsd: number | null
  /** Reputable live listings behind the price at the last daily check. */
  listedNow: number
  /** 7-day change in percent; null without two days of history. */
  trendPct: number | null
}

export type ValueListSort = 'price-desc' | 'price-asc' | 'movers' | 'listed' | 'name'

export const VALUE_LIST_PAGE_SIZE = 25
export const VALUE_LIST_DEFAULT_VIEW = 'all'
export const VALUE_LIST_DEFAULT_SORT: ValueListSort = 'price-desc'

/** Rows per tab, for the filter tiles. */
export function valueListTabCounts(tabs: readonly ValueListTab[], rows: ValueListRow[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const t of tabs) out[t.key] = rows.filter((r) => matchesValueListTab(t, r)).length
  return out
}

export function filterSortValueRows(
  rows: ValueListRow[],
  { query, tab, sort }: { query: string; tab: Pick<ValueListTab, 'rarity' | 'itemType'> | null; sort: ValueListSort },
): ValueListRow[] {
  const q = query.trim().toLowerCase()
  const list = rows.filter((r) => (!q || r.name.toLowerCase().includes(q)) && matchesValueListTab(tab, r))
  const priceOf = (r: ValueListRow) => r.cheapestUsd ?? -1
  return [...list].sort((a, b) => {
    // Unpriced items always sink, whatever the sort.
    const ap = a.cheapestUsd != null
    const bp = b.cheapestUsd != null
    if (ap !== bp && sort !== 'name') return ap ? -1 : 1
    switch (sort) {
      case 'price-asc':
        return priceOf(a) - priceOf(b)
      case 'movers': {
        const am = a.trendPct == null ? -1 : Math.abs(a.trendPct)
        const bm = b.trendPct == null ? -1 : Math.abs(b.trendPct)
        return bm - am || priceOf(b) - priceOf(a)
      }
      case 'listed':
        return b.listedNow - a.listedNow || priceOf(b) - priceOf(a)
      case 'name':
        return a.name.localeCompare(b.name)
      default:
        return priceOf(b) - priceOf(a) || a.name.localeCompare(b.name)
    }
  })
}

import { pack, type Packed } from '@/lib/serialize/columnar'

/**
 * Value lists ship their FIRST PAGE in the page and fetch the rest.
 *
 * Why (owner, 2026-10-07): the MM2, Adopt Me and Steal a Brainrot value lists
 * handed every row (500–1,067 items, each with per-variant or per-mutation
 * prices) to the client component as a prop, so the whole list sat in the
 * page's HTML: 0.8–1.7 MB. Bing flagged all three "HTML size is too long"
 * (soft limit ~125 KB) and failed to fetch /murder-mystery-2/values. These are
 * the pages that get us found, so every value list — and every new one built
 * on the shared template — follows this contract:
 *
 * - The page renders the default view's first page (`initial.rows`) plus the
 *   numbers the toolbar needs before the rest arrives (`total`, `facets`).
 *   Crawlers still see every item: the A–Z index links them all.
 * - The full list is the static, cached `/[game]/values/rows.json` (same
 *   readers and cache tags as the page, refreshed by the same revalidation).
 * - The client fetches it right after hydration (useValueListRows). Until it
 *   lands, the default view shows the first page; any other view shows its
 *   loading state.
 *
 * `value-list-lazy.guard.test.ts` fails a value list that hands its client
 * component the full row array again.
 */

/** Rows the page itself may carry: one page of the default view. */
export const INITIAL_ROWS_MAX = 25

export function valueRowsUrl(gameSlug: string): string {
  return `/${gameSlug}/values/rows.json`
}

export interface InitialValueList {
  /** pack(first page of the default view, in display order). */
  rows: Packed
  /** Rows in the whole list. */
  total: number
  /** Counts the toolbar shows before the full list arrives, by facet: { rarity: { Godly: 40 } }. */
  facets: Record<string, Record<string, number>>
  /** Small per-list extras the first page needs (e.g. which slugs get a "Popular" tag). */
  extra?: Record<string, unknown>
}

/** Count rows per value of each facet key. */
export function countFacets<T>(rows: T[], keys: Record<string, (row: T) => string | null | undefined>) {
  const facets: Record<string, Record<string, number>> = {}
  for (const [facet, get] of Object.entries(keys)) {
    const m: Record<string, number> = {}
    for (const row of rows) {
      const v = get(row)
      if (v) m[v] = (m[v] ?? 0) + 1
    }
    facets[facet] = m
  }
  return facets
}

/** Build the page's share of a value list from the full list in default display order. */
export function initialValueList<T>(
  ordered: T[],
  {
    pageSize,
    facets,
    extra,
  }: { pageSize: number; facets: Record<string, Record<string, number>>; extra?: Record<string, unknown> },
): InitialValueList {
  return {
    rows: pack(ordered.slice(0, Math.min(pageSize, INITIAL_ROWS_MAX))),
    total: ordered.length,
    facets,
    ...(extra ? { extra } : {}),
  }
}

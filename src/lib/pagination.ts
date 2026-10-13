/**
 * Page maths for the listing grids (items, other categories, storefronts).
 * Every grid already holds its full filtered list in the browser, so paging
 * is a slice: no extra query per page.
 *
 * URLs: page 1 is the bare path (the canonical, the prerendered HTML); later
 * pages are `?page=N`, which robots.txt disallows, so crawlers never see
 * duplicate grids and the static page stays the one that ranks.
 */

export type PageSlot = number | 'gap'

export function pageCount(total: number, size: number): number {
  return Math.max(1, Math.ceil(total / size))
}

/** A `?page=` value as a page number: a positive integer, clamped to the last page; anything else is page 1. */
export function parsePage(raw: string | null | undefined, totalPages: number): number {
  if (!raw || !/^\d+$/.test(raw)) return 1
  const n = Number(raw)
  if (n < 1) return 1
  return Math.min(n, Math.max(1, totalPages))
}

export function pageSlice<T>(items: readonly T[], page: number, size: number): T[] {
  const start = (page - 1) * size
  return items.slice(start, start + size)
}

/**
 * The buttons to draw: first, last, the current page and its neighbours,
 * with a 'gap' for each run of hidden pages. Always seven slots once there
 * are more than seven pages, so the bar never changes width as you page;
 * a gap never stands in for a single page (that page is shown instead).
 */
export function pageWindow(current: number, total: number): PageSlot[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, 'gap', total]
  if (current >= total - 3) return [1, 'gap', total - 4, total - 3, total - 2, total - 1, total]
  return [1, 'gap', current - 1, current, current + 1, 'gap', total]
}

/** The URL of page `page` on `pathname`, keeping the other params. Page 1 drops `page`. */
export function pageHref(pathname: string, search: string, page: number): string {
  const params = new URLSearchParams(search)
  if (page <= 1) params.delete('page')
  else params.set('page', String(page))
  const qs = params.toString()
  return qs ? `${pathname}?${qs}` : pathname
}

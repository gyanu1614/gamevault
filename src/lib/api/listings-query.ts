/**
 * Query rules for the public listing grid (/browse). Pure.
 *
 * - One page at a time: the grid used to load every live listing (with
 *   seller, game and category joins) in one request.
 * - "Price: Low to High" sorts ascending; newest and popular sort descending.
 * - The search goes inside a PostgREST or() filter, where a comma or bracket
 *   would start a new clause: those characters (and the wildcards) become
 *   spaces.
 */
export const LISTINGS_PAGE_SIZE = 24

export type ListingSort = 'created_at' | 'price' | 'sales'

export function listingOrder(sortBy: ListingSort | undefined): { column: ListingSort; ascending: boolean } {
  const column = sortBy ?? 'created_at'
  return { column, ascending: column === 'price' }
}

export function cleanListingSearch(raw: string): string {
  return raw.replace(/[,()*%\\]/g, ' ').replace(/\s+/g, ' ').trim()
}

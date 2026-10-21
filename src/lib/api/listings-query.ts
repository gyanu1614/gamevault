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

/**
 * Only what ListingCard renders, listingUrl() links and the seller line shows
 * (2026-10-20 usage audit, A7). It was `*` plus the seller, game and category
 * rows joined WHOLE. Validated against the local PostgREST in
 * listings-select.integration.test.ts.
 */
export const BROWSE_LISTING_SELECT = [
  'id, slug, title, price, original_price, images, quantity, is_unlimited, delivery_time, sales, views, created_at, game_id, game_category_id',
  'seller:public_profiles!listings_seller_id_fkey!inner(id, username, shop_name, shop_slug, avatar_url, is_verified, total_reviews, total_sales, seller_rating, seller_tier, is_test)',
  'game:games!listings_game_id_fkey(slug, name, emoji)',
  // No `icon`: game_categories has none (the card's category.icon was always empty).
  'category:game_categories!listings_game_category_id_fkey(slug, name, type)',
].join(', ')

/** The game and category dropdowns show a name and filter by id. */
export const BROWSE_GAME_SELECT = 'id, name'
export const BROWSE_CATEGORY_SELECT = 'id, name'

export type ListingSort = 'created_at' | 'price' | 'sales'

export function listingOrder(sortBy: ListingSort | undefined): { column: ListingSort; ascending: boolean } {
  const column = sortBy ?? 'created_at'
  return { column, ascending: column === 'price' }
}

export function cleanListingSearch(raw: string): string {
  return raw.replace(/[,()*%\\]/g, ' ').replace(/\s+/g, ' ').trim()
}

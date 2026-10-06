import { createTaggedAnonClient } from '@/lib/supabase/anon'
import { categoryListingsTag } from '@/lib/revalidation/listings'
import { HOME_LISTINGS_TAG } from '@/lib/revalidation/tags'

/**
 * The ONLY clients for marketplace listing reads on prerendered public pages
 * (category pages, the game hub, the homepage rails, the currency-listing
 * redirect). Cookie-free, so pages stay static.
 *
 * Why (2026-10-05, the values bug of #144 on the listing surfaces): on Next 14
 * an un-annotated server fetch on a static route is stored in the Data Cache
 * with the page's revalidate window and NO tags. supabase-js fetches are
 * un-annotated, so a listing mutation's `revalidateTag('listings:category:<id>')`
 * re-rendered the category page and the re-render was served the OLD listing
 * rows, counts and prices until the 24 h window ran out. Every response these
 * clients fetch is cached under the tags revalidateListingSurfaces
 * (lib/revalidation/listings.ts) revalidates, so a mutation refreshes the
 * DATA and not just the page shell. The tags also bind the render, so a page
 * that reads a category's listings is refreshed with that category.
 *
 * Guarded by src/test/guards/listings-data-tags.guard.test.ts.
 */

/**
 * Listing reads scoped to these game_categories rows — a category page (one
 * id) or a game hub (every category its read spans). Pass EVERY category the
 * query can return rows from: a listing in a category left out would not
 * refresh this read.
 */
export function createCategoryListingsReadClient(gameCategoryIds: readonly string[]) {
  return createTaggedAnonClient({ tags: [...new Set(gameCategoryIds)].map(categoryListingsTag) })
}

/** The homepage rails' listing reads (any game, any category). */
export function createHomeListingsReadClient() {
  return createTaggedAnonClient({ tags: [HOME_LISTINGS_TAG] })
}

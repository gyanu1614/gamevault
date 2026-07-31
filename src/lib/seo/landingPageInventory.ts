/**
 * Inventory behind the /buy/[seoSlug] landing pages.
 *
 * Lives in one place because the page and the sitemap must agree on what a
 * landing page contains. They previously didn't: the page resolved its own
 * filters (badly) while the sitemap listed every configured slug
 * unconditionally, so pages showing "coming soon" were still being submitted
 * to Google as ranking candidates.
 *
 * Resolution is strict on purpose. A configured slug that doesn't resolve to a
 * real, active row returns NO listings rather than silently dropping the filter
 * — dropping it made /buy/buy-roblox-items advertise "Roblox Items" while
 * listing Robux and accounts.
 */

import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { LandingPage } from './landingPages'
import type { ListingWithRelations } from '@/types/database'

// `!inner` so the is_test filter below actually constrains the join rather
// than just nulling the embedded seller.
const LISTING_SELECT = `
  id, slug, title, price, currency, images, delivery_time, is_unlimited, quantity, views, sales,
  seller:profiles!listings_seller_id_fkey!inner(id, username, avatar_url, seller_rating, is_test),
  game:games!listings_game_id_fkey(id, name, slug, emoji),
  category:categories!listings_category_id_fkey(id, name, slug, icon)
`

/**
 * Listings for a landing page, or [] when its configured game/category can't
 * be resolved. Wrapped in `cache()` so generateMetadata (which needs the count
 * to decide indexability) and the page body share a single round trip.
 */
export const getLandingPageListings = cache(async function getLandingPageListings(
  page: LandingPage,
): Promise<ListingWithRelations[]> {
  const supabase = await createClient()

  let query = supabase
    .from('listings')
    .select(LISTING_SELECT)
    .eq('status', 'active')
    // SEO hygiene, matching sitemap.ts and the game-hub indexability gate:
    // /buy/* is a search-landing surface, so it must not advertise demo
    // inventory. Excluding test sellers means fewer pages qualify as
    // indexable — that's the honest count, not a regression.
    .eq('seller.is_test', false)
    .order('sales', { ascending: false })
    .limit(12)

  let gameId: string | null = null

  if (page.gameSlug) {
    const { data: game } = (await supabase
      .from('games')
      .select('id')
      .eq('slug', page.gameSlug)
      .eq('is_active', true)
      .maybeSingle()) as { data: { id: string } | null; error: unknown }
    if (!game) return []
    gameId = game.id
    query = query.eq('game_id', game.id)
  }

  if (page.categorySlug) {
    // Category slugs repeat across games, and `categories` still holds at
    // least one orphan row with a NULL game_id (slug 'accounts') that an
    // unscoped lookup happily matched — filtering four pages to a category no
    // listing belongs to. Scope by game, and require an active row.
    let categoryQuery = supabase
      .from('categories')
      .select('id')
      .eq('slug', page.categorySlug)
      .eq('is_active', true)
    if (gameId) categoryQuery = categoryQuery.eq('game_id', gameId)

    const { data: category } = (await categoryQuery.maybeSingle()) as {
      data: { id: string } | null
      error: unknown
    }
    if (!category) return []
    query = query.eq('category_id', category.id)
  }

  const { data, error } = await query
  if (error) return []
  return (data ?? []) as unknown as ListingWithRelations[]
})

/**
 * A landing page with nothing to list is thin content — the same shape as the
 * soft 404s we just cleaned up. Mirrors the indexability gate on the game hubs
 * (`[gameSlug]/page.tsx`): stay out of the index until there's something real
 * to rank, but keep following links.
 */
export async function isLandingPageIndexable(page: LandingPage): Promise<boolean> {
  return (await getLandingPageListings(page)).length > 0
}

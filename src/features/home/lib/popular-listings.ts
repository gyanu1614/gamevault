/**
 * popular-listings — live category aggregation for the homepage
 * "Shop by category" tabs (Items / Accounts / Currencies / Top-Ups).
 *
 * ONE client-side read of the active listing book, aggregated in JS into
 * per-(game, category) rows carrying the TRUE minimum price and TRUE
 * active-listing count. No fabricated numbers: a category with zero
 * active listings simply doesn't appear.
 *
 * Parity with the marketplace grids and the SEO stats (see
 * src/lib/seo/page-stats.ts): listings from sellers in Offline Mode
 * (seller_presence.store_paused = true) are excluded so a paused store
 * never inflates the advertised count or drags down the "from" price.
 *
 * These helpers run in the browser (react-query hooks), so they use the
 * client Supabase instance and read seller_presence directly — it has a
 * public SELECT policy, same as games/categories/listings.
 */

import { createClient } from '@/lib/supabase/client'
import { classifyOfferType, type OfferType } from '@/lib/utils/offer-type'
import { getGameIcon } from './game-icons'

/** One aggregated (game, category) group with live count + min price. */
export interface PopularCategoryGroup {
  /** OfferType bucket — which homepage tab this group belongs to. */
  type: OfferType
  gameSlug: string
  /** Display label for the game (display_name || name). */
  gameName: string
  gameIcon: string
  categorySlug: string
  categoryName: string
  /** Cheapest active listing price in the group (> 0). */
  fromPrice: number
  /** Number of active listings in the group. */
  listingCount: number
}

interface ListingAggRow {
  price: number | null
  game: { slug: string; name: string; display_name: string | null } | null
  category: { slug: string; name: string; metadata: { type?: string } | null } | null
}

/**
 * Fetch every active listing (minus Offline-Mode sellers), grouped by
 * (game, category), each with its real min price and active count.
 * Groups are sorted by listing count descending — busiest first — which
 * is what "popular" means here. Returns [] on any error or empty book.
 */
export async function fetchPopularCategoryGroups(): Promise<PopularCategoryGroup[]> {
  const supabase = createClient()

  // Sellers in Offline Mode are hidden from the marketplace, so their
  // listings must not count toward the homepage's advertised numbers
  // either. Fail-open ([]) — better to show real listings than to blank
  // the homepage on a transient presence-read error.
  let pausedSellerIds: string[] = []
  const presence = await supabase
    .from('seller_presence')
    .select('seller_id')
    .eq('store_paused', true)
  if (!presence.error && presence.data) {
    pausedSellerIds = (presence.data as { seller_id: string }[])
      .map((r) => r.seller_id)
      .filter(Boolean)
  }

  let query = supabase
    .from('listings')
    .select(
      `price,
       game:games!listings_game_id_fkey(slug, name, display_name),
       category:categories!listings_category_id_fkey(slug, name, metadata)`,
    )
    .eq('status', 'active')
  if (pausedSellerIds.length > 0) {
    query = query.not('seller_id', 'in', `(${pausedSellerIds.join(',')})`)
  }

  const { data, error } = (await query) as unknown as {
    data: ListingAggRow[] | null
    error: unknown
  }
  if (error || !data) return []

  // Aggregate per (game, category). Key on the slug pair so distinct
  // categories never collapse together.
  const groups = new Map<string, PopularCategoryGroup>()
  for (const row of data) {
    const price = Number(row.price)
    if (!Number.isFinite(price) || price <= 0) continue
    const game = row.game
    const category = row.category
    if (!game?.slug || !category?.slug) continue

    const key = `${game.slug}::${category.slug}`
    const existing = groups.get(key)
    if (existing) {
      existing.listingCount += 1
      if (price < existing.fromPrice) existing.fromPrice = price
      continue
    }

    groups.set(key, {
      type: classifyOfferType(category.metadata?.type, category.slug),
      gameSlug: game.slug,
      gameName: game.display_name || game.name,
      gameIcon: getGameIcon(game.slug),
      categorySlug: category.slug,
      categoryName: category.name,
      fromPrice: price,
      listingCount: 1,
    })
  }

  return Array.from(groups.values()).sort(
    (a, b) => b.listingCount - a.listingCount,
  )
}

/** Filter aggregated groups to a single OfferType bucket. */
export function groupsOfType(
  groups: PopularCategoryGroup[],
  type: OfferType,
): PopularCategoryGroup[] {
  return groups.filter((g) => g.type === type)
}

/**
 * Format a "from" price for cards. Sub-dollar per-unit currency prices
 * (e.g. Robux at $0.0044) must not round to $0.00 — keep up to 4
 * significant decimals under $1, plain 2dp at/above $1. Mirrors
 * formatStatPrice in page-stats (which is server-only).
 */
export function formatFromPrice(price: number): string {
  if (!Number.isFinite(price) || price <= 0) return '0.00'
  if (price >= 1) return price.toFixed(2)
  return price.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
}

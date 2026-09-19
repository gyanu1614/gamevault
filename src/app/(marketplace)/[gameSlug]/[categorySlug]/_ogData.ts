import { ogRestFetch, slugToTitle, formatUsd, type RestResult } from '@/lib/seo/og-template'

export type OgFetcher = <T>(
  pathWithQuery: string,
  opts?: { count?: boolean },
) => Promise<RestResult<T> | null>

export interface CategoryOgData {
  gameName: string
  categoryName: string
  subtitle: string
}

interface GameRow {
  id: string
  name: string
}
interface CategoryRow {
  id: string
  name: string
}
interface ListingPriceRow {
  price: number | string | null
}

const DEFAULT_SUBTITLE = 'Verified Sellers · Instant Delivery'

/**
 * Live data for the game + category Open Graph card: names, lowest active
 * price and offer count. Any read failure degrades to prettified slugs —
 * never throws (the card must always render).
 *
 * Reads `game_categories` — the only category table app code may read. This
 * used to query the legacy `public.categories` mirror, which Phase B drops.
 * The fetcher is injected so the rule is testable without an image render.
 */
export async function buildCategoryOgData(
  gameSlug: string,
  categorySlug: string,
  fetcher: OgFetcher = ogRestFetch,
): Promise<CategoryOgData> {
  let gameName = slugToTitle(gameSlug)
  let categoryName = slugToTitle(categorySlug)
  let subtitle = DEFAULT_SUBTITLE

  const gameResult = await fetcher<GameRow>(
    `games?slug=eq.${encodeURIComponent(gameSlug)}&select=id,name&limit=1`,
  )
  const game = gameResult?.rows?.[0]
  if (!game) return { gameName, categoryName, subtitle }
  gameName = game.name

  const categoryResult = await fetcher<CategoryRow>(
    `game_categories?slug=eq.${encodeURIComponent(categorySlug)}&game_id=eq.${encodeURIComponent(game.id)}&is_enabled=eq.true&select=id,name&limit=1`,
  )
  const category = categoryResult?.rows?.[0]
  if (!category) return { gameName, categoryName, subtitle }
  categoryName = category.name

  // Lowest active price (first row, price ascending) + exact count from the
  // Content-Range header — one round trip.
  const listingsResult = await fetcher<ListingPriceRow>(
    `listings?game_id=eq.${encodeURIComponent(game.id)}&game_category_id=eq.${encodeURIComponent(category.id)}&status=eq.active&select=price&order=price.asc&limit=1`,
    { count: true },
  )
  const lowPrice = formatUsd(listingsResult?.rows?.[0]?.price)
  const count = listingsResult?.total ?? 0
  if (lowPrice && count > 0) {
    subtitle = `From ${lowPrice} · ${count.toLocaleString('en-US')} ${count === 1 ? 'Offer' : 'Offers'} · Instant Delivery`
  }

  return { gameName, categoryName, subtitle }
}

/**
 * Game + category Open Graph image — /{gameSlug}/{categorySlug}
 *
 * Pulls live data via Supabase REST (edge/runtime-safe plain fetch):
 * game + category names, plus the lowest active price and listing
 * count for the sub-line. Any fetch failure degrades to a card built
 * from prettified slugs — never throws.
 */

import { ImageResponse } from 'next/og'
import {
  OgCard,
  OG_SIZE,
  ogRestFetch,
  slugToTitle,
  formatUsd,
} from '@/lib/seo/og-template'

export const alt = 'Buy and sell on DropMarket — covered by SafeDrop Buyer Protection'
export const size = OG_SIZE
export const contentType = 'image/png'
export const revalidate = 86400

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

export default async function Image({
  params,
}: {
  params: Promise<{ gameSlug: string; categorySlug: string }>
}) {
  const { gameSlug, categorySlug } = await params

  let gameName = slugToTitle(gameSlug)
  let categoryName = slugToTitle(categorySlug)
  let subtitle = 'Verified Sellers · Instant Delivery'

  const gameResult = await ogRestFetch<GameRow>(
    `games?slug=eq.${encodeURIComponent(gameSlug)}&select=id,name&limit=1`
  )
  const game = gameResult?.rows?.[0]

  if (game) {
    gameName = game.name

    const categoryResult = await ogRestFetch<CategoryRow>(
      `categories?slug=eq.${encodeURIComponent(categorySlug)}&game_id=eq.${encodeURIComponent(game.id)}&select=id,name&limit=1`
    )
    const category = categoryResult?.rows?.[0]

    if (category) {
      categoryName = category.name

      // Lowest active price (first row, price ascending) + exact count
      // from the Content-Range header — one round trip.
      const listingsResult = await ogRestFetch<ListingPriceRow>(
        `listings?game_id=eq.${encodeURIComponent(game.id)}&category_id=eq.${encodeURIComponent(category.id)}&status=eq.active&select=price&order=price.asc&limit=1`,
        { count: true }
      )
      const lowPrice = formatUsd(listingsResult?.rows?.[0]?.price)
      const count = listingsResult?.total ?? 0

      if (lowPrice && count > 0) {
        subtitle = `From ${lowPrice} · ${count.toLocaleString('en-US')} ${count === 1 ? 'Offer' : 'Offers'} · Instant Delivery`
      }
    }
  }

  return new ImageResponse(
    (
      <OgCard
        eyebrow={gameName}
        title={categoryName}
        subtitle={subtitle}
      />
    ),
    { ...OG_SIZE }
  )
}

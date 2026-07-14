/**
 * Listing Open Graph image — /{gameSlug}/{categorySlug}/{listingSlug}
 *
 * Live listing title + price via Supabase REST (edge/runtime-safe
 * plain fetch), with the same slug→UUID fallback the page uses.
 * Fetch failure degrades to a generic card — never throws.
 */

import { ImageResponse } from 'next/og'
import {
  OgCard,
  OG_SIZE,
  ogRestFetch,
  slugToTitle,
  formatUsd,
} from '@/lib/seo/og-template'

export const alt = 'Listing on DropMarket — covered by SafeDrop Buyer Protection'
export const size = OG_SIZE
export const contentType = 'image/png'
export const revalidate = 86400

interface ListingRow {
  title: string | null
  price: number | string | null
  game: { name: string } | null
  category: { name: string } | null
}

const LISTING_SELECT =
  'select=title,price,game:games!listings_game_id_fkey(name),category:categories!listings_category_id_fkey(name)&limit=1'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function Image({
  params,
}: {
  params: Promise<{ gameSlug: string; categorySlug: string; listingSlug: string }>
}) {
  const { gameSlug, categorySlug, listingSlug } = await params

  let listingResult = await ogRestFetch<ListingRow>(
    `listings?slug=eq.${encodeURIComponent(listingSlug)}&${LISTING_SELECT}`
  )
  if (!listingResult?.rows?.[0] && UUID_REGEX.test(listingSlug)) {
    listingResult = await ogRestFetch<ListingRow>(
      `listings?id=eq.${encodeURIComponent(listingSlug)}&${LISTING_SELECT}`
    )
  }
  const listing = listingResult?.rows?.[0]

  const title = listing?.title || slugToTitle(listingSlug)
  const eyebrow =
    listing?.game?.name && listing?.category?.name
      ? `${listing.game.name} · ${listing.category.name}`
      : `${slugToTitle(gameSlug)} · ${slugToTitle(categorySlug)}`
  const price = formatUsd(listing?.price) ?? undefined

  return new ImageResponse(
    (
      <OgCard
        eyebrow={eyebrow}
        title={title}
        subtitle="Get What You Ordered, or Your Money Back"
        price={price}
      />
    ),
    { ...OG_SIZE }
  )
}

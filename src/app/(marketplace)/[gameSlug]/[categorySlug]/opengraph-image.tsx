/**
 * Game + category Open Graph image — /{gameSlug}/{categorySlug}
 *
 * Pulls live data via Supabase REST (edge/runtime-safe plain fetch):
 * game + category names, plus the lowest active price and listing
 * count for the sub-line. Any fetch failure degrades to a card built
 * from prettified slugs — never throws.
 */

import { ImageResponse } from 'next/og'
import { OgCard, OG_SIZE } from '@/lib/seo/og-template'
import { getIndexableCategoryPairs } from '@/lib/seo/category-pairs'
import { buildCategoryOgData } from './_ogData'

export const alt = 'Buy and sell on DropMarket — covered by SafeDrop Buyer Protection'
export const size = OG_SIZE
export const contentType = 'image/png'
// Step 7a — see ../opengraph-image.tsx: prerender the sitemap's pairs, keep
// 24 h ISR for the long tail. Data comes from _ogData.ts (game_categories,
// not the legacy `categories` mirror this route used to read).
export const dynamic = 'force-static'
export const revalidate = 86400

export async function generateStaticParams() {
  return getIndexableCategoryPairs()
}

export default async function Image({
  params,
}: {
  params: Promise<{ gameSlug: string; categorySlug: string }>
}) {
  const { gameSlug, categorySlug } = await params
  const { gameName, categoryName, subtitle } = await buildCategoryOgData(gameSlug, categorySlug)

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

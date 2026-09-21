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
//
// Step 7b — the long tail (no listing, no curated currency config: ~600
// pairs nobody shares) no longer pays a Satori render: it gets the static
// branded PNG next to this file, read through the bundler (the same
// `new URL(…, import.meta.url)` mechanism OG routes use for fonts).
export const dynamic = 'force-static'
export const revalidate = 86400

async function fallbackPng(): Promise<Response> {
  const bytes = await fetch(new URL('./_og-category-fallback.png', import.meta.url)).then((r) =>
    r.arrayBuffer(),
  )
  return new Response(bytes, {
    headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' },
  })
}

export async function generateStaticParams() {
  return getIndexableCategoryPairs()
}

export default async function Image({
  params,
}: {
  params: Promise<{ gameSlug: string; categorySlug: string }>
}) {
  const { gameSlug, categorySlug } = await params
  const { gameName, categoryName, subtitle, live } = await buildCategoryOgData(gameSlug, categorySlug)
  if (!live) return fallbackPng()

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

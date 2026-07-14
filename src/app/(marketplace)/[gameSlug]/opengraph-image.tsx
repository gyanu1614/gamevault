/**
 * Game Open Graph image — /{gameSlug}
 *
 * Live game name via Supabase REST (edge/runtime-safe plain fetch);
 * falls back to a prettified slug when the fetch fails.
 */

import { ImageResponse } from 'next/og'
import { OgCard, OG_SIZE, ogRestFetch, slugToTitle } from '@/lib/seo/og-template'

export const alt = 'Game marketplace on DropMarket — covered by SafeDrop Buyer Protection'
export const size = OG_SIZE
export const contentType = 'image/png'
export const revalidate = 86400

interface GameRow {
  name: string
}

export default async function Image({
  params,
}: {
  params: Promise<{ gameSlug: string }>
}) {
  const { gameSlug } = await params

  const result = await ogRestFetch<GameRow>(
    `games?slug=eq.${encodeURIComponent(gameSlug)}&select=name&limit=1`
  )
  const gameName = result?.rows?.[0]?.name || slugToTitle(gameSlug)

  return new ImageResponse(
    (
      <OgCard
        eyebrow="Buy & Sell"
        title={gameName}
        subtitle="Currency, Items & Accounts from Verified Sellers"
      />
    ),
    { ...OG_SIZE }
  )
}

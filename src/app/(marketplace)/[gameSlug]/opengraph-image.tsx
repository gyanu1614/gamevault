/**
 * Game Open Graph image — /{gameSlug}
 *
 * Live game name via Supabase REST (edge/runtime-safe plain fetch);
 * falls back to a prettified slug when the fetch fails.
 */

import { ImageResponse } from 'next/og'
import { OgCard, OG_SIZE, ogRestFetch, slugToTitle } from '@/lib/seo/og-template'
import { getActiveGameSlugs } from '@/lib/seo/indexable-games'

export const alt = 'Game marketplace on DropMarket — covered by SafeDrop Buyer Protection'
export const size = OG_SIZE
export const contentType = 'image/png'
// Step 7a — a cold OG render is a full Satori pass (0.4–1.1 s) and social
// scrapers hit each URL rarely, so the 24 h entry was almost always evicted
// first. Step 7b — force-static + generateStaticParams builds EVERY active
// game's image at deploy (served as files, zero runtime); a game added
// between deploys renders on demand with the 24 h TTL.
export const dynamic = 'force-static'
export const revalidate = 86400

export async function generateStaticParams() {
  return (await getActiveGameSlugs()).map((gameSlug) => ({ gameSlug }))
}

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

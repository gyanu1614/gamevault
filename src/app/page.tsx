import { SITE_URL } from '@/config/site'
import type { Metadata } from 'next'
import { HomePage } from '@/features/home/pages/HomePage'
import { PopularGames } from '@/features/home/components/PopularGames'
import { getLiveOfferCount } from '@/features/home/lib/popular-games'
import { LatestListings } from '@/features/home/components/LatestListings'
import { organization, ORGANIZATION_ID, serializeJsonLd } from '@/lib/seo/jsonld'

export const metadata: Metadata = {
  // `absolute`: the brand already leads this title, so skip the layout's
  // "| DropMarket" suffix (it rendered "DropMarket | … | DropMarket").
  title: { absolute: 'DropMarket | Buy & Sell Game Accounts, Items & Currency Safely' },
  // ≤155 characters so the snippet isn't cut (2026-10-06 crawl: was 193).
  description:
    'Buy and sell Roblox, Fortnite, Valorant and more: game currency, items and accounts from ID-verified sellers, with SafeDrop Protection on every order.',
  keywords: [
    'buy game accounts', 'sell game items', 'gaming marketplace',
    'roblox accounts', 'fortnite accounts', 'valorant accounts',
    'lol accounts', 'game currency', 'safe game trading', 'safedrop protection gaming marketplace',
  ],
  openGraph: {
    title: 'DropMarket — Safe Gaming Marketplace',
    description: 'Buy and sell game assets with SafeDrop Protection',
    type: 'website',
    siteName: 'DropMarket',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DropMarket — Safe Gaming Marketplace',
    description: 'Buy and sell game assets with SafeDrop Protection',
  },
}

// ─── Schema.org ────────────────────────────────────────────────────────────────

const SCHEMAS = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'DropMarket',
    url: SITE_URL,
    publisher: { '@id': ORGANIZATION_ID },
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  },
  // The full Organization node — the single source of the publisher entity that
  // every content page references by @id (see jsonld.ts ORGANIZATION_ID).
  organization(),
]

export default async function Page() {
  const liveOffers = await getLiveOfferCount()
  return (
    <>
      {/* JSON-LD */}
      {SCHEMAS.map((s, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(s) }}
        />
      ))}

      {/* Popular Games fetches on the server and is handed to the client
          page as a child — see the note in HomePage. */}
      <HomePage
        popularGames={<PopularGames />}
        latestListings={<LatestListings />}
        liveOffers={liveOffers}
      />
    </>
  )
}

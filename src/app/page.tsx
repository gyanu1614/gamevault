import { SITE_URL } from '@/config/site'
import type { Metadata } from 'next'
import { HomePage } from '@/features/home/pages/HomePage'
import { PopularGames } from '@/features/home/components/PopularGames'
import { LatestListings } from '@/features/home/components/LatestListings'
import { organization, ORGANIZATION_ID, serializeJsonLd } from '@/lib/seo/jsonld'
import { seoMeta } from '@/lib/seo/fit'

export const metadata: Metadata = seoMeta({
  // `absolute`: the brand already leads this title, so skip the layout's
  // "| DropMarket" suffix (it rendered "DropMarket | … | DropMarket").
  // Owner-approved 2026-10-07 ("A + 1"), the Eldorado / GameBoost / igitems
  // format: brand, then a short tagline matching the hero H1. ≤60 characters.
  title: { absolute: "DropMarket - The Gamer's Marketplace" },
  // ≤155 characters so the snippet isn't cut (2026-10-06 crawl: was 193).
  description:
    'Buy and sell game items, accounts, currency, top ups and boosting safely. ID-verified sellers, fast delivery and a full refund if it never arrives.',
  keywords: [
    'buy game accounts', 'sell game items', 'gaming marketplace',
    'roblox accounts', 'fortnite accounts', 'valorant accounts',
    'lol accounts', 'game currency', 'safe game trading', 'safedrop protection gaming marketplace',
  ],
  openGraph: {
    title: "DropMarket - The Gamer's Marketplace",
    description: 'Buy and sell game items, accounts, currency, top ups and boosting safely. ID-verified sellers, fast delivery and a full refund if it never arrives.',
    type: 'website',
    siteName: 'DropMarket',
  },
  twitter: {
    card: 'summary_large_image',
    title: "DropMarket - The Gamer's Marketplace",
    description: 'Buy and sell game items, accounts, currency, top ups and boosting safely. ID-verified sellers, fast delivery and a full refund if it never arrives.',
  },
})

// ─── Schema.org ────────────────────────────────────────────────────────────────

const SCHEMAS = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    // Site name in Google results (owner, 2026-10-07: "DropMarket", not
    // "dropmarket.gg"). Google reads name + alternateName from this node on the
    // root home page; the url is the canonical home page with its slash. The
    // SearchAction is gone: Google retired the sitelinks search box, and its
    // /?q= target is disallowed in robots.txt.
    '@id': `${SITE_URL}/#website`,
    name: 'DropMarket',
    alternateName: ['Drop Market', 'DropMarket.gg'],
    url: `${SITE_URL}/`,
    inLanguage: 'en',
    publisher: { '@id': ORGANIZATION_ID },
  },
  // The full Organization node — the single source of the publisher entity that
  // every content page references by @id (see jsonld.ts ORGANIZATION_ID).
  organization(),
]

export default function Page() {
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
      />
    </>
  )
}

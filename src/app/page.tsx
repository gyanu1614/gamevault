import type { Metadata } from 'next'
import { HomePage } from '@/features/home/pages/HomePage'

export const metadata: Metadata = {
  title: 'DropMarket | Buy & Sell Game Accounts, Items & Currency Safely',
  description:
    'The trusted marketplace for gaming accounts, items, and currency. Buy and sell Roblox, Fortnite, Valorant, and LoL assets with SafeDrop buyer protection. Lowest fees, instant delivery, 48-hour escrow.',
  keywords: [
    'buy game accounts', 'sell game items', 'gaming marketplace',
    'roblox accounts', 'fortnite accounts', 'valorant accounts',
    'lol accounts', 'game currency', 'safe game trading', 'escrow gaming marketplace',
  ],
  openGraph: {
    title: 'DropMarket — Safe Gaming Marketplace',
    description: 'Buy and sell game assets with SafeDrop escrow protection',
    type: 'website',
    siteName: 'DropMarket',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DropMarket — Safe Gaming Marketplace',
    description: 'Buy and sell game assets with SafeDrop escrow protection',
  },
}

// ─── Schema.org ────────────────────────────────────────────────────────────────

const SCHEMAS = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'DropMarket',
    url: 'https://dropmarket.gg',
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://dropmarket.gg/?q={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'DropMarket',
    url: 'https://dropmarket.gg',
    description: 'Trusted gaming marketplace with SafeDrop buyer protection',
  },
]

export default function Page() {
  return (
    <>
      {/* V20/P22 — Preload the hero backdrop so it's already cached by
          the time the .hero-backdrop element mounts. Without this, the
          image is invisible to the HTML preloader (CSS background-image)
          and only starts downloading after CSS parses → visible pop-in
          on every navigation back to home. */}
      <link
        rel="preload"
        as="image"
        href="/assets/heroes/home.avif"
        type="image/avif"
        // @ts-expect-error — `fetchpriority` is valid HTML, React types
        // lag the spec. High priority puts it ahead of carousel images.
        fetchpriority="high"
      />

      {/* JSON-LD */}
      {SCHEMAS.map((s, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }}
        />
      ))}

      <HomePage />
    </>
  )
}

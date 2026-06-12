import type { Metadata } from 'next'
import { HomePage } from '@/features/home/pages/HomePage'

export const metadata: Metadata = {
  title: 'GameVault | Buy & Sell Game Accounts, Items & Currency Safely',
  description:
    'The trusted marketplace for gaming accounts, items, and currency. Buy and sell Roblox, Fortnite, Valorant, and LoL assets with VaultShield buyer protection. Lowest fees, instant delivery, 48-hour escrow.',
  keywords: [
    'buy game accounts', 'sell game items', 'gaming marketplace',
    'roblox accounts', 'fortnite accounts', 'valorant accounts',
    'lol accounts', 'game currency', 'safe game trading', 'escrow gaming marketplace',
  ],
  openGraph: {
    title: 'GameVault — Safe Gaming Marketplace',
    description: 'Buy and sell game assets with VaultShield escrow protection',
    type: 'website',
    siteName: 'GameVault',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GameVault — Safe Gaming Marketplace',
    description: 'Buy and sell game assets with VaultShield escrow protection',
  },
}

// ─── Schema.org ────────────────────────────────────────────────────────────────

const SCHEMAS = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'GameVault',
    url: 'https://gamevault.gg',
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://gamevault.gg/?q={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'GameVault',
    url: 'https://gamevault.gg',
    description: 'Trusted gaming marketplace with VaultShield buyer protection',
  },
]

export default function Page() {
  return (
    <>
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

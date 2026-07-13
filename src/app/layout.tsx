import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { LayoutWrapper } from '@/components/layout-wrapper'
import { Toaster } from 'sonner'
import RecentPurchaseToast, { DailyStatsToast } from '@/components/marketplace/RecentPurchaseToast'
import { Analytics } from "@vercel/analytics/next"
import { AllHeroesPreload } from '@/components/hero-backdrop'

// Inter — single font for everything (display + body), same approach as Eldorado/G2G
// Exposed as both --font-display (new) and --font-inter (legacy alias for existing components)
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-inter',
  display: 'swap',
})

// JetBrains Mono — order IDs, timestamps, mono data
// (Geist Mono not available in next/font/google for Next.js 14; JetBrains Mono is equivalent quality)
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'DropMarket — Buy & Sell Game Items Safely',
    template: '%s | DropMarket',
  },
  description:
    'The safest peer-to-peer marketplace for gaming items, currency, and accounts. Every order covered by SafeDrop Buyer Protection. 18+ games, instant delivery.',
  keywords: [
    'gaming marketplace', 'buy robux', 'sell game accounts', 'valorant accounts',
    'roblox robux', 'cs2 skins', 'genshin crystals', 'safedrop', 'p2p gaming',
  ],
  openGraph: {
    type: 'website',
    siteName: 'DropMarket',
    title: 'DropMarket — Buy & Sell Game Items Safely',
    description: 'Peer-to-peer gaming marketplace with SafeDrop Buyer Protection on every order.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DropMarket — Buy & Sell Game Items Safely',
    description: 'Peer-to-peer gaming marketplace with SafeDrop Buyer Protection on every order.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      // 'dark' class forced — gaming audiences expect dark mode
      className="dark"
      suppressHydrationWarning
    >
      <head>
        {/* V21/P7.g — Warm-preload every hero AVIF at app load so
            SPA navigations between routes show their backdrops
            instantly without a black flash. fetchpriority=low so
            this doesn't compete with the LCP hero on the landing
            page. */}
        <AllHeroesPreload />
      </head>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`} style={{ '--font-display': 'var(--font-inter)', '--font-body': 'var(--font-inter)' } as React.CSSProperties}>
        <Providers>
          <LayoutWrapper>{children}</LayoutWrapper>
          {/* V17c — react-aria-inspired styling: subtle glass surface
              with a thin lime accent strip for success (and matching
              soft accents for error/warning/info). Skipping
              `richColors` because that flips on sonner's saturated
              defaults, which fight our globals.css custom palette. */}
          <Toaster
            position="top-right"
            theme="dark"
            duration={2200}
            closeButton
            toastOptions={{
              className: 'toast-reduced-glow',
            }}
          />
          {/* Social Proof Widgets */}
          <RecentPurchaseToast />
          <Analytics />
          <DailyStatsToast />
        </Providers>
      </body>
    </html>
  )
}

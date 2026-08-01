import { SITE_URL } from '@/config/site'
import type { Metadata } from 'next'
import { Inter, Figtree, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { LayoutWrapper } from '@/components/layout-wrapper'
import { FooterGameLinks } from '@/components/footer-game-links'
import { Toaster } from 'sonner'
import RecentPurchaseToast, { DailyStatsToast } from '@/components/marketplace/RecentPurchaseToast'
import { Analytics } from "@vercel/analytics/next"
import { AllHeroesPreload } from '@/components/hero-backdrop'

// Two text faces, split by surface:
//   • MARKETPLACE (storefront, everything by default) → Inter, exposed as
//     --font-inter. This is the site's original typeface and what every
//     component reading --font-inter resolves to unless a scope overrides it.
//   • CONTENT HUB (values / calculators / blog) → Figtree, exposed as
//     --font-figtree. globals.css remaps --font-inter → --font-figtree inside
//     the `.hub-chrome` wrapper, so hub pages pick up Figtree with no
//     component changes; the marketplace keeps Inter.
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-inter',
  display: 'swap',
})

const figtree = Figtree({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-figtree',
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
  // Canonical domain for every absolute URL Next emits (OG, twitter,
  // canonical). './' canonical = self-referencing per route — declares
  // dropmarket.gg as the real domain even while transition domains
  // serve the same deployment.
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: './' },
  title: {
    default: 'DropMarket — Buy & Sell Game Items Safely',
    template: '%s | DropMarket',
  },
  description:
    'The safest peer-to-peer marketplace for gaming items, currency, and accounts. Every order covered by SafeDrop Buyer Protection. 18+ games, instant delivery.',
  // No site-wide `keywords`: Google ignores the meta-keywords tag entirely, so a
  // single stuffed string on every page was dead weight. Pages that want
  // keywords set their own page-specific list in generateMetadata (e.g. the
  // game landing pages via seo/templates); everything else simply omits the tag.
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
      <body className={`${inter.variable} ${figtree.variable} ${jetbrainsMono.variable} font-sans antialiased`} style={{ '--font-display': 'var(--font-inter)', '--font-body': 'var(--font-inter)' } as React.CSSProperties}>
        <Providers>
          <LayoutWrapper footerGameLinks={<FooterGameLinks />}>
            {children}
          </LayoutWrapper>
          {/* V17c — react-aria-inspired styling: subtle glass surface
              with a thin lime accent strip for success (and matching
              soft accents for error/warning/info). Skipping
              `richColors` because that flips on sonner's saturated
              defaults, which fight our globals.css custom palette. */}
          <Toaster
            position="bottom-right"
            theme="dark"
            duration={3200}
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

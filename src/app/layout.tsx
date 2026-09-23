import { SITE_URL } from '@/config/site'
import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import { Providers } from '@/components/providers'
import { LayoutWrapper } from '@/components/layout-wrapper'
import { FooterGameLinks } from '@/components/footer-game-links'
import { Toaster } from 'sonner'
import RecentPurchaseToast, { DailyStatsToast } from '@/components/marketplace/RecentPurchaseToast'
import { Analytics } from "@vercel/analytics/next"

// Two text faces, split by surface:
//   • MARKETPLACE (storefront, everything by default) → Inter, exposed as
//     --font-inter. This is the site's original typeface and what every
//     component reading --font-inter resolves to unless a scope overrides it.
//   • CONTENT HUB (values / calculators / blog) → Figtree, exposed as
//     --font-figtree. globals.css remaps --font-inter → --font-figtree inside
//     the `.hub-chrome` wrapper, so hub pages pick up Figtree with no
//     component changes; the marketplace keeps Inter.
//
// SELF-HOSTED (build audit 2026-09-22, §3): these were `next/font/google`,
// which fetches the font files from Google at BUILD time — three families per
// build, and it flaked twice during the audit with a `next/font` TypeError.
// The files now live in ./fonts, so the build does no network I/O for fonts
// and cannot fail on Google being slow or unreachable.
//
// One variable woff2 per family covers the whole weight range (Google serves
// the same file for every static weight anyway), so this is also 14 requests
// fewer than the per-weight form. `latin` subset only, as before.
const inter = localFont({
  src: './fonts/inter-variable.woff2',
  weight: '100 900',
  variable: '--font-inter',
  display: 'swap',
})

// preload:false — Figtree is scoped to `.hub-chrome` (globals.css remaps
// --font-inter inside the content hub). next/font preloads every font declared
// in the root layout, so a marketplace route was fetching Figtree at high
// priority to render zero glyphs with it. It still loads on hub routes that
// use it, just without competing with the LCP everywhere else.
const figtree = localFont({
  src: './fonts/figtree-variable.woff2',
  weight: '300 900',
  variable: '--font-figtree',
  display: 'swap',
  preload: false,
})

// JetBrains Mono — order IDs, timestamps, mono data
// (Geist Mono not available in next/font/google for Next.js 14; JetBrains Mono is equivalent quality)
// preload:false — mono is for order IDs, timestamps and tabular data. 54 files
// use it, but never above the fold on a hub/sell/landing page, so preloading it
// spent priority on a font the first paint does not need.
const jetbrainsMono = localFont({
  src: './fonts/jetbrains-mono-variable.woff2',
  weight: '100 800',
  variable: '--font-mono',
  display: 'swap',
  preload: false,
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
        {/* Hero preloading is ROUTE-AWARE: each segment layout emits its own
            <HeroBackdropPreload> for the one hero it renders — `marketplace`
            in (marketplace), `sell` in (sell), `account` in /account, `home`
            on the landing page.

            V21/P7.g used to warm-preload all five heroes here so SPA
            navigations never showed a black flash. It cost every route ~2MB
            of images it does not display — `order.avif` alone is 1.24MB, and
            it was the single largest download on the landing page, which
            never shows that hero. Removed in Step 1c/Fix 1. */}
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

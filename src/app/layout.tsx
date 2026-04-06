import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { LayoutWrapper } from '@/components/layout-wrapper'
import { Toaster } from 'sonner'
import RecentPurchaseToast, { DailyStatsToast } from '@/components/marketplace/RecentPurchaseToast'
import { Analytics } from "@vercel/analytics/next"

// Inter — original body font, restored
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

// JetBrains Mono — prices, codes, data (numbers only, barely visible)
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'GameVault — Buy & Sell Game Items Safely',
    template: '%s | GameVault',
  },
  description:
    'The safest peer-to-peer marketplace for gaming items, currency, and accounts. Protected by VaultShield escrow. 18+ games, instant delivery.',
  keywords: [
    'gaming marketplace', 'buy robux', 'sell game accounts', 'valorant accounts',
    'roblox robux', 'cs2 skins', 'genshin crystals', 'vaultshield', 'p2p gaming',
  ],
  openGraph: {
    type: 'website',
    siteName: 'GameVault',
    title: 'GameVault — Buy & Sell Game Items Safely',
    description: 'Peer-to-peer gaming marketplace with VaultShield escrow protection.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GameVault — Buy & Sell Game Items Safely',
    description: 'Peer-to-peer gaming marketplace with VaultShield escrow protection.',
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
      <head />
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <Providers>
          <LayoutWrapper>{children}</LayoutWrapper>
          <Toaster
            position="top-right"
            richColors
            theme="dark"
            duration={2000}
            closeButton
            toastOptions={{
              style: {
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
              },
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

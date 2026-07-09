/**
 * V19/P24/P7.r — Checkout-only layout.
 *
 * V80 — Handoff rebuild (design_handoff_checkout 2a/2b): the page is a
 * flat #0c0e14 canvas and the checkout renders as a single centered
 * card shell that carries its own header (logo + SSL pill), so the old
 * slim top bar + hero backdrop + layout-level marquee are gone. The
 * payment marquee now lives inside the shell (see CheckoutForm).
 * Matches the industry pattern — G2A, G2G, Eldorado, Kinguin, 2Game
 * all strip global nav from checkout to reduce abandonment.
 *
 * Doesn't touch any pricing / payment logic; this is pure shell.
 */

import Link from 'next/link'
import { HelpCircle, ShieldCheck } from 'lucide-react'
import { PaymentsMarquee } from '@/components/marketplace/PaymentsMarquee'

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className="relative isolate flex min-h-screen flex-col bg-[#0c0e14]"
      style={{
        backgroundImage: 'radial-gradient(120% 46% at 50% -6%, #141a26, rgba(20,26,38,0) 62%)',
      }}
    >
      <div className="flex-1">{children}</div>

      {/* Site-wide grey payments marquee — same strip as the game /
          currency pages' bottoms. Its built-in mt-16/24 is meant for
          content-heavy pages; pull it back up here so the checkout
          cards and the strip sit close. */}
      <div className="-mt-10 sm:-mt-16">
        <PaymentsMarquee />
      </div>
      <CheckoutFooter />

      {/* V19/P24/P7.hh — Floating Need help chip, bottom-right.
          Same convention Stripe / 2Game / GameBoost use — looks
          like a chat launcher, always reachable without taking
          header space. */}
      <Link
        href="/support"
        aria-label="Need help?"
        className="fixed bottom-5 right-5 z-50 inline-flex h-12 items-center gap-2 rounded-full border border-border-default bg-bg-raised px-4 text-[13px] font-semibold text-text-primary shadow-elevated transition-all hover:border-lime-tint-border hover:bg-bg-raised-hover hover:shadow-glow sm:bottom-6 sm:right-6"
      >
        <HelpCircle className="h-4 w-4 text-lime-text" />
        Need help?
      </Link>
    </div>
  )
}

function CheckoutFooter() {
  return (
    <footer className="border-t border-white/[0.06] bg-[#0c0e14]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-8 lg:px-8">
        <div className="flex flex-col gap-1.5 text-[12.5px] text-text-tertiary sm:flex-row sm:items-center sm:gap-4">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-lime-text" />
            All transactions are SSL secured and escrow protected.
          </span>
          <span className="hidden text-[11.5px] sm:inline">© {new Date().getFullYear()} DropMarket Ltd</span>
        </div>
        <nav
          aria-label="Checkout legal"
          className="flex items-center gap-4 text-[12px] text-text-tertiary"
        >
          <Link href="/refund-policy" className="transition-colors hover:text-text-primary">
            Refunds
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-text-primary">
            Privacy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-text-primary">
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  )
}

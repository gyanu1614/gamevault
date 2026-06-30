/**
 * V19/P24/P7.r — Checkout-only layout.
 *
 * Strips the main navbar and replaces it with a slim header (logo +
 * "Secure Checkout" badge + Help link). Adds a slim footer with
 * payment provider badges + legal links. Matches the industry pattern
 * — G2A, G2G, Eldorado, Kinguin, 2Game all strip global nav from
 * checkout to reduce abandonment.
 *
 * Doesn't touch any pricing / payment logic; this is pure shell.
 */

import Link from 'next/link'
import { HelpCircle, Lock, ShieldCheck } from 'lucide-react'
import { PaymentBrandStrip } from './[id]/_PaymentBrands'

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // V19/P24/P7.aa — Solid opaque shell masks the body's violet
  // gradient + bloom for the entire /checkout/* tree. Checkout
  // pages need a serious, flat, payment-trust look — every major
  // checkout (Stripe, 2Game, GameBoost, Apple Pay) uses a flat
  // neutral surface, not a decorative gradient.
  return (
    <div className="relative isolate flex min-h-screen flex-col bg-bg-base">
      <CheckoutHeader />
      <div className="flex-1">{children}</div>
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

function CheckoutHeader() {
  // V19/P24/P7.cc — Header is now a hard 50/50 split that matches
  // the page body's split. The vertical divider runs THROUGH the
  // header band (and continues down through the body) so the line
  // is unbroken edge to edge. Logo + Secure Checkout chip on the
  // left half; payment brand strip + Need help on the right half.
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border-subtle bg-bg-base">
      <div className="grid h-14 w-full lg:h-16 lg:grid-cols-2">
        {/* LEFT: logo + Secure Checkout label */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 lg:px-12 xl:px-20">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[15px] font-black tracking-tight text-text-primary transition-opacity hover:opacity-80"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-lime text-[14px] font-black text-text-inverse">
              G
            </span>
            GameVault
          </Link>

          {/* Secure Checkout chip — placeholder shield lives at
              /public/assets/checkout/secure-checkout-icon.svg.
              Swap that file with your real logo any time. */}
          <span className="inline-flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/checkout/secure-checkout-icon.svg"
              alt=""
              className="h-4 w-4"
            />
            <span className="text-[12.5px] font-semibold uppercase tracking-wider text-text-secondary">
              Secure Checkout
            </span>
          </span>
        </div>

        {/* RIGHT: payment brand strip — full marquee. Help moved
            to the floating chip in the layout root. */}
        <div className="hidden items-center border-l border-border-default bg-bg-raised px-4 sm:px-6 lg:flex lg:px-12 xl:px-20">
          <PaymentBrandStrip />
        </div>
      </div>
    </header>
  )
}

function CheckoutFooter() {
  return (
    <footer className="border-t border-border-subtle bg-bg-base">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-8 lg:px-8">
        <div className="flex items-center gap-2 text-[12.5px] text-text-tertiary">
          <ShieldCheck className="h-4 w-4 text-lime-text" />
          All transactions are SSL secured and escrow protected.
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

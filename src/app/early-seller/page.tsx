/**
 * /early-seller — beta "first 100 sellers" waitlist landing.
 *
 * Linked from the top BetaBanner. A short pitch (lower fees, early access,
 * founding-seller perks) above the waitlist form. Server component for the
 * SEO shell; the form itself is a client island.
 */

import type { Metadata } from 'next'
import { Percent, Rocket, BadgeCheck, Sparkles } from 'lucide-react'
import { EarlySellerForm } from './_EarlySellerForm'

const AMBER = '#F5C451'

export const metadata: Metadata = {
  title: 'Become a Founding Seller — First 100 Get Lower Fees',
  description:
    'Join DropMarket as one of the first 100 sellers and lock in lower fees, early access, and a founding-seller badge. Register your interest for the beta.',
  alternates: { canonical: '/early-seller' },
  openGraph: {
    title: 'Become a Founding Seller on DropMarket',
    description:
      'The first 100 sellers get lower fees, early access, and a founding-seller badge. Reserve your spot.',
    url: '/early-seller',
    type: 'website',
  },
}

const PERKS = [
  {
    icon: Percent,
    title: 'Lower Fees, Locked In',
    body: 'Founding sellers keep a reduced commission rate that stays with your account after launch.',
  },
  {
    icon: Rocket,
    title: 'Early Access',
    body: 'List and start building your reputation before the marketplace opens to everyone.',
  },
  {
    icon: BadgeCheck,
    title: 'Founding-Seller Badge',
    body: 'A permanent badge on your shop that tells buyers you were here from day one.',
  },
]

export default function EarlySellerPage() {
  return (
    <main className="relative min-h-screen">
      {/* Ambient warm glow behind the hero. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-60"
        style={{
          background:
            'radial-gradient(60% 100% at 50% 0%, rgba(245,196,81,0.12), transparent 70%)',
        }}
      />

      <div className="relative mx-auto max-w-3xl px-5 pb-24 pt-14 sm:pt-20">
        {/* Eyebrow */}
        <div className="flex justify-center">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider"
            style={{
              color: AMBER,
              borderColor: 'rgba(245,196,81,0.30)',
              background: 'rgba(245,196,81,0.10)',
            }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Beta · First 100 Sellers
          </span>
        </div>

        <h1 className="mt-5 text-center text-[clamp(28px,6vw,40px)] font-extrabold leading-[1.1] tracking-tight text-white text-balance">
          Become a Founding Seller
          <br />
          <span style={{ color: AMBER }}>on DropMarket</span>
        </h1>

        <p className="mx-auto mt-4 max-w-xl text-center text-[15px] leading-relaxed text-text-secondary">
          We&apos;re opening the marketplace to a first group of sellers. Claim a
          spot in the first 100 to lock in lower fees, get early access, and earn
          a permanent founding-seller badge.
        </p>

        {/* Perks */}
        <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {PERKS.map((p) => (
            <div
              key={p.title}
              className="rounded-xl border border-white/10 bg-bg-overlay/40 p-4 backdrop-blur-sm"
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ background: 'rgba(245,196,81,0.12)', color: AMBER }}
              >
                <p.icon className="h-[18px] w-[18px]" />
              </div>
              <h3 className="mt-3 text-[13.5px] font-bold text-white">
                {p.title}
              </h3>
              <p className="mt-1 text-[12.5px] leading-relaxed text-text-tertiary">
                {p.body}
              </p>
            </div>
          ))}
        </div>

        {/* Form */}
        <div className="mt-10">
          <EarlySellerForm />
        </div>
      </div>
    </main>
  )
}

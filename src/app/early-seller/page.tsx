/**
 * /early-seller — beta "first 100 sellers" waitlist landing.
 *
 * Linked from the top BetaBanner. A short pitch (lower fees, early access,
 * founding-seller perks) above the waitlist form. Server component for the
 * SEO shell; the form itself is a client island.
 */

import type { Metadata } from 'next'
import { IconPercentage, IconRocket, IconRosetteDiscountCheck } from '@tabler/icons-react'
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
    icon: IconPercentage,
    title: 'Reduced Seller Fees',
    body: 'Lock in a lower commission rate that stays with your account permanently — even after full launch.',
  },
  {
    icon: IconRocket,
    title: 'Early Access',
    body: 'Start listing and building your reputation before the marketplace opens to the public.',
  },
  {
    icon: IconRosetteDiscountCheck,
    title: 'Founding-Seller Badge',
    body: 'A permanent badge on your storefront that shows buyers you were one of the first.',
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
        {/* Eyebrow — rectangular glyph badge + label, no pill. */}
        <div className="flex items-center justify-center gap-2.5">
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-[8px] border border-[#F5C451]/25 bg-[#F5C451]/10"
            style={{ color: AMBER }}
          >
            <IconRocket className="h-4 w-4" stroke={2} />
          </span>
          <span
            className="text-[11px] font-bold uppercase tracking-[0.14em]"
            style={{ color: AMBER }}
          >
            Beta · First 100 Sellers
          </span>
        </div>

        <h1 className="mt-6 text-center text-[clamp(28px,6vw,40px)] font-extrabold leading-[1.1] tracking-tight text-white text-balance">
          Become a Founding Seller
          <br />
          <span style={{ color: AMBER }}>on DropMarket</span>
        </h1>

        <p className="mx-auto mt-4 max-w-xl text-center text-[15px] leading-relaxed text-text-secondary text-balance">
          We&apos;re opening the marketplace to our first sellers. Join the first
          100 to lock in reduced fees, get early access, and earn a permanent
          founding-seller badge on your storefront.
        </p>

        {/* Perks — floating rows separated by hairlines, no boxed cards. */}
        <div className="mx-auto mt-12 max-w-2xl divide-y divide-white/[0.07] border-y border-white/[0.07]">
          {PERKS.map((p) => (
            <div key={p.title} className="flex items-start gap-4 py-5">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-[#F5C451]/20 bg-[#F5C451]/[0.08]"
                style={{ color: AMBER }}
              >
                <p.icon className="h-5 w-5" stroke={1.9} />
              </span>
              <div>
                <h3 className="text-[14.5px] font-bold text-white">{p.title}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-text-tertiary">
                  {p.body}
                </p>
              </div>
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

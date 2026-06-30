'use client'

/**
 * V19/P24/P7.bb — Trust marquee for the checkout footer.
 *
 * Replaces the static "All transactions are SSL secured" line +
 * brand strip with a smooth, pure-CSS infinite horizontal marquee
 * of trust messages — the pattern Aceternity / Magic UI / shadcn
 * examples all use (duplicated track + `translateX(-50%)` keyframe).
 *
 * Pauses on hover so a curious buyer can read a chip. No external
 * libraries (no framer-motion, no embla).
 */

import { CheckCircle2, Lock, RefreshCw, ShieldCheck, Star, Zap } from 'lucide-react'

interface TrustItem {
  Icon: React.ComponentType<{ className?: string }>
  text: string
}

const TRUST_ITEMS: TrustItem[] = [
  { Icon: Lock, text: '256-bit SSL encrypted transactions' },
  { Icon: ShieldCheck, text: 'Escrow protected — buyer covered until delivery' },
  { Icon: Zap, text: 'Average delivery under 15 minutes' },
  { Icon: RefreshCw, text: '100% money-back if delivery fails' },
  { Icon: Star, text: '4.9/5 rating across 50,000+ orders' },
  { Icon: CheckCircle2, text: 'Verified sellers · KYC checked' },
  { Icon: ShieldCheck, text: 'Visa · Mastercard · Amex · PayPal accepted' },
  { Icon: Lock, text: 'Stripe-powered payment processing' },
]

export function TrustMarquee() {
  // Render the list twice for seamless wrap-around.
  const tracks = [TRUST_ITEMS, TRUST_ITEMS] as const
  return (
    <div className="group relative w-full overflow-hidden">
      {/* Edge fades so chips slide in/out softly */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-bg-base to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-bg-base to-transparent"
      />

      <div className="flex w-max animate-marquee gap-4 group-hover:[animation-play-state:paused]">
        {tracks.map((track, t) => (
          <div key={t} className="flex shrink-0 items-center gap-4" aria-hidden={t === 1}>
            {track.map((item, i) => (
              <div
                key={`${t}-${i}`}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border-subtle bg-bg-raised/60 px-4 py-2 text-[12.5px] font-medium text-text-secondary"
              >
                <item.Icon className="h-3.5 w-3.5 text-lime-text" />
                {item.text}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

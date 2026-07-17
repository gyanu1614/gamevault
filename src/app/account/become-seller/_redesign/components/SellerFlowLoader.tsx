/**
 * SellerFlowLoader — the full-screen branded wait state for the seller flow:
 * shown while we check an existing application on Become a Seller click and
 * while the status page loads. One calm screen (sell hero photo under the
 * forest scrim + a minimal white chip) instead of spinner flashes and visible
 * redirect hops.
 *
 * CSS-only animation — no framer (rAF stalls would freeze a blocking screen).
 */

'use client'

import Image from 'next/image'
import { Loader2 } from 'lucide-react'
import { PALETTE } from '../theme'

export default function SellerFlowLoader({ label }: { label: string }) {
  return (
    <div className="fixed inset-0 z-[90]">
      <Image
        src="/assets/heroes/sell.avif"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `linear-gradient(160deg, rgba(20,67,42,0.93) 0%, rgba(15,51,32,0.86) 55%, rgba(15,51,32,0.92) 100%)`,
          backdropFilter: 'blur(2px)',
        }}
      />
      <div className="animate-fade-in relative z-10 flex h-full flex-col items-center justify-center gap-5 px-6">
        <div className="flex items-center gap-2.5">
          <Image
            src="/brand/logo-mark-white.png"
            alt="DropMarket"
            width={36}
            height={36}
            className="h-9 w-9 object-contain"
          />
          <span className="text-lg font-bold tracking-tight text-white">
            Drop<span className="text-white/70">Market</span>
          </span>
        </div>
        <div
          className="flex items-center gap-3 rounded-full py-2.5 pl-4 pr-5 shadow-xl"
          style={{ backgroundColor: PALETTE.paper }}
        >
          <Loader2 className="h-4 w-4 animate-spin" style={{ color: PALETTE.forest2 }} />
          <span className="text-sm font-medium" style={{ color: PALETTE.forest }}>
            {label}
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * SabSellerCta — the founding-seller pitch block for the Steal-a-Brainrot
 * CASH calculator, where a price-checker self-identifies as someone about to
 * sell. Forest-rectangular to match the SAB theme (sharp corners, #0B0F0C
 * panel, #1A211A borders, green #8FBF9C accent); amber (#F5C451) survives only
 * as a hairline "first 100" accent, never a full card.
 *
 * SAB-scoped on purpose: Brainrot currency is a Roblox in-game economy (10%
 * base commission), so the concrete "8%" is TRUE here — derived from the real
 * fee consts, never hard-coded, so it can't drift. Do NOT reuse where 8% would
 * be a lie (accounts are a 12–20% band).
 *
 * Placement rule (see callers): render BELOW the price/verdict content, never
 * above — the buyer's answer comes first; the seller ask is skippable.
 */

import Link from 'next/link'
import { ArrowRight, ShieldCheck, BadgeCheck } from 'lucide-react'
import { COMMISSION_PCT, FOUNDING_DISCOUNT_PTS } from '@/lib/fees'

// Real numbers, from the fee source of truth — never a literal.
const BASE_PCT = COMMISSION_PCT.currencyRobloxEconomy // 10
const FOUNDING_PCT = Math.max(0, BASE_PCT - FOUNDING_DISCOUNT_PTS) // 8
const KEEP_PCT = 100 - FOUNDING_PCT // 92

/** `src` tags the funnel source so we can tell which surface converts. */
export function SabSellerCta({ src }: { src: string }) {
  return (
    <section className="mx-auto mt-10 w-full max-w-3xl px-4 sm:px-6 lg:px-8">
      <div className="border border-[#1A211A] bg-[#0B0F0C] transition-colors hover:border-[#1E2723]">
        {/* Thin amber "first 100" hairline — the only amber on the card. */}
        <span
          aria-hidden
          className="block h-px w-full"
          style={{ background: 'linear-gradient(to right, transparent, #F5C45155, transparent)' }}
        />

        <div className="p-6 sm:p-7">
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-[#F5C451]" strokeWidth={2} />
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#F5C451]">
              First 100 Sellers
            </span>
          </div>

          <h2 className="mt-3 text-[20px] font-bold leading-tight tracking-tight text-[#F2F6F0] sm:text-[23px]">
            That&apos;s what a buyer pays.{' '}
            <span className="text-[#8FBF9C]">Here&apos;s what you keep.</span>
          </h2>

          <p className="mt-2.5 max-w-xl text-[14px] leading-relaxed text-[#98A398]">
            Sell your brainrot on DropMarket at the founding{' '}
            <span className="font-semibold text-[#E4EAE2]">{FOUNDING_PCT}% rate</span> — locked for
            life, {FOUNDING_DISCOUNT_PTS} points under our public {BASE_PCT}% and well below the
            10–15% Eldorado and G2G take. You keep {KEEP_PCT}%.
          </p>

          <div className="mt-3.5 flex items-start gap-2.5 text-[13px] leading-relaxed text-[#7E8A7E]">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#8FBF9C]" strokeWidth={2} />
            <span>
              <span className="font-semibold text-[#98A398]">Paid even if the buyer ghosts.</span>{' '}
              SafeDrop escrow holds the payment on order and releases it to you on delivery.
            </span>
          </div>

          <Link
            href={`/early-seller?src=${src}`}
            className="group mt-5 inline-flex items-center justify-center gap-2 border border-[#2C7A4B] bg-[#173A28] px-5 py-3 text-[13.5px] font-semibold text-[#DDF3E4] transition-colors hover:border-[#3A9A5F] hover:bg-[#1C4A32]"
          >
            Sell Your Brainrot
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.2} />
          </Link>
        </div>
      </div>
    </section>
  )
}

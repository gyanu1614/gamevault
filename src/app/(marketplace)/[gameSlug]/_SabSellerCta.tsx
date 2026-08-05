/**
 * HubSellerCta (exported as SabSellerCta for back-compat) — the founding-seller
 * pitch block for any game content hub (values, calculator, per-item, blog).
 *
 * Copy is BENEFIT-led, no commission math: sellers respond to "lower fees,
 * paid safely, sell for cash" — not to "8% vs 10%". The real founding rate
 * still governs payouts (src/lib/fees); it just isn't quoted on the page.
 * Forest-rectangular; amber only as the "first 100" hairline.
 *
 * Placement rule (callers): render BELOW the price/verdict content — the
 * buyer's answer comes first; the seller ask is skippable.
 */

import Link from 'next/link'
import { ArrowRight, ShieldCheck, BadgeCheck } from 'lucide-react'

interface HubSellerCtaProps {
  /** Game slug — used only for the /early-seller source tag. */
  gameSlug: string
  /** Display name for the copy ("Sell your Adopt Me pets"). */
  gameName: string
  /** `src` tags the funnel source so we can tell which surface converts. */
  src: string
}

export function SabSellerCta({ gameName, src }: HubSellerCtaProps) {
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
            Got {gameName} to sell?{' '}
            <span className="text-[#8FBF9C]">Turn it into cash.</span>
          </h2>

          <p className="mt-2.5 max-w-xl text-[14px] leading-relaxed text-[#98A398]">
            Join DropMarket as a founding seller and keep more of every sale —
            lower fees than the big marketplaces, locked to your account for life.
            No listing fees; you only pay when something sells.
          </p>

          <div className="mt-3.5 flex items-start gap-2.5 text-[13px] leading-relaxed text-[#7E8A7E]">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#8FBF9C]" strokeWidth={2} />
            <span>
              <span className="font-semibold text-[#98A398]">Get paid safely.</span>{' '}
              SafeDrop escrow means you&apos;re paid on delivery — even if a buyer
              disappears.
            </span>
          </div>

          <Link
            href={`/early-seller?src=${src}`}
            className="group mt-5 inline-flex items-center justify-center gap-2 border border-[#2C7A4B] bg-[#173A28] px-5 py-3 text-[13.5px] font-semibold text-[#DDF3E4] transition-colors hover:border-[#3A9A5F] hover:bg-[#1C4A32]"
          >
            Sell {gameName} For Cash
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.2} />
          </Link>
        </div>
      </div>
    </section>
  )
}

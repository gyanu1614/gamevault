'use client'

/**
 * SellChoiceModal — the "two ways in" chooser that opens when someone clicks a
 * "Start Selling {game}" button on the /sell page. Reuses the shared Radix
 * Dialog (src/components/ui/dialog.tsx) so it inherits the site's modal +
 * bottom-sheet behaviour and animations.
 *
 * Two paths, each with an ETA:
 *   - Founding seller waitlist (amber) → /early-seller (ETA ~1 week)
 *   - Sign up & apply (green, fastest)  → /signup-become-seller (ETA ~12h)
 *
 * The trigger is passed as children so the /sell page's own styled buttons
 * open it (no duplicate button styling here).
 */

import Link from 'next/link'
import { IconRosetteDiscountCheck, IconBolt, IconClock, IconArrowRight } from '@tabler/icons-react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { HubCtaBand } from '@/components/content/HubCtaBand'
import { SpotlightCard } from '@/components/ui/spotlight-card'

export function SellChoiceModal({
  gameName,
  gameSlug,
  children,
}: {
  gameName: string
  gameSlug: string
  /** The button that opens the modal (rendered as the DialogTrigger). */
  children: React.ReactNode
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="rounded-none border-[#1E2723] bg-[#0E1310] sm:max-w-[680px] sm:rounded-none">
        <div className="pr-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#F5C451]">
            Two ways in
          </p>
          <DialogTitle className="mt-2 text-[22px] font-bold tracking-[-0.02em] text-[#F1F3F1]">
            Start selling {gameName}
          </DialogTitle>
          <p className="mt-2 max-w-[46ch] text-[13px] leading-relaxed text-[#98A398]">
            Pick the path that fits — both keep the same low founding fees.
          </p>
        </div>

        {/* Two DETACHED choice cards (real gap, own borders — no shared
            hairline). Each is a SpotlightCard: the cursor-following glow (amber
            for founding, green for sign-up) carries the hover feedback, a
            stretched Link overlay makes the whole card clickable, and the
            content rides above the glow on `relative z-[1]`. */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Founding waitlist */}
          <SpotlightCard
            glow="amber"
            className="group relative border border-[#1A211A] bg-[#0B0F0C] p-6 transition-colors hover:border-[#24352A]"
          >
            <Link
              href={`/early-seller?src=${gameSlug}-sell-modal`}
              aria-label="Join the founding waitlist"
              className="absolute inset-0 z-10"
            />
            <div className="relative z-[1] flex flex-col gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center border border-[#1E2723] bg-[#10160F] text-[#C7D0C7]">
                <IconRosetteDiscountCheck className="h-[17px] w-[17px]" stroke={2} />
              </span>
              <span className="text-[14px] font-semibold text-[#F1F3F1]">
                Founding waitlist
              </span>
              <span className="flex-1 text-[12px] leading-relaxed text-[#98A398]">
                Reserve a first-100 spot. We onboard in batches.
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-[#7E8A7E]">
                <IconClock className="h-3.5 w-3.5" stroke={2} /> Around 1 week
              </span>
              <span className="mt-2 inline-flex items-center gap-1.5 border-t border-[#1A211A] pt-3 text-[12.5px] font-semibold text-[#E6C878]">
                Join the waitlist
                <IconArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" stroke={2.2} />
              </span>
            </div>
          </SpotlightCard>

          {/* Sign up & apply */}
          <SpotlightCard
            glow="green"
            className="group relative border border-[#1A211A] bg-[#0B0F0C] p-6 transition-colors hover:border-[#24352A]"
          >
            <Link
              href="/signup-become-seller"
              aria-label="Sign up and apply to sell"
              className="absolute inset-0 z-10"
            />
            <div className="relative z-[1] flex flex-col gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center border border-[#1E2723] bg-[#10160F] text-[#C7D0C7]">
                <IconBolt className="h-[17px] w-[17px]" stroke={2} />
              </span>
              <span className="text-[14px] font-semibold text-[#F1F3F1]">
                Sign up and apply
              </span>
              <span className="flex-1 text-[12px] leading-relaxed text-[#98A398]">
                Create an account and apply to sell right now.
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-[#7E8A7E]">
                <IconClock className="h-3.5 w-3.5" stroke={2} /> Around 12 hours
              </span>
              <span className="mt-2 inline-flex items-center gap-1.5 border-t border-[#1A211A] pt-3 text-[12.5px] font-semibold text-[#9FD3B0]">
                Sign up to sell
                <IconArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" stroke={2.2} />
              </span>
            </div>
          </SpotlightCard>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * SellFinalCta — the /sell page's bottom HubCtaBand whose button opens the
 * choice modal. Lives here (a client component) so the ctaWrap render function
 * never crosses the server→client boundary from the page.
 */
export function SellFinalCta({
  gameName,
  gameSlug,
  accent,
}: {
  gameName: string
  gameSlug: string
  accent: string
}) {
  return (
    <HubCtaBand
      gameSlug={gameSlug}
      title={`Ready to sell ${gameName}?`}
      body="Two ways in — join the founding programme, or sign up and apply to sell now."
      ctaLabel={`Start Selling ${gameName}`}
      ctaHref="#"
      ctaColor={accent}
      ctaTextColor="#08110B"
      className=""
      ctaWrap={(btn) => (
        <SellChoiceModal gameName={gameName} gameSlug={gameSlug}>
          {btn}
        </SellChoiceModal>
      )}
    />
  )
}

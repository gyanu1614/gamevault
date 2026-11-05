'use client'

/**
 * The seller prompt, written into the page (growth point 5, 2026-10-08).
 * Replaces the bar that sat above the transparent navbar.
 *
 *   <HeroEyebrow />      homepage: one line above the headline, the call to
 *                        action in a subtle outlined box. No dismiss.
 *   <SellerPromptCard /> game landing: a small card beside the page title
 *                        (its own row on phones), copy per game + category.
 *   <SubnavSellButton /> desktop game sub-navbar: one Sell button on every
 *                        game page (owner, 2026-11-02: the listings header
 *                        card took the space the pets should have).
 *   <SellerPromptRow />  listings pages on phones: one slim row inside the
 *                        grid after the first cards.
 *
 * Both reserve their space while `useSellerPrompt()` resolves (invisible,
 * same height, so the common visitor case never jumps), fade and rise in
 * once it knows who is looking, and for a seller who is already selling
 * (3+ listings) the space folds away in one eased motion — no blank bar
 * left behind, no wrong colour ever shown.
 */
import Link from '@/components/navigation/AppLink'
import { track } from '@vercel/analytics'
import { track as phTrack } from '@/lib/analytics/client'
import {
  IconArrowRight,
  IconBuildingStore,
  IconCoin,
} from '@tabler/icons-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ShineBorder } from '@/components/ui/shine-border'
import { useAuth } from '@/hooks/use-auth'
import {
  forgetSellerListingCount,
  useSellerPrompt,
  type SellerPromptState,
} from '@/hooks/use-seller-prompt'
import {
  HERO_EYEBROW,
  SELLER_PROMPT_EVENT,
  listingsCardCopy,
  sellerPromptHref,
  type SellerPromptVariant,
} from '@/lib/seller/seller-prompt'

function useCta(
  variant: SellerPromptVariant,
  source: string,
  forgetCount: () => void,
) {
  return {
    href: sellerPromptHref(variant, source),
    onClick: () => {
      track(SELLER_PROMPT_EVENT[variant], { source })
      // PostHog seller funnel entry (visitors only; a seller is already in).
      if (variant === 'visitor') phTrack('seller_banner_clicked', { source })
      // They are off to list: forget the cached 'no listing yet'.
      if (variant === 'seller') forgetCount()
    },
  }
}

/**
 * Mount/unmount choreography shared by both surfaces. The visitor copy is in
 * the static HTML and VISIBLE from the first paint (it is the homepage's LCP
 * element — hiding it until auth resolved pushed LCP to 8 s, Lighthouse
 * 2026-10-09). When auth resolves: a seller sees the words swap, an
 * established seller (3+ listings) sees it fold away.
 */
function Reveal({ state, className = '', children }: { state: SellerPromptState; className?: string; children: React.ReactNode }) {
  const reduce = useReducedMotion()
  const ease = [0.16, 1, 0.3, 1] as const
  return (
    <AnimatePresence initial={false}>
      {state !== 'hidden' && (
        <motion.div
          key="prompt"
          initial={false}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={reduce ? { duration: 0 } : { height: { duration: 0.4, ease }, opacity: { duration: 0.3, ease } }}
          style={{ overflow: 'hidden' }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const BOX = {
  visitor:
    'border-white/[0.16] bg-white/[0.06] text-white hover:border-white/30 hover:bg-white/[0.1]',
  seller:
    'border-lime-tint-border bg-lime-tint-bg text-lime-text hover:bg-[rgba(86,184,127,0.2)]',
} as const

export function HeroEyebrow({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const { state, forgetCount } = useSellerPrompt()
  const variant: SellerPromptVariant | null = state === 'visitor' || state === 'seller' ? state : null
  const copy = variant ? HERO_EYEBROW[variant] : HERO_EYEBROW.visitor
  const cta = useCta(variant ?? 'visitor', 'hero', forgetCount)

  return (
    <Reveal state={state}>
      {/* Phones: one full-width row, the catch on the left and the button on
          the right. Wider screens: centred, the whole pitch on one line. */}
      <div
        className={`mx-auto flex min-h-[40px] max-w-[1400px] items-center justify-between gap-x-3 whitespace-nowrap text-[14px] leading-tight text-text-secondary sm:justify-center sm:gap-x-3.5 ${className}`}
      >
        <p className="m-0 min-w-0 truncate">
          {/* On a phone the catch is the whole text, so it carries the shimmer. */}
          <span className="seller-shimmer font-semibold sm:hidden">{copy.accent}</span>
          <span className="hidden font-semibold text-lime-text sm:inline">{copy.accent}</span>
          <span className="ml-2 hidden font-semibold text-white sm:inline">{copy.lead}</span>
          <span
            aria-hidden
            className="mx-2.5 hidden h-[3px] w-[3px] -translate-y-[2px] rounded-full bg-white/40 sm:inline-block"
          />
          <span className="seller-shimmer hidden font-semibold sm:inline">{copy.tail}</span>
        </p>
        <Link
          href={cta.href}
          onClick={cta.onClick}
                    className={`group relative inline-flex h-9 shrink-0 items-center gap-1.5 overflow-hidden rounded-md border px-3.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${BOX[variant ?? 'visitor']}`}
        >
          {!reduce && <ShineBorder duration={6} borderWidth={1} shineColor="rgba(200,240,107,0.85)" />}
          <span className="sm:hidden">{copy.phoneCta}</span>
          <span className="hidden sm:inline">{copy.cta}</span>
          <IconArrowRight className="h-[15px] w-[15px] transition-transform group-hover:translate-x-0.5" stroke={2.2} />
        </Link>
      </div>
    </Reveal>
  )
}

export function SellerPromptCard({
  gameName,
  categoryLabel,
  className = '',
}: {
  gameName: string
  categoryLabel: string
  className?: string
}) {
  const reduce = useReducedMotion()
  const { state, forgetCount } = useSellerPrompt()
  const variant: SellerPromptVariant | null = state === 'visitor' || state === 'seller' ? state : null
  const copy = listingsCardCopy(variant ?? 'visitor', gameName, categoryLabel)
  const cta = useCta(variant ?? 'visitor', 'listings', forgetCount)
  const Icon = variant === 'seller' ? IconBuildingStore : IconCoin

  return (
    <Reveal state={state} className={className}>
      {/* Glass over the game art: translucent raised surface, hairline,
          the thin lime line travelling the border; no glow. */}
      <div className="relative flex min-h-[64px] items-center gap-3.5 overflow-hidden rounded-lg border border-white/[0.1] bg-[rgba(29,30,35,0.6)] px-4 py-3 backdrop-blur-xl backdrop-saturate-150">
        {!reduce && <ShineBorder duration={8} borderWidth={1} shineColor="rgba(200,240,107,0.6)" />}
        <span
          aria-hidden
          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md ${variant === 'seller' ? 'bg-lime-tint-bg text-lime-text' : 'bg-warning-bg text-warning'}`}
        >
          <Icon className="h-[22px] w-[22px]" stroke={1.8} />
        </span>
        <p className="m-0 min-w-0 flex-1 text-[13px] leading-snug text-text-secondary">
          <span className="block text-[14px] font-semibold text-text-primary">{copy.lead}</span>
          <span className="seller-shimmer hidden font-medium sm:block">{copy.tail}</span>
        </p>
        <Link
          href={cta.href}
          onClick={cta.onClick}
                    className={`inline-flex h-10 shrink-0 items-center rounded-md px-4 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
            variant === 'seller' ? 'bg-lime text-text-inverse hover:bg-lime-hover active:bg-lime-pressed' : 'bg-white text-black hover:bg-white/90'
          }`}
        >
          {copy.cta}
        </Link>
      </div>
    </Reveal>
  )
}

/**
 * The desktop sub-navbar's Sell button, right of the content tab. A visitor
 * goes to the seller sign-up, a seller straight to a new listing. The value
 * pages' gold light moves through the words and a slow gold band round the
 * edge (owner, 2026-11-03: "an animation moving color but subtle"); static
 * under reduced motion. Reads only `useAuth()` (no listing count), so it costs
 * nothing on every game page; the static HTML carries the visitor label.
 */
export function SubnavSellButton({ className = '' }: { className?: string }) {
  const { profile } = useAuth()
  const variant: SellerPromptVariant = profile?.role === 'seller' ? 'seller' : 'visitor'
  const cta = useCta(variant, 'subnav', () => {
    if (profile?.id) forgetSellerListingCount(profile.id)
  })
  return (
    <Link
      href={cta.href}
      onClick={cta.onClick}
      className={`relative inline-flex h-9 shrink-0 items-center gap-2 overflow-hidden whitespace-nowrap rounded-md bg-white/[0.07] px-3.5 text-[14px] font-semibold transition-colors hover:bg-white/[0.11] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${className}`}
    >
      <ShineBorder duration={7} borderWidth={1} shineColor="rgba(232,189,106,0.75)" />
      <IconBuildingStore aria-hidden className="h-[17px] w-[17px] text-[#e8bd6a]" stroke={1.9} />
      <span className="trade-shine">{variant === 'seller' ? 'Create Listing' : 'Start Selling'}</span>
    </Link>
  )
}

/**
 * Phones: the ask to sell as one slim row inside the grid, after the first
 * cards (Eldorado drops its promo row into the grid the same way), so the
 * first screen is all items. Same copy and variants as the card.
 */
export function SellerPromptRow({ gameName, categoryLabel, className = '' }: { gameName: string; categoryLabel: string; className?: string }) {
  const { state, forgetCount } = useSellerPrompt()
  const variant: SellerPromptVariant | null = state === 'visitor' || state === 'seller' ? state : null
  const copy = listingsCardCopy(variant ?? 'visitor', gameName, categoryLabel)
  const cta = useCta(variant ?? 'visitor', 'listings-row', forgetCount)

  return (
    <Reveal state={state} className={className}>
      <div className="flex min-h-[56px] items-center gap-3 rounded-lg bg-[#1C1D22] py-2.5 pl-4 pr-2.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]">
        <IconBuildingStore aria-hidden className="h-5 w-5 shrink-0 text-[#e8bd6a]" stroke={1.9} />
        <p className="m-0 line-clamp-2 min-w-0 flex-1 text-[14px] font-semibold leading-snug">
          <span className="trade-shine">{copy.lead}</span>
        </p>
        <Link
          href={cta.href}
          onClick={cta.onClick}
          className={`inline-flex h-9 shrink-0 items-center rounded-md px-3.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
            variant === 'seller' ? 'bg-lime text-text-inverse hover:bg-lime-hover active:bg-lime-pressed' : 'bg-white text-black hover:bg-white/90'
          }`}
        >
          {copy.cta}
        </Link>
      </div>
    </Reveal>
  )
}

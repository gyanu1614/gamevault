'use client'

/**
 * The seller prompt, written into the page (growth point 5, 2026-10-08).
 * Replaces the bar that sat above the transparent navbar.
 *
 *   <HeroEyebrow />      homepage: one line above the headline, the call to
 *                        action in a subtle outlined box. No dismiss.
 *   <SellerPromptCard /> listings page: a small card beside the page title
 *                        (its own row on phones), copy per game + category.
 *
 * Both reserve their space while `useSellerPrompt()` resolves (invisible,
 * same height, so the common visitor case never jumps), fade and rise in
 * once it knows who is looking, and for a seller who is already selling
 * (3+ listings) the space folds away in one eased motion — no blank bar
 * left behind, no wrong colour ever shown.
 */
import Link from '@/components/navigation/AppLink'
import { track } from '@vercel/analytics'
import {
  IconArrowRight,
  IconBuildingStore,
  IconCoin,
} from '@tabler/icons-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ShineBorder } from '@/components/ui/shine-border'
import {
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
      // They are off to list: forget the cached 'no listing yet'.
      if (variant === 'seller') forgetCount()
    },
  }
}

/**
 * Mount/unmount choreography shared by both surfaces: invisible-but-sized
 * while pending, fade + 6px rise when resolved, height folds to 0 on hide.
 */
function Reveal({
  state,
  className = '',
  children,
}: {
  state: SellerPromptState
  className?: string
  children: React.ReactNode
}) {
  const reduce = useReducedMotion()
  const resolved = state === 'visitor' || state === 'seller'
  const ease = [0.16, 1, 0.3, 1] as const
  return (
    <AnimatePresence initial={false}>
      {state !== 'hidden' && (
        <motion.div
          key="prompt"
          aria-hidden={!resolved}
          initial={false}
          animate={{
            height: 'auto',
            opacity: resolved ? 1 : 0,
            y: resolved ? 0 : 6,
          }}
          exit={{ height: 0, opacity: 0, y: 0 }}
          transition={
            reduce
              ? { duration: 0 }
              : {
                  height: { duration: 0.4, ease },
                  opacity: { duration: 0.35, ease },
                  y: { duration: 0.45, ease },
                }
          }
          style={{ overflow: 'hidden' }}
          className={`${className} ${resolved ? '' : 'pointer-events-none'}`}
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
        className={`mx-auto flex min-h-[40px] max-w-[1400px] items-center justify-between gap-x-3 whitespace-nowrap text-[15px] leading-tight text-text-secondary sm:justify-center sm:gap-x-3.5 ${className}`}
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
          tabIndex={variant ? undefined : -1}
          className={`group relative inline-flex h-9 shrink-0 items-center gap-1.5 overflow-hidden rounded-md border px-3.5 text-[13.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${BOX[variant ?? 'visitor']}`}
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
        <p className="m-0 min-w-0 flex-1 text-[13.5px] leading-snug text-text-secondary">
          <span className="block text-[15px] font-semibold text-text-primary">{copy.lead}</span>
          <span className="seller-shimmer hidden font-medium sm:block">{copy.tail}</span>
        </p>
        <Link
          href={cta.href}
          onClick={cta.onClick}
          tabIndex={variant ? undefined : -1}
          className={`inline-flex h-10 shrink-0 items-center rounded-md px-4 text-[13.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
            variant === 'seller' ? 'bg-lime text-text-inverse hover:bg-lime-hover active:bg-lime-pressed' : 'bg-white text-black hover:bg-white/90'
          }`}
        >
          {copy.cta}
        </Link>
      </div>
    </Reveal>
  )
}

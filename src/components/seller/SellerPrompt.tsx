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
 * Both reserve their space and fade in once `useSellerPrompt()` knows who
 * is looking, so nothing jumps and no wrong colour flashes. A seller who is
 * already selling (3+ listings) sees the reserved space, empty.
 */
import Link from '@/components/navigation/AppLink'
import { track } from '@vercel/analytics'
import { IconArrowRight, IconBuildingStore, IconCoin } from '@tabler/icons-react'
import { useSellerPrompt } from '@/hooks/use-seller-prompt'
import {
  HERO_EYEBROW,
  SELLER_PROMPT_EVENT,
  listingsCardCopy,
  sellerPromptHref,
  type SellerPromptVariant,
} from '@/lib/seller/seller-prompt'

function useCta(variant: SellerPromptVariant, source: string, forgetCount: () => void) {
  return {
    href: sellerPromptHref(variant, source),
    onClick: () => {
      track(SELLER_PROMPT_EVENT[variant], { source })
      // They are off to list: forget the cached "no listing yet".
      if (variant === 'seller') forgetCount()
    },
  }
}

const BOX = {
  visitor: 'border-white/[0.16] bg-white/[0.06] text-white hover:border-white/30 hover:bg-white/[0.1]',
  seller: 'border-lime-tint-border bg-lime-tint-bg text-lime-text hover:bg-[rgba(86,184,127,0.2)]',
} as const

export function HeroEyebrow({ className = '' }: { className?: string }) {
  const { state, forgetCount } = useSellerPrompt()
  const variant: SellerPromptVariant | null = state === 'visitor' || state === 'seller' ? state : null
  const copy = variant ? HERO_EYEBROW[variant] : HERO_EYEBROW.visitor
  const cta = useCta(variant ?? 'visitor', 'hero', forgetCount)

  return (
    <div
      aria-hidden={!variant}
      className={`flex min-h-[38px] flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[13px] leading-tight text-text-secondary transition-opacity duration-300 sm:text-[14px] ${variant ? 'opacity-100' : 'pointer-events-none opacity-0'} ${className}`}
    >
      <p className="m-0">
        <span className="font-semibold text-white">{copy.lead}</span>
        <span aria-hidden className="mx-2 inline-block h-[3px] w-[3px] -translate-y-[2px] rounded-full bg-white/40" />
        <span>{copy.tail}</span>
      </p>
      <Link
        href={cta.href}
        onClick={cta.onClick}
        tabIndex={variant ? undefined : -1}
        className={`group inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[12.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${BOX[variant ?? 'visitor']}`}
      >
        {copy.cta}
        <IconArrowRight className="h-[14px] w-[14px] transition-transform group-hover:translate-x-0.5" stroke={2.2} />
      </Link>
    </div>
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
  const { state, forgetCount } = useSellerPrompt()
  const variant: SellerPromptVariant | null = state === 'visitor' || state === 'seller' ? state : null
  const copy = listingsCardCopy(variant ?? 'visitor', gameName, categoryLabel)
  const cta = useCta(variant ?? 'visitor', 'listings', forgetCount)
  const Icon = variant === 'seller' ? IconBuildingStore : IconCoin

  return (
    <div
      aria-hidden={!variant}
      className={`flex min-h-[56px] items-center gap-3 rounded-lg border border-white/[0.08] bg-bg-raised px-3.5 py-2.5 transition-opacity duration-300 ${variant ? 'opacity-100' : 'pointer-events-none opacity-0'} ${className}`}
    >
      <span
        aria-hidden
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${variant === 'seller' ? 'bg-lime-tint-bg text-lime-text' : 'bg-warning-bg text-warning'}`}
      >
        <Icon className="h-[18px] w-[18px]" stroke={1.8} />
      </span>
      <p className="m-0 min-w-0 flex-1 text-[12.5px] leading-snug text-text-secondary">
        <span className="block font-semibold text-text-primary">{copy.lead}</span>
        <span className="hidden sm:block">{copy.tail}</span>
      </p>
      <Link
        href={cta.href}
        onClick={cta.onClick}
        tabIndex={variant ? undefined : -1}
        className={`inline-flex h-9 shrink-0 items-center rounded-md px-3.5 text-[12.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
          variant === 'seller' ? 'bg-lime text-text-inverse hover:bg-lime-hover active:bg-lime-pressed' : 'bg-white text-black hover:bg-white/90'
        }`}
      >
        {copy.cta}
      </Link>
    </div>
  )
}

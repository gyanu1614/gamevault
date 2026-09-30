'use client'

/**
 * TierIcon — the seller rank as one premium glyph (owner, 2026-09-30: "we
 * have bad icons for tiers, get premium icons").
 *
 * Phosphor fill glyphs with a metal gradient (the gradient is an SVG child
 * of the icon, so the art stays the library's; nothing hand-drawn):
 *   Bronze / Silver / Gold  medal in its metal
 *   Diamond                 cut gem, ice blue
 *   Legendary               crown, in the ladder's green
 * The ladder reads at a glance: three medals, then a gem, then a crown.
 *
 * Carries an accessible name ("Gold Seller") unless `decorative`, and a
 * native tooltip with the same text.
 */

import { useId } from 'react'
import { MedalIcon, SketchLogoIcon, CrownIcon } from '@phosphor-icons/react'
import { tierByKey, type SellerTier } from '@/lib/seller/tiers'
import { cn } from '@/lib/utils'

const ART: Record<SellerTier, { Icon: typeof MedalIcon; stops: [string, string, string] }> = {
  bronze: { Icon: MedalIcon, stops: ['#F7C39A', '#D0844E', '#9A5530'] },
  silver: { Icon: MedalIcon, stops: ['#FAFAFB', '#C9CCD3', '#8E939E'] },
  gold: { Icon: MedalIcon, stops: ['#FFF1B0', '#F2C230', '#B7860B'] },
  diamond: { Icon: SketchLogoIcon, stops: ['#E6FDFF', '#67E3F9', '#1597C4'] },
  legendary: { Icon: CrownIcon, stops: ['#E4FCC6', '#7FD89A', '#2F9A61'] },
}

export function TierIcon({
  tier,
  size = 16,
  decorative = false,
  className,
}: {
  tier: string | null | undefined
  size?: number
  /** True when the tier name is already written next to it. */
  decorative?: boolean
  className?: string
}) {
  const def = tierByKey(tier)
  const { Icon, stops } = ART[def.key]
  const id = `tier-${useId().replace(/:/g, '')}`
  const name = `${def.label} Seller`
  return (
    <Icon
      size={size}
      weight="fill"
      color={`url(#${id})`}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : name}
      role={decorative ? undefined : 'img'}
      className={cn('shrink-0 drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]', className)}
    >
      {!decorative && <title>{name}</title>}
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0%" stopColor={stops[0]} />
          <stop offset="55%" stopColor={stops[1]} />
          <stop offset="100%" stopColor={stops[2]} />
        </linearGradient>
      </defs>
    </Icon>
  )
}

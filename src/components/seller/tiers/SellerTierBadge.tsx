'use client'

/**
 * SellerTierBadge — the visual tier medallion.
 *
 * Renders the ornate per-tier art from `public/tiers/{tier}.png` (gently
 * floating), and falls back to the flat lucide gemstone icon when the PNG isn't
 * present yet — so the app works with a full set, a partial set, or none.
 *
 * Drop the images at:  public/tiers/{quartz,amethyst,ruby,sapphire,diamond}.png
 * (transparent, square). See public/tiers/README.md for the spec.
 */

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { tierByKey } from '@/lib/seller/tiers'

interface SellerTierBadgeProps {
  tier: string | null | undefined
  /** Rendered pixel size of the medallion (width = height). */
  size?: number
  /** Gentle up/down float. On by default; disabled respects reduced-motion. */
  float?: boolean
  className?: string
}

export default function SellerTierBadge({
  tier,
  size = 40,
  float = true,
  className,
}: SellerTierBadgeProps) {
  const def = tierByKey(tier)
  // Start by trying the PNG; flip to the lucide fallback if it 404s / is absent.
  const [useArt, setUseArt] = useState(true)
  const TierIcon = def.Icon

  const floatCls = float ? 'motion-safe:animate-float' : ''

  if (useArt) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- static per-tier art, sized inline
      <img
        src={`/tiers/${def.key}.png`}
        alt={`${def.label} tier`}
        width={size}
        height={size}
        loading="lazy"
        onError={() => setUseArt(false)}
        className={cn('inline-block select-none object-contain', floatCls, className)}
        style={{ width: size, height: size }}
        draggable={false}
      />
    )
  }

  // Fallback: the flat lucide gemstone icon in the tier's colour, on a soft chip.
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full border',
        def.colors.text,
        def.colors.bg,
        def.colors.border,
        floatCls,
        className,
      )}
      style={{ width: size, height: size }}
      aria-label={`${def.label} tier`}
    >
      <TierIcon style={{ width: size * 0.55, height: size * 0.55 }} aria-hidden="true" />
    </span>
  )
}

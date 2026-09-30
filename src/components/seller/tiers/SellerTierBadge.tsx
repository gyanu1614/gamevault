'use client'

/**
 * SellerTierBadge — the tier medallion on the storefront banner, tier cards
 * and the profile menu. Draws <TierIcon> (Phosphor medal / gem / crown in a
 * metal gradient) at any size, optionally floating.
 *
 * The old version tried `public/tiers/{tier}.png` first; none of the metal
 * tiers ever had art, so every render 404'd and fell back to a generic
 * lucide shape (owner, 2026-09-30: "bad icons for tiers").
 */

import { cn } from '@/lib/utils'
import { TierIcon } from './TierIcon'

interface SellerTierBadgeProps {
  tier: string | null | undefined
  /** Rendered pixel size of the medallion (width = height). */
  size?: number
  /** Gentle up/down float. On by default; disabled respects reduced-motion. */
  float?: boolean
  className?: string
}

export default function SellerTierBadge({ tier, size = 40, float = true, className }: SellerTierBadgeProps) {
  return <TierIcon tier={tier} size={size} className={cn(float && 'motion-safe:animate-float', className)} />
}

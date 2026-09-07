/**
 * TierBadge — inline pill showing a seller's tier with the correct colour.
 *
 * badge_color values from seller_tier_config:
 *   zinc | orange | slate | yellow | cyan | violet
 */

import { cn } from '@/lib/utils'
import { tierByKey, type SellerTier } from '@/lib/seller/tiers'

export type { SellerTier }

interface TierBadgeProps {
  tier: SellerTier | string
  size?: 'xs' | 'sm' | 'md'
  showIcon?: boolean
  className?: string
}

const SIZE_CLASSES = {
  xs: 'text-[10px] px-1.5 py-0.5 gap-0.5',
  sm: 'text-xs px-2 py-0.5 gap-1',
  md: 'text-sm px-2.5 py-1 gap-1.5',
}

export default function TierBadge({
  tier,
  size = 'sm',
  showIcon = true,
  className,
}: TierBadgeProps) {
  const def = tierByKey(tier)
  const TierIcon = def.Icon

  return (
    <span
      className={cn(
        'inline-flex items-center font-semibold rounded-full border',
        def.colors.text,
        def.colors.bg,
        def.colors.border,
        SIZE_CLASSES[size],
        className
      )}
    >
      {showIcon && <TierIcon className="h-3 w-3" aria-hidden="true" />}
      {def.label}
    </span>
  )
}

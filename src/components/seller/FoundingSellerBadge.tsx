/**
 * FoundingSellerBadge — the storefront/identity badge for a founding seller.
 *
 * Rendered wherever a seller's identity shows once profiles.founding_seller is
 * true. Amber "founding" treatment (matching the /early-seller programme page),
 * deliberately distinct from the tier badges (TierBadge) so the two can sit
 * side by side: tier = earned progression, founding = the first-100 status.
 *
 * This is the visible half of the perk; the commission side lives in
 * src/lib/fees (FOUNDING_DISCOUNT_PTS).
 */

import { IconRosetteDiscountCheck } from '@tabler/icons-react'
import { cn } from '@/lib/utils'

interface FoundingSellerBadgeProps {
  size?: 'xs' | 'sm' | 'md'
  /** Hide the "Founding Seller" label and show only the rosette (tight rows). */
  iconOnly?: boolean
  className?: string
}

const SIZE_CLASSES: Record<NonNullable<FoundingSellerBadgeProps['size']>, string> = {
  xs: 'text-[10px] px-1.5 py-0.5 gap-0.5',
  sm: 'text-xs px-2 py-0.5 gap-1',
  md: 'text-sm px-2.5 py-1 gap-1.5',
}

const ICON_SIZE: Record<NonNullable<FoundingSellerBadgeProps['size']>, string> = {
  xs: 'h-3 w-3',
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
}

export default function FoundingSellerBadge({
  size = 'sm',
  iconOnly = false,
  className,
}: FoundingSellerBadgeProps) {
  return (
    <span
      title="Founding Seller — one of DropMarket's first 100"
      className={cn(
        'inline-flex items-center rounded-full border font-semibold',
        'border-[#F5C451]/25 bg-[#F5C451]/10 text-[#F5C451]',
        SIZE_CLASSES[size],
        className,
      )}
    >
      <IconRosetteDiscountCheck className={ICON_SIZE[size]} stroke={2} aria-hidden="true" />
      {!iconOnly && <span>Founding Seller</span>}
    </span>
  )
}

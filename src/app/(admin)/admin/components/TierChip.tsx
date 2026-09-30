'use client'

import { TierIcon } from '@/components/seller/tiers/TierIcon'
import { tierByKey } from '@/lib/seller/tiers'
import { cn } from '@/lib/utils'

/** A seller's tier as a small fill chip with the site's tier medallion. */
export function TierChip({ tier, className }: { tier: string | null | undefined; className?: string }) {
  const def = tierByKey(tier)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-white/[0.07] py-0.5 pl-1.5 pr-2 text-[11.5px] font-semibold text-text-primary',
        className,
      )}
    >
      <TierIcon tier={def.key} size={13} decorative />
      {def.label}
    </span>
  )
}

'use client'

/**
 * RankIcon — the small square rank glyph used in rank cards and compact rows.
 *
 * Tries the owner-supplied art at `public/tiers/icons/{tier}.png` first
 * (drop-in, no code changes — see public/tiers/icons/README.md for the spec),
 * and falls back to the flat lucide glyph on a tinted chip when the file
 * doesn't exist. Distinct from the big storefront medallions in public/tiers/.
 */

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { tierByKey } from '@/lib/seller/tiers'

export default function RankIcon({
  tier,
  size = 24,
  className,
}: {
  tier: string | null | undefined
  /** Rendered pixel size (width = height). */
  size?: number
  className?: string
}) {
  const def = tierByKey(tier)
  const [useArt, setUseArt] = useState(true)
  const TierIcon = def.Icon

  if (useArt) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- static per-rank art, sized inline
      <img
        src={`/tiers/icons/${def.key}.png`}
        alt={`${def.label} rank`}
        width={size}
        height={size}
        loading="lazy"
        onError={() => setUseArt(false)}
        className={cn('inline-block shrink-0 select-none object-contain', className)}
        style={{ width: size, height: size }}
        draggable={false}
      />
    )
  }

  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-md border',
        def.colors.text,
        def.colors.bg,
        def.colors.border,
        className,
      )}
      style={{ width: size, height: size }}
      aria-label={`${def.label} rank`}
    >
      <TierIcon style={{ width: size * 0.58, height: size * 0.58 }} aria-hidden="true" />
    </span>
  )
}

'use client'

import { useCountUp } from '../hooks/useCountUp'

export interface StatTileProps {
  value: number
  label: string
  prefix?: string
  suffix?: string
  decimals?: number
  compact?: boolean
  accent?: boolean
  /** Tailwind border classes for this tile's position in the grid */
  className?: string
}

/**
 * Trust stat tile with count-up animation triggered by IntersectionObserver
 * (threshold 0.3). Snaps to final value if prefers-reduced-motion.
 */
export function StatTile({ value, label, prefix, suffix, decimals, compact, accent, className }: StatTileProps) {
  const ref = useCountUp({ target: value, prefix, suffix, decimals, compact })

  return (
    <div className={`py-12 px-6 text-center ${className ?? ''}`}>
      <div
        ref={ref as React.RefObject<HTMLDivElement>}
        className={`font-display text-display-lg text-tabular ${accent ? 'text-lime' : 'text-text-primary'}`}
      >
        {/* Initial render before hydration / observer fires */}
        {prefix}
        {compact && value >= 1_000_000
          ? (value / 1_000_000).toFixed(2).replace(/\.00$/, '') + 'M'
          : value.toLocaleString(undefined, { minimumFractionDigits: decimals ?? 0, maximumFractionDigits: decimals ?? 0 })}
        {suffix}
      </div>
      <div className="text-text-secondary mt-2 text-[14.5px]">{label}</div>
    </div>
  )
}

/**
 * OrderCard — V21/P3.d
 *
 * Surface primitive for the order detail page. Matches the canonical
 * card shape used site-wide on bundle currency / Other Sellers:
 * solid `bg-bg-raised`, 1px subtle border, `rounded-lg`. NOT blurred
 * or translucent — the V20 handoff suggested a glass surface but the
 * user rolled it back to the canonical shape per memory:card-shape-rule.
 *
 * Variants:
 * - default — bg-bg-raised, border-border-default
 * - glow    — same surface + faint lime outer shadow (chat hero only)
 * - lime    — lime-tinted bg + border (delivery instructions panel)
 *
 * Below sm every variant is full-bleed: the page keeps its px-5 gutter
 * for text, and cards cancel it so they run edge to edge.
 */

import { cn } from '@/lib/utils'
import type { HTMLAttributes } from 'react'

interface OrderCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glow' | 'lime'
  padded?: boolean
}

export function OrderCard({
  className,
  variant = 'default',
  padded = true,
  ...rest
}: OrderCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border',
        // Phone: full-bleed rows (edge to edge, no border, no corners); the
        // card's own fill against the page is the only edge, and the page
        // gap separates rows. -mx-5 cancels the page's px-5 gutter.
        'max-sm:-mx-5 max-sm:rounded-none max-sm:border-0',
        variant === 'default' && 'border-border-default bg-bg-raised',
        variant === 'glow' &&
          'border-lime-tint-border bg-bg-raised shadow-[0_0_0_1px_rgba(198,255,61,0.10),0_8px_30px_rgba(198,255,61,0.05)]',
        variant === 'lime' &&
          'border-lime-tint-border bg-gradient-to-b from-lime/[0.07] to-lime/[0.01]',
        padded && 'p-5',
        className,
      )}
      {...rest}
    />
  )
}

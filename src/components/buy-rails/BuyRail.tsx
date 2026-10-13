import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { RAIL_TOP, type RailTop } from './geometry'

/**
 * A sticky desktop rail (≥1280px only): the grid cell stretches to the
 * content column's height; the inner box is the screen under the nav, sticks
 * there and centres the card in it, so the rail stays put mid-screen while
 * the article scrolls and stops at the end of the content.
 * Server component; the cards inside are the client islands.
 */
export function BuyRail({
  label,
  top = 'hub',
  children,
  className,
}: {
  /** aria-label, e.g. "Buy Robux". */
  label: string
  top?: RailTop
  children: ReactNode
  className?: string
}) {
  return (
    <aside aria-label={label} className={cn('hidden self-stretch xl:block', className)}>
      <div className={cn('sticky flex flex-col justify-center gap-4 py-6', RAIL_TOP[top])}>{children}</div>
    </aside>
  )
}

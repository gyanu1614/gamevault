import type { ReactNode } from 'react'

export interface HorizontalScrollerProps {
  children: ReactNode
}

/**
 * Shared container for all Popular* rows. On desktop it's an even grid;
 * on mobile it becomes a snap-scroll horizontal carousel.
 */
export function HorizontalScroller({ children }: HorizontalScrollerProps) {
  return (
    <div className="grid grid-flow-col auto-cols-[minmax(180px,1fr)] gap-5 md:overflow-visible overflow-x-auto snap-x-mandatory pb-2 -mx-6 px-6 md:mx-0 md:px-0">
      {children}
    </div>
  )
}

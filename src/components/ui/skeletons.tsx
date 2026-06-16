/**
 * Shared skeleton components used across account pages.
 * All use the `.skeleton` CSS class (purple shimmer from globals.css).
 */

import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Generic helpers                                                      */
/* ------------------------------------------------------------------ */

function Sk({ className }: { className: string }) {
  return <div className={cn('skeleton rounded', className)} />
}

/* ------------------------------------------------------------------ */
/* Order card skeleton                                                  */
/* ------------------------------------------------------------------ */

export function OrderCardSkeleton() {
  return (
    <div className="rounded-2xl bg-bg-raised border border-border-subtle p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 flex-1">
          <Sk className="h-4 w-32" />
          <Sk className="h-5 w-64" />
        </div>
        <Sk className="h-6 w-20 rounded-full" />
      </div>
      <div className="flex items-center gap-4">
        <Sk className="h-3 w-24" />
        <Sk className="h-3 w-16" />
        <Sk className="h-3 w-20" />
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
        <Sk className="h-6 w-16" />
        <Sk className="h-8 w-24 rounded-lg" />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Review card skeleton                                                 */
/* ------------------------------------------------------------------ */

export function ReviewCardSkeleton() {
  return (
    <div className="rounded-2xl bg-bg-raised border border-border-subtle p-5 space-y-3">
      <div className="flex items-center gap-3">
        <Sk className="h-9 w-9 rounded-full" />
        <div className="space-y-1.5 flex-1">
          <Sk className="h-3 w-28" />
          <Sk className="h-3 w-20" />
        </div>
        <Sk className="h-4 w-16 rounded-full" />
      </div>
      <Sk className="h-4 w-full" />
      <Sk className="h-4 w-4/5" />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Metric card skeleton                                                 */
/* ------------------------------------------------------------------ */

export function MetricCardSkeleton() {
  return (
    <div className="rounded-2xl bg-bg-raised border border-border-subtle p-5 space-y-3">
      <div className="flex items-center justify-between">
        <Sk className="h-3 w-24" />
        <Sk className="h-7 w-7 rounded-lg" />
      </div>
      <Sk className="h-8 w-28" />
      <Sk className="h-3 w-20" />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Chat / message skeleton                                              */
/* ------------------------------------------------------------------ */

export function ChatMessageSkeleton({ right = false }: { right?: boolean }) {
  return (
    <div className={cn('flex gap-3', right && 'flex-row-reverse')}>
      <Sk className="h-8 w-8 rounded-full shrink-0" />
      <div className={cn('space-y-1.5 max-w-[60%]', right && 'items-end flex flex-col')}>
        <Sk className="h-4 w-full rounded-xl rounded-tl-none" />
        <Sk className="h-4 w-4/5 rounded-xl" />
        <Sk className="h-3 w-16 rounded" />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Table row skeleton                                                   */
/* ------------------------------------------------------------------ */

export function TableRowSkeleton({ cols = 4 }: { cols?: number }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-border-subtle">
      {Array.from({ length: cols }).map((_, i) => (
        <Sk key={i} className={cn('h-4 flex-1', i === 0 && 'w-8 flex-none')} />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Full page skeletons for account sections                             */
/* ------------------------------------------------------------------ */

/** Renders N metric cards + N order card skeletons */
export function AccountPageSkeleton({
  metrics = 3,
  cards = 5,
  CardSkeleton = OrderCardSkeleton,
}: {
  metrics?: number
  cards?: number
  CardSkeleton?: () => JSX.Element
}) {
  return (
    <div className="space-y-6">
      {/* Metric row */}
      {metrics > 0 && (
        <div className={cn('grid gap-4', `grid-cols-${metrics}`)}>
          {Array.from({ length: metrics }).map((_, i) => (
            <MetricCardSkeleton key={i} />
          ))}
        </div>
      )}
      {/* Card list */}
      <div className="space-y-3">
        {Array.from({ length: cards }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

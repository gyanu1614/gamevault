/**
 * Loading skeletons for admin pages. Each mirrors its page's layout (header,
 * strips, panels) so the swap to real content doesn't jump. Built on the
 * account skeleton pieces; the admin shell already pads the content column,
 * so these render without a page frame of their own.
 */

import { Sk } from '@/components/account/AccountSkeletons'
import { cn } from '@/lib/utils'

export function SkAdminHeader({ actions = false, titleWidth = 'w-56' }: { actions?: boolean; titleWidth?: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-6">
      <div className="min-w-0">
        <Sk className={cn('h-8 max-w-full rounded-md', titleWidth)} />
        <Sk className="mt-2 h-4 w-64 max-w-full" />
      </div>
      {actions && <Sk className="h-9 w-32 rounded-md" />}
    </div>
  )
}

/** StatStrip placeholder with any column count at lg. */
export function SkAdminStrip({ count = 4, lgCols = 'lg:grid-cols-4', className }: { count?: number; lgCols?: string; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-white/[0.07]', lgCols, className)} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-bg-raised px-4 py-4 sm:px-5">
          <Sk className="h-3.5 w-20" />
          <Sk className="mt-2.5 h-7 w-16" />
          <Sk className="mt-2 h-3 w-24" />
        </div>
      ))}
    </div>
  )
}

/** A panel of list rows (icon tile + two lines + trailing chip). */
export function SkAdminRows({ count = 5, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('divide-y divide-white/[0.06] overflow-hidden rounded-lg bg-bg-raised', className)} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <Sk className="h-10 w-10 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1">
            <Sk className="h-3.5 w-40 max-w-[70%]" />
            <Sk className="mt-2 h-3 w-56 max-w-[85%]" />
          </div>
          <Sk className="h-5 w-16 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  )
}

export function SkSectionLabel({ className }: { className?: string }) {
  return <Sk className={cn('mb-3 h-4 w-28', className)} />
}

/** Any admin page without its own skeleton: header, a strip, a list. */
export function SkAdminPage() {
  return (
    <div aria-busy aria-label="Loading">
      <SkAdminHeader actions />
      <SkAdminStrip />
      <SkAdminRows count={6} className="mt-6" />
    </div>
  )
}

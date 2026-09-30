/**
 * Skeleton parts for account pages, built from the same measurements as the
 * real pieces in AccountSurface (card padding, header sizes, stat strip), so a
 * route's loading.tsx can mirror its page 1:1 and nothing jumps when data
 * lands (skeletons-match-the-page).
 */

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Sk({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn('skeleton rounded', className)} style={style} aria-hidden />
}

/** AccountPage frame + AccountPageHeader (24px title, 13px subtitle, optional right actions). */
export function SkPage({
  children,
  actions,
  titleWidth = 'w-44',
  subtitle = true,
}: {
  children: ReactNode
  actions?: ReactNode
  titleWidth?: string
  subtitle?: boolean
}) {
  return (
    <div className="pb-12" aria-busy aria-label="Loading">
      <div className="mx-auto w-full max-w-full px-4 sm:px-6 md:max-w-7xl lg:px-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Sk className={cn('h-8 rounded-md', titleWidth)} />
            {subtitle && <Sk className="mt-1.5 h-4 w-72 max-w-full" />}
          </div>
          {actions}
        </div>
        {children}
      </div>
    </div>
  )
}

/** SegmentedTabs placeholder: the bar with the first tab selected. */
export function SkTabs({ widths }: { widths: number[] }) {
  return (
    <div className="flex w-fit max-w-full gap-0.5 overflow-hidden rounded-lg border border-white/[0.08] bg-bg-well p-0.5" aria-hidden>
      {widths.map((w, i) => (
        <div key={i} className={cn('h-[34px] shrink-0 rounded-md', i === 0 ? 'bg-white/[0.09]' : 'skeleton opacity-40')} style={{ width: w }} />
      ))}
    </div>
  )
}

/** StatStrip placeholder. */
export function SkStatStrip({ count = 4 }: { count?: number }) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-white/[0.07]',
        count >= 4 ? 'lg:grid-cols-4' : count === 3 ? 'lg:grid-cols-3' : '',
      )}
      aria-hidden
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-bg-raised px-4 py-4 sm:px-5">
          <Sk className="h-3.5 w-24" />
          <Sk className="mt-2 h-7 w-24" />
          <Sk className="mt-2 h-3 w-20" />
        </div>
      ))}
    </div>
  )
}

/** SettingsCard placeholder: title (+ description), body, optional footer bar. */
export function SkCard({
  children,
  description = true,
  aside = false,
  footer = false,
  className,
}: {
  children?: ReactNode
  description?: boolean
  aside?: boolean
  footer?: boolean
  className?: string
}) {
  return (
    <div className={cn('overflow-hidden rounded-lg bg-bg-raised', className)} aria-hidden>
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <Sk className="h-4 w-32" />
            {description && <Sk className="mt-2 h-3.5 w-64 max-w-full" />}
          </div>
          {aside && <Sk className="h-4 w-16" />}
        </div>
        {children && <div className="mt-5">{children}</div>}
      </div>
      {footer && (
        <div className="flex items-center justify-between gap-3 border-t border-white/[0.07] bg-black/[0.14] px-5 py-3 sm:px-6">
          <Sk className="h-3.5 w-44 max-w-[50%]" />
          <Sk className="h-10 w-24 rounded-md" />
        </div>
      )}
    </div>
  )
}

/** Stacked row placeholders (accountRowCls rows, list rows). */
export function SkRows({ count = 3, height = 'h-12', gap = 'space-y-2' }: { count?: number; height?: string; gap?: string }) {
  return (
    <div className={gap} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <Sk key={i} className={cn('w-full rounded-md', height)} />
      ))}
    </div>
  )
}

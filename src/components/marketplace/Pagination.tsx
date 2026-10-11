'use client'

/**
 * Numbered pages under a listing grid (items, other categories, storefronts):
 * Previous · 1 2 3 … 12 · Next, then "Showing 25–48 of 68". Replaces the
 * old Load More buttons (owner, 2026-10-11).
 *
 * Each page is a real link (`?page=N`) so it can open in a new tab; a plain
 * click stays in place, swaps the slice and scrolls the grid's top into view
 * (useUrlPage). robots.txt disallows `?page=`, so crawlers keep to page 1.
 */
import { usePathname } from 'next/navigation'
import { CaretLeftIcon } from '@phosphor-icons/react/dist/csr/CaretLeft'
import { CaretRightIcon } from '@phosphor-icons/react/dist/csr/CaretRight'

import { cn } from '@/lib/utils'
import { pageHref, pageWindow } from '@/lib/pagination'

const CELL =
  'inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2.5 text-[13px] font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring'
const IDLE = 'bg-bg-raised text-text-secondary hover:bg-bg-raised-hover hover:text-text-primary'

export function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onChange,
  className,
}: {
  page: number
  totalPages: number
  totalItems: number
  pageSize: number
  onChange: (page: number) => void
  className?: string
}) {
  const pathname = usePathname() ?? '/'
  if (totalPages <= 1) return null

  const first = (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, totalItems)

  const link = (n: number, label: React.ReactNode, cls: string, aria?: Record<string, string>) => (
    <a
      key={typeof label === 'string' || typeof label === 'number' ? `p${n}-${label}` : `p${n}`}
      href={pageHref(pathname, '', n)}
      onClick={(e) => {
        // Let Cmd/Ctrl/middle-click open a new tab as a normal link.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
        e.preventDefault()
        onChange(n)
      }}
      className={cls}
      {...aria}
    >
      {label}
    </a>
  )

  const edge = (dir: 'prev' | 'next') => {
    const target = dir === 'prev' ? page - 1 : page + 1
    const disabled = target < 1 || target > totalPages
    const label = (
      <>
        {dir === 'prev' && <CaretLeftIcon className="h-3.5 w-3.5" weight="bold" />}
        <span className="max-sm:sr-only">{dir === 'prev' ? 'Previous' : 'Next'}</span>
        {dir === 'next' && <CaretRightIcon className="h-3.5 w-3.5" weight="bold" />}
      </>
    )
    const cls = cn(CELL, 'gap-1 sm:px-3', disabled ? 'cursor-default bg-white/[0.03] text-text-disabled' : IDLE)
    return disabled ? (
      <span key={dir} aria-disabled="true" className={cls}>
        {label}
      </span>
    ) : (
      link(target, label, cls, { rel: dir, 'aria-label': dir === 'prev' ? 'Previous page' : 'Next page' })
    )
  }

  return (
    <nav aria-label="Pagination" className={cn('mt-9 flex flex-col items-center gap-3', className)}>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {edge('prev')}
        {pageWindow(page, totalPages).map((slot, i) =>
          slot === 'gap' ? (
            <span key={`gap-${i}`} aria-hidden className="inline-flex h-9 w-6 items-center justify-center text-[13px] text-text-disabled">
              …
            </span>
          ) : slot === page ? (
            <span key={slot} aria-current="page" className={cn(CELL, 'bg-white/[0.12] text-text-primary')}>
              {slot}
            </span>
          ) : (
            link(slot, slot, cn(CELL, IDLE), { 'aria-label': `Page ${slot}` })
          ),
        )}
        {edge('next')}
      </div>
      <p className="text-[12.5px] tabular-nums text-text-tertiary">
        Showing {first}–{last} of {totalItems}
      </p>
    </nav>
  )
}

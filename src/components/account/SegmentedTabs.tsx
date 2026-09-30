'use client'

/**
 * SegmentedTabs — the compact tab control used on account pages (Settings,
 * Wallet, …): same size and fill as the wallet tabs the owner approved
 * (2026-09-28), with the selection sliding between tabs instead of jumping.
 *
 * - `role="tablist"` + roving tabindex: ←/→/Home/End move and select.
 * - The bar stays put; on narrow screens the tabs scroll inside it and the
 *   clipped edge fades into the bar with a chevron (ScrollRow), keeping the
 *   selected tab in view.
 * - Reduced motion: the pill moves without animating.
 */

import { useEffect, useRef, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ScrollRow } from '@/components/ui/scroll-row'
import { cn } from '@/lib/utils'

export interface SegmentedTab<T extends string> {
  id: T
  /** Text, or text plus a muted count (`<>5 Stars <TabCount n={8} /></>`). */
  label: ReactNode
}

interface SegmentedTabsProps<T extends string> {
  tabs: SegmentedTab<T>[]
  value: T
  onChange: (id: T) => void
  /** Unique per page, so two tab rows never share one sliding pill. */
  layoutId: string
  ariaLabel: string
  /** id prefix for aria-controls / the panel's aria-labelledby. */
  idPrefix?: string
  className?: string
}

export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  layoutId,
  ariaLabel,
  idPrefix = layoutId,
  className,
}: SegmentedTabsProps<T>) {
  const reduce = useReducedMotion()
  const refs = useRef(new Map<T, HTMLButtonElement>())

  // Keep the selected tab fully visible when the row scrolls (phones, 7
  // tabs), clear of the edge fade rather than tucked under it.
  useEffect(() => {
    const tab = refs.current.get(value)
    const row = tab?.closest<HTMLElement>('[data-scrollrow]')
    if (!tab || !row) return
    const pad = 44
    const left = tab.offsetLeft - pad
    const right = tab.offsetLeft + tab.offsetWidth + pad - row.clientWidth
    const target = row.scrollLeft > left ? left : row.scrollLeft < right ? right : null
    if (target != null) row.scrollTo({ left: Math.max(0, target), behavior: reduce ? 'auto' : 'smooth' })
  }, [value, reduce])

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = tabs.length - 1
    const next =
      event.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
      : event.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : null
    if (next == null) return
    event.preventDefault()
    const id = tabs[next].id
    onChange(id)
    refs.current.get(id)?.focus()
  }

  return (
    // The bar is a fixed frame; only the tabs scroll inside it, and the
    // clipped edge fades into the bar's own fill with a ‹ / › chevron.
    // GameBoost sizing (measured 2026-09-29): a ~40px bar, 14px labels, 2px
    // inset, the selected tab a lighter fill with a hairline ring.
    <div className={cn('w-fit max-w-full overflow-hidden rounded-lg border border-white/[0.08] bg-bg-well', className)}>
    <ScrollRow
      edgeColor="var(--color-bg-well)"
      className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div role="tablist" aria-label={ariaLabel} className="flex w-max items-center gap-0.5 p-0.5">
        {tabs.map((tab, index) => {
          const active = tab.id === value
          return (
            <button
              key={tab.id}
              ref={(el) => {
                if (el) refs.current.set(tab.id, el)
                else refs.current.delete(tab.id)
              }}
              type="button"
              role="tab"
              id={`${idPrefix}-tab-${tab.id}`}
              aria-selected={active}
              aria-controls={`${idPrefix}-panel-${tab.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                'relative flex h-[34px] shrink-0 items-center whitespace-nowrap rounded-md px-3.5 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring',
                active ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {active && (
                <motion.span
                  layoutId={layoutId}
                  aria-hidden
                  className="absolute inset-0 rounded-md bg-white/[0.08] ring-1 ring-inset ring-white/[0.08]"
                  transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 42, mass: 0.8 }}
                />
              )}
              <span className="relative inline-flex items-center gap-1.5">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </ScrollRow>
    </div>
  )
}

/** A muted number beside a tab label. */
export function TabCount({ n }: { n: number }) {
  return <span className="text-[12px] font-medium tabular-nums text-text-tertiary">{n}</span>
}

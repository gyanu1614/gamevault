'use client'

/**
 * The one filter dropdown (owner, 2026-11-03: "the filter dropdowns all need
 * to be similar"): every filter on every marketplace page is this button and
 * this panel. Same width, same 44px header with the filter's name, same 40px
 * rows, same tick. Built on Radix Popover.
 *
 * Every dropdown opens BELOW its button (owner, 2026-10-01: a list that
 * flipped up ran off the top of the phone) and, on touch screens, opens
 * without focusing a search box, so the keyboard only comes up when the box
 * is tapped. See useFilterDropdown.
 */

import { useRef, useState, type ReactNode, type RefObject } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useCoarsePointer } from '@/hooks/use-coarse-pointer'

const EDGE = 12 // panels keep this far from the screen edges
const PANEL_WIDTH = 260
const TOP_CLEARANCE = 80 // the fixed navbar (≤64px) + a little air
const ROOM_WANTED = 360 // header + search + about six rows

/** One option row in any filter's list. */
export const FILTER_ROW = 'flex h-10 w-full cursor-pointer items-center gap-3 px-4 text-left transition-colors hover:bg-white/[0.05]'
/** A filter's list. Size on the list, not the rows: rows build classes with cn(). */
export const FILTER_LIST = 'min-h-0 overflow-y-auto overscroll-contain py-1.5 text-[14px] font-medium'
/** The tick box of a multi-select row; picked = trust blue (house checklist). */
export const FILTER_TICK = 'h-[18px] w-[18px] rounded data-[state=checked]:border-[#6AA8FF] data-[state=checked]:bg-[#6AA8FF] data-[state=checked]:text-[#141519]'

/**
 * Open state + placement for one filter dropdown. Radix would flip a panel
 * that doesn't fit below to the top, and its sideways shift is behind the
 * same switch, so both are off and handled here when the panel opens: the
 * page scrolls just enough to leave room below the button (never past what
 * fits under the navbar), and the panel is nudged sideways to stay on
 * screen. Whatever height is left, the list scrolls inside it (FilterPanel
 * caps it with Radix's available-height variable).
 */
export function useFilterDropdown(align: 'start' | 'end') {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpenState] = useState(false)
  const [alignOffset, setAlignOffset] = useState(0)

  const place = () => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const vw = document.documentElement.clientWidth
    const vh = window.innerHeight
    const width = Math.min(PANEL_WIDTH, vw - EDGE * 2)
    // alignOffset runs toward the panel's far side: rightward for 'start',
    // leftward for 'end'.
    if (align === 'start') {
      const left = Math.min(Math.max(r.left, EDGE), vw - EDGE - width)
      setAlignOffset(left - r.left)
    } else {
      const right = Math.max(Math.min(r.right, vw - EDGE), EDGE + width)
      setAlignOffset(r.right - right)
    }
    const wanted = Math.min(ROOM_WANTED, vh - TOP_CLEARANCE - r.height - EDGE)
    const room = vh - r.bottom - EDGE
    if (room < wanted) {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      window.scrollBy({ top: wanted - room, behavior: reduce ? 'auto' : 'smooth' })
    }
  }

  const setOpen = (next: boolean) => {
    if (next) place()
    setOpenState(next)
  }

  return { open, setOpen, triggerRef, alignOffset }
}

/**
 * The button that opens every filter. Width follows its content, so the bar
 * stays compact. The height comes from the `--h-btn-secondary` variable the
 * filter row sets. `segment` (default): on phones it becomes a segment inside
 * the listings filter bar; off, it keeps the soft fill at every width.
 */
export function FilterTrigger({
  icon: Icon,
  label,
  active,
  open,
  buttonRef,
  segment = true,
}: {
  icon?: LucideIcon
  label: ReactNode
  active: boolean
  open: boolean
  buttonRef: RefObject<HTMLButtonElement>
  segment?: boolean
}) {
  return (
    <Popover.Trigger asChild>
      <button
        ref={buttonRef}
        type="button"
        className={cn(
          // Fill only, no outline (card-surface system).
          'inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3.5 font-semibold text-text-primary transition-colors',
          'text-[14px] sm:text-[length:var(--fs-body)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/15',
          // Active or open: one step lighter. Neutral — no accent colour.
          active || open ? 'bg-[#3A3B43]' : 'bg-[#2E2F36] hover:bg-[#33343B]',
          // Phones: a segment of the filter bar (the Messages tab bar's look:
          // 34px, 14px medium, text-only), see _ItemsPageClient. A hairline
          // sits between neighbours (owner, 2026-10-01: Item Type and Trait
          // read as one button), not before the first or beside a filled one.
          segment && 'max-sm:gap-1.5 max-sm:px-3 max-sm:font-medium',
          segment &&
            (active || open
              ? 'max-sm:bg-white/[0.08] max-sm:text-white max-sm:before:hidden max-sm:[&+button]:before:hidden'
              : 'max-sm:bg-transparent max-sm:text-text-secondary max-sm:hover:bg-white/[0.05] max-sm:hover:text-text-primary'),
          segment &&
            'max-sm:relative max-sm:before:pointer-events-none max-sm:before:absolute max-sm:before:left-[-1.5px] max-sm:before:top-1/2 max-sm:before:h-4 max-sm:before:w-px max-sm:before:-translate-y-1/2 max-sm:before:bg-white/[0.14] max-sm:first:before:hidden',
        )}
        style={{ height: 'var(--h-btn-secondary)' }}
      >
        {Icon ? <Icon aria-hidden className={cn('h-4 w-4 shrink-0 text-text-secondary', segment && 'max-sm:hidden')} /> : null}
        {/* grow: when a row stretches the button (category filter bar),
            the chevron sits at its far right. */}
        <span className={cn('grow truncate text-left', segment && 'max-w-[180px] sm:max-w-none')}>{label}</span>
        <ChevronDown
          aria-hidden
          className={cn('h-4 w-4 shrink-0 text-text-tertiary transition-transform', segment && 'max-sm:h-3.5 max-sm:w-3.5', open && 'rotate-180')}
        />
      </button>
    </Popover.Trigger>
  )
}

/** The dropdown panel: one width and surface, a header row, then its body. */
export function FilterPanel({
  title,
  onClear,
  children,
  className,
  align = 'start',
  alignOffset = 0,
}: {
  title: string
  onClear?: () => void
  children: ReactNode
  className?: string
  align?: 'start' | 'end'
  alignOffset?: number
}) {
  const coarse = useCoarsePointer()
  return (
    <Popover.Portal>
      <Popover.Content
        side="bottom"
        align={align}
        alignOffset={alignOffset}
        sideOffset={6}
        // Never flip above the button; useFilterDropdown makes the room.
        avoidCollisions={false}
        collisionPadding={EDGE}
        // Touch screens: don't focus the search box on open — that pops the
        // keyboard over the list. Tapping the box brings it up.
        onOpenAutoFocus={(e) => {
          if (coarse) e.preventDefault()
        }}
        className={cn(
          'z-50 flex w-[min(260px,calc(100vw-24px))] max-h-[var(--radix-popover-content-available-height)] flex-col overflow-hidden rounded-lg bg-[#1D1E23]',
          'shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),0_24px_48px_-16px_rgba(0,0,0,0.8)]',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className,
        )}
      >
        <div className="flex h-11 shrink-0 items-center justify-between gap-3 px-4 shadow-[inset_0_-1px_0_rgba(255,255,255,0.08)]">
          <p className="text-[14px] font-semibold leading-tight text-text-primary">{title}</p>
          {onClear && (
            <button type="button" onClick={onClear} className="text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary">
              Clear
            </button>
          )}
        </div>
        {children}
      </Popover.Content>
    </Popover.Portal>
  )
}

/** The round mark of a pick-one row (sort): same size as the tick box. */
export function FilterRadioMark({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full transition-colors',
        on ? 'bg-[#6AA8FF] text-[#141519]' : 'shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.24)]',
      )}
    >
      {on ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
    </span>
  )
}

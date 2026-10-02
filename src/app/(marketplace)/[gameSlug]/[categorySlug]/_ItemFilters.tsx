'use client'

/**
 * Filter bar controls for the items page.
 *
 *   MultiSelectFilter — a button (icon + label + caret) that opens a
 *     rectangular dropdown: a header with the filter's name, then one row
 *     per option with a tick box. Several options can be ticked; the
 *     dropdown stays open while you pick. Long lists get a search box.
 *   PriceRangeFilter — the same button, opening From/To inputs over a
 *     two-thumb slider whose limits are the cheapest and dearest listing
 *     actually on the page.
 *
 * Built on the site's own primitives: Radix Popover, and the shared
 * `Checkbox` / `Slider` from components/ui. Icons are Lucide.
 *
 * Every dropdown opens BELOW its button (owner, 2026-10-01: a list that
 * flipped up ran off the top of the phone) and, on touch screens, opens
 * without focusing its search box, so the keyboard only comes up when the
 * search box is tapped. See useFilterDropdown.
 */

import { useId, useMemo, useRef, useState, type RefObject } from 'react'
import * as Popover from '@radix-ui/react-popover'
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  Clock,
  DollarSign,
  Gem,
  LayoutGrid,
  ListFilter,
  PawPrint,
  Search,
  Sparkles,
  Tag,
  type LucideIcon,
} from 'lucide-react'

import { Checkbox } from '@/components/ui/checkbox'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import { useCoarsePointer } from '@/hooks/use-coarse-pointer'
import type { TaxonomyOption } from './_itemsTypes'

// ─── Shared pieces ──────────────────────────────────────────────────────────

/**
 * Icon for a filter, chosen from its name. Filters are admin-defined per
 * game, so this matches on words in the label rather than fixed slugs; an
 * unknown filter gets the generic list-filter icon.
 */
export function iconForFilter(label: string): LucideIcon {
  const l = label.toLowerCase()
  if (l.includes('price')) return DollarSign
  if (l.includes('deliver')) return Clock
  if (l.includes('rarity')) return Gem
  if (l.includes('pet')) return PawPrint
  if (l.includes('trait') || l.includes('mutation') || l.includes('variant')) return Sparkles
  if (l.includes('type') || l.includes('categor')) return LayoutGrid
  if (l.includes('name')) return Tag
  return ListFilter
}

/** "item type" → "Item Type". Filter labels are shown in Title Case. */
export function titleCase(s: string): string {
  return s.replace(/\b([a-z])/g, (c) => c.toUpperCase())
}

const EDGE = 12 // panels keep this far from the screen edges
const PANEL_WIDTH = 260
const TOP_CLEARANCE = 96 // fixed navbar + a little air
const ROOM_WANTED = 360 // header + search + about six rows

/**
 * Open state + placement for one filter dropdown. Radix would flip a panel
 * that doesn't fit below to the top, and its sideways shift is behind the
 * same switch, so both are off and handled here when the panel opens: the
 * page scrolls just enough to leave room below the button (never past what
 * fits under the navbar), and the panel is nudged sideways to stay on
 * screen. Whatever height is left, the list scrolls inside it (Panel caps
 * it with Radix's available-height variable).
 */
function useFilterDropdown(align: 'start' | 'end') {
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
 * The button that opens every filter. Width follows its content (no fixed
 * min-width), so the bar stays compact. The height comes from the
 * `--h-btn-secondary` variable the filter row sets.
 */
function Trigger({
  icon: Icon,
  label,
  active,
  open,
  buttonRef,
}: {
  icon: LucideIcon
  label: string
  active: boolean
  open: boolean
  buttonRef: RefObject<HTMLButtonElement>
}) {
  return (
    <Popover.Trigger asChild>
      <button
        ref={buttonRef}
        type="button"
        className={cn(
          // Fill only, no outline (card-surface system). sm+: a soft pill.
          // Phones: a segment inside the filter bar (the Messages tab bar's
          // look: 34px, 14px medium, text-only), see _ItemsPageClient.
          'inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3.5 font-semibold text-text-primary transition-colors',
          'text-[14px] sm:text-[length:var(--fs-body)] max-sm:gap-1.5 max-sm:px-3 max-sm:font-medium',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/15',
          // Active or open: one step lighter. Neutral — no accent colour.
          active || open
            ? 'bg-white/[0.11] max-sm:bg-white/[0.08] max-sm:text-white'
            : 'bg-white/[0.05] hover:bg-white/[0.08] max-sm:bg-transparent max-sm:text-text-secondary max-sm:hover:bg-white/[0.05] max-sm:hover:text-text-primary',
          // Phones: the segments share one bar, so a hairline sits between
          // neighbours (owner, 2026-10-01: Item Type and Trait read as one
          // button). Not before the first, and not beside a filled segment.
          'max-sm:relative max-sm:before:pointer-events-none max-sm:before:absolute max-sm:before:left-[-1.5px] max-sm:before:top-1/2 max-sm:before:h-4 max-sm:before:w-px max-sm:before:-translate-y-1/2 max-sm:before:bg-white/[0.14] max-sm:first:before:hidden',
          (active || open) && 'max-sm:before:hidden max-sm:[&+button]:before:hidden',
        )}
        style={{ height: 'var(--h-btn-secondary)' }}
      >
        <Icon aria-hidden className="h-4 w-4 shrink-0 text-text-secondary max-sm:hidden" />
        {/* grow: when a row stretches the button (category filter bar),
            the chevron sits at its far right. */}
        <span className="max-w-[180px] grow truncate text-left sm:max-w-none">{label}</span>
        <ChevronDown
          aria-hidden
          className={cn('h-4 w-4 shrink-0 text-text-tertiary transition-transform max-sm:h-3.5 max-sm:w-3.5', open && 'rotate-180')}
        />
      </button>
    </Popover.Trigger>
  )
}

/** The dropdown panel: rectangular, header row, then its body. */
function Panel({
  title,
  onClear,
  children,
  className,
  align = 'start',
  alignOffset = 0,
}: {
  title: string
  onClear?: () => void
  children: React.ReactNode
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
          'z-50 flex w-[min(260px,calc(100vw-24px))] max-h-[var(--radix-popover-content-available-height)] flex-col overflow-hidden rounded-lg border border-white/10 bg-[#1D1E23] shadow-[0_18px_40px_-12px_rgba(0,0,0,0.7)]',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className,
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.08] bg-white/[0.03] px-4 py-2">
          <p className="text-body-sm font-bold leading-tight text-text-primary">{title}</p>
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="text-body-sm font-medium text-text-tertiary transition-colors hover:text-text-primary"
            >
              Clear
            </button>
          )}
        </div>
        {children}
      </Popover.Content>
    </Popover.Portal>
  )
}

// ─── Multi-select ───────────────────────────────────────────────────────────

/** Lists longer than this get a search box at the top of the dropdown. */
const SEARCH_THRESHOLD = 8

export function MultiSelectFilter({
  label,
  icon,
  options,
  selected,
  onChange,
}: {
  label: string
  icon: LucideIcon
  options: TaxonomyOption[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const { open, setOpen, triggerRef, alignOffset } = useFilterDropdown('start')
  const [query, setQuery] = useState('')
  const baseId = useId()

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options
  }, [options, query])

  // Button text: the filter name; with one pick, that pick; with several,
  // the name and a count.
  const buttonLabel =
    selected.length === 0
      ? label
      : selected.length === 1
        ? (options.find((o) => o.slug === selected[0])?.label ?? label)
        : `${label} (${selected.length})`

  const toggle = (slug: string) =>
    onChange(selected.includes(slug) ? selected.filter((s) => s !== slug) : [...selected, slug])

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setQuery('')
      }}
    >
      <Trigger icon={icon} label={buttonLabel} active={selected.length > 0} open={open} buttonRef={triggerRef} />
      <Panel title={label} alignOffset={alignOffset} onClear={selected.length > 0 ? () => onChange([]) : undefined}>
        {options.length > SEARCH_THRESHOLD && (
          <div className="relative shrink-0 border-b border-white/[0.06] px-3 py-2">
            <Search aria-hidden className="pointer-events-none absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}…`}
              aria-label={`Search ${label}`}
              // 16px on touch screens so iOS doesn't zoom on focus.
              // A plain box: hover = white outline; focus changes nothing (no
              // green ring from the site-wide :focus-visible rule). The text
              // caret is the focus cue.
              className="h-8 w-full rounded border border-white/10 bg-bg-base pl-9 pr-3 text-[16px] text-text-primary outline-none placeholder:text-text-tertiary hover:border-white/40 focus-visible:shadow-none sm:text-body-sm"
            />
          </div>
        )}

        {/* Rows are <label>s bound to their checkbox, so the whole row is
            the click target and screen readers announce it correctly. */}
        {/* Font size lives on the <ul>, NOT on the rows: rows build their
            classes with cn() (tailwind-merge), which mistakes our custom
            `text-body-sm` size for a colour and deletes it when a colour
            class follows — the rows then fell back to 16px. */}
        <ul className="max-h-[300px] min-h-0 overflow-y-auto overscroll-contain py-1 text-body-sm" aria-label={`${label} options`}>
          {shown.length === 0 && (
            <li className="px-4 py-2.5 text-text-tertiary">No matches</li>
          )}
          {shown.map((o) => {
            const id = `${baseId}-${o.slug}`
            const checked = selected.includes(o.slug)
            return (
              <li key={o.slug}>
                <label
                  htmlFor={id}
                  className={cn(
                    'flex cursor-pointer items-center justify-between gap-3 px-4 py-1.5 transition-colors hover:bg-white/[0.04]',
                    checked ? 'font-semibold text-text-primary' : 'text-text-secondary',
                  )}
                >
                  <span className="min-w-0 truncate">{o.label}</span>
                  <Checkbox id={id} checked={checked} onCheckedChange={() => toggle(o.slug)} className="h-4 w-4 rounded" />
                </label>
              </li>
            )
          })}
        </ul>
      </Panel>
    </Popover.Root>
  )
}

// ─── Single-select (sort) ───────────────────────────────────────────────────

/**
 * One choice from a list — used for sorting. Same button and panel as the
 * filters, so the whole bar reads as one set. The button shows the current
 * choice; picking a row closes the dropdown.
 */
export function SingleSelectFilter<T extends string>({
  title,
  options,
  value,
  onChange,
  icon = ArrowUpDown,
}: {
  title: string
  options: { slug: T; label: string }[]
  value: T
  onChange: (next: T) => void
  icon?: LucideIcon
}) {
  const { open, setOpen, triggerRef, alignOffset } = useFilterDropdown('end')
  const current = options.find((o) => o.slug === value)?.label ?? title
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Trigger icon={icon} label={current} active={false} open={open} buttonRef={triggerRef} />
      <Panel title={title} align="end" alignOffset={alignOffset}>
        {/* Size on the <ul> for the same tailwind-merge reason as above. */}
        <ul className="min-h-0 overflow-y-auto overscroll-contain py-1 text-body-sm" role="listbox" aria-label={title}>
          {options.map((o) => {
            const selected = o.slug === value
            return (
              <li key={o.slug} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.slug)
                    setOpen(false)
                  }}
                  className={cn(
                    // Same row geometry as the multi-select rows.
                    'flex w-full items-center justify-between gap-3 px-4 py-1.5 text-left transition-colors hover:bg-white/[0.04]',
                    selected ? 'font-semibold text-text-primary' : 'text-text-secondary',
                  )}
                >
                  <span className="min-w-0 truncate">{o.label}</span>
                  {selected && <Check aria-hidden className="h-3.5 w-3.5 shrink-0 text-text-primary" />}
                </button>
              </li>
            )
          })}
        </ul>
      </Panel>
    </Popover.Root>
  )
}

// ─── Price range ────────────────────────────────────────────────────────────

const money = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`

export function PriceRangeFilter({
  bounds,
  value,
  onChange,
}: {
  /** Cheapest and dearest price on the page — the slider's limits. */
  bounds: [number, number]
  /** Current range, or null for "any price". */
  value: [number, number] | null
  onChange: (next: [number, number] | null) => void
}) {
  const { open, setOpen, triggerRef, alignOffset } = useFilterDropdown('start')
  const [lo, hi] = value ?? bounds
  const span = bounds[1] - bounds[0]
  // Whole dollars on wide ranges; cents when the page's prices are close.
  const step = span > 50 ? 1 : 0.01

  // A range equal to the full bounds is the same as no filter.
  const commit = (next: [number, number]) => {
    const a = Math.max(bounds[0], Math.min(next[0], next[1]))
    const b = Math.min(bounds[1], Math.max(next[0], next[1]))
    onChange(a <= bounds[0] && b >= bounds[1] ? null : [a, b])
  }

  const buttonLabel = value ? `${money(lo)} – ${money(hi)}` : 'Price'

  const field = (which: 0 | 1, text: string) => (
    <label className="block min-w-0 flex-1">
      <span className="text-body-sm text-text-secondary">{text}</span>
      <span className="mt-1.5 flex h-10 items-center gap-1.5 rounded border border-white/10 bg-bg-base px-3 focus-within:border-border-strong">
        <span aria-hidden className="text-text-tertiary">$</span>
        <input
          type="number"
          inputMode="decimal"
          min={bounds[0]}
          max={bounds[1]}
          step={step}
          value={which === 0 ? lo : hi}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (!Number.isFinite(n)) return
            commit(which === 0 ? [n, hi] : [lo, n])
          }}
          aria-label={`${text} price`}
          className="w-full min-w-0 bg-transparent text-[16px] tabular-nums text-text-primary outline-none focus-visible:shadow-none sm:text-body-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      </span>
    </label>
  )

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Trigger icon={DollarSign} label={buttonLabel} active={!!value} open={open} buttonRef={triggerRef} />
      <Panel title="Price" alignOffset={alignOffset} onClear={value ? () => onChange(null) : undefined}>
        <div className="min-h-0 space-y-5 overflow-y-auto px-4 pb-4 pt-4">
          <div className="flex items-end gap-2.5">
            {field(0, 'From')}
            <span aria-hidden className="pb-2.5 text-text-tertiary">–</span>
            {field(1, 'To')}
          </div>
          <div>
            <Slider
              min={bounds[0]}
              max={bounds[1]}
              step={step}
              value={[lo, hi]}
              minStepsBetweenThumbs={0}
              onValueChange={(v) => commit([v[0], v[1]])}
              aria-label="Price range"
            />
            <div className="mt-2.5 flex justify-between text-body-sm tabular-nums text-text-secondary">
              <span>{money(bounds[0])}</span>
              <span>{money(bounds[1])}</span>
            </div>
          </div>
        </div>
      </Panel>
    </Popover.Root>
  )
}

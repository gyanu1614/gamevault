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
 *   SingleSelectFilter — the same button, pick one (sort).
 *
 * Built on the shared FilterDropdown (one button, one panel, one row size)
 * and the `Checkbox` / `Slider` from components/ui. Icons are Lucide.
 */

import { useId, useMemo, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import {
  ArrowUpDown,
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
import { FILTER_LIST, FILTER_ROW, FILTER_TICK, FilterPanel, FilterRadioMark, FilterTrigger, useFilterDropdown } from '@/components/marketplace/FilterDropdown'
import { cn } from '@/lib/utils'
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
      <FilterTrigger icon={icon} label={buttonLabel} active={selected.length > 0} open={open} buttonRef={triggerRef} />
      <FilterPanel title={label} alignOffset={alignOffset} onClear={selected.length > 0 ? () => onChange([]) : undefined}>
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
        <ul className={FILTER_LIST} aria-label={`${label} options`}>
          {shown.length === 0 && (
            <li className="px-4 py-2.5 text-text-tertiary">No matches</li>
          )}
          {shown.map((o) => {
            const id = `${baseId}-${o.slug}`
            const checked = selected.includes(o.slug)
            return (
              <li key={o.slug}>
                <label htmlFor={id} className={cn(FILTER_ROW, checked ? 'text-text-primary' : 'text-text-secondary')}>
                  <Checkbox id={id} checked={checked} onCheckedChange={() => toggle(o.slug)} className={FILTER_TICK} />
                  <span className="min-w-0 truncate">{o.label}</span>
                </label>
              </li>
            )
          })}
        </ul>
      </FilterPanel>
    </Popover.Root>
  )
}

// ─── Single-select (sort) ───────────────────────────────────────────────────

/**
 * One choice from a list — used for sorting. Same button and panel as the
 * filters, so the whole bar reads as one set. The button says what it is and
 * the current choice ("Sort: Recommended"; owner, 2026-11-03: "Recommended"
 * alone did not read as a control); phones, in the tight filter bar, show the
 * choice only. Picking a row closes the dropdown.
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
      <FilterTrigger
        icon={icon}
        label={
          <>
            <span className="font-medium text-text-secondary max-sm:hidden">Sort: </span>
            {current}
          </>
        }
        active={false}
        open={open}
        buttonRef={triggerRef}
      />
      <FilterPanel title={title} align="end" alignOffset={alignOffset}>
        <ul className={FILTER_LIST} role="listbox" aria-label={title}>
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
                  className={cn(FILTER_ROW, selected ? 'text-text-primary' : 'text-text-secondary')}
                >
                  <FilterRadioMark on={selected} />
                  <span className="min-w-0 truncate">{o.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </FilterPanel>
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
  const buttonLabel = value ? `${money(lo)} – ${money(hi)}` : 'Price'

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <FilterTrigger icon={DollarSign} label={buttonLabel} active={!!value} open={open} buttonRef={triggerRef} />
      <FilterPanel title="Price" alignOffset={alignOffset} onClear={value ? () => onChange(null) : undefined}>
        <PriceRangeFields bounds={bounds} value={value} onChange={onChange} className="min-h-0 overflow-y-auto px-4 pb-4 pt-4" />
      </FilterPanel>
    </Popover.Root>
  )
}

/** The price filter's From / To boxes and slider: the dropdown's body, and the items grid's phone filter sheet. */
export function PriceRangeFields({
  bounds,
  value,
  onChange,
  className,
}: {
  bounds: [number, number]
  value: [number, number] | null
  onChange: (next: [number, number] | null) => void
  className?: string
}) {
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
    <div className={cn('space-y-5', className)}>
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
  )
}

'use client'

import { useState } from 'react'
import { Drawer } from 'vaul'
import { IconAdjustmentsHorizontal, IconCheck, IconX } from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import { PriceRangeFields } from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_ItemFilters'
import { TRAIT_LETTERS } from '@/features/item-buy/TraitFilterMenu'
import { TraitMarks } from '@/features/item-buy/TraitMarks'
import type { AmLetter } from '@/features/item-buy/model/am-traits'
import type { FilterOption, GridSort } from './model/grid'

/** The trust-blue edge every picked option wears (house checklist: picked rows). */
const PICKED = 'bg-white/[0.08] text-text-primary shadow-[inset_0_0_0_1.5px_#6AA8FF]'
const IDLE = 'bg-white/[0.05] text-text-secondary hover:bg-white/[0.08] hover:text-text-primary'

export interface GridFilterControls {
  sort: { value: GridSort; options: { slug: GridSort; label: string }[]; onChange: (s: GridSort) => void }
  rarities: { options: FilterOption[]; selected: string[]; onChange: (next: string[]) => void }
  types: { options: FilterOption[]; selected: string[]; onChange: (next: string[]) => void }
  /** Adopt Me: N / M / F / R letters that land on one form. */
  letters: { lit: ReadonlySet<AmLetter>; onToggle: (l: AmLetter) => void } | null
  /** Other games: the forms as chips. */
  forms: { options: FilterOption[]; selected: string[]; onChange: (next: string[]) => void } | null
  price: { bounds: [number, number]; value: [number, number] | null; onChange: (next: [number, number] | null) => void } | null
  /** How many filters are on (sort not counted). */
  active: number
  onClear: () => void
}

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

/**
 * Phones and tablets: every filter and the sort in one bottom sheet behind a
 * Filters button beside the search (owner, 2026-11-02, Eldorado's phone item
 * grid as the reference: the old filter row ran off the screen). Filters
 * apply as you tap; Show Results closes the sheet.
 */
export function GridFiltersSheet({ controls, className }: { controls: GridFilterControls; className?: string }) {
  const [open, setOpen] = useState(false)
  const c = controls

  return (
    <Drawer.Root open={open} onOpenChange={setOpen} repositionInputs={false}>
      <Drawer.Trigger
        className={cn(
          'inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 font-semibold text-text-primary transition-colors',
          c.active > 0 ? 'bg-white/[0.11]' : 'bg-white/[0.07] hover:bg-white/[0.1]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
          className,
        )}
        style={{ height: 'var(--h-input)', fontSize: 'var(--fs-body)' }}
      >
        <IconAdjustmentsHorizontal aria-hidden size={18} stroke={1.9} />
        Filters
        {c.active > 0 ? (
          <span className="grid h-5 min-w-5 place-items-center rounded bg-[#6AA8FF] px-1 text-[12px] font-bold tabular-nums text-[#0E0F12]">{c.active}</span>
        ) : null}
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/70" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[88dvh] w-full max-w-[560px] flex-col rounded-t-lg bg-[#1A1B1F] pb-[env(safe-area-inset-bottom)] outline-none">
          <div aria-hidden className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-white/15" />
          <div className="flex items-center justify-between px-5 pb-2 pt-3">
            <Drawer.Title className="font-semibold text-text-primary" style={{ fontSize: 'var(--fs-section)' }}>
              Filters
            </Drawer.Title>
            <Drawer.Close className="-mr-2 rounded-md p-2.5 text-text-tertiary transition-colors hover:bg-white/[0.06] hover:text-text-primary">
              <IconX aria-hidden size={18} stroke={2} />
              <span className="sr-only">Close</span>
            </Drawer.Close>
          </div>
          <Drawer.Description className="sr-only">Sort and narrow the list.</Drawer.Description>

          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 pb-5 pt-1">
            <Section title="Sort By">
              <div className="grid gap-1.5">
                {c.sort.options.map((o) => {
                  const on = o.slug === c.sort.value
                  return (
                    <button
                      key={o.slug}
                      type="button"
                      aria-pressed={on}
                      onClick={() => c.sort.onChange(o.slug)}
                      className={cn('flex h-11 items-center justify-between rounded-md px-3.5 text-left font-medium transition-colors', on ? PICKED : IDLE)}
                    >
                      {o.label}
                      {on ? <IconCheck aria-hidden size={16} stroke={2.4} className="text-[#6AA8FF]" /> : null}
                    </button>
                  )
                })}
              </div>
            </Section>

            {c.rarities.options.length > 1 && (
              <Section title="Rarity">
                <Chips options={c.rarities.options} selected={c.rarities.selected} onToggle={(v) => c.rarities.onChange(toggle(c.rarities.selected, v))} />
              </Section>
            )}

            {c.letters && (
              <Section title="Traits">
                <div className="grid grid-cols-2 gap-1.5">
                  {TRAIT_LETTERS.map((l) => {
                    const on = c.letters!.lit.has(l.letter)
                    return (
                      <button
                        key={l.letter}
                        type="button"
                        aria-pressed={on}
                        onClick={() => c.letters!.onToggle(l.letter)}
                        className={cn('flex h-11 items-center gap-2.5 rounded-md px-3 text-left font-medium transition-colors', on ? 'bg-white/[0.08] text-text-primary' : IDLE)}
                        style={on ? { boxShadow: `inset 0 0 0 1.5px ${l.color}` } : undefined}
                      >
                        <TraitMarks code={l.letter} size={20} />
                        {l.label}
                      </button>
                    )
                  })}
                </div>
              </Section>
            )}

            {c.forms && c.forms.options.length > 0 && (
              <Section title="Traits">
                <Chips options={c.forms.options} selected={c.forms.selected} onToggle={(v) => c.forms!.onChange(toggle(c.forms!.selected, v))} />
              </Section>
            )}

            {c.types.options.length > 1 && (
              <Section title="Item Type">
                <Chips options={c.types.options} selected={c.types.selected} onToggle={(v) => c.types.onChange(toggle(c.types.selected, v))} />
              </Section>
            )}

            {c.price && (
              <Section title="Price">
                <PriceRangeFields bounds={c.price.bounds} value={c.price.value} onChange={c.price.onChange} />
              </Section>
            )}
          </div>

          <div className="flex shrink-0 gap-2.5 px-5 pb-4 pt-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
            {c.active > 0 && (
              <button
                type="button"
                onClick={c.onClear}
                className="h-12 rounded-md bg-white/[0.07] px-4 font-semibold text-text-primary transition-colors hover:bg-white/[0.11]"
                style={{ fontSize: 'var(--fs-body)' }}
              >
                Clear All
              </button>
            )}
            <Drawer.Close className="h-12 flex-1 rounded-md bg-white font-semibold text-black transition-colors hover:bg-white/90" style={{ fontSize: 'var(--fs-body)' }}>
              Show Results
            </Drawer.Close>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2.5 font-semibold text-text-primary" style={{ fontSize: 'var(--fs-card-title)' }}>
        {title}
      </h3>
      {children}
    </section>
  )
}

function Chips({ options, selected, onToggle }: { options: FilterOption[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = selected.includes(o.value)
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(o.value)}
            className={cn('h-10 rounded-md px-3.5 font-medium transition-colors', on ? PICKED : IDLE)}
            style={{ fontSize: 'var(--fs-body)' }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

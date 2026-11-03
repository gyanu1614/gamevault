'use client'

import { useState, type ReactNode } from 'react'
import { Drawer } from 'vaul'
import { IconAdjustmentsHorizontal, IconCheck, IconX } from '@tabler/icons-react'
import { cn } from '@/lib/utils'

/** The trust-blue edge every picked option wears (house checklist: picked rows). */
const PICKED = 'bg-white/[0.08] text-text-primary shadow-[inset_0_0_0_1.5px_#6AA8FF]'
const IDLE = 'bg-white/[0.05] text-text-secondary hover:bg-white/[0.08] hover:text-text-primary'

export interface FilterSheetSection {
  key: string
  title: string
  content: ReactNode
}

/**
 * Phones and tablets: every filter and the sort in one bottom sheet behind a
 * Filters button beside the search (owner, 2026-11-02, Eldorado's phone item
 * grid as the reference: the old filter row ran off the screen). Filters apply
 * as you tap; Show Results closes the sheet.
 */
export function FiltersSheet({
  sections,
  active,
  onClear,
  className,
}: {
  sections: FilterSheetSection[]
  /** How many filters are on (sort not counted). */
  active: number
  onClear: () => void
  className?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <Drawer.Root open={open} onOpenChange={setOpen} repositionInputs={false}>
      <Drawer.Trigger
        className={cn(
          'inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 font-semibold text-text-primary transition-colors',
          active > 0 ? 'bg-[#3A3B43]' : 'bg-[#2E2F36] hover:bg-[#33343B]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
          className,
        )}
        style={{ height: 'var(--h-input)', fontSize: 'var(--fs-body)' }}
      >
        <IconAdjustmentsHorizontal aria-hidden size={18} stroke={1.9} />
        Filters
        {active > 0 ? <span className="grid h-5 min-w-5 place-items-center rounded bg-[#6AA8FF] px-1 text-[12px] font-bold tabular-nums text-[#0E0F12]">{active}</span> : null}
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
            {sections.map((s) => (
              <section key={s.key}>
                <h3 className="mb-2.5 font-semibold text-text-primary" style={{ fontSize: 'var(--fs-card-title)' }}>
                  {s.title}
                </h3>
                {s.content}
              </section>
            ))}
          </div>

          <div className="flex shrink-0 gap-2.5 px-5 pb-4 pt-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
            {active > 0 && (
              <button
                type="button"
                onClick={onClear}
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

/** Pick one (sort): full-width rows with a tick. */
export function SheetPickOne<T extends string>({ options, value, onChange }: { options: { slug: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="grid gap-1.5">
      {options.map((o) => {
        const on = o.slug === value
        return (
          <button
            key={o.slug}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.slug)}
            className={cn('flex h-11 items-center justify-between rounded-md px-3.5 text-left font-medium transition-colors', on ? PICKED : IDLE)}
          >
            {o.label}
            {on ? <IconCheck aria-hidden size={16} stroke={2.4} className="text-[#6AA8FF]" /> : null}
          </button>
        )
      })}
    </div>
  )
}

/** Pick several: chips that wrap, scrolling inside the sheet when a filter has a long list. */
export function SheetChips({ options, selected, onChange }: { options: { slug: string; label: string }[]; selected: string[]; onChange: (next: string[]) => void }) {
  return (
    <div className="flex max-h-[200px] flex-wrap gap-1.5 overflow-y-auto overscroll-contain">
      {options.map((o) => {
        const on = selected.includes(o.slug)
        return (
          <button
            key={o.slug}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? selected.filter((x) => x !== o.slug) : [...selected, o.slug])}
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

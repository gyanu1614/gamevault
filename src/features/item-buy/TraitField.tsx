'use client'

import { useId, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Drawer } from 'vaul'
import { IconCheck, IconChevronDown, IconX } from '@tabler/icons-react'
import { formatStatPrice } from '@/lib/seo/page-stats-format'
import { useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'
import { TraitMarks } from './TraitMarks'
import { TraitName } from './TraitName'
import type { TraitOption } from './model/offers'

/**
 * The trait picker (owner, 2026-10-27; StockX's "Size: All ⌄" as the reference):
 * the word "Trait", the picked trait and a chevron, on a filled card one tone above
 * whatever is behind it, the same on phone and desktop (owner, 2026-11-05: it has to
 * look like something you can open). It opens a list of every trait with its
 * cheapest price; a trait nobody sells says Notify Me. Desktop: a dropdown under the
 * field (Radix Popover). Phones: a sheet that slides up from the bottom (vaul).
 */
export function TraitField({
  noun,
  options,
  value,
  onChange,
}: {
  noun: string
  options: TraitOption[]
  value: string | null
  onChange: (variant: string) => void
}) {
  const [open, setOpen] = useState(false)
  const desktop = useMediaQuery('(min-width: 1024px)')
  const labelId = useId()
  const current = options.find((o) => o.variant === value) ?? null

  const pick = (variant: string) => {
    onChange(variant)
    setOpen(false)
  }

  const trigger = (
    <button
      type="button"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-labelledby={labelId}
      className={cn(
        'flex h-12 w-full items-center gap-3 rounded-lg px-3.5 text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
        open ? 'bg-white/[0.14]' : 'bg-white/[0.08] hover:bg-white/[0.11]',
      )}
    >
      <span id={labelId} className="shrink-0 text-text-tertiary" style={{ fontSize: 'var(--fs-body)' }}>
        {noun}
      </span>
      <span className="flex min-w-0 flex-1 items-center justify-end gap-2.5">
        {current?.short ? <TraitMarks code={current.short} size={22} /> : null}
        <span className="truncate text-[14px] font-semibold text-text-primary">
          {current ? <TraitName traitKey={current.variant} label={current.label} /> : `Choose a ${noun}`}
        </span>
      </span>
      <IconChevronDown aria-hidden size={18} stroke={2} className={cn('shrink-0 text-text-secondary transition-transform duration-200', open && 'rotate-180')} />
    </button>
  )

  // Only Adopt Me's forms have badges; a list without them has no empty column and no extra width.
  const hasMarks = options.some((o) => !!o.short)
  const list = <TraitList options={options} value={value} onPick={pick} labelId={labelId} hasMarks={hasMarks} />

  if (desktop) {
    return (
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>{trigger}</Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side="bottom"
            align="start"
            sideOffset={8}
            // Always below the field, like every filter dropdown (owner, 2026-10-01): flipped up it covered the navbar. A short window scrolls the list.
            avoidCollisions={false}
            collisionPadding={12}
            className={cn(
              'z-50 max-h-[min(460px,var(--radix-popover-content-available-height))] overflow-y-auto overscroll-contain rounded-lg bg-[#2A2B31] py-1.5',
              hasMarks ? 'w-[max(var(--radix-popover-trigger-width),340px)]' : 'w-[max(var(--radix-popover-trigger-width),280px)]',
              'shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),0_24px_48px_-16px_rgba(0,0,0,0.8)]',
              'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1',
            )}
          >
            {list}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    )
  }

  return (
    <Drawer.Root open={open} onOpenChange={setOpen} repositionInputs={false}>
      <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/70" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[88dvh] w-full max-w-[480px] flex-col rounded-t-lg bg-[#1A1B1F] pb-[env(safe-area-inset-bottom)] outline-none">
          <div aria-hidden className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-white/15" />
          <div className="flex items-center justify-between px-5 pb-2 pt-3">
            <Drawer.Title className="font-semibold text-text-primary" style={{ fontSize: 'var(--fs-section)' }}>
              Choose a {noun}
            </Drawer.Title>
            <Drawer.Close className="-mr-2 rounded-md p-2.5 text-text-tertiary transition-colors hover:bg-white/[0.06] hover:text-text-primary">
              <IconX aria-hidden size={18} stroke={2} />
              <span className="sr-only">Close</span>
            </Drawer.Close>
          </div>
          <Drawer.Description className="sr-only">Every {noun.toLowerCase()} with its cheapest price.</Drawer.Description>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-3">{list}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

function TraitList({ options, value, onPick, labelId, hasMarks }: { options: TraitOption[]; value: string | null; onPick: (v: string) => void; labelId: string; hasMarks: boolean }) {
  return (
    <ul role="listbox" aria-labelledby={labelId}>
      {options.map((o) => {
        const selected = o.variant === value
        return (
          <li key={o.variant} role="option" aria-selected={selected}>
            <button
              type="button"
              onClick={() => onPick(o.variant)}
              className={cn('flex min-h-[56px] w-full items-center gap-3 px-4 text-left transition-colors hover:bg-white/[0.04] lg:min-h-[44px]', selected && 'bg-white/[0.035]')}
            >
              {hasMarks ? <span className="flex w-[62px] shrink-0 items-center">{o.short ? <TraitMarks code={o.short} className={cn(o.count === 0 && 'opacity-40')} /> : null}</span> : null}
              <span className={cn('min-w-0 flex-1 truncate', selected ? 'font-semibold' : 'font-medium')} style={{ fontSize: 'var(--fs-body)' }}>
                <TraitName traitKey={o.variant} label={o.label} />
              </span>
              {o.minPriceUsd != null ? (
                <span className="shrink-0 font-semibold tabular-nums text-text-primary" style={{ fontSize: 'var(--fs-body)' }}>
                  ${formatStatPrice(o.minPriceUsd)}
                </span>
              ) : (
                <span className="shrink-0 text-text-tertiary" style={{ fontSize: 'var(--fs-meta)' }}>
                  Notify Me
                </span>
              )}
              <IconCheck aria-hidden size={16} stroke={2.2} className={cn('shrink-0 text-[#6AA8FF]', !selected && 'invisible')} />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

'use client'

import { useId, useRef, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { IconCategory2, IconCheck, IconChevronDown } from '@tabler/icons-react'
import { formatStatPrice } from '@/lib/seo/page-stats-format'
import { cn } from '@/lib/utils'
import type { TraitOption } from './model/offers'

const EDGE = 12
/** Navbar + game sub-navbar (≤120px) + air: the page never scrolls the button under them. */
const TOP_CLEARANCE = 136
const ROOM_WANTED = 420

/**
 * The trait picker (owner, 2026-10-26: "traits dropdown with the price per
 * trait"). Every trait is listed with its cheapest price and offer count; a
 * trait nobody sells says so (the buy box then offers Notify Me). It opens
 * below its button like the grid filters — the page scrolls to make room
 * rather than the list flipping up off a phone screen.
 */
export function TraitSelect({
  noun,
  options,
  value,
  onChange,
}: {
  noun: string
  options: TraitOption[]
  value: string | null
  onChange: (variant: string | null) => void
}) {
  const [open, setOpenState] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const labelId = useId()
  const current = options.find((o) => o.variant === value) ?? options[0]

  const setOpen = (next: boolean) => {
    if (next) makeRoom(triggerRef.current)
    setOpenState(next)
  }

  return (
    <div>
      <div id={labelId} className="mb-2 font-semibold text-text-primary" style={{ fontSize: 'var(--fs-meta)' }}>
        {noun}
      </div>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            ref={triggerRef}
            type="button"
            aria-labelledby={labelId}
            aria-haspopup="listbox"
            className={cn(
              'flex h-12 w-full items-center gap-3 rounded-md px-3 text-left transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/15',
              open ? 'bg-white/[0.1]' : 'bg-white/[0.06] hover:bg-white/[0.09]',
            )}
          >
            <TraitChip option={current} />
            <span className="min-w-0 flex-1 truncate font-semibold text-text-primary" style={{ fontSize: 'var(--fs-body)' }}>
              {current.label}
            </span>
            <PriceText option={current} />
            <IconChevronDown aria-hidden size={17} stroke={2} className={cn('shrink-0 text-text-tertiary transition-transform', open && 'rotate-180')} />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side="bottom"
            align="start"
            sideOffset={6}
            avoidCollisions={false}
            collisionPadding={EDGE}
            className={cn(
              'z-50 flex w-[var(--radix-popover-trigger-width)] max-h-[min(440px,var(--radix-popover-content-available-height))] flex-col overflow-hidden rounded-lg bg-[#1D1E23]',
              'shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_40px_-12px_rgba(0,0,0,0.75)]',
              'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            )}
          >
            <div className="shrink-0 bg-white/[0.03] px-4 py-2.5 font-semibold text-text-secondary" style={{ fontSize: 'var(--fs-meta)' }}>
              Choose a {noun}
            </div>
            <ul role="listbox" aria-labelledby={labelId} className="min-h-0 overflow-y-auto overscroll-contain py-1">
              {options.map((o) => {
                const selected = o.variant === value
                return (
                  <li key={o.variant ?? 'any'} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(o.variant)
                        setOpenState(false)
                      }}
                      className={cn('flex min-h-[52px] w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-white/[0.05]', selected && 'bg-white/[0.04]')}
                    >
                      <TraitChip option={o} />
                      <span className="min-w-0 flex-1">
                        <span className={cn('block truncate', selected ? 'font-semibold text-text-primary' : 'font-medium text-text-primary')} style={{ fontSize: 'var(--fs-body)' }}>
                          {o.label}
                        </span>
                        <span className="block text-text-tertiary tabular-nums" style={{ fontSize: 'var(--fs-micro)' }}>
                          {o.count > 0 ? `${o.count} ${o.count === 1 ? 'Offer' : 'Offers'}` : 'No Offers Yet'}
                        </span>
                      </span>
                      <PriceText option={o} />
                      <IconCheck aria-hidden size={16} stroke={2.2} className={cn('shrink-0 text-lime-text', !selected && 'invisible')} />
                    </button>
                  </li>
                )
              })}
            </ul>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}

/** "FR" / "NFR" in a small box; a grid icon for Any Trait; an empty slot keeps names aligned. */
function TraitChip({ option }: { option: TraitOption }) {
  return (
    <span className="grid h-7 w-11 shrink-0 place-items-center rounded bg-white/[0.06] text-[11.5px] font-bold tracking-wide text-text-secondary">
      {option.variant === null ? <IconCategory2 aria-hidden size={15} stroke={1.9} /> : option.short ?? <span aria-hidden className="h-1 w-1 rounded-full bg-text-tertiary" />}
    </span>
  )
}

function PriceText({ option }: { option: TraitOption }) {
  return option.minPriceUsd != null ? (
    <span className="shrink-0 font-semibold tabular-nums text-text-primary" style={{ fontSize: 'var(--fs-body)' }}>
      ${formatStatPrice(option.minPriceUsd)}
    </span>
  ) : (
    <span className="shrink-0 text-text-tertiary" style={{ fontSize: 'var(--fs-meta)' }}>
      Notify Me
    </span>
  )
}

/** Scroll just enough to open the list below its button, never past the fixed chrome. */
function makeRoom(el: HTMLElement | null) {
  if (!el) return
  const r = el.getBoundingClientRect()
  const vh = window.innerHeight
  const wanted = Math.min(ROOM_WANTED, vh - TOP_CLEARANCE - r.height - EDGE)
  const room = vh - r.bottom - EDGE
  if (room < wanted) {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    window.scrollBy({ top: wanted - room, behavior: reduce ? 'auto' : 'smooth' })
  }
}

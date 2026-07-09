'use client'

/**
 * V43 — FAQ accordion cards, Flock-Ramp geometry (measured off the live
 * template): ~790px column, white-4% frost cards with NO border, 20px
 * radius, roomy padding, 19px/500 questions, muted 16px answers capped
 * at ~640px, 40px rounded-square +/− toggle (lime-filled when open),
 * cards nearly touching. Presentational — every surface brings its own
 * items and heading.
 */

import { useState } from 'react'
import { Plus, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FaqItem {
  q: string
  a: string
}

export function FaqCards({
  items,
  defaultOpen = 0,
  className,
}: {
  items: FaqItem[]
  /** Index opened initially; -1 for all closed. */
  defaultOpen?: number
  className?: string
}) {
  const [openIdx, setOpenIdx] = useState<number>(defaultOpen)
  return (
    <div className={cn('mx-auto mt-8 max-w-3xl space-y-2', className)}>
      {items.map((item, i) => {
        const open = openIdx === i
        return (
          <div
            key={i}
            className={cn(
              'overflow-hidden rounded-[20px] transition-colors',
              open ? 'bg-white/[0.06]' : 'bg-white/[0.04] hover:bg-white/[0.06]',
            )}
          >
            <h3>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenIdx(open ? -1 : i)}
                className="flex w-full items-center justify-between gap-6 px-6 py-5 text-left sm:px-9 sm:py-7"
              >
                <span className="text-[16.5px] font-medium leading-snug text-text-primary sm:text-[19px]">
                  {item.q}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] transition-all',
                    open
                      ? 'bg-lime text-text-inverse'
                      : 'bg-white/[0.05] text-text-secondary',
                  )}
                >
                  {open ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </span>
              </button>
            </h3>
            {open && (
              <div className="-mt-2 px-6 pb-6 sm:px-9 sm:pb-8">
                <div className="max-w-[640px] space-y-3 text-[15px] leading-[1.6] text-text-secondary sm:text-[16px]">
                  {item.a
                    .split(/\n{2,}/)
                    .map((p) => p.trim())
                    .filter(Boolean)
                    .map((p, j) => (
                      <p key={j}>{p}</p>
                    ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

'use client'

/**
 * V43 — FAQ accordion cards, Flock-Ramp geometry (measured off the live
 * template): ~790px column, white-4% frost cards with NO border, 20px
 * radius, roomy padding, 19px/500 questions, muted 16px answers capped
 * at ~640px, 40px rounded-square +/− toggle (lime-filled when open),
 * cards nearly touching. Presentational — every surface brings its own
 * items and heading.
 *
 * `square` opts into the game content hub's geometry (zero radius, forest
 * accent instead of lime). The rounded lime default stays for the marketplace
 * pages — currency, bundle and listing detail — which share this component.
 *
 * `glass` is the homepage variant: a blurred translucent surface with NO
 * perimeter outline at all — it is defined by a lit top edge, a shadow
 * beneath, and an accent rail on the leading edge (see `.faq-glass` in
 * globals.css). Two earlier passes used a 1px border and then a graded
 * gradient ring; both still drew a visible box, which made a stack of six
 * read as chunks rather than a list. The chevron rotates instead of a +/-
 * swap. Added as a variant rather than a second component so the open/close
 * behaviour stays in ONE place.
 */

import { useState } from 'react'
import { ChevronDown, Plus, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FaqItem {
  q: string
  a: string
}

export function FaqCards({
  items,
  defaultOpen = 0,
  className,
  square = false,
  glass = false,
}: {
  items: FaqItem[]
  /** Index opened initially; -1 for all closed. */
  defaultOpen?: number
  className?: string
  /** Content-hub variant: square edges, forest accent. */
  square?: boolean
  /** Homepage variant: glassmorphic surface, rotating green chevron. */
  glass?: boolean
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
              'transition-all duration-300',
              // No `overflow-hidden` on the glass variant: the accent rail
              // sits at left:0 and the sheen runs edge to edge, and clipping
              // them to the rounded box shaved both. The glass card has no
              // overflowing children to contain. Radius comes from
              // `.faq-glass` (10px) — an inline `rounded-[16px]` here used to
              // override it and kept the cards looking like pills.
              glass
                ? 'faq-glass'
                : square
                  ? 'overflow-hidden border border-[rgba(255,255,255,0.08)]'
                  : 'overflow-hidden rounded-[20px]',
              glass
                ? open
                  ? 'faq-glass--open'
                  : ''
                : open
                  ? 'bg-white/[0.06]'
                  : 'bg-white/[0.04] hover:bg-white/[0.06]',
            )}
          >
            <h3>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenIdx(open ? -1 : i)}
                className={cn(
                  'flex w-full items-center justify-between text-left',
                  glass
                    ? 'gap-5 px-5 py-4 sm:px-6 sm:py-[18px]'
                    : 'gap-6 px-6 py-5 sm:px-9 sm:py-7',
                )}
              >
                <span
                  className={cn(
                    'leading-snug text-text-primary',
                    glass
                      ? 'text-[16px] font-semibold tracking-[-0.005em] sm:text-[17.5px]'
                      : 'text-[16.5px] font-medium sm:text-[19px]',
                  )}
                >
                  {item.q}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    'flex shrink-0 items-center justify-center transition-all duration-300',
                    glass
                      ? 'h-9 w-9 rounded-[7px]'
                      : cn('h-10 w-10', square ? '' : 'rounded-[10px]'),
                    glass
                      ? open
                        ? 'bg-[color-mix(in_srgb,var(--color-accent-text)_18%,transparent)] text-[var(--color-accent-text)]'
                        : 'bg-white/[0.05] text-[color-mix(in_srgb,var(--color-accent-text)_75%,transparent)]'
                      : open
                        ? square
                          ? 'bg-[#2A7A50] text-white'
                          : 'bg-lime text-text-inverse'
                        : 'bg-white/[0.05] text-text-secondary',
                  )}
                >
                  {glass ? (
                    <ChevronDown
                      className={cn(
                        'h-[18px] w-[18px] transition-transform duration-300',
                        open && 'rotate-180',
                      )}
                    />
                  ) : open ? (
                    <Minus className="h-4 w-4" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </span>
              </button>
            </h3>
            {/* Glass variant keeps the answer mounted and animates it with a
                grid-template-rows 0fr -> 1fr transition, which interpolates to
                the content's intrinsic height without measuring it in JS (the
                trick a max-height guess always gets wrong). The row collapses
                to zero, so the inner element needs min-h-0 + overflow-hidden
                or its content refuses to shrink below its intrinsic height.
                The other variants keep the original mount/unmount untouched. */}
            {(glass || open) && (
              <div
                className={cn(
                  glass && 'faq-glass__reveal',
                  glass && open && 'faq-glass__reveal--open',
                )}
                // Hidden-but-mounted content must leave the a11y tree and the
                // tab order, or the closed answers' links stay focusable.
                // React 18 has no boolean `inert`: `true` warns and is dropped.
                // The empty string renders the attribute (inert="").
                {...(glass && !open ? { inert: '' as unknown as boolean } : {})}
              >
                <div className={cn(glass && 'min-h-0 overflow-hidden')}>
                  <div
                    className={cn(
                      glass
                        ? '-mt-1 px-5 pb-4 sm:px-6 sm:pb-5'
                        : '-mt-2 px-6 pb-6 sm:px-9 sm:pb-8',
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[640px] space-y-3 text-text-secondary',
                        glass
                          ? 'text-[14.5px] leading-[1.55] sm:text-[15px]'
                          : 'text-[15px] leading-[1.6] sm:text-[16px]',
                      )}
                    >
                      {item.a
                        .split(/\n{2,}/)
                        .map((p) => p.trim())
                        .filter(Boolean)
                        .map((p, j) => (
                          <p key={j}>{p}</p>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

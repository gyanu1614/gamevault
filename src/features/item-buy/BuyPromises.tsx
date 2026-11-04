'use client'

import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
import { Headset, Lightning, ShieldCheck } from '@phosphor-icons/react'

/** The checkout's trust blue (src/app/checkout/[id]/_surfaces.ts): security signals only. */
const TRUST_BLUE = '#6AA8FF'

const ROWS: Array<{ Icon: PhosphorIcon; label: string; sub: string }> = [
  { Icon: ShieldCheck, label: 'Money-Back Guarantee', sub: 'SafeDrop Protection' },
  { Icon: Lightning, label: 'Quick Delivery', sub: 'Handed over by in-game trade' },
  { Icon: Headset, label: '24/7 Live Support', sub: 'Real people, any time' },
]

/** Fades the loop out at both screen edges. */
const EDGE_FADE = 'linear-gradient(to right, transparent, black 28px, black calc(100% - 28px), transparent)'

/**
 * The three promises right under Buy, with no box around them (owner,
 * 2026-11-02, Eldorado's rows as the reference). Desktop: a trust-blue icon and
 * two lines per promise. Below lg, one row that keeps sliding in a loop (owner,
 * 2026-11-03: three half-empty rows looked bad), the promises alone; a finger
 * held on it pauses it, and under reduced motion it stays still and scrolls by
 * hand. Screen readers get the full list once. Duplicated track + the shared
 * `animate-marquee`, as on PaymentsMarquee; each track repeats the set so the
 * loop has no gap on a tablet.
 */
export function BuyPromises() {
  return (
    <>
      <div className="group -mx-4 sm:-mx-6 lg:hidden">
        <ul aria-label="Our Promises" className="sr-only">
          {ROWS.map(({ label, sub }) => (
            <li key={label}>
              {label}: {sub}
            </li>
          ))}
        </ul>
        <div
          aria-hidden
          tabIndex={-1}
          className="overflow-hidden [scrollbar-width:none] motion-reduce:overflow-x-auto"
          style={{ maskImage: EDGE_FADE, WebkitMaskImage: EDGE_FADE }}
        >
          <div className="flex w-max animate-marquee [animation-duration:40s] group-active:[animation-play-state:paused] motion-reduce:animate-none">
            {[0, 1].map((track) => (
              <div key={track} className="flex shrink-0 items-center gap-8 pr-8">
                {[...ROWS, ...ROWS].map(({ Icon, label }, i) => (
                  <span key={`${label}-${i}`} className="flex shrink-0 items-center gap-2 whitespace-nowrap text-[15px] font-medium text-text-primary">
                    <Icon size={20} weight="fill" color={TRUST_BLUE} className="shrink-0" />
                    {label}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <ul aria-label="Our Promises" className="hidden gap-4 lg:grid">
        {ROWS.map(({ Icon, label, sub }) => (
          <li key={label} className="flex items-start gap-3" style={{ fontSize: 'var(--fs-body)' }}>
            <Icon aria-hidden size={20} weight="fill" color={TRUST_BLUE} className="mt-px shrink-0" />
            <p className="min-w-0 leading-snug">
              <span className="block font-medium text-text-primary">{label}</span>
              <span className="mt-0.5 block text-[13px] text-text-secondary">{sub}</span>
            </p>
          </li>
        ))}
      </ul>
    </>
  )
}

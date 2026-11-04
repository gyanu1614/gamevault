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

/**
 * The three promises as plain rows right under Buy (owner, 2026-11-02, with
 * Eldorado's rows as the reference): a trust-blue icon, the promise, and a
 * short muted line, floating on the page with no box around them. They sit
 * where the buyer decides, instead of a separate strip lower down. The promise
 * and its line stack, in a lighter weight, on every screen (owner, 2026-11-03:
 * too bold, too packed).
 */
export function BuyPromises() {
  return (
    <ul aria-label="Our Promises" className="grid gap-4">
      {ROWS.map(({ Icon, label, sub }) => (
        <li key={label} className="flex items-start gap-3" style={{ fontSize: 'var(--fs-body)' }}>
          <Icon aria-hidden size={20} weight="fill" color={TRUST_BLUE} className="mt-px shrink-0" />
          <p className="min-w-0 leading-snug">
            <span className="block font-medium text-text-primary">{label}</span>
            <span className="mt-0.5 block text-[13px] text-text-tertiary">{sub}</span>
          </p>
        </li>
      ))}
    </ul>
  )
}

/**
 * The balance at the top of the wallet, withdrawal and payout pages, in the
 * checkout's card-and-band material. One surface, two jobs:
 *
 *   left   the number and what to do with it, all on one left edge
 *   right  a statement: what makes it up, labels left, figures right-aligned
 *
 * The same component on all three pages, so they can't disagree or drift. Sizes from
 * the shared scale (page-scale.ts): the balance is a buy box price, 30, not a poster
 * (owner, 2026-11-06).
 */

import type { ReactNode } from 'react'
import { BAND_CLASS, CARD_CLASS } from '@/app/checkout/[id]/_surfaces'
import { ICON_TEXT, type IconTileTone } from '@/components/account/AccountSurface'
import { cn } from '@/lib/utils'

export interface BalanceRow {
  label: string
  value: string
  icon: ReactNode
  tone?: IconTileTone
}

export const usd = (n: number) =>
  (n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

export function BalanceHero({
  label,
  amount,
  caption,
  actions,
  rows,
  className,
}: {
  label: string
  amount: number
  caption?: ReactNode
  actions?: ReactNode
  rows: BalanceRow[]
  className?: string
}) {
  return (
    <section aria-label={label} className={cn(CARD_CLASS, 'grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]', className)}>
      <div className="flex min-w-0 flex-col justify-center p-6">
        <h2 className="text-[14px] font-medium text-text-secondary">{label}</h2>
        <p className="mt-2 text-[30px] font-bold leading-none tracking-[-0.025em] tabular-nums text-text-primary">{usd(amount)}</p>
        {caption && <p className="mt-3 text-[14px] leading-relaxed text-text-secondary">{caption}</p>}
        {actions && <div className="mt-5 flex flex-wrap gap-2">{actions}</div>}
      </div>

      <dl className={cn(BAND_CLASS, 'flex flex-col justify-center divide-y divide-white/[0.07] px-6 py-2')}>
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 py-3.5">
            <dt className="flex min-w-0 items-center gap-2.5 text-[14px] text-text-secondary">
              <span aria-hidden className={cn('shrink-0', ICON_TEXT[row.tone ?? 'neutral'])}>{row.icon}</span>
              {row.label}
            </dt>
            <dd className="shrink-0 text-[14px] font-semibold tabular-nums text-text-primary">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

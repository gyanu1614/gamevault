/**
 * FeeSummaryCard — read-only per-category fee summary.
 *
 * Replaces the removed commission-tier cards. Every number is rendered from
 * @/lib/fees (single source of truth — no literals) and links to the full
 * public fee schedule at /fees.
 */

'use client'

import Link from 'next/link'
import { ArrowUpRight, Percent } from 'lucide-react'
import { COMMISSION_PCT, PAYOUT_FEES, PAYOUT_MIN_USD } from '@/lib/fees'

const CATEGORY_ROWS: Array<{ label: string; value: string }> = [
  { label: 'Game Currency', value: `${COMMISSION_PCT.currencyStandard}%` },
  { label: 'Roblox Game Economies', value: `${COMMISSION_PCT.currencyRobloxEconomy}%` },
  { label: 'Items & Boosting', value: `${COMMISSION_PCT.items}%` },
  { label: 'Top-Ups', value: `${COMMISSION_PCT.topUp}%` },
  {
    label: 'Accounts (By Risk)',
    value: `${COMMISSION_PCT.accounts.low}–${COMMISSION_PCT.accounts.high}%`,
  },
]

export default function FeeSummaryCard({ compact = false }: { compact?: boolean }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border-subtle bg-bg-overlay p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Percent className="h-3.5 w-3.5 text-lime-text" />
          <h3 className="text-xs font-semibold text-white sm:text-sm">Selling Fees</h3>
        </div>
        <Link
          href="/fees"
          target="_blank"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-text-secondary transition-colors hover:bg-white/5 hover:text-white sm:text-xs"
        >
          Full Fee Schedule
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Commission per category */}
      <div className={compact ? 'grid gap-x-6 gap-y-1.5 sm:grid-cols-2' : 'space-y-1.5'}>
        {CATEGORY_ROWS.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 text-xs sm:text-sm">
            <span className="text-text-secondary">{row.label}</span>
            <span className="font-medium tabular-nums text-white">{row.value}</span>
          </div>
        ))}
      </div>

      {/* Payout rails */}
      <div className="mt-3 border-t border-border-subtle pt-3">
        <div className={compact ? 'grid gap-x-6 gap-y-1.5 sm:grid-cols-2' : 'space-y-1.5'}>
          <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
            <span className="text-text-secondary">Bank Payout</span>
            <span className="font-medium tabular-nums text-white">
              {PAYOUT_FEES.fiat.pct}% + ${PAYOUT_FEES.fiat.fixed}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
            <span className="text-text-secondary">Crypto Payout</span>
            <span className="font-medium tabular-nums text-white">
              {PAYOUT_FEES.crypto.pct}% + ${PAYOUT_FEES.crypto.fixed}
            </span>
          </div>
        </div>
        <p className="mt-2 text-[10px] text-text-tertiary sm:text-xs">
          Minimum payout ${PAYOUT_MIN_USD}. Commission comes off the item price when an order completes — buyers pay their own checkout fees.
        </p>
      </div>
    </div>
  )
}

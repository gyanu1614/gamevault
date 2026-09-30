'use client'

import Link from 'next/link'
import { ArrowDownToLine, ChevronRight } from 'lucide-react'
import { useSellerEarnings } from '@/hooks/use-seller-earnings'
import PayoutDetailsSection from '@/components/account/settings/PayoutDetailsSection'
import { AccountCard, SettingsCard, accountBtn } from '@/components/account/AccountSurface'
import { cn } from '@/lib/utils'

const usd = (n: number | null | undefined) =>
  (n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

/**
 * Payouts (sellers). Mounted only while the tab is open, so buyers and other
 * tabs never fetch earnings. Figures come from the same ledger reads as
 * /account/wallet.
 */
export function PayoutsTab() {
  const { stats, payouts, isLoadingStats, isLoadingPayouts } = useSellerEarnings()

  return (
    <>
      {/* Same balance panel as the wallet page: one fill, a divider between cells. */}
      <AccountCard padded={false} className="overflow-hidden">
        <div className="grid divide-y divide-white/[0.07] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <div className="flex items-start justify-between gap-3 p-5">
            <Balance label="Available Balance" value={stats.available_balance} loading={isLoadingStats} caption="Ready to withdraw." />
            <Link
              href="/account/wallet/withdraw"
              // Not disabled at $0: withdrawals can also draw on store credit,
              // which this tab doesn't load (the withdraw page checks both).
              className={cn(accountBtn.primary, 'shrink-0')}
            >
              <ArrowDownToLine className="h-4 w-4" aria-hidden />
              Withdraw
            </Link>
          </div>
          <div className="p-5">
            <Balance label="Pending Sales" value={stats.pending_balance} loading={isLoadingStats} caption="Credited once the buyer confirms delivery." />
          </div>
        </div>
      </AccountCard>

      <PayoutDetailsSection />

      <SettingsCard
        title="Recent Payouts"
        description="Your last five withdrawals."
        aside={
          <Link
            href="/account/wallet"
            className="inline-flex items-center gap-0.5 text-[13px] font-semibold text-text-secondary transition-colors hover:text-text-primary"
          >
            View All
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        }
      >
        {isLoadingPayouts ? (
          <div className="divide-y divide-white/[0.07]" aria-busy>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div className="space-y-1.5">
                  <div className="skeleton h-4 w-20 rounded" />
                  <div className="skeleton h-3 w-24 rounded" />
                </div>
                <div className="skeleton h-6 w-20 rounded-full" />
              </div>
            ))}
          </div>
        ) : payouts.length === 0 ? (
          <p className="rounded-md bg-bg-overlay px-4 py-6 text-center text-[13px] text-text-secondary">
            No payouts yet. Withdrawals you request show up here.
          </p>
        ) : (
          <ul className="divide-y divide-white/[0.07]">
            {payouts.slice(0, 5).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-semibold tabular-nums text-text-primary">{usd(p.amount)}</p>
                  <p className="mt-0.5 text-[12px] text-text-tertiary">{shortDate(p.completed_at ?? p.created_at)}</p>
                </div>
                <span
                  className={cn(
                    'inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-semibold capitalize',
                    p.status === 'completed' ? 'bg-success-bg text-success' : 'bg-white/[0.06] text-text-secondary',
                  )}
                >
                  {p.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SettingsCard>
    </>
  )
}

function Balance({ label, value, caption, loading }: { label: string; value: number; caption: string; loading: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[12.5px] font-medium text-text-secondary">{label}</p>
      {loading ? (
        <div className="skeleton mt-1.5 h-8 w-28 rounded" aria-hidden />
      ) : (
        <p className="mt-1 text-[28px] font-bold leading-tight tabular-nums text-text-primary">{usd(value)}</p>
      )}
      <p className="mt-1 text-[12px] text-text-tertiary">{caption}</p>
    </div>
  )
}

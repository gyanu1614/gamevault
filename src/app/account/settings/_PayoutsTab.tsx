'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLineDownIcon } from '@phosphor-icons/react/dist/csr/ArrowLineDown'
import { ArrowRightIcon } from '@phosphor-icons/react/dist/csr/ArrowRight'
import { ClockCounterClockwiseIcon } from '@phosphor-icons/react/dist/csr/ClockCounterClockwise'
import { HourglassMediumIcon } from '@phosphor-icons/react/dist/csr/HourglassMedium'
import { PaperPlaneTiltIcon } from '@phosphor-icons/react/dist/csr/PaperPlaneTilt'
import PayoutDetailsSection from '@/components/account/settings/PayoutDetailsSection'
import { SettingsCard, accountBtn } from '@/components/account/AccountSurface'
import { BalanceHero, usd } from '@/components/account/BalanceHero'
import Link from '@/components/navigation/AppLink'
import WithdrawalRequestCard from '@/components/wallet/WithdrawalRequestCard'
import type { WalletOverview } from '@/lib/actions/wallet-ledger'
import type { WithdrawalRequest } from '@/lib/actions/withdrawals'
import type { SellerEarningsSummary } from '@/lib/wallet/reads'

interface WalletSummary {
  overview: WalletOverview
  earnings: SellerEarningsSummary
  withdrawn: number
  requests: WithdrawalRequest[]
}

const QUERY_KEY = ['settings', 'wallet-summary'] as const

async function fetchWalletSummary(): Promise<WalletSummary> {
  const res = await fetch('/api/account/wallet-summary', { cache: 'no-store' })
  if (!res.ok) throw new Error(`wallet summary ${res.status}`)
  return res.json()
}

/**
 * Payouts (sellers). Mounted only while the tab is open. The same reads as the
 * wallet page, so the two can never show different numbers.
 */
export function PayoutsTab() {
  const queryClient = useQueryClient()
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: QUERY_KEY, queryFn: fetchWalletSummary })
  const refresh = () => void queryClient.invalidateQueries({ queryKey: QUERY_KEY })

  return (
    <>
      {isLoading ? (
        <div className="skeleton h-[190px] w-full rounded-lg" aria-hidden />
      ) : data ? (
        <BalanceHero
          label="Store Balance"
          amount={data.overview.available + data.overview.wallet}
          actions={
            <Link href="/account/wallet/withdraw" className={accountBtn.primary}>
              <ArrowLineDownIcon size={18} weight="bold" aria-hidden />
              Withdraw
            </Link>
          }
          rows={[
            { label: 'Pending Sales', value: usd(data.earnings.pendingSales + data.overview.pending), tone: 'trust', icon: <HourglassMediumIcon size={18} weight="duotone" /> },
            { label: 'Withdrawn', value: usd(data.withdrawn), tone: 'neutral', icon: <PaperPlaneTiltIcon size={18} weight="duotone" /> },
          ]}
        />
      ) : null}

      <PayoutDetailsSection />

      <SettingsCard
        title="Recent Withdrawals"
                icon={<ClockCounterClockwiseIcon size={22} weight="duotone" />}
        aside={
          <Link href="/account/wallet?tab=payouts" className="inline-flex items-center gap-1 text-[13px] font-semibold text-text-secondary transition-colors hover:text-text-primary">
            View All
            <ArrowRightIcon size={14} weight="bold" aria-hidden />
          </Link>
        }
        bodyClassName="pb-0 sm:pb-0"
      >
        {isLoading ? (
          <div className="space-y-3 pb-5" aria-busy>
            {[0, 1, 2].map((i) => <div key={i} className="skeleton h-12 w-full rounded-md" />)}
          </div>
        ) : isError ? (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-md bg-bg-overlay px-4 py-3">
            <p className="text-[13px] text-text-secondary">We couldn’t load your withdrawals.</p>
            <button type="button" onClick={() => void refetch()} className={accountBtn.secondary}>Try Again</button>
          </div>
        ) : !data?.requests.length ? (
          <p className="mb-5 rounded-md bg-bg-overlay px-4 py-6 text-center text-[13px] text-text-secondary">
            No withdrawals yet.
          </p>
        ) : (
          <div className="-mx-5 divide-y divide-white/[0.07] border-t border-white/[0.07] sm:-mx-6">
            {data.requests.map((request) => (
              <WithdrawalRequestCard key={request.id} request={request} onUpdate={refresh} />
            ))}
          </div>
        )}
      </SettingsCard>
    </>
  )
}

'use client'

/**
 * The wallet: where a person's money is, then everything that happened to it (owner,
 * 2026-11-06, a full redo). The server page hands over the balance and withdrawals, so
 * the top is drawn on arrival; the feed reads its lists when they are needed.
 */

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { GearSixIcon } from '@phosphor-icons/react/dist/csr/GearSix'
import AccountPageHeader from '@/components/account/AccountPageHeader'
import { AccountPage, accountBtn } from '@/components/account/AccountSurface'
import Link from '@/components/navigation/AppLink'
import type { WalletOverview } from '@/lib/actions/wallet-ledger'
import type { WithdrawalRequest } from '@/lib/actions/withdrawals'
import type { ActivityFilter } from '@/lib/wallet/activity'
import type { SellerEarningsSummary } from '@/lib/wallet/reads'
import { cn } from '@/lib/utils'
import { Activity } from './_Activity'
import { Balances, CreditPanel } from './_Balances'
import { RefundToCardCard } from './_RefundToCardCard'
import { LoadError } from './_WalletLists'

interface Props {
  userId: string
  isSeller: boolean
  initialFilter: ActivityFilter
  overview: WalletOverview | null
  earnings: SellerEarningsSummary | null
  requests: WithdrawalRequest[]
}

export default function WalletClient({ userId, isSeller, initialFilter, overview, earnings, requests }: Props) {
  const router = useRouter()
  const refresh = useCallback(() => router.refresh(), [router])
  const [totals, setTotals] = useState<{ spent: number; completed: number } | null>(null)

  return (
    <AccountPage>
      <AccountPageHeader
        title="Wallet"
        className="mb-4"
        actions={
          isSeller ? (
            <Link href="/account/settings?tab=payouts" className={cn(accountBtn.secondary, 'max-sm:hidden')}>
              <GearSixIcon size={18} weight="duotone" aria-hidden />
              Payout Settings
            </Link>
          ) : undefined
        }
      />

      {!overview ? (
        <div className="rounded-lg bg-bg-raised">
          <LoadError what="Your Balance" onRetry={refresh} />
        </div>
      ) : isSeller ? (
        <Balances overview={overview} earnings={earnings} />
      ) : (
        <CreditPanel credit={overview.wallet} spent={totals?.spent ?? null} completed={totals?.completed ?? null} />
      )}

      {/* Refunds sit as store credit; each refunded order can go back to the card. */}
      <RefundToCardCard userId={userId} />

      <Activity userId={userId} isSeller={isSeller} requests={requests} initialFilter={initialFilter} onUpdate={refresh} onPurchaseTotals={isSeller ? undefined : setTotals} />
    </AccountPage>
  )
}

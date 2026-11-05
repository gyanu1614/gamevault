'use client'

/**
 * The wallet. The server page hands it the balance and withdrawals, so the top is
 * drawn on arrival; a list only loads when its tab is open.
 */

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ArrowLineDownIcon } from '@phosphor-icons/react/dist/csr/ArrowLineDown'
import { ChartLineUpIcon } from '@phosphor-icons/react/dist/csr/ChartLineUp'
import { CoinsIcon } from '@phosphor-icons/react/dist/csr/Coins'
import { CheckCircleIcon } from '@phosphor-icons/react/dist/csr/CheckCircle'
import { CreditCardIcon } from '@phosphor-icons/react/dist/csr/CreditCard'
import { GearSixIcon } from '@phosphor-icons/react/dist/csr/GearSix'
import { HourglassMediumIcon } from '@phosphor-icons/react/dist/csr/HourglassMedium'
import { MagnifyingGlassIcon } from '@phosphor-icons/react/dist/csr/MagnifyingGlass'
import { PaperPlaneTiltIcon } from '@phosphor-icons/react/dist/csr/PaperPlaneTilt'
import { ReceiptIcon } from '@phosphor-icons/react/dist/csr/Receipt'
import { ShoppingCartIcon } from '@phosphor-icons/react/dist/csr/ShoppingCart'
import { TrendUpIcon } from '@phosphor-icons/react/dist/csr/TrendUp'
import { XIcon } from '@phosphor-icons/react/dist/csr/X'
import AccountPageHeader from '@/components/account/AccountPageHeader'
import { AccountPage, accountBtn, accountInputCls } from '@/components/account/AccountSurface'
import { BalanceHero, usd, type BalanceRow } from '@/components/account/BalanceHero'
import { SegmentedTabs } from '@/components/account/SegmentedTabs'
import Link from '@/components/navigation/AppLink'
import type { WalletOverview } from '@/lib/actions/wallet-ledger'
import type { WithdrawalRequest } from '@/lib/actions/withdrawals'
import type { SellerEarningsSummary } from '@/lib/wallet/reads'
import { matchesPurchaseFilter } from '@/lib/wallet/wallet-rows'
import { cn } from '@/lib/utils'
import { RefundToCardCard } from './_RefundToCardCard'
import { ListSkeleton, LoadError, PayoutList, PurchaseList, SalesList } from './_WalletLists'
import { fetchPurchases, fetchSales } from './_walletData'

export type WalletTab = 'purchases' | 'earnings' | 'payouts'

interface Props {
  userId: string
  isSeller: boolean
  initialTab: WalletTab
  overview: WalletOverview | null
  earnings: SellerEarningsSummary | null
  requests: WithdrawalRequest[]
  withdrawn: number
}

/** A read that failed shows this, never a false $0.00. */
const UNKNOWN = '—'

const TAB_ICONS = { earnings: TrendUpIcon, purchases: ShoppingCartIcon, payouts: CreditCardIcon } as const

export default function WalletClient({ userId, isSeller, initialTab, overview, earnings, requests, withdrawn }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<WalletTab>(initialTab)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  const refresh = useCallback(() => router.refresh(), [router])

  const selectTab = (tab: WalletTab) => {
    setActiveTab(tab)
    setSearchQuery('')
    setFilterStatus('all')
    window.history.replaceState(null, '', tab === (isSeller ? 'earnings' : 'purchases') ? '/account/wallet' : `/account/wallet?tab=${tab}`)
  }

  const purchasesQuery = useQuery({
    queryKey: ['wallet-purchases', userId],
    queryFn: () => fetchPurchases(userId),
    // A buyer's totals come from this list; a seller only needs it on its tab.
    enabled: !isSeller || activeTab === 'purchases',
    refetchOnWindowFocus: false,
    retry: 1,
  })

  const salesQuery = useQuery({
    queryKey: ['wallet-sales', userId],
    queryFn: () => fetchSales(userId),
    enabled: isSeller && activeTab === 'earnings',
    refetchOnWindowFocus: false,
    retry: 1,
  })

  const purchases = useMemo(() => purchasesQuery.data?.transactions ?? [], [purchasesQuery.data])
  const sales = useMemo(() => salesQuery.data ?? [], [salesQuery.data])

  const query = searchQuery.trim().toLowerCase()
  const filteredPurchases = useMemo(
    () =>
      purchases.filter(
        (t) =>
          matchesPurchaseFilter(t.status, filterStatus) &&
          (!query ||
            t.title.toLowerCase().includes(query) ||
            (t.orderNumber || '').toLowerCase().includes(query) ||
            (t.gameName || '').toLowerCase().includes(query)),
      ),
    [purchases, filterStatus, query],
  )
  const filteredSales = useMemo(
    () =>
      sales.filter(
        (t) =>
          !query ||
          t.listingTitle?.toLowerCase().includes(query) ||
          t.orderNumber?.toLowerCase().includes(query) ||
          t.buyerUsername?.toLowerCase().includes(query) ||
          (t.gameName || '').toLowerCase().includes(query),
      ),
    [sales, query],
  )

  // One customer-facing number (owner, 2026-09-29), the same sum the withdrawal page
  // offers: released sales plus store credit. Sellers withdraw it, everyone can spend it.
  const balance = overview ? (isSeller ? overview.available + overview.wallet : overview.wallet) : 0
  const rows: BalanceRow[] = isSeller
    ? [
        // Still in flight, plus confirmed sales inside the short hold before release.
        { label: 'Pending Sales', value: earnings ? usd(earnings.pendingSales + (overview?.pending ?? 0)) : UNKNOWN, tone: 'trust', icon: <HourglassMediumIcon size={18} weight="duotone" /> },
        { label: 'This Month', value: earnings ? usd(earnings.thisMonth) : UNKNOWN, tone: 'speed', icon: <ChartLineUpIcon size={18} weight="duotone" /> },
        { label: 'Lifetime Earnings', value: earnings ? usd(earnings.totalEarned) : UNKNOWN, tone: 'money', icon: <CoinsIcon size={18} weight="duotone" /> },
        { label: 'Withdrawn', value: usd(withdrawn), tone: 'neutral', icon: <PaperPlaneTiltIcon size={18} weight="duotone" /> },
      ]
    : [
        { label: 'Total Spent', value: usd(purchasesQuery.data?.lifetimeSpent ?? 0), tone: 'neutral', icon: <ReceiptIcon size={18} weight="duotone" /> },
        { label: 'Completed Orders', value: String(purchases.filter((t) => t.status === 'completed').length), tone: 'money', icon: <CheckCircleIcon size={18} weight="duotone" /> },
      ]

  const tabs: { id: WalletTab; label: string }[] = isSeller
    ? [
        { id: 'earnings', label: 'Sales' },
        { id: 'purchases', label: 'Purchases' },
        { id: 'payouts', label: 'Payouts' },
      ]
    : [{ id: 'purchases', label: 'Purchases' }]

  return (
    <AccountPage>
      <AccountPageHeader title="Wallet" className="mb-4" />

      {overview ? (
        <BalanceHero
          label="Store Balance"
          amount={balance}
          caption={
            isSeller
              ? 'Use it at checkout with no service fee, or withdraw it.'
              : 'Use it at checkout with no service fee. To withdraw it, contact support.'
          }
          actions={
            isSeller ? (
              <>
                <Link href="/account/wallet/withdraw" className={cn(accountBtn.primary, 'h-11 flex-1 px-3 text-[14px] sm:flex-none sm:px-6')}>
                  <ArrowLineDownIcon size={18} weight="bold" aria-hidden />
                  Withdraw
                </Link>
                <Link href="/account/settings?tab=payouts" className={cn(accountBtn.secondary, 'h-11 flex-1 px-3 text-[14px] sm:flex-none sm:px-5')}>
                  <GearSixIcon size={18} weight="duotone" aria-hidden />
                  Payout Settings
                </Link>
              </>
            ) : undefined
          }
          rows={rows}
        />
      ) : (
        <LoadError what="Your Balance" onRetry={refresh} />
      )}

      {/* Refunds sit as store credit; each refunded order can go back to the card. */}
      <RefundToCardCard userId={userId} />

      <section aria-label="Transactions" className="mt-6 overflow-hidden rounded-lg bg-bg-raised">
        <div className="flex flex-col gap-3 border-b border-white/[0.07] p-3 sm:px-5 sm:py-4 lg:flex-row lg:items-center lg:justify-between">
          <SegmentedTabs
            tabs={tabs.map((tab) => {
              const Icon = TAB_ICONS[tab.id]
              return { id: tab.id, label: <><Icon size={15} weight="duotone" aria-hidden className="shrink-0" />{tab.label}</> }
            })}
            value={activeTab}
            onChange={selectTab}
            layoutId="wallet-tab-pill"
            ariaLabel="Wallet sections"
          />

          {activeTab !== 'payouts' && (
            <div className="flex gap-2 lg:w-[400px]">
              <div className="relative min-w-0 flex-1">
                <MagnifyingGlassIcon size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                <input
                  type="text"
                  name="wallet-search"
                  autoComplete="off"
                  placeholder={activeTab === 'purchases' ? 'Search purchases…' : 'Search sales…'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search transactions"
                  className={cn(accountInputCls, 'h-10 py-0 pl-9 pr-9')}
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear search" className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-text-tertiary transition-colors hover:text-text-primary">
                    <XIcon size={14} weight="bold" aria-hidden />
                  </button>
                )}
              </div>
              {activeTab === 'purchases' && (
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  aria-label="Filter by status"
                  className={cn(accountInputCls, 'h-10 w-auto shrink-0 py-0 pr-8 text-[13px] sm:text-[13px]')}
                >
                  <option value="all">All Statuses</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Awaiting Payment</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="refunded">Refunded</option>
                </select>
              )}
            </div>
          )}
        </div>

        {activeTab === 'purchases' &&
          (purchasesQuery.isLoading ? (
            <ListSkeleton />
          ) : purchasesQuery.error && !purchasesQuery.data ? (
            <LoadError what="Your Purchases" onRetry={() => void purchasesQuery.refetch()} />
          ) : (
            <PurchaseList rows={filteredPurchases} filtered={!!query || filterStatus !== 'all'} />
          ))}

        {activeTab === 'earnings' &&
          (salesQuery.isLoading ? (
            <ListSkeleton />
          ) : salesQuery.error && !salesQuery.data ? (
            <LoadError what="Your Sales" onRetry={() => void salesQuery.refetch()} />
          ) : (
            <SalesList rows={filteredSales} filtered={!!query} />
          ))}

        {activeTab === 'payouts' && <PayoutList requests={requests} onUpdate={refresh} />}
      </section>
    </AccountPage>
  )
}

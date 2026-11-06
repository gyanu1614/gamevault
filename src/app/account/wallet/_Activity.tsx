'use client'

/**
 * Every movement of the money on one full-width feed, by day: a sale, a purchase, a
 * withdrawal, each with its sign. A row opens its order, or a withdrawal's details.
 * Only the list a filter needs is read, and only when it is opened.
 */

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CaretRightIcon } from '@phosphor-icons/react/dist/csr/CaretRight'
import { GameControllerIcon } from '@phosphor-icons/react/dist/csr/GameController'
import { MagnifyingGlassIcon } from '@phosphor-icons/react/dist/csr/MagnifyingGlass'
import { XIcon } from '@phosphor-icons/react/dist/csr/X'
import { IconTile, StatusPill, accountBtn, accountInputCls } from '@/components/account/AccountSurface'
import { OrderStatusPill } from '@/components/account/OrderStatusPill'
import { SegmentedTabs } from '@/components/account/SegmentedTabs'
import Link from '@/components/navigation/AppLink'
import CoinBadge from '@/components/wallet/CoinBadge'
import { WithdrawalDetails, withdrawalStatus } from '@/components/wallet/WithdrawalRequestCard'
import type { WithdrawalRequest } from '@/lib/actions/withdrawals'
import { cn } from '@/lib/utils'
import { filterActivity, groupByDay, signedMoney, toActivity, type ActivityFilter, type ActivityRow } from '@/lib/wallet/activity'
import { ActivityEmpty, ListSkeleton, LoadError } from './_WalletLists'
import { fetchPurchases, fetchSales } from './_walletData'

const PAGE = 25

function Thumb({ row }: { row: ActivityRow }) {
  const [failed, setFailed] = useState(false)
  if (row.request) {
    return (
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-white/[0.05]">
        <CoinBadge coin={row.request.method?.coin ?? null} methodName={row.request.method_name} size={28} />
      </span>
    )
  }
  if (row.imageUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- listing art from any host
      <img src={row.imageUrl} alt="" width={48} height={48} loading="lazy" onError={() => setFailed(true)} className="h-12 w-12 shrink-0 rounded-md object-cover" />
    )
  }
  return (
    <IconTile className="h-12 w-12">
      <GameControllerIcon size={22} weight="duotone" />
    </IconTile>
  )
}

function Amount({ row }: { row: ActivityRow }) {
  return (
    <span className={cn('text-[16px] font-bold tabular-nums', row.voided ? 'text-text-tertiary line-through' : row.amount > 0 ? 'text-success' : 'text-text-primary')}>
      {signedMoney(row.amount)}
    </span>
  )
}

function Status({ row }: { row: ActivityRow }) {
  if (row.request) {
    const s = withdrawalStatus(row.request)
    return <StatusPill tone={s.tone}>{s.label}</StatusPill>
  }
  return <OrderStatusPill status={row.status} />
}

const ROW = 'group grid w-full grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04] focus-visible:bg-white/[0.05] focus-visible:outline-none sm:gap-x-4 sm:px-6 md:grid-cols-[48px_minmax(0,1fr)_140px_112px_14px]'

function RowBody({ row }: { row: ActivityRow }) {
  return (
    <>
      <Thumb row={row} />
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-semibold text-text-primary">{row.title}</span>
        <span className="mt-0.5 block truncate text-[13px] text-text-secondary">{row.sub}</span>
      </span>
      <span className="hidden md:block"><Status row={row} /></span>
      <span className="flex flex-col items-end gap-1 md:block md:text-right">
        <Amount row={row} />
        <span className="md:hidden"><Status row={row} /></span>
      </span>
      <CaretRightIcon size={14} weight="bold" aria-hidden className="hidden text-text-tertiary transition-colors group-hover:text-text-primary md:block" />
    </>
  )
}

export function Activity({
  userId,
  isSeller,
  requests,
  initialFilter,
  onUpdate,
  onPurchaseTotals,
}: {
  userId: string
  isSeller: boolean
  requests: WithdrawalRequest[]
  initialFilter: ActivityFilter
  onUpdate: () => void
  onPurchaseTotals?: (totals: { spent: number; completed: number } | null) => void
}) {
  const [filter, setFilter] = useState<ActivityFilter>(initialFilter)
  const [search, setSearch] = useState('')
  const [shown, setShown] = useState(PAGE)
  const [openRequest, setOpenRequest] = useState<WithdrawalRequest | null>(null)
  // Days are the viewer's own, so the list draws once it is in their browser.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const purchasesQuery = useQuery({
    queryKey: ['wallet-purchases', userId],
    queryFn: () => fetchPurchases(userId),
    enabled: filter === 'all' || filter === 'purchases',
    refetchOnWindowFocus: false,
    retry: 1,
  })
  const salesQuery = useQuery({
    queryKey: ['wallet-sales', userId],
    queryFn: () => fetchSales(userId),
    enabled: isSeller && (filter === 'all' || filter === 'sales'),
    refetchOnWindowFocus: false,
    retry: 1,
  })

  const purchases = purchasesQuery.data
  useEffect(() => {
    if (!onPurchaseTotals) return
    onPurchaseTotals(purchases ? { spent: purchases.lifetimeSpent, completed: purchases.transactions.filter((t) => t.status === ('completed' as typeof t.status)).length } : null)
  }, [purchases, onPurchaseTotals])

  const rows = useMemo(
    () => toActivity({ sales: salesQuery.data, purchases: purchases?.transactions, requests: isSeller ? requests : [] }),
    [salesQuery.data, purchases, requests, isSeller],
  )
  const matching = useMemo(() => filterActivity(rows, filter, search), [rows, filter, search])
  const days = useMemo(() => groupByDay(matching.slice(0, shown), new Date()), [matching, shown])

  const pick = (next: ActivityFilter) => {
    setFilter(next)
    setShown(PAGE)
    const tab = next === 'sales' ? 'earnings' : next === 'withdrawals' ? 'payouts' : next === 'purchases' && isSeller ? 'purchases' : null
    window.history.replaceState(null, '', tab ? `/account/wallet?tab=${tab}` : '/account/wallet')
  }

  const wantsSales = isSeller && (filter === 'all' || filter === 'sales')
  const wantsPurchases = filter === 'all' || filter === 'purchases'
  const loading = !mounted || (wantsSales && salesQuery.isLoading) || (wantsPurchases && purchasesQuery.isLoading)
  const failed = (wantsSales && salesQuery.error && !salesQuery.data) || (wantsPurchases && purchasesQuery.error && !purchases)

  const tabs: { id: ActivityFilter; label: string }[] = isSeller
    ? [
        { id: 'all', label: 'All' },
        { id: 'sales', label: 'Sales' },
        { id: 'withdrawals', label: 'Withdrawals' },
        { id: 'purchases', label: 'Purchases' },
      ]
    : []

  return (
    <section aria-labelledby="wallet-activity" className="mt-8">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <h2 id="wallet-activity" className="text-[20px] font-bold text-text-primary">Activity</h2>
          {tabs.length > 0 && <SegmentedTabs tabs={tabs} value={filter} onChange={pick} layoutId="wallet-activity-pill" ariaLabel="Filter activity" />}
        </div>
        <div className="relative lg:w-[320px]">
          <MagnifyingGlassIcon size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            name="wallet-search"
            autoComplete="off"
            placeholder="Search Activity"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setShown(PAGE)
            }}
            aria-label="Search activity"
            className={cn(accountInputCls, 'h-10 bg-bg-raised py-0 pl-9 pr-9')}
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-text-tertiary transition-colors hover:text-text-primary">
              <XIcon size={14} weight="bold" aria-hidden />
            </button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg bg-bg-raised">
        {loading ? (
          <ListSkeleton />
        ) : failed ? (
          <LoadError
            what="Your Activity"
            onRetry={() => {
              if (wantsSales) void salesQuery.refetch()
              if (wantsPurchases) void purchasesQuery.refetch()
            }}
          />
        ) : matching.length === 0 ? (
          <ActivityEmpty filter={filter} searching={!!search.trim()} isSeller={isSeller} />
        ) : (
          days.map((day) => (
            <div key={day.key}>
              <h3 className="border-b border-white/[0.07] bg-white/[0.02] px-4 py-2 text-[13px] font-semibold text-text-secondary sm:px-6">{day.label}</h3>
              <ul className="divide-y divide-white/[0.07]">
                {day.rows.map((row) => (
                  <li key={row.id}>
                    {row.href ? (
                      <Link href={row.href} className={ROW}>
                        <RowBody row={row} />
                      </Link>
                    ) : (
                      <button type="button" onClick={() => setOpenRequest(row.request ?? null)} className={ROW}>
                        <RowBody row={row} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>

      {!loading && matching.length > shown && (
        <button type="button" onClick={() => setShown((n) => n + PAGE)} className={cn(accountBtn.secondary, 'mt-3 h-11 w-full text-[14px]')}>
          Show More
        </button>
      )}

      {openRequest && <WithdrawalDetails request={openRequest} open onOpenChange={(open) => !open && setOpenRequest(null)} onUpdate={onUpdate} />}
    </section>
  )
}

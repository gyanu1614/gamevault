'use client'

/**
 * /admin/active-sellers client (account-section design, 2026-09-30).
 *
 * Page header (+ Export CSV), the four numbers as a StatStrip, a toolbar
 * (search / tier / status / paused / sort — a swipe row on phones), then one
 * fill-only panel of seller rows. The ENTIRE row clicks through to
 * /admin/active-sellers/{profile id} — the seller-management detail. The
 * founding star stays as the one per-row action.
 *
 * Data via react-query seeded with the server wrapper's initialData;
 * relative times gate on useNow() (hydration-safe).
 */

import React, { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowClockwise,
  CaretRight,
  CircleNotch,
  DownloadSimple,
  MagnifyingGlass,
  SortAscending,
  SortDescending,
  Star,
  Storefront,
  Warning,
  X,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { finiteOrNull, money } from '@/lib/seller/format-amount'
import { useNow } from '@/hooks/use-now'
import { useActiveSellers, useSellerStats, type SellerStatsSummary } from '@/hooks/use-active-sellers'
import type { ActiveSeller, ActiveSellerSort } from '@/lib/actions/admin-active-sellers'
import { setFoundingSeller } from '@/lib/actions/admin-sellers'
import { TIERS, TIER_KEYS, type SellerTier } from '@/lib/seller/tiers'
import { StatStrip } from '@/components/account/AccountSurface'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AdminEmpty, AdminLoadingRows, FilterChip, PageHeader, adminBtn, adminFieldCls, adminSelectCls } from '../../components/kit'
import { GameTile } from '../../components/GameTile'
import { TierChip } from '../../components/TierChip'

// ─── Types + constants ───────────────────────────────────────────────────────

type FilterStatus = 'all' | 'active' | 'restricted' | 'banned'
type FilterTier = 'all' | SellerTier

function relativeTime(iso: string | null | undefined, now: number | null): string {
  if (!iso || now == null) return ''
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const mins = Math.max(0, Math.round((now - then) / 60_000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

const SORT_OPTIONS: { key: ActiveSellerSort; label: string }[] = [
  { key: 'listings', label: 'Listings' },
  { key: 'sales', label: 'Sales' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'joined', label: 'Joined' },
  { key: 'last_active', label: 'Last Active' },
  { key: 'approved', label: 'Newest Approved' },
  { key: 'recent_listing', label: 'Recently Listed' },
]

// ─── Component ───────────────────────────────────────────────────────────────

export default function ActiveSellersPageClient({
  initialSellers,
  initialStats,
}: {
  /** Server-fetched seller list (unfiltered); undefined if the server fetch failed. */
  initialSellers?: ActiveSeller[]
  /** Server-fetched stats overview; undefined if the server fetch failed. */
  initialStats?: SellerStatsSummary
}) {
  const router = useRouter()
  const now = useNow()

  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [filterTier, setFilterTier] = useState<FilterTier>('all')
  const [pausedOnly, setPausedOnly] = useState(false)
  const [sortBy, setSortBy] = useState<ActiveSellerSort>('listings')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const sellersQuery = useActiveSellers(undefined, { initialData: initialSellers })
  const { data: statsData } = useSellerStats({ initialData: initialStats })

  const sellers = useMemo(() => sellersQuery.data ?? [], [sellersQuery.data])

  // ── Founding-seller toggle (grants/revokes the locked commission) ──
  const queryClient = useQueryClient()
  const [, startFoundingTransition] = useTransition()
  const [pendingFounding, setPendingFounding] = useState<string | null>(null)

  function handleToggleFounding(seller: ActiveSeller) {
    if (pendingFounding) return
    setPendingFounding(seller.id)
    startFoundingTransition(async () => {
      const res = await setFoundingSeller(seller.id, seller.founding_seller)
      if (!res.success) {
        console.error('[active-sellers] founding toggle failed:', res.error)
        window.alert(`Couldn't update founding status: ${res.error ?? 'unknown error'}`)
      } else {
        await queryClient.invalidateQueries({ queryKey: ['active-sellers'] })
      }
      setPendingFounding(null)
    })
  }

  // ── Filter + sort (client-side over the unfiltered fetch) ──
  const filteredSellers = useMemo(() => {
    let filtered = sellers

    if (filterStatus !== 'all') {
      filtered = filtered.filter((s) => s.seller_status === filterStatus)
    }
    if (filterTier !== 'all') {
      filtered = filtered.filter((s) => s.seller_tier === filterTier)
    }
    if (pausedOnly) {
      filtered = filtered.filter((s) => s.store_paused)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      filtered = filtered.filter(
        (s) =>
          s.username.toLowerCase().includes(q) ||
          (s.full_name || '').toLowerCase().includes(q) ||
          (s.shop_name || '').toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q),
      )
    }

    const value = (s: ActiveSeller): number => {
      switch (sortBy) {
        case 'sales':
          return s.stats.completed_sales
        case 'revenue':
          return s.stats.revenue
        case 'joined':
          return new Date(s.created_at).getTime()
        case 'last_active':
          return s.last_active_at ? new Date(s.last_active_at).getTime() : 0
        case 'approved':
          return s.approved_at ? new Date(s.approved_at).getTime() : 0
        case 'recent_listing':
          return s.latest_listing_at ? new Date(s.latest_listing_at).getTime() : 0
        case 'listings':
        default:
          return s.stats.active_listings
      }
    }
    const dir = sortOrder === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => (value(a) - value(b)) * dir)
  }, [sellers, filterStatus, filterTier, pausedOnly, searchQuery, sortBy, sortOrder])

  // ── CSV export of the filtered rows ──
  function handleExport() {
    const header = [
      'Shop Name',
      'Username',
      'Email',
      'Tier',
      'Status',
      'Active Listings',
      'Pending Listings',
      'Sales',
      'Revenue',
      'Founding',
      'Test',
      'Joined',
      'Last Active',
    ]
    const escapeCell = (v: string | number | boolean | null | undefined) => {
      const s = String(v ?? '')
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const lines = [
      header.join(','),
      ...filteredSellers.map((s) =>
        [
          s.shop_name || '',
          s.username,
          s.email,
          s.seller_tier,
          s.seller_status,
          s.stats.active_listings,
          s.stats.pending_listings,
          s.stats.completed_sales,
          (finiteOrNull(s.stats.revenue) ?? 0).toFixed(2),
          s.founding_seller,
          s.is_test,
          s.created_at,
          s.last_active_at || '',
        ]
          .map(escapeCell)
          .join(','),
      ),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `active-sellers-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const stats = statsData
  const filtered = searchQuery || filterStatus !== 'all' || filterTier !== 'all' || pausedOnly

  return (
    <div className="space-y-5">
      <PageHeader
        title="Active Sellers"
        description="Every seller account. Open one to manage tier, wallet, payouts and restrictions."
        actions={
          <button type="button" onClick={handleExport} className={adminBtn.secondary}>
            <DownloadSimple aria-hidden weight="bold" className="h-4 w-4" />
            Export CSV
          </button>
        }
        className="mb-0 sm:mb-0"
      />

      <StatStrip
        stats={[
          { label: 'Sellers', value: stats?.totalSellers ?? '—' },
          { label: 'Active Listings', value: stats?.totalActiveListings ?? '—' },
          { label: 'Revenue', value: stats ? money(stats.totalRevenue) : '—' },
          {
            label: 'Pending Withdrawals',
            value: (
              <span className={(stats?.pendingWithdrawals ?? 0) > 0 ? 'text-warning' : undefined}>
                {stats?.pendingWithdrawals ?? '—'}
              </span>
            ),
          },
        ]}
      />

      {/* Toolbar: search, then filters + sort (a swipe row on phones) */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative lg:w-[300px]">
          <MagnifyingGlass
            aria-hidden
            weight="bold"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary"
          />
          <input
            type="search"
            placeholder="Search name, email, shop…"
            aria-label="Search sellers"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(adminFieldCls, 'pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden')}
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearchQuery('')}
              className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-white/[0.06] hover:text-text-primary"
            >
              <X aria-hidden weight="bold" className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:px-0 lg:flex-1 [&::-webkit-scrollbar]:hidden">
          <select
            value={filterTier}
            onChange={(e) => {
              const v = e.target.value
              setFilterTier(v === 'all' || TIER_KEYS.includes(v as SellerTier) ? (v as FilterTier) : 'all')
            }}
            className={adminSelectCls}
            aria-label="Filter by tier"
          >
            <option value="all">All Tiers</option>
            {TIERS.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            className={adminSelectCls}
            aria-label="Filter by status"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="restricted">Restricted</option>
            <option value="banned">Banned</option>
          </select>

          <FilterChip selected={pausedOnly} onClick={() => setPausedOnly((v) => !v)}>
            Paused Only
          </FilterChip>

          <div className="flex shrink-0 items-center gap-1.5 lg:ml-auto">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as ActiveSellerSort)}
              className={adminSelectCls}
              aria-label="Sort by"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  Sort: {o.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
              aria-label={sortOrder === 'desc' ? 'Sorted descending' : 'Sorted ascending'}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-bg-raised text-text-secondary transition-colors hover:bg-bg-raised-hover hover:text-text-primary"
            >
              {sortOrder === 'desc' ? (
                <SortDescending aria-hidden weight="bold" className="h-4 w-4" />
              ) : (
                <SortAscending aria-hidden weight="bold" className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      {sellersQuery.isError ? (
        <AdminEmpty
          icon={Warning}
          tone="warning"
          title="Couldn’t load sellers"
          hint={(sellersQuery.error as Error)?.message || 'Something went wrong fetching sellers.'}
          action={
            <button
              type="button"
              onClick={() => sellersQuery.refetch()}
              disabled={sellersQuery.isFetching}
              className={adminBtn.secondary}
            >
              {sellersQuery.isFetching ? (
                <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowClockwise aria-hidden weight="bold" className="h-4 w-4" />
              )}
              Retry
            </button>
          }
        />
      ) : sellersQuery.isPending ? (
        <AdminLoadingRows rows={8} />
      ) : filteredSellers.length === 0 ? (
        <AdminEmpty
          icon={Storefront}
          title="No sellers found"
          hint={filtered ? 'Try another search or clear the filters.' : 'No seller accounts yet.'}
        />
      ) : (
        <div className="space-y-2">
          <p className="px-1 text-[12.5px] text-text-tertiary">
            Showing {filteredSellers.length} of {sellers.length} sellers
          </p>
          <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-lg bg-bg-raised">
            {filteredSellers.map((seller) => (
              <SellerRow
                key={seller.id}
                seller={seller}
                now={now}
                foundingBusy={pendingFounding === seller.id}
                onToggleFounding={() => handleToggleFounding(seller)}
                onOpen={() => router.push(`/admin/active-sellers/${seller.id}`)}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ─── Seller row ──────────────────────────────────────────────────────────────

const FLAG = 'inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold'

function SellerRow({
  seller,
  now,
  foundingBusy,
  onToggleFounding,
  onOpen,
}: {
  seller: ActiveSeller
  now: number | null
  foundingBusy: boolean
  onToggleFounding: () => void
  onOpen: () => void
}) {
  const name = seller.shop_name || seller.username
  const lastActive = relativeTime(seller.last_active_at, now)

  return (
    <li
      role="link"
      tabIndex={0}
      aria-label={`Open seller ${name}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      className="group flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03] focus-visible:bg-white/[0.04] focus-visible:outline-none"
    >
      <GameTile src={seller.avatar_url} name={name} className="h-10 w-10 rounded-md text-[14px]" />

      {/* Identity */}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <p className="min-w-0 truncate text-[14px] font-semibold text-text-primary">{name}</p>
          <TierChip tier={seller.seller_tier} />
          {seller.seller_status === 'restricted' && <span className={cn(FLAG, 'bg-error-bg text-error')}>Restricted</span>}
          {seller.seller_status === 'banned' && <span className={cn(FLAG, 'bg-error-bg text-error')}>Banned</span>}
          {seller.store_paused && <span className={cn(FLAG, 'bg-warning-bg text-warning')}>Paused</span>}
          {seller.founding_seller && <span className={cn(FLAG, 'bg-success-bg text-success')}>Founding</span>}
          {seller.is_test && <span className={cn(FLAG, 'bg-white/[0.07] text-text-secondary')}>Test</span>}
        </div>
        <p className="mt-0.5 truncate text-[12.5px] text-text-tertiary">
          @{seller.username} · {seller.email}
        </p>
        {/* Phones: the numbers under the name */}
        <p className="mt-0.5 text-[12.5px] tabular-nums text-text-secondary sm:hidden">
          {seller.stats.active_listings} active · {money(seller.stats.revenue)} · {seller.stats.completed_sales}{' '}
          {seller.stats.completed_sales === 1 ? 'sale' : 'sales'}
        </p>
      </div>

      {/* Listings */}
      <div className="hidden w-[110px] shrink-0 sm:block">
        <p className="text-[13.5px] font-semibold tabular-nums text-text-primary">
          {seller.stats.active_listings} <span className="text-[12px] font-normal text-text-tertiary">active</span>
        </p>
        {seller.stats.pending_listings > 0 && (
          <p className="text-[12px] tabular-nums text-warning">{seller.stats.pending_listings} pending</p>
        )}
      </div>

      {/* Revenue + sales */}
      <div className="hidden w-[120px] shrink-0 md:block">
        <p className="text-[13.5px] font-semibold tabular-nums text-text-primary">{money(seller.stats.revenue)}</p>
        <p className="text-[12px] tabular-nums text-text-tertiary">
          {seller.stats.completed_sales} {seller.stats.completed_sales === 1 ? 'sale' : 'sales'}
        </p>
      </div>

      {/* Last active */}
      <p className="hidden w-[84px] shrink-0 truncate text-[12.5px] text-text-tertiary lg:block">{lastActive || '—'}</p>

      {/* Founding toggle (the one per-row action) */}
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggleFounding()
            }}
            onKeyDown={(e) => e.stopPropagation()}
            disabled={foundingBusy}
            aria-label={seller.founding_seller ? 'Revoke founding-seller status' : 'Grant founding-seller status'}
            aria-pressed={seller.founding_seller}
            className={cn(
              'grid h-9 w-9 shrink-0 place-items-center rounded-md transition-colors disabled:opacity-50',
              seller.founding_seller
                ? 'text-warning hover:bg-warning-bg'
                : 'text-text-tertiary hover:bg-white/[0.06] hover:text-text-primary',
            )}
          >
            {foundingBusy ? (
              <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
            ) : (
              <Star aria-hidden weight={seller.founding_seller ? 'fill' : 'bold'} className="h-4 w-4" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent className="border-0 bg-bg-overlay-2 text-[12px]">
          {seller.founding_seller ? 'Revoke founding status' : 'Grant founding status (locks a reduced commission)'}
        </TooltipContent>
      </Tooltip>

      <CaretRight
        aria-hidden
        weight="bold"
        className="h-4 w-4 shrink-0 text-text-disabled transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-text-secondary"
      />
    </li>
  )
}

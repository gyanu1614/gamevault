'use client'

/**
 * Forest Ledger — /admin/active-sellers client.
 *
 * ONE compact forest frame (mirrors the moderation page): gradient header
 * band with the title + inline stat chips (real numbers), a toolbar row
 * (search / tier / status / paused / sort), then glass seller rows. The
 * ENTIRE row clicks through to /admin/active-sellers/{profile id} — the
 * seller-management detail. Founding star stays as the one per-row action;
 * Export downloads the filtered rows as CSV.
 *
 * Data via react-query seeded with the server wrapper's initialData;
 * relative times gate on useNow() (hydration-safe).
 */

import React, { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import {
  Search,
  Download,
  Store,
  Loader2,
  Award,
  AlertTriangle,
  RefreshCcw,
  ChevronRight,
  X,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNow } from '@/hooks/use-now'
import { useActiveSellers, useSellerStats, type SellerStatsSummary } from '@/hooks/use-active-sellers'
import type { ActiveSeller, ActiveSellerSort } from '@/lib/actions/admin-active-sellers'
import { setFoundingSeller } from '@/lib/actions/admin-sellers'
import { TIERS, TIER_KEYS, type SellerTier } from '@/lib/seller/tiers'
import { FOREST_BG, FOREST_MOTION, forestStagger } from '../../_theme/forest'

// ─── Types + constants ───────────────────────────────────────────────────────

type FilterStatus = 'all' | 'active' | 'restricted' | 'banned'
type FilterTier = 'all' | SellerTier

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A3E635] focus-visible:ring-offset-0'

const CHIP =
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[10.5px] font-bold'

const SELECT_CLASSES =
  'h-9 rounded-[10px] border border-white/[0.12] bg-white/[0.05] px-3 text-[12.5px] font-semibold text-white transition-colors hover:border-white/25 focus:border-[#A3E635] focus:outline-none [&>option]:bg-[#0F2419]'

/** Header-band gradient (top-lit) shared with the moderation frame. */
const BAND_STYLE: React.CSSProperties = {
  background:
    'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 42%), ' +
    FOREST_BG.listHeader,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(0,0,0,0.3)',
}

/** seller_tier_config badge_color → dark-surface chip classes (gemstone tokens). */
export const TIER_CHIP_CLASSES: Record<string, string> = {
  zinc: 'bg-white/[0.1] text-white/85',
  violet: 'bg-violet-500/[0.16] text-violet-300',
  red: 'bg-red-500/[0.16] text-red-300',
  blue: 'bg-blue-500/[0.16] text-blue-300',
  lime: 'bg-lime-500/[0.16] text-lime-300',
}

const TIER_BADGE_COLOR: Record<string, string> = Object.fromEntries(
  TIERS.map((t) => [t.key, t.colors.badgeColor]),
)

export function tierChipClass(tier: string, badgeColor?: string | null): string {
  const color = badgeColor || TIER_BADGE_COLOR[tier] || 'zinc'
  return cn(CHIP, TIER_CHIP_CLASSES[color] ?? TIER_CHIP_CLASSES.zinc)
}

function tierLabel(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1)
}

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

function money(n: number): string {
  return `$${n.toFixed(2)}`
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
          s.stats.revenue.toFixed(2),
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

  const statChips: { label: string; value: React.ReactNode; amber?: boolean }[] = [
    { label: 'Sellers', value: stats?.totalSellers ?? '—' },
    { label: 'Active Listings', value: stats?.totalActiveListings ?? '—' },
    {
      label: 'Revenue',
      value: stats ? money(stats.totalRevenue) : '—',
    },
    {
      label: 'Pending Withdrawals',
      value: stats?.pendingWithdrawals ?? '—',
      amber: (stats?.pendingWithdrawals ?? 0) > 0,
    },
  ]

  return (
    <div>
      <div className="mx-auto max-w-7xl">
        {/* ── The single forest frame ── */}
        <div
          className="overflow-hidden rounded-2xl border border-white/[0.09]"
          style={{ background: FOREST_BG.canvas }}
        >
          {/* Header band */}
          <div className="px-6 py-5" style={BAND_STYLE}>
            <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
              <div className="min-w-0">
                <h1 className="text-[24px] font-extrabold leading-tight tracking-tight text-white">
                  Active Sellers
                </h1>
                <p className="mt-0.5 text-[12px] text-white/85">
                  Every seller account — open one to manage tier, wallet, payouts and restrictions
                </p>
              </div>
              <button
                type="button"
                onClick={handleExport}
                className={cn(
                  'ml-auto inline-flex items-center gap-1.5 rounded-full border border-white/[0.14] px-4 py-2 text-[12px] font-bold text-white/70',
                  'transition-[transform,border-color,color] duration-150 hover:-translate-y-px hover:border-[#A3E635]/50 hover:text-white',
                  FOCUS_RING,
                )}
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </button>
            </div>

            {/* Slim stat strip */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {statChips.map((chip) => (
                <span
                  key={chip.label}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold',
                    chip.amber
                      ? 'border-[#F59E0B]/40 bg-[#F59E0B]/[0.14] text-[#FCD34D]'
                      : 'border-white/[0.1] bg-white/[0.05] text-white/85',
                  )}
                >
                  {chip.label}
                  <span
                    className={cn(
                      'font-extrabold tabular-nums',
                      chip.amber ? 'text-[#FCD34D]' : 'text-white/90',
                    )}
                  >
                    {chip.value}
                  </span>
                </span>
              ))}
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5 border-b border-white/[0.08] px-6 py-3">
            <div className="relative min-w-[200px] flex-1 sm:max-w-[280px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70" />
              <input
                type="text"
                placeholder="Search name, email, shop…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  'h-9 w-full rounded-[10px] border border-white/[0.12] bg-white/[0.05] pl-9 pr-8 text-[13px] text-white placeholder:text-white/70',
                  'transition-colors hover:border-white/25 focus:border-[#A3E635] focus:outline-none focus:ring-1 focus:ring-[#A3E635]/40',
                )}
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery('')}
                  className={cn(
                    'absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white',
                    FOCUS_RING,
                  )}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <select
              value={filterTier}
              onChange={(e) => {
                const v = e.target.value
                setFilterTier(
                  v === 'all' || TIER_KEYS.includes(v as SellerTier) ? (v as FilterTier) : 'all',
                )
              }}
              className={cn(SELECT_CLASSES, FOCUS_RING)}
              aria-label="Filter By Tier"
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
              className={cn(SELECT_CLASSES, FOCUS_RING)}
              aria-label="Filter By Status"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="restricted">Restricted</option>
              <option value="banned">Banned</option>
            </select>

            <button
              type="button"
              onClick={() => setPausedOnly((v) => !v)}
              aria-pressed={pausedOnly}
              className={cn(
                'h-9 whitespace-nowrap rounded-[10px] border px-3 text-[12.5px] font-bold transition-colors',
                FOCUS_RING,
                pausedOnly
                  ? 'border-[#F59E0B]/50 bg-[#F59E0B]/[0.16] text-[#FCD34D]'
                  : 'border-white/[0.12] text-white/85 hover:border-white/25 hover:text-white',
              )}
            >
              Paused Only
            </button>

            <div className="ml-auto flex items-center gap-1.5">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as ActiveSellerSort)}
                className={cn(SELECT_CLASSES, FOCUS_RING)}
                aria-label="Sort By"
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
                aria-label={sortOrder === 'desc' ? 'Sorted Descending' : 'Sorted Ascending'}
                className={cn(
                  'grid h-9 w-9 place-items-center rounded-[10px] border border-white/[0.12] text-white/85 transition-colors hover:border-white/25 hover:text-white',
                  FOCUS_RING,
                )}
              >
                {sortOrder === 'desc' ? (
                  <ArrowDownWideNarrow className="h-4 w-4" />
                ) : (
                  <ArrowUpNarrowWide className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 pb-5 pt-3">
            {sellersQuery.isError ? (
              <div
                className={cn(
                  'flex flex-col items-center rounded-[11px] border border-white/[0.08] bg-white/[0.04] px-6 py-10 text-center',
                  FOREST_MOTION.fadeIn,
                )}
              >
                <div className="grid h-12 w-12 place-items-center rounded-[14px] bg-[#F59E0B]/[0.14] ring-1 ring-[#F59E0B]/30">
                  <AlertTriangle className="h-6 w-6 text-[#FCD34D]" />
                </div>
                <p className="mt-3 text-[15px] font-extrabold text-white/95">
                  Couldn&apos;t Load Sellers
                </p>
                <p className="mx-auto mt-1 max-w-md text-[12.5px] text-white/85">
                  {(sellersQuery.error as Error)?.message || 'Something went wrong fetching sellers.'}
                </p>
                <button
                  type="button"
                  onClick={() => sellersQuery.refetch()}
                  disabled={sellersQuery.isFetching}
                  className={cn(
                    'mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/[0.14] px-4 py-2 text-[12px] font-bold text-white/70',
                    'transition-colors hover:border-[#A3E635]/50 hover:text-white disabled:opacity-50',
                    FOCUS_RING,
                  )}
                >
                  {sellersQuery.isFetching ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCcw className="h-3.5 w-3.5" />
                  )}
                  Retry
                </button>
              </div>
            ) : sellersQuery.isPending ? (
              <div className="px-6 py-10 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#A3E635] border-r-transparent" />
                <p className="mt-4 text-[13px] text-white/85">Loading active sellers…</p>
              </div>
            ) : filteredSellers.length === 0 ? (
              <div
                className={cn(
                  'flex flex-col items-center rounded-[11px] border border-white/[0.08] bg-white/[0.04] px-6 py-10 text-center',
                  FOREST_MOTION.fadeIn,
                )}
              >
                <div className="grid h-12 w-12 place-items-center rounded-[14px] bg-[#A3E635]/[0.12] ring-1 ring-[#A3E635]/25">
                  <Store className="h-6 w-6 text-[#A3E635]" />
                </div>
                <p className="mt-3 text-[15px] font-extrabold text-white/95">No Sellers Found</p>
                <p className="mt-1 text-[12.5px] text-white/85">
                  {searchQuery || filterStatus !== 'all' || filterTier !== 'all' || pausedOnly
                    ? 'Try adjusting your search or filters'
                    : 'No seller accounts yet'}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="px-1 text-[11px] font-semibold text-white/70">
                  Showing {filteredSellers.length} of {sellers.length} sellers
                </p>
                {filteredSellers.map((seller, index) => (
                  <SellerRow
                    key={seller.id}
                    seller={seller}
                    index={index}
                    now={now}
                    foundingBusy={pendingFounding === seller.id}
                    onToggleFounding={() => handleToggleFounding(seller)}
                    onOpen={() => router.push(`/admin/active-sellers/${seller.id}`)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Seller row ──────────────────────────────────────────────────────────────

function SellerRow({
  seller,
  index,
  now,
  foundingBusy,
  onToggleFounding,
  onOpen,
}: {
  seller: ActiveSeller
  index: number
  now: number | null
  foundingBusy: boolean
  onToggleFounding: () => void
  onOpen: () => void
}) {
  const name = seller.shop_name || seller.username
  const initial = (name.trim()[0] || 'S').toUpperCase()
  const lastActive = relativeTime(seller.last_active_at, now)

  return (
    <div
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
      className={cn(
        'flex cursor-pointer flex-wrap items-center gap-3 rounded-[14px] border border-white/[0.09] bg-white/[0.05] px-3.5 py-2.5 backdrop-blur-sm',
        'transition-[transform,box-shadow,background-color,border-color] duration-150 hover:-translate-y-[1px]',
        'hover:border-white/[0.14] hover:bg-white/[0.08] hover:shadow-[0_12px_30px_-18px_rgba(0,0,0,0.65)]',
        FOCUS_RING,
        FOREST_MOTION.fadeUp,
      )}
      style={forestStagger(Math.min(index, 10), 45)}
    >
      {/* Avatar / initial tile */}
      {seller.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={seller.avatar_url}
          alt={name}
          className="h-10 w-10 shrink-0 rounded-[10px] object-cover ring-1 ring-white/10"
        />
      ) : (
        <div
          className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] text-[14px] font-black text-[#A3E635]"
          style={{ background: FOREST_BG.storeTile }}
        >
          {initial}
        </div>
      )}

      {/* Identity */}
      <div className="min-w-[150px] flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-[13.5px] font-extrabold text-white/95">{name}</p>
          <span className={tierChipClass(seller.seller_tier)}>{tierLabel(seller.seller_tier)}</span>
          {seller.seller_status === 'restricted' && (
            <span className={cn(CHIP, 'bg-[#B42318]/20 text-[#FCA5A5]')}>Restricted</span>
          )}
          {seller.seller_status === 'banned' && (
            <span className={cn(CHIP, 'bg-[#B42318]/25 text-[#FCA5A5]')}>Banned</span>
          )}
          {seller.store_paused && (
            <span className={cn(CHIP, 'bg-[#F59E0B]/[0.16] text-[#FCD34D]')}>Paused</span>
          )}
          {seller.founding_seller && (
            <span className={cn(CHIP, 'bg-[#A3E635]/[0.15] text-[#D9F99D]')}>Founding</span>
          )}
          {seller.is_test && (
            <span className={cn(CHIP, 'bg-white/[0.1] text-white/85')}>Test</span>
          )}
        </div>
        <p className="mt-0.5 truncate text-[11.5px] text-white/70">
          @{seller.username} · {seller.email}
        </p>
      </div>

      {/* Listings */}
      <div className="hidden w-[120px] shrink-0 sm:block">
        <p className="text-[13px] font-bold tabular-nums text-white/90">
          {seller.stats.active_listings}{' '}
          <span className="text-[11px] font-semibold text-white/70">active</span>
        </p>
        {seller.stats.pending_listings > 0 && (
          <p className="text-[11px] font-semibold tabular-nums text-[#FCD34D]">
            · {seller.stats.pending_listings} pending
          </p>
        )}
      </div>

      {/* Sales + revenue */}
      <div className="hidden w-[130px] shrink-0 md:block">
        <p className="text-[13px] font-bold tabular-nums text-white/90">
          {money(seller.stats.revenue)}
        </p>
        <p className="text-[11px] font-semibold tabular-nums text-white/70">
          {seller.stats.completed_sales} {seller.stats.completed_sales === 1 ? 'sale' : 'sales'}
        </p>
      </div>

      {/* Last active */}
      <div className="hidden w-[90px] shrink-0 lg:block">
        <p className="truncate text-[11.5px] text-white/70">{lastActive || '—'}</p>
      </div>

      {/* Founding toggle (the one per-row action) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onToggleFounding()
        }}
        onKeyDown={(e) => e.stopPropagation()}
        disabled={foundingBusy}
        title={
          seller.founding_seller
            ? 'Revoke founding-seller status'
            : 'Grant founding-seller status (locks a reduced commission for life)'
        }
        aria-pressed={seller.founding_seller}
        className={cn(
          'shrink-0 rounded-lg p-1.5 transition-colors disabled:opacity-50',
          FOCUS_RING,
          seller.founding_seller
            ? 'text-[#F5C451] hover:bg-[#F5C451]/10'
            : 'text-white/70 hover:bg-white/[0.08] hover:text-white',
        )}
      >
        {foundingBusy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Award className="h-3.5 w-3.5" />
        )}
      </button>

      <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
    </div>
  )
}

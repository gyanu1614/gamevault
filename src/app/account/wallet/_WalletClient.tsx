'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import AccountPageHeader from '@/components/account/AccountPageHeader'
import { useSellerEarnings } from '@/hooks/use-seller-earnings'
import { createClient } from '@/lib/supabase/client'
import { fetchAllRows, chunk } from '@/lib/db/fetch-all'
import { orderItemImage, orderItemTitle, type CurrencyTitleConfig } from '@/lib/orders/display-title'
import { withOwnOrderFields } from '@/lib/orders/own-fields'
import { createTopUpCheckout } from '@/lib/actions/wallet'
import { WALLET_TOPUP_ENABLED } from '@/lib/config/purchases'
// Ledger-backed balance (funds-flow cutover): refund credits post to the
// ledger wallet, which the legacy wallet_balances float table never sees.
import { getMyWalletBalance } from '@/lib/actions/wallet-ledger'
import { getLoyaltyStats } from '@/lib/actions/loyalty'
import { getMyWithdrawalRequests } from '@/lib/actions/withdrawals'
import Link from 'next/link'
import {
  Wallet,
  ShoppingCart,
  TrendingUp,
  Search,
  X,
  Loader2,
  CreditCard,
  Package,
  ExternalLink,
  ChevronRight,
  Zap,
  User,
  Plus,
  ArrowDownToLine,
  AlertTriangle,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import WithdrawalRequestCard from '@/components/wallet/WithdrawalRequestCard'
import { lifetimeSpentOf, matchesPurchaseFilter, saleRowAmounts } from '@/lib/wallet/wallet-rows'
import { WalletSkeleton } from './_WalletSkeleton'
import { OrderStatusPill } from '@/components/account/OrderStatusPill'
import { SegmentedTabs } from '@/components/account/SegmentedTabs'
import { accountInputCls } from '@/components/account/AccountSurface'

// ── Types ──────────────────────────────────────────────────────────────────────

type Tab = 'purchases' | 'earnings' | 'payouts'

interface PurchaseTransaction {
  id: string
  amount: number
  platformFee: number
  netAmount: number
  status: 'completed' | 'processing' | 'pending' | 'failed'
  title: string
  orderId: string
  orderNumber?: string
  createdAt: string
  gameName?: string
  gameEmoji?: string
  gameImageUrl?: string | null
  listingImageUrl?: string | null
  categoryName?: string
}

// ── Fetch buyer purchase history ───────────────────────────────────────────────

async function fetchPurchases(userId: string) {
  const supabase = createClient()

  // Paged: one PostgREST response stops at 1000 rows, silently.
  const { data: rawOrders, error } = await fetchAllRows<any>((from, to) =>
    supabase
      .from('orders')
      .select(`
        id,
        order_number,
        total_amount,
        status,
        created_at,
        quantity,
        listing:listing_id (
          title,
          images,
          game_id,
          bundle_id,
          game:game_id (name, emoji, image_url),
          category:game_categories!listings_game_category_id_fkey (name, type)
        )
      `)
      .eq('buyer_id', userId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to),
  )

  if (error) {
    console.error('[Wallet] Failed to fetch purchases:', error)
    throw error
  }

  const orders = (rawOrders || []) as any[]
  const currencyCfgs = await currencyConfigsFor(supabase, orders)

  const transactions: PurchaseTransaction[] = orders.map(order => {
    const listing = order.listing as any
    const item = itemOf(order, currencyCfgs)
    return {
      id: order.id,
      amount: order.total_amount || 0,
      // The buyer's row shows what THEY paid. platform_fee / seller_payout are
      // the seller's commission and payout, not the buyer's business.
      platformFee: 0,
      netAmount: 0,
      status: order.status as any,
      title: item.title,
      orderId: order.id,
      orderNumber: order.order_number,
      createdAt: order.created_at,
      gameName: listing?.game?.name,
      gameEmoji: listing?.game?.emoji,
      gameImageUrl: listing?.game?.image_url,
      listingImageUrl: item.image,
      categoryName: listing?.category?.name,
    }
  }) as any

  const lifetimeSpent = lifetimeSpentOf(orders)

  return { transactions, lifetimeSpent }
}

// ── Fetch seller sales history (with game/category) ───────────────────────────

interface SaleTransaction {
  id: string
  orderId: string
  orderNumber: string
  buyerUsername: string
  amount: number
  platformFee: number
  netAmount: number
  status: string
  createdAt: string
  listingTitle: string
  gameName?: string
  gameEmoji?: string
  gameImageUrl?: string | null
  listingImageUrl?: string | null
  categoryName?: string
}

async function fetchSales(userId: string): Promise<SaleTransaction[]> {
  const supabase = createClient()

  const { data, error } = await fetchAllRows<any>((from, to) =>
    supabase
      .from('orders')
      .select(`
        id,
        order_number,
        subtotal,
        total_amount,
        status,
        created_at,
        quantity,
        buyer:profiles!buyer_id(username),
        listing:listing_id (
          title,
          images,
          game_id,
          bundle_id,
          game:game_id (name, emoji, image_url),
          category:game_categories!listings_game_category_id_fkey (name, type)
        )
      `)
      .eq('seller_id', userId)
      // Every PAID sale, whatever happened next. (Was: 'processing' and
      // 'confirmed', which are not order statuses, and delivering / disputed /
      // refunded sales silently vanished.)
      .in('status', ['paid', 'delivering', 'delivered', 'disputed', 'completed', 'refunded'])
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to),
  )

  if (error) {
    console.error('[fetchSales] Error:', error)
    throw error
  }

  // seller_payout is the seller's private column: merged in, not selected.
  const rows = (await withOwnOrderFields(supabase, 'seller', (data || []) as any[])) as any[]

  // A partial refund completes the order but pays the seller less: what they
  // kept is dispute_resolutions.seller_payout_amount (latest resolved dispute).
  const kept = new Map<string, number>()
  const completedIds = rows.filter((o) => o.status === 'completed').map((o) => o.id)
  // 100 ids per request: a long .in() list overflows the URL.
  const partialRows = (
    await Promise.all(
      chunk(completedIds).map(async (ids) => {
        const { data: part } = await supabase
          .from('disputes')
          .select('transaction_id, resolved_at, resolution:dispute_resolutions(seller_payout_amount, resolution_type)')
          .in('transaction_id', ids)
          .eq('status', 'resolved_partial')
          .order('resolved_at', { ascending: true }) as any
        return (part ?? []) as any[]
      }),
    )
  ).flat()
  // Oldest first, so the latest resolution per order wins below.
  partialRows.sort((a, b) => String(a.resolved_at ?? '').localeCompare(String(b.resolved_at ?? '')))
  for (const d of partialRows) {
    const r = Array.isArray(d.resolution) ? d.resolution[0] : d.resolution
    if (r?.resolution_type === 'partial_refund' && r.seller_payout_amount != null) {
      kept.set(d.transaction_id, Number(r.seller_payout_amount))
    }
  }

  const currencyCfgs = await currencyConfigsFor(supabase, rows)
  return rows.map(order => {
    const { amount, platformFee, netAmount } = saleRowAmounts(order, kept.get(order.id))
    return {
    id: order.id,
    orderId: order.id,
    orderNumber: order.order_number || `#${order.id.slice(0, 8)}`,
    buyerUsername: order.buyer?.username || 'Unknown',
    amount,
    platformFee,
    netAmount,
    status: order.status,
    createdAt: order.created_at,
    listingTitle: itemOf(order, currencyCfgs).title,
    gameName: order.listing?.game?.name,
    gameEmoji: order.listing?.game?.emoji,
    gameImageUrl: order.listing?.game?.image_url,
    listingImageUrl: itemOf(order, currencyCfgs).image,
    categoryName: order.listing?.category?.name,
    }
  })
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Currency configs (name, icon, bundles) for the currency games in `orders`,
 *  so each row names what was sold ("50 Diamonds") like the order page. */
async function currencyConfigsFor(
  supabase: ReturnType<typeof createClient>,
  orders: any[],
): Promise<Record<string, CurrencyTitleConfig>> {
  const ids = Array.from(
    new Set(
      orders
        .filter((o) => o.listing?.category?.type === 'currency' && o.listing?.game_id)
        .map((o) => o.listing.game_id as string),
    ),
  )
  if (ids.length === 0) return {}
  const out: Record<string, CurrencyTitleConfig> = {}
  for (const part of chunk(ids)) {
    const { data } = await supabase
      .from('category_configs')
      .select('game_id, unit_label:config->>unit_label, quantity_granularity:config->>quantity_granularity, currency_icon_url:config->>currency_icon_url, bundles:config->bundles')
      .eq('category_type', 'currency')
      .in('game_id', part)
    for (const r of (data ?? []) as any[]) out[r.game_id] = r
  }
  return out
}

function itemOf(order: any, cfgs: Record<string, CurrencyTitleConfig>) {
  const listing = order.listing ?? {}
  const cfg = listing.game_id ? cfgs[listing.game_id] ?? null : null
  const categoryType = listing.category?.type ?? null
  return {
    title: orderItemTitle({
      listingTitle: listing.title ?? 'Game Item',
      quantity: order.quantity ?? 1,
      categoryType,
      currencyConfig: cfg,
      bundleId: listing.bundle_id ?? null,
    }),
    image: orderItemImage({
      categoryType,
      currencyConfig: cfg,
      bundleId: listing.bundle_id ?? null,
      listingImage: Array.isArray(listing.images) ? listing.images[0] ?? null : null,
    }),
  }
}

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function fmtDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Game icon ─────────────────────────────────────────────────────────────────

function GameIcon({ emoji, imageUrl, size = 10 }: { emoji?: string; imageUrl?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false)
  const cls = `h-${size} w-${size} flex-shrink-0`
  if (imageUrl && !failed) {
    return (
      <img
        src={imageUrl}
        alt=""
        className={`${cls} rounded-lg object-cover`}
        onError={() => setFailed(true)}
      />
    )
  }
  return (
    <div className={`${cls} rounded-lg bg-bg-raised-hover border border-border-subtle flex items-center justify-center text-xl`}>
      {emoji || '🎮'}
    </div>
  )
}

// ── Load error (instead of an empty list or an endless skeleton) ─────────────

function LoadError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center px-4 py-16 text-center">
      <AlertTriangle className="mb-3 h-8 w-8 text-amber-400" aria-hidden />
      <p className="text-sm font-medium text-text-secondary">We couldn&apos;t load {what}.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex min-h-[40px] items-center rounded-lg border border-border-default px-4 text-sm font-semibold text-text-primary transition-colors hover:bg-white/[0.04]"
      >
        Try Again
      </button>
    </div>
  )
}

// ── Compact stat card ──────────────────────────────────────────────────────────

/** One balance in the wallet's top panel: small label, big figure, one-line note. */
function BalanceCell({ label, value, caption }: { label: string; value: number; caption: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11.5px] font-semibold uppercase tracking-wider text-text-tertiary">{label}</p>
      <p className="mt-1 text-[28px] font-bold leading-tight tabular-nums text-text-primary">${(value ?? 0).toFixed(2)}</p>
      <p className="mt-1 text-[12px] text-text-secondary">{caption}</p>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

interface Props {
  /** Resolved server-side, so the five queries below fan out immediately. */
  userId: string
  /** Resolved server-side, so the opening tab is right on first paint. */
  isSeller: boolean
}

export default function WalletClient({ userId, isSeller }: Props) {
  // STATE-008 — the opening tab is known on the server, so it is the initial
  // state rather than something a useEffect corrects after hydration (which
  // showed buyers the wrong tab for a frame).
  const [activeTab, setActiveTab] = useState<Tab>(isSeller ? 'earnings' : 'purchases')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [isTopUpLoading, setIsTopUpLoading] = useState(false)

  const { data: purchaseData, isLoading: purchasesLoading, error: purchasesError, refetch: refetchPurchases } = useQuery({
    queryKey: ['wallet-purchases', userId],
    queryFn: () => fetchPurchases(userId),
    refetchOnWindowFocus: false,
    retry: 1,
  })

  const { data: salesData, isLoading: salesLoading, error: salesError, refetch: refetchSales } = useQuery({
    queryKey: ['wallet-sales', userId],
    queryFn: async () => {
      return fetchSales(userId)
    },
    enabled: isSeller,
    refetchOnWindowFocus: false,
    retry: 1,
  })

  // Fetch wallet balance (ledger-derived — the source refund credits post to)
  const { data: walletData, isLoading: walletLoading, error: walletError, refetch: refetchWallet } = useQuery({
    queryKey: ['wallet-balance', userId],
    queryFn: async () => {
      const result = await getMyWalletBalance()
      if (!result.success) {
        console.error('[Wallet] Balance fetch failed:', result.error)
        throw new Error(result.error || 'Failed to fetch wallet balance')
      }
      return result.balance
    },
    refetchOnWindowFocus: false,
    retry: 1,
  })

  // Fetch loyalty stats for accurate cashback
  const { data: loyaltyStats, isLoading: loyaltyLoading, error: loyaltyError } = useQuery({
    queryKey: ['loyalty-stats', userId],
    queryFn: async () => {
      const result = await getLoyaltyStats()
      if (!result.success || !result.data) {
        console.error('[Wallet] Loyalty stats fetch failed:', result.error)
        return null
      }
      return result.data
    },
    refetchOnWindowFocus: false,
    retry: 1,
  })

  // Fetch withdrawal requests
  const { data: withdrawalRequestsData, isLoading: withdrawalsLoading, refetch: refetchWithdrawals } = useQuery({
    queryKey: ['withdrawal-requests', userId],
    queryFn: async () => {
      const result = await getMyWithdrawalRequests()
      if (!result.success) {
        console.error('[Wallet] Withdrawal requests fetch failed:', result.error)
        return []
      }
      return result.requests || []
    },
    refetchOnWindowFocus: false,
    retry: 1,
  })

  const { stats: earningsStats, payouts, isLoading: earningsLoading } = useSellerEarnings()

  // Handle top-up
  const handleTopUp = async (amount: number) => {
    setIsTopUpLoading(true)
    const result = await createTopUpCheckout(amount)
    setIsTopUpLoading(false)

    if (result.success && result.url) {
      window.location.href = result.url
    } else {
      toast.error(result.error || 'Failed to create top-up')
    }
  }

  const isLoading = purchasesLoading || walletLoading || (isSeller && (salesLoading || earningsLoading))

  // Stable when the query data is: the list memos below depend on these.
  const purchases = useMemo(() => purchaseData?.transactions ?? [], [purchaseData])
  const sales = useMemo(() => salesData ?? [], [salesData])
  const lifetimeSpent = purchaseData?.lifetimeSpent || 0
  const walletBalance = walletData || {
    available_balance: 0,
    pending_balance: 0,
    lifetime_earned: 0,
    lifetime_spent: 0,
    total_cashback: 0,
    referral_earnings: 0,
  }

  const filteredPurchases = useMemo(() => {
    return purchases.filter(t => {
      const matchStatus = matchesPurchaseFilter(t.status, filterStatus)
      const matchSearch = !searchQuery ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.orderNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.gameName || '').toLowerCase().includes(searchQuery.toLowerCase())
      return matchStatus && matchSearch
    })
  }, [purchases, filterStatus, searchQuery])

  const filteredSales = useMemo(() => {
    return sales.filter(txn => {
      if (!searchQuery) return true
      return (
        txn.listingTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        txn.orderNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        txn.buyerUsername?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (txn.gameName || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    })
  }, [sales, searchQuery])

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = isSeller
    ? [
        { id: 'earnings',  label: 'Sales',     icon: TrendingUp },
        { id: 'purchases', label: 'Purchases', icon: ShoppingCart },
        { id: 'payouts',   label: 'Payouts',   icon: CreditCard },
      ]
    : [
        { id: 'purchases', label: 'Purchases', icon: ShoppingCart },
      ]

  // STATE-008 — the auth-loading branch is gone: isSeller arrives from the
  // server, so there is no window in which the buyer UI could flash for a
  // seller, and no auth round-trip to wait out before the data loads. Only the
  // genuine data-readiness checks remain.
  {
    if (isSeller) {
      // Seller: Must have both wallet and earnings loaded
      // Same skeleton as the route fallback (loading.tsx), so the page
      // doesn't swap skeleton → spinner → content.
      if (walletError && !walletData) {
        return <LoadError what="your wallet" onRetry={() => void refetchWallet()} />
      }
      if (!walletData || earningsLoading) {
        return <WalletSkeleton isSeller />
      }
    } else {
      // Buyer: Only needs wallet data
      if (walletError && !walletData) {
        return <LoadError what="your wallet" onRetry={() => void refetchWallet()} />
      }
      if (!walletData) {
        return <WalletSkeleton isSeller={false} />
      }
    }
  }

  return (
    <div className="pb-12">
      <div className="mx-auto w-full max-w-full px-4 sm:px-6 md:max-w-7xl lg:px-8">
        {/* ── Header ── */}
        <div className="mb-6">
          <AccountPageHeader
            icon="wallet"
            title="Wallet"
            subtitle="Purchases, sales & payouts"
            className="mb-4"
          />

          {/* Balances — ONE panel, no outline (owner, 2026-09-28: the page
              was five boxes of numbers). Sellers: Available (+ Withdraw),
              Store Credit, Pending; buyers: their store-credit balance.
              A thin line underneath carries the running totals. */}
          <div className="overflow-hidden rounded-lg bg-bg-raised">
            {isSeller ? (
              <div className="grid divide-y divide-white/[0.07] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                <div className="flex items-start justify-between gap-3 p-5">
                  <BalanceCell label="Available Balance" value={earningsStats.available_balance} caption="Ready to withdraw." />
                  <Link
                    href="/account/wallet/withdraw"
                    className={cn(
                      'inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-md bg-lime px-3.5 text-[13px] font-semibold text-text-inverse transition-colors hover:bg-lime-hover',
                      // Withdrawals draw on sales AND store credit (withdrawal_quote:
                      // matured + wallet), as the withdraw page shows.
                      earningsStats.available_balance + walletBalance.available_balance <= 0 &&
                        'pointer-events-none opacity-50',
                    )}
                  >
                    <ArrowDownToLine className="h-4 w-4" />
                    Withdraw
                  </Link>
                </div>
                {/* Refunds and cashback land in the buyer wallet, not in sales
                    earnings; withdrawals can draw on it too. */}
                <div className="p-5">
                  <BalanceCell label="Store Credit" value={walletBalance.available_balance} caption="Refunds. Spend it at checkout or withdraw it." />
                </div>
                <div className="p-5">
                  <BalanceCell label="Pending Sales" value={earningsStats.pending_balance} caption="Credited once the buyer confirms delivery." />
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-4 p-5">
                <BalanceCell label="Balance" value={walletBalance.available_balance} caption="Refunds and credit. Spend it at checkout." />
                {/* Top-up stays gated behind its own flag even after
                    purchases open (compliance — lib/config/purchases). */}
                {WALLET_TOPUP_ENABLED && (
                  <div className="flex w-full gap-2 sm:w-auto">
                    {[25, 50].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => handleTopUp(amt)}
                        disabled={isTopUpLoading}
                        className={cn(
                          'flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-md px-4 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed sm:flex-none',
                          amt === 25
                            ? 'bg-lime text-text-inverse hover:bg-lime-hover'
                            : 'border border-border-default bg-white/[0.03] text-text-primary hover:border-border-strong',
                        )}
                      >
                        {isTopUpLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Plus className="h-3.5 w-3.5" />${amt}</>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-white/[0.07] px-5 py-3 text-[12.5px]">
              {(isSeller
                ? [
                    { label: 'This Month', value: `$${(earningsStats.this_month_earnings ?? 0).toFixed(2)}` },
                    { label: 'Lifetime Earned', value: `$${(earningsStats.total_earnings ?? 0).toFixed(2)}` },
                    { label: 'Withdrawn', value: `$${(earningsStats.total_payouts ?? 0).toFixed(2)}` },
                  ]
                : [
                    { label: 'Total Spent', value: `$${lifetimeSpent.toFixed(2)}` },
                    { label: 'Completed', value: purchases.filter((t) => t.status === 'completed').length.toString() },
                    { label: 'Total Orders', value: purchases.length.toString() },
                  ]
              ).map((st) => (
                <span key={st.label} className="whitespace-nowrap">
                  <span className="text-text-tertiary">{st.label}</span>{' '}
                  <span className="font-semibold tabular-nums text-text-primary">{st.value}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

      {/* ── Tabs: the shared compact control with the sliding pill ── */}
      <SegmentedTabs
        className="mb-3"
        tabs={tabs.map((tab) => {
          const Icon = tab.icon
          return { id: tab.id, label: <><Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />{tab.label}</> }
        })}
        value={activeTab}
        onChange={(id) => { setActiveTab(id); setSearchQuery(''); setFilterStatus('all') }}
        layoutId="wallet-tab-pill"
        ariaLabel="Wallet sections"
      />

      {/* ── Search + Filter bar ── */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" aria-hidden />
          <input
            type="text"
            placeholder={activeTab === 'purchases' ? 'Search by item, game, order…' : 'Search by item, buyer, order…'}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            aria-label="Search transactions"
            className={cn(accountInputCls, 'h-10 bg-bg-raised py-0 pl-9 pr-9')}
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear search" className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-text-tertiary transition-colors hover:text-text-primary">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {activeTab === 'purchases' && (
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            aria-label="Filter by status"
            className={cn(accountInputCls, 'h-10 w-auto bg-bg-raised py-0 pr-8 text-[13px] sm:text-[13px]')}
          >
            <option value="all">All Status</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="pending">Awaiting Payment</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
          </select>
        )}
      </div>

      {/* ════════════════ TAB: PURCHASES ════════════════ */}
      {activeTab === 'purchases' && (
        <div className="overflow-hidden rounded-lg bg-bg-raised">
          {purchasesError && !purchaseData ? (
            <LoadError what="your purchases" onRetry={() => void refetchPurchases()} />
          ) : filteredPurchases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ShoppingCart className="h-10 w-10 text-text-tertiary mb-3" />
              <p className="text-sm font-medium text-text-secondary">
                {searchQuery || filterStatus !== 'all' ? 'No matching purchases' : 'No purchases yet'}
              </p>
              <p className="text-xs text-text-disabled mt-1">
                {searchQuery || filterStatus !== 'all' ? 'Try adjusting your search or filters' : 'Browse listings and make your first purchase'}
              </p>
              {!searchQuery && filterStatus === 'all' && (
                <Link href="/" className="mt-4 rounded-lg bg-lime hover:bg-lime-hover px-5 py-2 text-sm font-medium text-text-inverse transition-colors">
                  Browse Listings
                </Link>
              )}
            </div>
          ) : (
            <div className="divide-y divide-white/[0.07]">
              {filteredPurchases.map((txn, i) => (
                <motion.div
                  key={txn.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Link
                    href={`/account/orders/${txn.orderId}`}
                    className="group flex items-center gap-3 px-4 py-4 transition-colors hover:bg-white/[0.03] sm:gap-4 sm:px-5"
                  >
                    {/* Listing image (fallback to game icon) */}
                    <GameIcon emoji={txn.gameEmoji} imageUrl={txn.listingImageUrl || txn.gameImageUrl} size={10} />

                    {/* Item details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-0.5">
                        {txn.gameName && (
                          <span className="truncate max-w-[16ch] text-[11.5px] font-bold text-lime-text uppercase tracking-[0.14em]">{txn.gameName}</span>
                        )}
                        {txn.categoryName && (
                          <>
                            <span className="text-text-tertiary">·</span>
                            <span className="text-[11px] text-text-tertiary">{txn.categoryName}</span>
                          </>
                        )}
                      </div>
                      <p className="text-sm font-medium text-white truncate leading-snug">{txn.title}</p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                        {txn.orderNumber && (
                          <span className="truncate max-w-[14ch] text-[11px] text-lime-text">#{txn.orderNumber}</span>
                        )}
                        <span className="text-[11px] text-text-tertiary">{timeAgo(txn.createdAt)}</span>
                      </div>
                    </div>

                    {/* Right side: Status + Price breakdown */}
                    <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                      <OrderStatusPill status={txn.status} />
                      <div className="text-right">
                        <div className="text-base font-bold text-white">${txn.amount.toFixed(2)}</div>
                        {txn.platformFee > 0 && (
                          <div className="text-xs text-text-disabled">
                            fee <span className="text-[color-mix(in_srgb,var(--color-error)_70%,transparent)]">-${txn.platformFee.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-text-tertiary group-hover:text-text-secondary flex-shrink-0 transition-colors" />
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}


      {/* ════════════════ TAB: SALES ════════════════ */}
      {activeTab === 'earnings' && (
        <div className="overflow-hidden rounded-lg bg-bg-raised">
          {salesLoading ? (
            <div className="divide-y divide-white/[0.07]" aria-busy>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-4 sm:px-5">
                  <div className="skeleton h-10 w-10 shrink-0 rounded-md" />
                  <div className="flex-1 space-y-1.5">
                    <div className="skeleton h-3 w-24 rounded" />
                    <div className="skeleton h-4 w-48 max-w-full rounded" />
                  </div>
                  <div className="skeleton h-6 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ) : salesError && !salesData ? (
            <LoadError what="your sales" onRetry={() => void refetchSales()} />
          ) : filteredSales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <Package className="h-10 w-10 text-text-tertiary mb-3" />
              <p className="text-sm font-medium text-text-secondary">{searchQuery ? 'No matching sales' : 'No sales yet'}</p>
              <p className="text-xs text-text-disabled mt-1 mb-4">
                {searchQuery ? 'Try adjusting your search' : 'Start listing items to earn money'}
              </p>
              {!searchQuery && (
                <Link
                  href="/sell/new"
                  className="inline-flex items-center gap-2 rounded-lg bg-lime text-text-inverse hover:bg-lime-hover px-4 py-2 text-sm font-semibold transition-all"
                >
                  <Plus className="h-4 w-4" />
                  Create Listing
                </Link>
              )}
            </div>
          ) : (
            <div className="divide-y divide-white/[0.07]">
              {filteredSales.map((txn, i) => (
                <motion.div
                  key={txn.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Link
                    href={`/account/orders/${txn.orderId}`}
                    className="group flex items-center gap-3 px-4 py-4 transition-colors hover:bg-white/[0.03] sm:gap-4 sm:px-5"
                  >
                    {/* Listing image (fallback to game icon) */}
                    <GameIcon emoji={txn.gameEmoji} imageUrl={txn.listingImageUrl || txn.gameImageUrl} size={10} />

                    {/* Item details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-0.5">
                        {txn.gameName && (
                          <span className="truncate max-w-[16ch] text-[11.5px] font-bold text-lime-text uppercase tracking-[0.14em]">{txn.gameName}</span>
                        )}
                        {txn.categoryName && (
                          <>
                            <span className="text-text-tertiary">·</span>
                            <span className="text-[11px] text-text-tertiary">{txn.categoryName}</span>
                          </>
                        )}
                      </div>
                      <p className="text-sm font-medium text-white truncate leading-snug">{txn.listingTitle}</p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                        <User className="h-3 w-3 text-text-disabled flex-shrink-0" />
                        <span className="truncate max-w-[12ch] text-[11px] text-text-secondary font-medium">{txn.buyerUsername}</span>
                        <span className="text-text-tertiary">·</span>
                        <span className="truncate max-w-[14ch] text-[11px] text-lime-text">#{txn.orderNumber}</span>
                        <span className="text-text-tertiary max-sm:hidden">·</span>
                        <span className="text-[11px] text-text-tertiary max-sm:hidden">{timeAgo(txn.createdAt)}</span>
                      </div>
                    </div>

                    {/* Right: status + price breakdown */}
                    <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                      <OrderStatusPill status={txn.status} />
                      <div className="text-right">
                        <div className="text-base font-bold text-success">+${txn.netAmount.toFixed(2)}</div>
                        {txn.platformFee > 0 && (
                          <div className="text-xs text-text-disabled">
                            sale <span className="text-text-secondary">${txn.amount.toFixed(2)}</span>
                            {' '}· fee <span className="text-[color-mix(in_srgb,var(--color-error)_70%,transparent)]">-${txn.platformFee.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-text-tertiary group-hover:text-text-secondary flex-shrink-0 transition-colors" />
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════ TAB: PAYOUTS ════════════════ */}
      {activeTab === 'payouts' && (
        <div className="overflow-hidden rounded-lg bg-bg-raised">
          {/* Where withdrawals go */}
          {isSeller && (
            <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] bg-[rgba(86,184,127,0.05)] px-5 py-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-lime-text flex-shrink-0" />
                <span className="text-xs text-text-secondary">Withdrawals Are Paid In Crypto</span>
              </div>
              <Link
                href="/account/wallet/withdraw"
                className="flex items-center gap-1.5 text-xs font-medium text-lime-text hover:text-lime-text transition-colors whitespace-nowrap"
              >
                Request Withdrawal <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          )}

          {payouts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CreditCard className="h-10 w-10 text-text-tertiary mb-3" />
              <p className="text-sm font-medium text-text-secondary">No payouts yet</p>
              <p className="text-xs text-text-disabled mt-1">Payouts appear once you&apos;ve completed sales</p>
            </div>
          ) : (
            <>
              {/* The "Export" button here had no handler; removed (2026-09-29). */}
              <div className="border-b border-white/[0.07] px-5 py-3">
                <span className="text-[12.5px] text-text-tertiary">{payouts.length} payout{payouts.length !== 1 ? 's' : ''}</span>
              </div>

              <div className="divide-y divide-white/[0.07]">
                {payouts.map((payout, i) => (
                  <motion.div
                    key={payout.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center gap-3 px-4 py-4 sm:gap-4 sm:px-5"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-bg-overlay">
                      <CreditCard className="h-4 w-4 text-text-secondary" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{fmtDate(payout.created_at)}</p>
                      <p className="text-[11px] text-text-tertiary mt-0.5">{payout.method}</p>
                    </div>

                    <div className="flex-shrink-0 flex flex-col items-end gap-1">
                      <span className={cn(
                        'inline-flex h-6 items-center rounded-full border px-2 text-[12px] font-semibold capitalize',
                        payout.status === 'completed' ? 'bg-success-bg text-success border-green-500/20'
                          : payout.status === 'pending' ? 'bg-warning-bg text-warning border-[color-mix(in_srgb,var(--color-warning)_30%,transparent)]'
                          : 'bg-error-bg text-error border-[color-mix(in_srgb,var(--color-error)_40%,transparent)]'
                      )}>
                        {payout.status}
                      </span>
                      <span className="text-sm font-semibold text-white">${payout.amount.toFixed(2)}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Withdrawal Requests (Sellers Only) — straight rows in one panel ── */}
      {isSeller && withdrawalRequestsData && withdrawalRequestsData.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2.5 text-[15px] font-bold text-text-primary">Withdrawal Requests</h2>
          <div className="overflow-hidden rounded-lg bg-bg-raised">
            <div className="hidden grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,0.8fr))_auto_auto] gap-x-4 border-b border-white/[0.07] px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-text-tertiary sm:grid">
              <span>Method</span>
              <span className="text-right">Amount</span>
              <span className="text-right">Fee</span>
              <span className="text-right">You Receive</span>
              <span className="text-right">Status</span>
              <span className="w-[62px]" aria-hidden />
            </div>
            <div className="divide-y divide-white/[0.06]">
              {withdrawalRequestsData.map((request) => (
                <WithdrawalRequestCard
                  key={request.id}
                  request={request}
                  onUpdate={refetchWithdrawals}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  )
}

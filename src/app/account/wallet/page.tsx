'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import AccountPageHeader from '@/components/account/AccountPageHeader'
import { useSellerEarnings } from '@/hooks/use-seller-earnings'
import { createClient } from '@/lib/supabase/client'
import { createTopUpCheckout } from '@/lib/actions/wallet'
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
  DollarSign,
  CheckCircle2,
  Search,
  X,
  Loader2,
  Download,
  CreditCard,
  Clock,
  Package,
  ExternalLink,
  ChevronRight,
  Zap,
  CircleDot,
  CircleCheck,
  CircleX,
  CircleDashed,
  User,
  Plus,
  Gift,
  Sparkles,
  ArrowDownToLine,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import WithdrawalRequestCard from '@/components/wallet/WithdrawalRequestCard'

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

  const { data: rawOrders, error } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      total_amount,
      platform_fee,
      seller_payout,
      status,
      created_at,
      listing:listing_id (
        title,
        images,
        game:game_id (name, emoji, image_url),
        category:category_id (name)
      )
    `)
    .eq('buyer_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[Wallet] Failed to fetch purchases:', error)
    throw error
  }

  console.log('[Wallet] Fetched purchases:', rawOrders?.length || 0)

  const orders = (rawOrders || []) as any[]

  const transactions: PurchaseTransaction[] = orders.map(order => {
    const listing = order.listing as any
    return {
      id: order.id,
      amount: order.total_amount || 0,
      platformFee: order.platform_fee || 0,
      netAmount: order.seller_payout || 0,
      status: (order.status === 'completed' ? 'completed'
            : order.status === 'cancelled' ? 'cancelled'
            : order.status === 'refunded' ? 'refunded'
            : order.status === 'pending' ? 'pending'
            : order.status === 'paid' ? 'processing'
            : 'processing') as any,
      title: listing?.title || 'Game Item',
      orderId: order.id,
      orderNumber: order.order_number,
      createdAt: order.created_at,
      gameName: listing?.game?.name,
      gameEmoji: listing?.game?.emoji,
      gameImageUrl: listing?.game?.image_url,
      listingImageUrl: Array.isArray(listing?.images) ? listing.images[0] : null,
      categoryName: listing?.category?.name,
    }
  }) as any

  const lifetimeSpent = orders
    .filter((o: any) => o.status !== 'cancelled' && o.status !== 'refunded')
    .reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0)

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

  console.log('[fetchSales] Fetching sales for user:', userId)

  const { data, error } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      total_amount,
      platform_fee,
      seller_payout,
      status,
      created_at,
      buyer:profiles!buyer_id(username),
      listing:listing_id (
        title,
        images,
        game:game_id (name, emoji, image_url),
        category:category_id (name)
      )
    `)
    .eq('seller_id', userId)
    .in('status', ['completed', 'processing', 'paid', 'delivered', 'confirmed'])
    .order('created_at', { ascending: false })

  console.log('[fetchSales] Query result:', { data, error, count: data?.length })

  if (error) {
    console.error('[fetchSales] Error:', error)
    throw error
  }

  return ((data || []) as any[]).map(order => ({
    id: order.id,
    orderId: order.id,
    orderNumber: order.order_number || `#${order.id.slice(0, 8)}`,
    buyerUsername: order.buyer?.username || 'Unknown',
    amount: order.total_amount || 0,
    platformFee: order.platform_fee || 0,
    netAmount: order.seller_payout || 0,
    status: order.status,
    createdAt: order.created_at,
    listingTitle: order.listing?.title || 'N/A',
    gameName: order.listing?.game?.name,
    gameEmoji: order.listing?.game?.emoji,
    gameImageUrl: order.listing?.game?.image_url,
    listingImageUrl: order.listing?.images?.[0],
    categoryName: order.listing?.category?.name,
  }))
}

// ── Helpers ────────────────────────────────────────────────────────────────────

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

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, {
  label: string
  icon: React.ElementType
  pill: string
  dot: string
  pulse: boolean
}> = {
  completed:  { label: 'Delivered',   icon: CircleCheck,  pill: 'bg-green-500/12 text-success border-green-500/25',  dot: 'bg-green-400',  pulse: false },
  processing: { label: 'Processing',  icon: CircleDot,    pill: 'bg-amber-500/12 text-amber-400 border-amber-500/25',  dot: 'bg-amber-400',  pulse: true  },
  paid:       { label: 'Paid',        icon: CircleCheck,  pill: 'bg-green-500/12 text-success border-green-500/25',  dot: 'bg-green-400',  pulse: false },
  pending:    { label: 'Pending',     icon: CircleDashed, pill: 'bg-blue-500/12  text-blue-400  border-blue-500/25',   dot: 'bg-blue-400',   pulse: true  },
  failed:     { label: 'Cancelled',   icon: CircleX,      pill: 'bg-red-500/12   text-error   border-red-500/25',    dot: 'bg-red-400',    pulse: false },
  cancelled:  { label: 'Cancelled',   icon: CircleX,      pill: 'bg-red-500/12   text-error   border-red-500/25',    dot: 'bg-red-400',    pulse: false },
  refunded:   { label: 'Refunded',    icon: CircleX,      pill: 'bg-orange-500/12 text-orange-400 border-orange-500/25', dot: 'bg-orange-400', pulse: false },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status, icon: CircleDot,
    pill: 'bg-gray-500/12 text-text-secondary border-gray-500/25',
    dot: 'bg-gray-400', pulse: false,
  }
  const Icon = cfg.icon
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold whitespace-nowrap',
      cfg.pill
    )}>
      {/* animated pulse dot */}
      <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
        {cfg.pulse && (
          <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-60', cfg.dot)} />
        )}
        <span className={cn('relative inline-flex rounded-full h-1.5 w-1.5', cfg.dot)} />
      </span>
      {cfg.label}
    </span>
  )
}

// ── Compact stat card ──────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color = 'violet' }: {
  icon: React.ElementType; label: string; value: string; sub?: string
  color?: 'violet' | 'green' | 'amber' | 'blue'
}) {
  const colors = {
    violet: 'text-lime-text bg-lime/10 border-lime-tint-border',
    green:  'text-success  bg-success-bg  border-green-500/20',
    amber:  'text-amber-400  bg-amber-500/10  border-amber-500/20',
    blue:   'text-blue-400   bg-blue-500/10   border-blue-500/20',
  }
  return (
    <div className="rounded-lg border border-border-subtle card-frost px-3 py-2.5 flex items-center gap-2.5">
      <div className={cn('flex-shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-lg border', colors[color])}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <div className="text-base font-bold text-white leading-tight">{value}</div>
        <div className="text-[11px] text-text-tertiary truncate">{label}</div>
        {sub && <div className="text-[10px] text-text-tertiary truncate">{sub}</div>}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WalletPage() {
  const { user, loading: authLoading } = useAuth()
  const isSeller = user?.isApprovedSeller || false
  const [activeTab, setActiveTab] = useState<Tab>('purchases')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [isTopUpLoading, setIsTopUpLoading] = useState(false)

  // Update active tab when user role is determined
  useEffect(() => {
    if (user && !authLoading) {
      setActiveTab(isSeller ? 'earnings' : 'purchases')
    }
  }, [user, isSeller, authLoading])

  const { data: purchaseData, isLoading: purchasesLoading, error: purchasesError } = useQuery({
    queryKey: ['wallet-purchases', user?.id],
    queryFn: () => fetchPurchases(user!.id),
    enabled: !!user?.id && !authLoading,
    refetchOnWindowFocus: false,
    retry: 1,
  })

  const { data: salesData, isLoading: salesLoading, error: salesError } = useQuery({
    queryKey: ['wallet-sales', user?.id],
    queryFn: async () => {
      console.log('[Wallet] Fetching sales for user:', user!.id)
      const result = await fetchSales(user!.id)
      console.log('[Wallet] Sales data:', result)
      return result
    },
    enabled: !!user?.id && !!user?.isApprovedSeller && !authLoading,
    refetchOnWindowFocus: false,
    retry: 1,
  })

  // Fetch wallet balance (ledger-derived — the source refund credits post to)
  const { data: walletData, isLoading: walletLoading, error: walletError } = useQuery({
    queryKey: ['wallet-balance', user?.id],
    queryFn: async () => {
      const result = await getMyWalletBalance()
      if (!result.success) {
        console.error('[Wallet] Balance fetch failed:', result.error)
        throw new Error(result.error || 'Failed to fetch wallet balance')
      }
      return result.balance
    },
    enabled: !!user?.id && !authLoading,
    refetchOnWindowFocus: false,
    retry: 1,
  })

  // Fetch loyalty stats for accurate cashback
  const { data: loyaltyStats, isLoading: loyaltyLoading, error: loyaltyError } = useQuery({
    queryKey: ['loyalty-stats', user?.id],
    queryFn: async () => {
      const result = await getLoyaltyStats()
      if (!result.success || !result.data) {
        console.error('[Wallet] Loyalty stats fetch failed:', result.error)
        return null
      }
      return result.data
    },
    enabled: !!user?.id && !authLoading,
    refetchOnWindowFocus: false,
    retry: 1,
  })

  // Fetch withdrawal requests
  const { data: withdrawalRequestsData, isLoading: withdrawalsLoading, refetch: refetchWithdrawals } = useQuery({
    queryKey: ['withdrawal-requests', user?.id],
    queryFn: async () => {
      const result = await getMyWithdrawalRequests()
      if (!result.success) {
        console.error('[Wallet] Withdrawal requests fetch failed:', result.error)
        return []
      }
      return result.requests || []
    },
    enabled: !!user?.id && !authLoading,
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

  const purchases = purchaseData?.transactions || []
  const sales = salesData || []
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
      const matchStatus = filterStatus === 'all' || t.status === filterStatus
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

  // Show loader IMMEDIATELY to prevent flash of wrong content
  // CRITICAL: Always show loader while auth is loading to prevent flash of buyer UI for sellers
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-lime-text" />
      </div>
    )
  }

  // After auth loads, check if data is ready
  if (user?.id) {
    if (isSeller) {
      // Seller: Must have both wallet and earnings loaded
      if (!walletData || earningsLoading) {
        return (
          <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-lime-text" />
          </div>
        )
      }
    } else {
      // Buyer: Only needs wallet data
      if (!walletData) {
        return (
          <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-lime-text" />
          </div>
        )
      }
    }
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="mx-auto w-full max-w-full px-4 sm:px-6 md:max-w-7xl lg:px-8">
        {/* ── Header ── */}
        <div className="mb-6">
          <AccountPageHeader
            icon="wallet"
            title="Wallet"
            subtitle="Purchases, sales & payouts"
            className="mb-4"
          />

          {/* V22 — Seller balance: Available + Pending cards, then a
              compact real-data stats strip. Replaces the full-width slab. */}
          {isSeller && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                {/* Available — value left, Withdraw CTA right (like the ref) */}
                <div className="flex items-start justify-between gap-4 rounded-lg border border-border-subtle card-frost p-5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-text-secondary">
                      <DollarSign className="h-4 w-4 text-success" />
                      <span className="text-[12px] font-semibold uppercase tracking-wider">Available Balance</span>
                    </div>
                    <p className="mt-1.5 text-3xl font-bold leading-tight text-text-primary">
                      ${earningsStats.available_balance.toFixed(2)}
                    </p>
                    <p className="mt-2 text-[12px] text-text-secondary">Ready to withdraw to your payout method.</p>
                  </div>
                  <Link
                    href="/account/wallet/withdraw"
                    className={cn(
                      'inline-flex shrink-0 items-center gap-2 rounded-lg bg-lime px-4 py-2.5 text-sm font-semibold text-text-inverse transition-colors hover:bg-lime-hover',
                      earningsStats.available_balance <= 0 && 'pointer-events-none opacity-50',
                    )}
                  >
                    <ArrowDownToLine className="h-4 w-4" />
                    Withdraw
                  </Link>
                </div>

                {/* Pending — sales awaiting completion */}
                <div className="rounded-lg border border-border-subtle card-frost p-5">
                  <div className="flex items-center gap-2 text-text-secondary">
                    <Clock className="h-4 w-4 text-amber-400" />
                    <span className="text-[12px] font-semibold uppercase tracking-wider">Pending Sales</span>
                  </div>
                  <p className="mt-1.5 text-3xl font-bold leading-tight text-text-primary">
                    ${earningsStats.pending_balance.toFixed(2)}
                  </p>
                  <p className="mt-2 text-[12px] text-text-secondary">
                    Sale proceeds from active orders — credited to your Seller Balance once the
                    buyer confirms delivery or the protection window closes.
                  </p>
                </div>
              </div>

              {/* Real-data stats strip */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'This Month', value: earningsStats.this_month_earnings, icon: TrendingUp },
                  { label: 'Lifetime Earned', value: earningsStats.total_earnings, icon: DollarSign },
                  { label: 'Withdrawn', value: earningsStats.total_payouts, icon: ArrowDownToLine },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border border-border-subtle card-frost py-3">
                    <div className="flex items-center gap-2 text-text-tertiary">
                      <s.icon className="h-3.5 w-3.5" />
                      <span className="text-[11px] font-medium uppercase tracking-wide">{s.label}</span>
                    </div>
                    <p className="mt-1 text-lg font-bold text-text-primary">${(s.value ?? 0).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Wallet Balance Card (Buyers Only - No Withdrawals) ── */}
          {!isSeller && (
            <div className="rounded-lg border border-border-subtle bg-gradient-to-br from-lime/10 to-transparent p-1 shadow-xl">
              <div className="rounded-lg bg-black/40 backdrop-blur-sm p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Wallet className="h-4 w-4 text-lime-text" />
                      <p className="text-[10px] text-white/50 font-semibold uppercase tracking-wider">Balance</p>
                    </div>
                    <p className="text-4xl font-bold text-white tracking-tight">${walletBalance.available_balance.toFixed(2)}</p>
                    {walletBalance.pending_balance > 0 && (
                      <p className="text-[11px] text-white/40 mt-1">
                        +${walletBalance.pending_balance.toFixed(2)} pending
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleTopUp(25)}
                      disabled={isTopUpLoading}
                      className="group relative flex items-center justify-center gap-1.5 rounded-lg bg-lime text-text-inverse hover:bg-lime-hover px-4 py-2 text-sm font-semibold transition-all disabled:cursor-not-allowed"
                    >
                      {isTopUpLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5" />
                          <span>$25</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleTopUp(50)}
                      disabled={isTopUpLoading}
                      className="group relative flex items-center justify-center gap-1.5 rounded-lg border border-border-default bg-bg-raised hover:bg-bg-raised-hover hover:border-lime-tint-border px-4 py-2 text-sm font-semibold text-white transition-all disabled:cursor-not-allowed"
                    >
                      {isTopUpLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5" />
                          <span>$50</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Rewards Row */}
                <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-border-subtle">
                  <div className="flex items-center gap-2.5 rounded-lg bg-success-bg border border-green-500/20 px-3 py-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-success-bg">
                      <Gift className="h-3.5 w-3.5 text-success" />
                    </div>
                    <div>
                      <p className="text-[9px] text-success/70 font-medium uppercase tracking-wide">Cashback</p>
                      <p className="text-base font-bold text-success">${walletBalance.total_cashback.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20">
                      <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-[9px] text-amber-400/70 font-medium uppercase tracking-wide">Referrals</p>
                      <p className="text-base font-bold text-amber-400">${walletBalance.referral_earnings.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Compact Stats (Buyers Only) ── */}
        {!isSeller && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
          <StatCard
            icon={Gift} label="Total Cashback"
            value={`$${walletBalance.total_cashback.toFixed(2)}`}
            sub="Earned rewards"
            color="green"
          />
          <StatCard
            icon={ShoppingCart} label="Total Spent"
            value={`$${lifetimeSpent.toFixed(2)}`}
            sub="All purchases"
            color="violet"
          />
          <StatCard
            icon={CheckCircle2} label="Completed"
            value={purchases.filter(t => t.status === 'completed').length.toString()}
            sub="Delivered"
            color="amber"
          />
          <StatCard
            icon={Package} label="Total Orders"
            value={purchases.length.toString()}
            sub="All purchases"
            color="blue"
          />
          </div>
        )}

      {/* ── Tabs ── */}
      <div className="flex gap-3 mb-4">
        {tabs.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSearchQuery(''); setFilterStatus('all') }}
              className={cn(
                isActive
                  ? 'flex items-center gap-2 px-4 py-3 text-sm font-semibold rounded-lg border-2 border-lime bg-gradient-to-br from-lime/20 to-lime/5 text-white shadow-elevated transition-all'
                  : 'flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-lg border border-border-subtle card-frost text-text-secondary hover:border-lime-tint-border hover:bg-bg-overlay hover:text-text-secondary transition-all'
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* ── Search + Filter bar ── */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            placeholder={activeTab === 'purchases' ? 'Search by item, game, order…' : 'Search by item, buyer, order…'}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border-subtle card-frost py-2 pl-9 pr-8 text-sm text-white placeholder:text-text-disabled focus:border-lime focus:outline-none focus:ring-1 focus:ring-lime/20 transition-all"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-white transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {activeTab === 'purchases' && (
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="rounded-lg border border-border-subtle card-frost px-3 py-2 text-xs text-white focus:border-lime focus:outline-none transition-all"
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="processing">Processing</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
          </select>
        )}
      </div>

      {/* ════════════════ TAB: PURCHASES ════════════════ */}
      {activeTab === 'purchases' && (
        <div className="rounded-lg border border-border-subtle card-frost overflow-hidden">
          {filteredPurchases.length === 0 ? (
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
            <div className="divide-y divide-white/[0.05]">
              {filteredPurchases.map((txn, i) => (
                <motion.div
                  key={txn.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Link
                    href={`/account/orders/${txn.orderId}`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-bg-overlay transition-colors group"
                  >
                    {/* Listing image (fallback to game icon) */}
                    <GameIcon emoji={txn.gameEmoji} imageUrl={txn.listingImageUrl || txn.gameImageUrl} size={10} />

                    {/* Item details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        {txn.gameName && (
                          <span className="text-[11.5px] font-bold text-lime-text uppercase tracking-[0.14em]">{txn.gameName}</span>
                        )}
                        {txn.categoryName && (
                          <>
                            <span className="text-text-tertiary">·</span>
                            <span className="text-[10px] text-text-tertiary">{txn.categoryName}</span>
                          </>
                        )}
                      </div>
                      <p className="text-sm font-medium text-white truncate leading-snug">{txn.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {txn.orderNumber && (
                          <span className="text-[11px] text-lime-text">#{txn.orderNumber}</span>
                        )}
                        <span className="text-[11px] text-text-tertiary">{timeAgo(txn.createdAt)}</span>
                      </div>
                    </div>

                    {/* Right side: Status + Price breakdown */}
                    <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                      <StatusBadge status={txn.status} />
                      <div className="text-right">
                        <div className="text-base font-bold text-white">${txn.amount.toFixed(2)}</div>
                        {txn.platformFee > 0 && (
                          <div className="text-[10px] text-text-disabled">
                            fee <span className="text-error/70">-${txn.platformFee.toFixed(2)}</span>
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
        <div className="rounded-lg border border-border-subtle card-frost overflow-hidden">
          {salesLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-lime-text mb-3" />
              <p className="text-sm text-text-tertiary">Loading sales...</p>
            </div>
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
            <div className="divide-y divide-white/[0.05]">
              {filteredSales.map((txn, i) => (
                <motion.div
                  key={txn.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Link
                    href={`/account/orders/${txn.orderId}`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-bg-overlay transition-colors group"
                  >
                    {/* Listing image (fallback to game icon) */}
                    <GameIcon emoji={txn.gameEmoji} imageUrl={txn.listingImageUrl || txn.gameImageUrl} size={10} />

                    {/* Item details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        {txn.gameName && (
                          <span className="text-[11.5px] font-bold text-lime-text uppercase tracking-[0.14em]">{txn.gameName}</span>
                        )}
                        {txn.categoryName && (
                          <>
                            <span className="text-text-tertiary">·</span>
                            <span className="text-[10px] text-text-tertiary">{txn.categoryName}</span>
                          </>
                        )}
                      </div>
                      <p className="text-sm font-medium text-white truncate leading-snug">{txn.listingTitle}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <User className="h-3 w-3 text-text-disabled flex-shrink-0" />
                        <span className="text-[11px] text-text-secondary font-medium">{txn.buyerUsername}</span>
                        <span className="text-text-tertiary">·</span>
                        <span className="text-[11px] text-lime-text">#{txn.orderNumber}</span>
                        <span className="text-text-tertiary">·</span>
                        <span className="text-[11px] text-text-tertiary">{timeAgo(txn.createdAt)}</span>
                      </div>
                    </div>

                    {/* Right: status + price breakdown */}
                    <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                      <StatusBadge status={txn.status} />
                      <div className="text-right">
                        <div className="text-base font-bold text-success">+${txn.netAmount.toFixed(2)}</div>
                        {txn.platformFee > 0 && (
                          <div className="text-[10px] text-text-disabled">
                            sale <span className="text-text-secondary">${txn.amount.toFixed(2)}</span>
                            {' '}· fee <span className="text-error/70">-${txn.platformFee.toFixed(2)}</span>
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
        <div className="rounded-lg border border-border-subtle card-frost overflow-hidden">
          {/* Stripe Connect prompt if seller hasn't connected */}
          {isSeller && (
            <div className="px-5 py-3 border-b border-border-subtle flex items-center justify-between gap-4 bg-lime/5">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-lime-text flex-shrink-0" />
                <span className="text-xs text-text-secondary">Payouts via Stripe Connect</span>
              </div>
              <Link
                href="/account/wallet/connect"
                className="flex items-center gap-1.5 text-xs font-medium text-lime-text hover:text-lime-text transition-colors whitespace-nowrap"
              >
                Manage account <ExternalLink className="h-3 w-3" />
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
              <div className="flex items-center justify-between px-5 py-3 border-b border-border-subtle">
                <span className="text-xs text-text-tertiary">{payouts.length} payout{payouts.length !== 1 ? 's' : ''}</span>
                <button className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-raised hover:bg-bg-raised-hover px-3 py-1 text-xs font-medium text-text-secondary hover:text-white transition-all">
                  <Download className="h-3.5 w-3.5" />
                  Export
                </button>
              </div>

              <div className="divide-y divide-white/[0.05]">
                {payouts.map((payout, i) => (
                  <motion.div
                    key={payout.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-bg-overlay transition-colors"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-lime/10 border border-lime-tint-border">
                      <CreditCard className="h-5 w-5 text-lime-text" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{fmtDate(payout.created_at)}</p>
                      <p className="text-[11px] text-text-tertiary mt-0.5">{payout.method}</p>
                    </div>

                    <div className="flex-shrink-0 flex flex-col items-end gap-1">
                      <span className={cn(
                        'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize',
                        payout.status === 'completed' ? 'bg-success-bg text-success border-green-500/20'
                          : payout.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-error-bg text-error border-error/40'
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

      {/* ── Withdrawal Requests Section (Sellers Only) ── */}
      {isSeller && withdrawalRequestsData && withdrawalRequestsData.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <ArrowDownToLine className="h-5 w-5 text-success" />
            Withdrawal Requests
          </h2>
          <div className="grid gap-3">
            {withdrawalRequestsData.map((request) => (
              <WithdrawalRequestCard
                key={request.id}
                request={request}
                onUpdate={refetchWithdrawals}
              />
            ))}
          </div>
        </div>
      )}

      </div>
    </div>
  )
}

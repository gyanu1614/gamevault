'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { useSellerEarnings } from '@/hooks/use-seller-earnings'
import { createClient } from '@/lib/supabase/client'
import { getWalletBalance, getWalletTransactions, createTopUpCheckout } from '@/lib/actions/wallet'
import { getLoyaltyStats } from '@/lib/actions/loyalty'
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
} from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

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
        image_url,
        game:game_id (name, emoji, image_url),
        category:category_id (name)
      )
    `)
    .eq('seller_id', userId)
    .in('status', ['completed', 'processing', 'paid'])
    .order('created_at', { ascending: false })

  if (error) throw error

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
    <div className={`${cls} rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-xl`}>
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
  completed:  { label: 'Delivered',   icon: CircleCheck,  pill: 'bg-green-500/12 text-green-400 border-green-500/25',  dot: 'bg-green-400',  pulse: false },
  processing: { label: 'Processing',  icon: CircleDot,    pill: 'bg-amber-500/12 text-amber-400 border-amber-500/25',  dot: 'bg-amber-400',  pulse: true  },
  paid:       { label: 'Paid',        icon: CircleCheck,  pill: 'bg-green-500/12 text-green-400 border-green-500/25',  dot: 'bg-green-400',  pulse: false },
  pending:    { label: 'Pending',     icon: CircleDashed, pill: 'bg-blue-500/12  text-blue-400  border-blue-500/25',   dot: 'bg-blue-400',   pulse: true  },
  failed:     { label: 'Cancelled',   icon: CircleX,      pill: 'bg-red-500/12   text-red-400   border-red-500/25',    dot: 'bg-red-400',    pulse: false },
  cancelled:  { label: 'Cancelled',   icon: CircleX,      pill: 'bg-red-500/12   text-red-400   border-red-500/25',    dot: 'bg-red-400',    pulse: false },
  refunded:   { label: 'Refunded',    icon: CircleX,      pill: 'bg-orange-500/12 text-orange-400 border-orange-500/25', dot: 'bg-orange-400', pulse: false },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status, icon: CircleDot,
    pill: 'bg-gray-500/12 text-gray-400 border-gray-500/25',
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
    violet: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
    green:  'text-green-400  bg-green-500/10  border-green-500/20',
    amber:  'text-amber-400  bg-amber-500/10  border-amber-500/20',
    blue:   'text-blue-400   bg-blue-500/10   border-blue-500/20',
  }
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 flex items-center gap-2.5">
      <div className={cn('flex-shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-lg border', colors[color])}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <div className="text-base font-bold text-white leading-tight">{value}</div>
        <div className="text-[11px] text-gray-500 truncate">{label}</div>
        {sub && <div className="text-[10px] text-gray-700 truncate">{sub}</div>}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WalletPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('purchases')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [isTopUpLoading, setIsTopUpLoading] = useState(false)

  const { data: purchaseData, isLoading: purchasesLoading, error: purchasesError } = useQuery({
    queryKey: ['wallet-purchases', user?.id],
    queryFn: () => fetchPurchases(user!.id),
    enabled: !!user?.id,
    refetchOnWindowFocus: false,
    retry: 1,
  })

  const { data: salesData, isLoading: salesLoading, error: salesError } = useQuery({
    queryKey: ['wallet-sales', user?.id],
    queryFn: () => fetchSales(user!.id),
    enabled: !!user?.id && !!user?.isApprovedSeller,
    refetchOnWindowFocus: false,
    retry: 1,
  })

  // Fetch wallet balance
  const { data: walletData, isLoading: walletLoading, error: walletError } = useQuery({
    queryKey: ['wallet-balance', user?.id],
    queryFn: async () => {
      const result = await getWalletBalance()
      if (!result.success) {
        console.error('[Wallet] Balance fetch failed:', result.error)
        throw new Error(result.error || 'Failed to fetch wallet balance')
      }
      return result.balance
    },
    enabled: !!user?.id,
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
    enabled: !!user?.id,
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

  const isSeller = user?.isApprovedSeller
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

  // Show loader IMMEDIATELY if no wallet data exists yet - prevents flash of $0.00
  // MUST be after all hooks to follow Rules of Hooks
  if (!walletData && user?.id) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black pb-20">
      <div className="mx-auto w-full max-w-full px-4 sm:px-6 md:max-w-7xl lg:px-8">
        {/* ── Header ── */}
        <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/10">
              <Wallet className="h-5 w-5 text-violet-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Wallet</h1>
          </div>
          <p className="text-sm text-gray-400 ml-14">Purchases, sales &amp; payouts</p>
        </div>

        {/* Stripe Connect CTA — sellers only */}
        {isSeller && (
          <Link
            href="/account/wallet/connect"
            className="flex-shrink-0 flex items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 px-4 py-2.5 text-sm font-medium text-violet-300 hover:text-violet-200 transition-all"
          >
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Payout Account</span>
            <ExternalLink className="h-3.5 w-3.5 opacity-60" />
          </Link>
        )}
      </div>

      {/* ── Wallet Balance Card (Buyers Only) ── */}
      {!isSeller && (
        <div className="mb-6 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-transparent p-1 shadow-xl">
          <div className="rounded-xl bg-black/40 backdrop-blur-sm p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Wallet className="h-4 w-4 text-violet-400" />
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
                  className="group relative flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 disabled:from-violet-500/50 disabled:to-purple-600/50 px-4 py-2 text-sm font-semibold text-white transition-all shadow-lg hover:shadow-violet-500/25 disabled:cursor-not-allowed"
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
                  className="group relative flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 disabled:from-purple-500/50 disabled:to-pink-600/50 px-4 py-2 text-sm font-semibold text-white transition-all shadow-lg hover:shadow-purple-500/25 disabled:cursor-not-allowed"
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
            <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-white/[0.06]">
              <div className="flex items-center gap-2.5 rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-500/20">
                  <Gift className="h-3.5 w-3.5 text-green-400" />
                </div>
                <div>
                  <p className="text-[9px] text-green-400/70 font-medium uppercase tracking-wide">Cashback</p>
                  <p className="text-base font-bold text-green-400">${walletBalance.total_cashback.toFixed(2)}</p>
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

      {/* ── Compact Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
        {/* Buyer stats - always shown */}
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

        {/* Seller stats - only shown if user is approved seller */}
        {isSeller ? (
          <>
            <StatCard
              icon={DollarSign} label="Total Earned"
              value={`$${earningsStats.total_earnings.toFixed(2)}`}
              sub="As seller"
              color="amber"
            />
            <StatCard
              icon={Clock} label="Pending Pay"
              value={`$${earningsStats.pending_balance.toFixed(2)}`}
              sub="Awaiting payout"
              color="blue"
            />
          </>
        ) : (
          <>
            {/* Buyer-only stats when not a seller */}
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
          </>
        )}
      </div>

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
                  ? 'flex items-center gap-2 px-4 py-3 text-sm font-semibold rounded-xl border-2 border-violet-500/50 bg-gradient-to-br from-violet-500/20 to-purple-500/10 text-white shadow-lg shadow-violet-500/20 transition-all'
                  : 'flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-xl border border-white/[0.08] bg-white/[0.02] text-gray-400 hover:border-violet-500/30 hover:bg-white/[0.05] hover:text-gray-300 transition-all'
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
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder={activeTab === 'purchases' ? 'Search by item, game, order…' : 'Search by item, buyer, order…'}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] py-2 pl-9 pr-8 text-sm text-white placeholder:text-gray-600 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/20 transition-all"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {activeTab === 'purchases' && (
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white focus:border-violet-500/50 focus:outline-none transition-all"
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
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
          {filteredPurchases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ShoppingCart className="h-10 w-10 text-gray-700 mb-3" />
              <p className="text-sm font-medium text-gray-400">
                {searchQuery || filterStatus !== 'all' ? 'No matching purchases' : 'No purchases yet'}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {searchQuery || filterStatus !== 'all' ? 'Try adjusting your search or filters' : 'Browse listings and make your first purchase'}
              </p>
              {!searchQuery && filterStatus === 'all' && (
                <Link href="/" className="mt-4 rounded-lg bg-violet-500 hover:bg-violet-600 px-5 py-2 text-sm font-medium text-white transition-colors">
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
                    className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.03] transition-colors group"
                  >
                    {/* Listing image (fallback to game icon) */}
                    <GameIcon emoji={txn.gameEmoji} imageUrl={txn.listingImageUrl || txn.gameImageUrl} size={10} />

                    {/* Item details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        {txn.gameName && (
                          <span className="text-[10px] font-semibold text-violet-400 uppercase tracking-wide">{txn.gameName}</span>
                        )}
                        {txn.categoryName && (
                          <>
                            <span className="text-gray-700">·</span>
                            <span className="text-[10px] text-gray-500">{txn.categoryName}</span>
                          </>
                        )}
                      </div>
                      <p className="text-sm font-medium text-white truncate leading-snug">{txn.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {txn.orderNumber && (
                          <span className="text-[11px] text-violet-400">#{txn.orderNumber}</span>
                        )}
                        <span className="text-[11px] text-gray-600">{timeAgo(txn.createdAt)}</span>
                      </div>
                    </div>

                    {/* Right side: Status + Price breakdown */}
                    <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                      <StatusBadge status={txn.status} />
                      <div className="text-right">
                        <div className="text-base font-bold text-white">${txn.amount.toFixed(2)}</div>
                        {txn.platformFee > 0 && (
                          <div className="text-[10px] text-gray-600">
                            fee <span className="text-red-400/70">-${txn.platformFee.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-gray-700 group-hover:text-gray-400 flex-shrink-0 transition-colors" />
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════ TAB: SALES ════════════════ */}
      {activeTab === 'earnings' && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
          {filteredSales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Package className="h-10 w-10 text-gray-700 mb-3" />
              <p className="text-sm font-medium text-gray-400">{searchQuery ? 'No matching sales' : 'No sales yet'}</p>
              <p className="text-xs text-gray-600 mt-1">{searchQuery ? 'Try adjusting your search' : 'Start listing items to earn money'}</p>
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
                    className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.03] transition-colors group"
                  >
                    {/* Listing image (fallback to game icon) */}
                    <GameIcon emoji={txn.gameEmoji} imageUrl={txn.listingImageUrl || txn.gameImageUrl} size={10} />

                    {/* Item details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        {txn.gameName && (
                          <span className="text-[10px] font-semibold text-violet-400 uppercase tracking-wide">{txn.gameName}</span>
                        )}
                        {txn.categoryName && (
                          <>
                            <span className="text-gray-700">·</span>
                            <span className="text-[10px] text-gray-500">{txn.categoryName}</span>
                          </>
                        )}
                      </div>
                      <p className="text-sm font-medium text-white truncate leading-snug">{txn.listingTitle}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <User className="h-3 w-3 text-gray-600 flex-shrink-0" />
                        <span className="text-[11px] text-gray-300 font-medium">{txn.buyerUsername}</span>
                        <span className="text-gray-700">·</span>
                        <span className="text-[11px] text-violet-400">#{txn.orderNumber}</span>
                        <span className="text-gray-700">·</span>
                        <span className="text-[11px] text-gray-600">{timeAgo(txn.createdAt)}</span>
                      </div>
                    </div>

                    {/* Right: status + price breakdown */}
                    <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                      <StatusBadge status={txn.status} />
                      <div className="text-right">
                        <div className="text-base font-bold text-green-400">+${txn.netAmount.toFixed(2)}</div>
                        {txn.platformFee > 0 && (
                          <div className="text-[10px] text-gray-600">
                            sale <span className="text-gray-400">${txn.amount.toFixed(2)}</span>
                            {' '}· fee <span className="text-red-400/70">-${txn.platformFee.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-gray-700 group-hover:text-gray-400 flex-shrink-0 transition-colors" />
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════ TAB: PAYOUTS ════════════════ */}
      {activeTab === 'payouts' && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
          {/* Stripe Connect prompt if seller hasn't connected */}
          {isSeller && (
            <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between gap-4 bg-violet-500/5">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-violet-400 flex-shrink-0" />
                <span className="text-xs text-gray-400">Payouts via Stripe Connect</span>
              </div>
              <Link
                href="/account/wallet/connect"
                className="flex items-center gap-1.5 text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors whitespace-nowrap"
              >
                Manage account <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          )}

          {payouts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CreditCard className="h-10 w-10 text-gray-700 mb-3" />
              <p className="text-sm font-medium text-gray-400">No payouts yet</p>
              <p className="text-xs text-gray-600 mt-1">Payouts appear once you've completed sales</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
                <span className="text-xs text-gray-500">{payouts.length} payout{payouts.length !== 1 ? 's' : ''}</span>
                <button className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] px-3 py-1 text-xs font-medium text-gray-400 hover:text-white transition-all">
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
                    className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-violet-500/10 border border-violet-500/20">
                      <CreditCard className="h-5 w-5 text-violet-400" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{fmtDate(payout.created_at)}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">{payout.method}</p>
                    </div>

                    <div className="flex-shrink-0 flex flex-col items-end gap-1">
                      <span className={cn(
                        'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize',
                        payout.status === 'completed' ? 'bg-green-500/10 text-green-400 border-green-500/20'
                          : payout.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-red-500/10 text-red-400 border-red-500/20'
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
      </div>
    </div>
  )
}

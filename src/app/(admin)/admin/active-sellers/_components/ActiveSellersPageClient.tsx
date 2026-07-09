'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Search,
  Download,
  MoreVertical,
  Store,
  TrendingUp,
  TrendingDown,
  Star,
  Package,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Ban,
  Eye,
  MessageSquare,
  ShieldAlert,
  Users,
  Activity,
  Loader2
} from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useActiveSellers, useSellerStats, type SellerStatsSummary } from '@/hooks/use-active-sellers'
import type { ActiveSeller } from '@/lib/actions/admin-active-sellers'
import { PageHeader, StatCard, AdminPanel, TABLE } from '../../components/kit'


type FilterStatus = 'all' | 'active' | 'warning' | 'suspended'
type FilterTier = 'all' | 'bronze' | 'silver' | 'gold' | 'platinum'
type SortBy = 'sales' | 'earnings' | 'rating' | 'listings' | 'joined' | 'activity'

const INPUT_CLASSES =
  'w-full rounded-lg border border-border-default bg-bg-base text-sm text-text-primary placeholder:text-text-tertiary focus:border-lime focus:outline-none transition-colors'

export default function ActiveSellersPageClient({
  initialSellers,
  initialStats,
}: {
  /** Server-fetched seller list (unfiltered); undefined if the server fetch failed. */
  initialSellers?: ActiveSeller[]
  /** Server-fetched stats overview; undefined if the server fetch failed. */
  initialStats?: SellerStatsSummary
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [filterTier, setFilterTier] = useState<FilterTier>('all')
  const [sortBy, setSortBy] = useState<SortBy>('sales')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [selectedSeller, setSelectedSeller] = useState<string | null>(null)

  // Fetch real data from database.
  // V54 — Server-seeded via initialData: on refresh the page arrives
  // rendered (isLoading is false from the first paint), while refetches
  // and client-side filtering/sorting keep working unchanged.
  const { data: fetchedSellers, isLoading, error } = useActiveSellers(undefined, {
    initialData: initialSellers,
  })
  const { data: statsData } = useSellerStats({ initialData: initialStats })

  // Use only real fetched data
  const sellers = fetchedSellers || []

  // Filter and sort sellers
  const filteredSellers = useMemo(() => {
    let filtered = sellers

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(s => s.status === filterStatus)
    }

    // Apply tier filter
    if (filterTier !== 'all') {
      filtered = filtered.filter(s => s.seller_tier === filterTier)
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(s =>
        s.username.toLowerCase().includes(query) ||
        s.full_name?.toLowerCase().includes(query) ||
        s.email.toLowerCase().includes(query) ||
        s.primary_games.some(g => g.toLowerCase().includes(query))
      )
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortBy) {
        case 'sales':
          aValue = a.stats.total_sales
          bValue = b.stats.total_sales
          break
        case 'earnings':
          aValue = a.stats.total_earnings
          bValue = b.stats.total_earnings
          break
        case 'rating':
          aValue = a.stats.avg_rating
          bValue = b.stats.avg_rating
          break
        case 'listings':
          aValue = a.stats.active_listings
          bValue = b.stats.active_listings
          break
        case 'joined':
          aValue = new Date(a.approved_at).getTime()
          bValue = new Date(b.approved_at).getTime()
          break
        case 'activity':
          aValue = new Date(a.last_active).getTime()
          bValue = new Date(b.last_active).getTime()
          break
        default:
          aValue = a.stats.total_sales
          bValue = b.stats.total_sales
      }

      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue
    })

    return filtered
  }, [sellers, filterStatus, filterTier, searchQuery, sortBy, sortOrder])

  // Calculate stats (use fetched stats if available, otherwise show zeros)
  const stats = useMemo(() => {
    if (statsData) {
      return statsData
    }
    // Return zeros for empty state
    return {
      total: 0,
      active: 0,
      warning: 0,
      suspended: 0,
      totalEarnings: 0,
      totalSales: 0,
      totalListings: 0,
    }
  }, [statsData])

  const getTierColor = (tier: string) => {
    const colors = {
      bronze: 'border border-orange-500/25 bg-orange-500/10 text-orange-400',
      silver: 'border border-border-default bg-bg-overlay text-text-secondary',
      gold: 'border border-yellow-500/25 bg-yellow-500/10 text-yellow-400',
      platinum: 'border border-border-strong bg-bg-overlay text-text-primary'
    }
    return colors[tier as keyof typeof colors] || 'border border-border-default bg-bg-overlay text-text-secondary'
  }

  const getStatusColor = (status: string) => {
    const colors = {
      active: 'border border-emerald-500/25 bg-emerald-500/10 text-emerald-400',
      restricted: 'border border-yellow-500/25 bg-yellow-500/10 text-yellow-400',
      banned: 'border border-red-500/25 bg-red-500/10 text-red-400',
      warning: 'border border-yellow-500/25 bg-yellow-500/10 text-yellow-400',
      suspended: 'border border-red-500/25 bg-red-500/10 text-red-400'
    }
    return colors[status as keyof typeof colors] || 'border border-border-default bg-bg-overlay text-text-secondary'
  }

  const getTimeAgo = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000)
    if (seconds < 60) return 'Just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-lime-text" />
          <p className="text-sm text-text-secondary">Loading active sellers...</p>
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-error" />
          <h2 className="mt-4 text-lg font-semibold text-text-primary">Error loading sellers</h2>
          <p className="mt-1 text-sm text-text-secondary">{error.message}</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <PageHeader
        title="Active Sellers"
        description="Manage and monitor approved sellers on the platform"
      />

      {/* Stats Overview */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Total Sellers"
          value={stats.total}
          icon={Users}
          tone="lime"
          sub={
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                <span className="font-medium text-success">{stats.active} active</span>
              </span>
              <span className="text-text-tertiary">•</span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                <span className="font-medium text-warning">{stats.warning} warnings</span>
              </span>
            </span>
          }
        />
        <StatCard
          label="Total Earnings"
          value={`$${stats.totalEarnings > 0 ? stats.totalEarnings.toLocaleString() : '0'}`}
          icon={DollarSign}
          tone="success"
          sub={
            <span className="flex items-center gap-1 text-success">
              <TrendingUp className="h-3 w-3" />
              Platform revenue
            </span>
          }
        />
        <StatCard
          label="Total Sales"
          value={stats.totalSales > 0 ? stats.totalSales.toLocaleString() : '0'}
          icon={TrendingUp}
          tone="neutral"
          sub={
            <span className="flex items-center gap-1">
              <Package className="h-3 w-3" />
              {stats.totalListings} active listings
            </span>
          }
        />
      </div>

      {/* Filters */}
      <AdminPanel className="mb-6 p-4 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Search */}
          <div className="lg:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
              <input
                type="text"
                placeholder="Search by name, email, or game..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(INPUT_CLASSES, 'py-2 pl-10 pr-4')}
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
              className={cn(INPUT_CLASSES, 'px-3 py-2')}
            >
              <option value="all" className="bg-bg-raised">All Status</option>
              <option value="active" className="bg-bg-raised">Active</option>
              <option value="warning" className="bg-bg-raised">Warning</option>
              <option value="suspended" className="bg-bg-raised">Suspended</option>
            </select>
          </div>

          {/* Tier Filter */}
          <div>
            <select
              value={filterTier}
              onChange={(e) => setFilterTier(e.target.value as FilterTier)}
              className={cn(INPUT_CLASSES, 'px-3 py-2')}
            >
              <option value="all" className="bg-bg-raised">All Tiers</option>
              <option value="bronze" className="bg-bg-raised">Bronze</option>
              <option value="silver" className="bg-bg-raised">Silver</option>
              <option value="gold" className="bg-bg-raised">Gold</option>
              <option value="platinum" className="bg-bg-raised">Platinum</option>
            </select>
          </div>

          {/* Sort */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className={cn(INPUT_CLASSES, 'px-3 py-2')}
            >
              <option value="sales" className="bg-bg-raised">Sort by Sales</option>
              <option value="earnings" className="bg-bg-raised">Sort by Earnings</option>
              <option value="rating" className="bg-bg-raised">Sort by Rating</option>
              <option value="listings" className="bg-bg-raised">Sort by Listings</option>
              <option value="joined" className="bg-bg-raised">Sort by Join Date</option>
              <option value="activity" className="bg-bg-raised">Sort by Activity</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <p className="text-xs text-text-secondary">
            Showing <span className="font-semibold text-text-primary">{filteredSellers.length}</span> of{' '}
            <span className="font-semibold text-text-primary">{sellers.length}</span> sellers
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-overlay px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
            >
              {sortOrder === 'desc' ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
              {sortOrder === 'desc' ? 'Descending' : 'Ascending'}
            </button>
            <button className="flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-overlay px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary">
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
          </div>
        </div>
      </AdminPanel>

      {/* Sellers Table */}
      {filteredSellers.length === 0 ? (
        <AdminPanel className="p-8 text-center">
          <Store className="mx-auto h-10 w-10 text-text-tertiary" />
          <h3 className="mt-3 text-base font-semibold text-text-primary">No sellers found</h3>
          <p className="mt-1 text-sm text-text-secondary">
            {searchQuery ? 'Try adjusting your search or filters' : 'No active sellers yet'}
          </p>
        </AdminPanel>
      ) : (
        <AdminPanel pad={false} className="overflow-hidden">
          <div className={TABLE.wrap}>
            <table className={TABLE.table}>
              <thead>
                <tr>
                  <th className={TABLE.th}>Seller</th>
                  <th className={TABLE.th}>Tier</th>
                  <th className={TABLE.th}>Performance</th>
                  <th className={TABLE.th}>Earnings</th>
                  <th className={TABLE.th}>Status</th>
                  <th className={TABLE.th}>Last Active</th>
                  <th className={cn(TABLE.th, 'text-right')}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSellers.map((seller, index) => (
                  <motion.tr
                    key={seller.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={TABLE.row}
                  >
                    {/* Seller Info */}
                    <td className={cn(TABLE.td, 'whitespace-nowrap')}>
                      <div className="flex items-center">
                        <img
                          src={seller.avatar_url || '/default-avatar.png'}
                          alt={seller.username}
                          className="h-8 w-8 rounded-full border border-border-default bg-bg-overlay"
                        />
                        <div className="ml-3">
                          <div className="text-xs font-semibold text-text-primary">{seller.username}</div>
                          <div className="text-[10px] text-text-tertiary">{seller.full_name}</div>
                          <div className="mt-0.5 flex items-center gap-1">
                            {seller.primary_games.slice(0, 2).map((game, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center rounded border border-border-default bg-bg-overlay px-1.5 py-0.5 text-[9px] font-medium text-text-secondary"
                              >
                                {game}
                              </span>
                            ))}
                            {seller.primary_games.length > 2 && (
                              <span className="text-[9px] text-text-tertiary">
                                +{seller.primary_games.length - 2}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Tier */}
                    <td className={cn(TABLE.td, 'whitespace-nowrap')}>
                      <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase', getTierColor(seller.seller_tier))}>
                        {seller.seller_tier}
                      </span>
                    </td>

                    {/* Performance */}
                    <td className={cn(TABLE.td, 'whitespace-nowrap')}>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1 text-xs">
                          <Star className="h-2.5 w-2.5 fill-current text-warning" />
                          <span className="font-semibold text-text-primary">
                            {seller.stats.avg_rating > 0 ? seller.stats.avg_rating.toFixed(1) : 'N/A'}
                          </span>
                          <span className="text-[10px] text-text-tertiary">
                            ({seller.stats.review_count > 0 ? seller.stats.review_count : '0'})
                          </span>
                        </div>
                        <div className="text-[10px] text-text-secondary">
                          {seller.stats.total_sales > 0 ? seller.stats.total_sales : '0'} sales • {seller.stats.active_listings > 0 ? seller.stats.active_listings : '0'} listings
                        </div>
                        <div className="text-[10px] text-text-tertiary">
                          {seller.stats.completion_rate > 0 ? `${seller.stats.completion_rate}%` : 'N/A'} completion
                        </div>
                      </div>
                    </td>

                    {/* Earnings */}
                    <td className={cn(TABLE.td, 'whitespace-nowrap')}>
                      <div className="text-xs font-semibold tabular-nums text-text-primary">
                        {seller.stats.total_earnings > 0 ? `$${seller.stats.total_earnings.toLocaleString()}` : '$0'}
                      </div>
                      <div className="text-[10px] text-text-tertiary">Total earnings</div>
                    </td>

                    {/* Status */}
                    <td className={cn(TABLE.td, 'whitespace-nowrap')}>
                      <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold capitalize', getStatusColor(seller.status))}>
                        {seller.status === 'active' && <CheckCircle2 className="mr-1 h-2.5 w-2.5" />}
                        {seller.status === 'restricted' && <ShieldAlert className="mr-1 h-2.5 w-2.5" />}
                        {seller.status === 'banned' && <Ban className="mr-1 h-2.5 w-2.5" />}
                        {seller.status === 'warning' && <AlertCircle className="mr-1 h-2.5 w-2.5" />}
                        {seller.status === 'suspended' && <Ban className="mr-1 h-2.5 w-2.5" />}
                        {seller.status}
                      </span>
                    </td>

                    {/* Last Active */}
                    <td className={cn(TABLE.td, 'whitespace-nowrap')}>
                      <div className="flex items-center gap-1 text-xs text-text-secondary">
                        <Activity className="h-2.5 w-2.5" />
                        {getTimeAgo(seller.last_active)}
                      </div>
                      <div className="text-[10px] text-text-tertiary">
                        Joined {new Date(seller.approved_at).toLocaleDateString()}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className={cn(TABLE.td, 'whitespace-nowrap text-right')}>
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/admin/sellers/${seller.id}`}
                          className="rounded-lg p-1.5 text-lime-text transition-colors hover:bg-lime-tint-bg"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Link>
                        <button className="rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-bg-overlay hover:text-text-primary">
                          <MessageSquare className="h-3.5 w-3.5" />
                        </button>
                        <button className="rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-bg-overlay hover:text-text-primary">
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminPanel>
      )}
    </div>
  )
}

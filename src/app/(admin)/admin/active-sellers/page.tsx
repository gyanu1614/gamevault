'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Search,
  Filter,
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
  Calendar,
  Shield,
  ShieldAlert,
  ChevronDown,
  Users,
  Activity,
  Loader2
} from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useActiveSellers, useSellerStats } from '@/hooks/use-active-sellers'


type FilterStatus = 'all' | 'active' | 'warning' | 'suspended'
type FilterTier = 'all' | 'bronze' | 'silver' | 'gold' | 'platinum'
type SortBy = 'sales' | 'earnings' | 'rating' | 'listings' | 'joined' | 'activity'

export default function ActiveSellersPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [filterTier, setFilterTier] = useState<FilterTier>('all')
  const [sortBy, setSortBy] = useState<SortBy>('sales')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [selectedSeller, setSelectedSeller] = useState<string | null>(null)

  // Fetch real data from database
  const { data: fetchedSellers, isLoading, error } = useActiveSellers()
  const { data: statsData } = useSellerStats()

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
      bronze: 'bg-orange-500/20 text-orange-400 border-orange-500/30 ring-1 ring-orange-500/20',
      silver: 'bg-gray-500/20 text-gray-300 border-gray-500/30 ring-1 ring-gray-500/20',
      gold: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30 ring-1 ring-yellow-500/20',
      platinum: 'bg-purple-500/20 text-purple-400 border-purple-500/30 ring-1 ring-purple-500/20'
    }
    return colors[tier as keyof typeof colors] || 'bg-gray-500/20 text-gray-400'
  }

  const getStatusColor = (status: string) => {
    const colors = {
      active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 ring-1 ring-emerald-500/20',
      restricted: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30 ring-1 ring-yellow-500/20',
      banned: 'bg-red-500/20 text-red-400 border-red-500/30 ring-1 ring-red-500/20',
      warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30 ring-1 ring-yellow-500/20',
      suspended: 'bg-red-500/20 text-red-400 border-red-500/30 ring-1 ring-red-500/20'
    }
    return colors[status as keyof typeof colors] || 'bg-gray-500/20 text-gray-400'
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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black via-gray-900 to-black p-6">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-gray-400">Loading active sellers...</p>
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black via-gray-900 to-black p-6">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-4 text-lg font-semibold text-white">Error loading sellers</h2>
          <p className="mt-1 text-sm text-gray-400">{error.message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Active Sellers</h1>
        <p className="mt-1 text-sm text-gray-400">
          Manage and monitor approved sellers on the platform
        </p>
      </div>

      {/* Stats Overview */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Total Sellers */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-white/10 bg-black/40 p-4 shadow-xl backdrop-blur-xl hover:bg-black/50 transition-all"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-400">Total Sellers</p>
              <p className="mt-1.5 text-2xl font-bold text-white">{stats.total}</p>
              <div className="mt-2.5 flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-emerald-400 font-medium">{stats.active} active</span>
                </div>
                <span className="text-gray-600">•</span>
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                  <span className="text-yellow-400 font-medium">{stats.warning} warnings</span>
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 p-2.5 ring-1 ring-blue-500/30">
              <Users className="h-5 w-5 text-blue-400" />
            </div>
          </div>
        </motion.div>

        {/* Total Earnings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-xl border border-white/10 bg-black/40 p-4 shadow-xl backdrop-blur-xl hover:bg-black/50 transition-all"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-400">Total Earnings</p>
              <p className="mt-1.5 text-2xl font-bold text-white">
                ${stats.totalEarnings > 0 ? stats.totalEarnings.toLocaleString() : '0'}
              </p>
              <div className="mt-2.5 flex items-center text-[10px] text-emerald-400">
                <TrendingUp className="h-2.5 w-2.5 mr-1" />
                Platform revenue
              </div>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 p-2.5 ring-1 ring-emerald-500/30">
              <DollarSign className="h-5 w-5 text-emerald-400" />
            </div>
          </div>
        </motion.div>

        {/* Total Sales */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-white/10 bg-black/40 p-4 shadow-xl backdrop-blur-xl hover:bg-black/50 transition-all"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-400">Total Sales</p>
              <p className="mt-1.5 text-2xl font-bold text-white">{stats.totalSales > 0 ? stats.totalSales.toLocaleString() : '0'}</p>
              <div className="mt-2.5 flex items-center text-xs text-gray-400">
                <Package className="h-3 w-3 mr-1 text-purple-400" />
                {stats.totalListings} active listings
              </div>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 p-2.5 ring-1 ring-purple-500/30">
              <TrendingUp className="h-5 w-5 text-purple-400" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-xl border border-white/10 bg-black/40 p-4 shadow-xl backdrop-blur-xl">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Search */}
          <div className="lg:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Search by name, email, or game..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-sm text-white placeholder:text-gray-500 focus:border-primary focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-primary focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
            >
              <option value="all" className="bg-gray-900">All Status</option>
              <option value="active" className="bg-gray-900">Active</option>
              <option value="warning" className="bg-gray-900">Warning</option>
              <option value="suspended" className="bg-gray-900">Suspended</option>
            </select>
          </div>

          {/* Tier Filter */}
          <div>
            <select
              value={filterTier}
              onChange={(e) => setFilterTier(e.target.value as FilterTier)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-primary focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
            >
              <option value="all" className="bg-gray-900">All Tiers</option>
              <option value="bronze" className="bg-gray-900">Bronze</option>
              <option value="silver" className="bg-gray-900">Silver</option>
              <option value="gold" className="bg-gray-900">Gold</option>
              <option value="platinum" className="bg-gray-900">Platinum</option>
            </select>
          </div>

          {/* Sort */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-primary focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
            >
              <option value="sales" className="bg-gray-900">Sort by Sales</option>
              <option value="earnings" className="bg-gray-900">Sort by Earnings</option>
              <option value="rating" className="bg-gray-900">Sort by Rating</option>
              <option value="listings" className="bg-gray-900">Sort by Listings</option>
              <option value="joined" className="bg-gray-900">Sort by Join Date</option>
              <option value="activity" className="bg-gray-900">Sort by Activity</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-xs text-gray-400">
            Showing <span className="font-semibold text-white">{filteredSellers.length}</span> of{' '}
            <span className="font-semibold text-white">{sellers.length}</span> sellers
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-all"
            >
              {sortOrder === 'desc' ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
              {sortOrder === 'desc' ? 'Descending' : 'Ascending'}
            </button>
            <button className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-all">
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Sellers Table */}
      {filteredSellers.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-black/40 p-8 text-center shadow-xl backdrop-blur-xl">
          <Store className="mx-auto h-10 w-10 text-gray-500" />
          <h3 className="mt-3 text-base font-semibold text-white">No sellers found</h3>
          <p className="mt-1 text-sm text-gray-400">
            {searchQuery ? 'Try adjusting your search or filters' : 'No active sellers yet'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-black/40 shadow-xl backdrop-blur-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/5">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    Seller
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    Tier
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    Performance
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    Earnings
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    Last Active
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 bg-black/20">
                {filteredSellers.map((seller, index) => (
                  <motion.tr
                    key={seller.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="hover:bg-white/5 transition-colors border-b border-white/5"
                  >
                    {/* Seller Info */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        <img
                          src={seller.avatar_url || '/default-avatar.png'}
                          alt={seller.username}
                          className="h-8 w-8 rounded-full ring-2 ring-primary/30"
                        />
                        <div className="ml-3">
                          <div className="text-xs font-semibold text-white">{seller.username}</div>
                          <div className="text-[10px] text-gray-400">{seller.full_name}</div>
                          <div className="flex items-center gap-1 mt-0.5">
                            {seller.primary_games.slice(0, 2).map((game, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-white/10 text-gray-300 border border-white/10"
                              >
                                {game}
                              </span>
                            ))}
                            {seller.primary_games.length > 2 && (
                              <span className="text-[9px] text-gray-500">
                                +{seller.primary_games.length - 2}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Tier */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase', getTierColor(seller.seller_tier))}>
                        {seller.seller_tier}
                      </span>
                    </td>

                    {/* Performance */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1 text-xs">
                          <Star className="h-2.5 w-2.5 text-yellow-400 fill-current" />
                          <span className="font-semibold text-white">
                            {seller.stats.avg_rating > 0 ? seller.stats.avg_rating.toFixed(1) : 'N/A'}
                          </span>
                          <span className="text-gray-500 text-[10px]">
                            ({seller.stats.review_count > 0 ? seller.stats.review_count : '0'})
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {seller.stats.total_sales > 0 ? seller.stats.total_sales : '0'} sales • {seller.stats.active_listings > 0 ? seller.stats.active_listings : '0'} listings
                        </div>
                        <div className="text-[10px] text-gray-500">
                          {seller.stats.completion_rate > 0 ? `${seller.stats.completion_rate}%` : 'N/A'} completion
                        </div>
                      </div>
                    </td>

                    {/* Earnings */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-xs font-semibold text-white">
                        {seller.stats.total_earnings > 0 ? `$${seller.stats.total_earnings.toLocaleString()}` : '$0'}
                      </div>
                      <div className="text-[10px] text-gray-500">Total earnings</div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium capitalize', getStatusColor(seller.status))}>
                        {seller.status === 'active' && <CheckCircle2 className="h-2.5 w-2.5 mr-1" />}
                        {seller.status === 'restricted' && <ShieldAlert className="h-2.5 w-2.5 mr-1" />}
                        {seller.status === 'banned' && <Ban className="h-2.5 w-2.5 mr-1" />}
                        {seller.status === 'warning' && <AlertCircle className="h-2.5 w-2.5 mr-1" />}
                        {seller.status === 'suspended' && <Ban className="h-2.5 w-2.5 mr-1" />}
                        {seller.status}
                      </span>
                    </td>

                    {/* Last Active */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Activity className="h-2.5 w-2.5" />
                        {getTimeAgo(seller.last_active)}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        Joined {new Date(seller.approved_at).toLocaleDateString()}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/admin/sellers/${seller.id}`}
                          className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-all"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Link>
                        <button className="p-1.5 rounded-lg text-gray-400 hover:bg-white/10 hover:text-white transition-all">
                          <MessageSquare className="h-3.5 w-3.5" />
                        </button>
                        <button className="p-1.5 rounded-lg text-gray-400 hover:bg-white/10 hover:text-white transition-all">
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

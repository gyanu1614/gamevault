'use client'

import { useState, useMemo, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useBuyerOrders } from '@/hooks/use-buyer-orders'
import { useSellerOrders } from '@/hooks/use-seller-orders'
import { OrderStatus } from '@/lib/api/seller-compatible'
import { getAvatarUrl } from '@/lib/utils/avatar'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  Search,
  Download,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  TrendingUp,
  Eye,
  Store,
  ShoppingCart,
  Star,
  ShieldCheck,
  ShieldX,
  Gamepad2,
  Folder,
  Calendar,
  ChevronDown,
  Filter as FilterIcon
} from 'lucide-react'
import LeaveReviewButton from '@/components/reviews/LeaveReviewButton'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

type FilterStatus = 'all' | 'pending' | 'completed' | 'disputed' | 'cancelled'
type ViewTab = 'purchases' | 'sales'

// Advanced filter state
interface AdvancedFilters {
  status: FilterStatus
  games: string[] // game IDs
  category: string | null
  dateRange: 'all' | 'today' | '7days' | '30days' | '90days' | 'custom'
  customDateStart: Date | null
  customDateEnd: Date | null
  searchQuery: string
}

export default function OrdersPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<ViewTab>('purchases')
  const [disputeResolutions, setDisputeResolutions] = useState<Record<string, any>>({})

  // Set initial tab based on user type (sellers default to 'sales')
  useEffect(() => {
    if (user?.isApprovedSeller) {
      setActiveTab('sales')
    }
  }, [user?.isApprovedSeller])

  // Combined filter state
  const [filters, setFilters] = useState<AdvancedFilters>({
    status: 'all',
    games: [],
    category: null,
    dateRange: 'all',
    customDateStart: null,
    customDateEnd: null,
    searchQuery: ''
  })

  // Dropdown open state
  const [openDropdown, setOpenDropdown] = useState<'game' | 'category' | 'date' | null>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenDropdown(null)
    if (openDropdown) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [openDropdown])

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?redirect=/account/orders')
    }
  }, [user, authLoading, router])

  // Fetch buyer orders (fetch ALL orders, filtering done client-side)
  const {
    orders: buyerOrders,
    isLoading: buyerOrdersLoading,
  } = useBuyerOrders({})

  // Fetch seller orders (only if approved seller) (fetch ALL orders, filtering done client-side)
  const {
    orders: sellerOrders,
    isLoading: sellerOrdersLoading,
  } = useSellerOrders({})

  // Determine which orders to show based on active tab
  const dbOrders = activeTab === 'purchases' ? buyerOrders : sellerOrders || []
  const ordersLoading = activeTab === 'purchases' ? buyerOrdersLoading : sellerOrdersLoading

  // Fetch dispute resolutions for all orders with disputes
  useEffect(() => {
    const fetchDisputeResolutions = async () => {
      if (!dbOrders || dbOrders.length === 0) return

      const supabase = createClient()

      // Get all order IDs (including disputed ones, not just completed)
      const orderIds = dbOrders.map(o => o.id)

      if (orderIds.length === 0) return

      // Fetch disputes for these orders
      const { data: disputes } = await supabase
        .from('disputes')
        .select('id, transaction_id, status')
        .in('transaction_id', orderIds)
        .in('status', ['resolved_buyer_favor', 'resolved_seller_favor', 'resolved_partial'])

      if (!disputes || disputes.length === 0) return

      // Fetch resolutions for these disputes
      const disputeIds = disputes.map(d => d.id)
      const { data: resolutions } = await supabase
        .from('dispute_resolutions')
        .select('*')
        .in('dispute_id', disputeIds)

      if (!resolutions) return

      // Map resolutions by order ID
      const resolutionMap: Record<string, any> = {}
      disputes.forEach(dispute => {
        const resolution = resolutions.find(r => r.dispute_id === dispute.id)
        if (resolution) {
          resolutionMap[dispute.transaction_id] = resolution
        }
      })

      setDisputeResolutions(resolutionMap)
    }

    fetchDisputeResolutions()
  }, [dbOrders])

  const filteredOrders = useMemo(() => {
    let filtered = dbOrders || []

    // Status filter: Merge 'Processing' into 'Pending'
    if (filters.status === 'pending') {
      // Pending includes: paid, delivering, processing
      filtered = filtered.filter(o => ['paid', 'delivering', 'processing'].includes(o.status))
    } else if (filters.status === 'completed') {
      // Completed includes: completed, delivered
      filtered = filtered.filter(o => ['completed', 'delivered'].includes(o.status))
    } else if (filters.status === 'disputed') {
      filtered = filtered.filter(o => o.status === 'disputed')
    } else if (filters.status === 'cancelled') {
      filtered = filtered.filter(o => o.status === 'cancelled')
    }

    // Game filter
    if (filters.games.length > 0) {
      filtered = filtered.filter(o => {
        const gameId = o.listing?.game_id || o.game?.id
        return gameId && filters.games.includes(gameId)
      })
    }

    // Category filter
    if (filters.category) {
      filtered = filtered.filter(o => o.listing?.category_id === filters.category)
    }

    // Date range filter
    if (filters.dateRange !== 'all') {
      const now = new Date()
      filtered = filtered.filter(o => {
        const orderDate = new Date(o.created_at)

        if (filters.dateRange === 'today') {
          return orderDate.toDateString() === now.toDateString()
        } else if (filters.dateRange === '7days') {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          return orderDate >= sevenDaysAgo
        } else if (filters.dateRange === '30days') {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          return orderDate >= thirtyDaysAgo
        } else if (filters.dateRange === '90days') {
          const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
          return orderDate >= ninetyDaysAgo
        } else if (filters.dateRange === 'custom' && filters.customDateStart && filters.customDateEnd) {
          return orderDate >= filters.customDateStart && orderDate <= filters.customDateEnd
        }

        return true
      })
    }

    // Search filter
    if (filters.searchQuery) {
      filtered = filtered.filter(o =>
        o.order_number?.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
        o.listing?.title?.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
        o.seller?.username?.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
        o.buyer?.username?.toLowerCase().includes(filters.searchQuery.toLowerCase())
      )
    }

    return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [dbOrders, filters])

  // Status counts (calculated from UNFILTERED dbOrders to show accurate stats)
  const statusCounts = useMemo(() => ({
    all: dbOrders?.length || 0,
    // Pending: paid + delivering + processing
    pending: dbOrders?.filter(o => ['paid', 'delivering', 'processing'].includes(o.status)).length || 0,
    // Completed: completed + delivered
    completed: dbOrders?.filter(o => ['completed', 'delivered'].includes(o.status)).length || 0,
    // Disputed
    disputed: dbOrders?.filter(o => o.status === 'disputed').length || 0,
    // Cancelled
    cancelled: dbOrders?.filter(o => o.status === 'cancelled').length || 0,
  }), [dbOrders])

  // Extract unique games and categories for filter dropdowns
  const availableGames = useMemo(() => {
    if (!dbOrders) return []
    const gameMap = new Map()
    dbOrders.forEach(order => {
      const game = order.listing?.game || order.game
      if (game && game.id) {
        gameMap.set(game.id, { id: game.id, name: game.name, image_url: game.image_url })
      }
    })
    return Array.from(gameMap.values())
  }, [dbOrders])

  const availableCategories = useMemo(() => {
    if (!dbOrders) return []
    const categoryMap = new Map()
    dbOrders.forEach(order => {
      const category = order.listing?.category
      if (category && category.id) {
        categoryMap.set(category.id, { id: category.id, name: category.name })
      }
    })
    return Array.from(categoryMap.values())
  }, [dbOrders])

  const getStatusColor = (status: string) => {
    const colors = {
      paid: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
      delivering: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      delivered: 'bg-green-500/10 text-green-400 border-green-500/30',
      completed: 'bg-green-500/10 text-green-400 border-green-500/30',
      disputed: 'bg-red-500/10 text-red-400 border-red-500/30',
      resolved: 'bg-green-500/10 text-green-400 border-green-500/30',
      refunded: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
      cancelled: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
    }
    return colors[status as keyof typeof colors] || colors.paid
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return <Clock className="h-3.5 w-3.5" />
      case 'delivering': return <TrendingUp className="h-3.5 w-3.5" />
      case 'delivered': return <CheckCircle2 className="h-3.5 w-3.5" />
      case 'completed': return <CheckCircle2 className="h-3.5 w-3.5" />
      case 'disputed': return <AlertCircle className="h-3.5 w-3.5" />
      case 'resolved': return <CheckCircle2 className="h-3.5 w-3.5" />
      default: return <Clock className="h-3.5 w-3.5" />
    }
  }

  const getTimeAgo = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  if (authLoading || ordersLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          <p className="text-gray-400">Loading orders...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const isSeller = user?.isApprovedSeller
  const pageTitle = isSeller
    ? (activeTab === 'purchases' ? 'Purchases' : 'Sold Orders')
    : 'Purchases'

  return (
    <div className="min-h-screen bg-black pb-20">
      <div className="mx-auto w-full max-w-full px-4 sm:px-6 md:max-w-7xl lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
      >
        <h1 className="text-3xl font-bold text-white">{pageTitle}</h1>
        <p className="text-sm text-gray-400 mt-1">
          {activeTab === 'purchases'
            ? 'Track your orders and manage your gaming purchases'
            : 'Manage your sales and customer orders'
          }
        </p>
        </motion.div>

        {/* Tabs - Only show if seller */}
        {isSeller && (
        <div className="mb-6 flex gap-3">
          <button
            onClick={() => setActiveTab('sales')}
            className={cn(
              activeTab === 'sales'
                ? "flex items-center gap-2 px-4 py-3 text-sm font-semibold rounded-xl border-2 border-violet-500/50 bg-gradient-to-br from-violet-500/20 to-purple-500/10 text-white shadow-lg shadow-violet-500/20 transition-all"
                : "flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-xl border border-white/[0.08] bg-white/[0.02] text-gray-400 hover:border-violet-500/30 hover:bg-white/[0.05] hover:text-gray-300 transition-all"
            )}
          >
            <Store className="w-4 h-4" />
            Sold Orders
          </button>
          <button
            onClick={() => setActiveTab('purchases')}
            className={cn(
              activeTab === 'purchases'
                ? "flex items-center gap-2 px-4 py-3 text-sm font-semibold rounded-xl border-2 border-violet-500/50 bg-gradient-to-br from-violet-500/20 to-purple-500/10 text-white shadow-lg shadow-violet-500/20 transition-all"
                : "flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-xl border border-white/[0.08] bg-white/[0.02] text-gray-400 hover:border-violet-500/30 hover:bg-white/[0.05] hover:text-gray-300 transition-all"
            )}
          >
            <ShoppingCart className="w-4 h-4" />
            Purchases
          </button>
        </div>
        )}

        {/* Status Tabs (replacing stats cards) */}
        <div className="mb-6 flex items-center gap-2 flex-wrap">
          {[
            { label: 'All', value: 'all' as FilterStatus, count: statusCounts.all },
            { label: 'Pending', value: 'pending' as FilterStatus, count: statusCounts.pending },
            { label: 'Completed', value: 'completed' as FilterStatus, count: statusCounts.completed },
            { label: 'Disputed', value: 'disputed' as FilterStatus, count: statusCounts.disputed },
            { label: 'Cancelled', value: 'cancelled' as FilterStatus, count: statusCounts.cancelled },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilters({ ...filters, status: tab.value })}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all',
                filters.status === tab.value
                  ? 'border-2 border-violet-500/50 bg-gradient-to-br from-violet-500/20 to-purple-500/10 text-white shadow-lg shadow-violet-500/20'
                  : 'border border-white/[0.08] bg-white/[0.02] text-gray-400 hover:border-violet-500/30 hover:bg-white/[0.05] hover:text-gray-300'
              )}
            >
              {tab.label}
              <span className={cn(
                'px-1.5 py-0.5 rounded-md text-xs font-semibold',
                filters.status === tab.value
                  ? 'bg-violet-500/30 text-violet-200'
                  : 'bg-white/[0.05] text-gray-500'
              )}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Advanced Filter Bar */}
        <div className="mb-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Game Filter */}
            <div className="relative">
              <button
                onClick={() => setOpenDropdown(openDropdown === 'game' ? null : 'game')}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border text-sm transition-all",
                  openDropdown === 'game'
                    ? "border-violet-500/50 bg-white/[0.05] text-white"
                    : "border-white/[0.08] bg-white/[0.02] text-gray-400 hover:border-violet-500/30 hover:bg-white/[0.05]"
                )}
              >
                <div className="flex items-center gap-2">
                  <Gamepad2 className="h-4 w-4" />
                  <span>{filters.games.length > 0 ? `${filters.games.length} Game${filters.games.length > 1 ? 's' : ''}` : 'All Games'}</span>
                </div>
                <ChevronDown className={cn("h-4 w-4 transition-transform", openDropdown === 'game' && "rotate-180")} />
              </button>

              {/* Game Dropdown Panel */}
              {openDropdown === 'game' && availableGames.length > 0 && (
                <div className="absolute z-50 mt-2 w-full min-w-[280px] rounded-xl border border-white/[0.08] bg-[#0d0d14] shadow-2xl shadow-black/50 max-h-[320px] overflow-y-auto">
                  <div className="p-2 space-y-1">
                    {availableGames.map((game) => {
                      const isSelected = filters.games.includes(game.id)
                      return (
                        <button
                          key={game.id}
                          onClick={() => {
                            if (isSelected) {
                              setFilters({ ...filters, games: filters.games.filter(id => id !== game.id) })
                            } else {
                              setFilters({ ...filters, games: [...filters.games, game.id] })
                            }
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all text-left",
                            isSelected
                              ? "bg-violet-500/20 text-white border border-violet-500/30"
                              : "text-gray-300 hover:bg-white/[0.05] hover:text-white"
                          )}
                        >
                          {game.image_url && (
                            <Image
                              src={game.image_url}
                              alt={game.name}
                              width={24}
                              height={24}
                              className="rounded object-cover flex-shrink-0"
                              unoptimized
                            />
                          )}
                          <span className="flex-1">{game.name}</span>
                          {isSelected && <CheckCircle2 className="h-4 w-4 text-violet-400 flex-shrink-0" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Category Filter */}
            <div className="relative">
              <button
                onClick={() => setOpenDropdown(openDropdown === 'category' ? null : 'category')}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border text-sm transition-all",
                  openDropdown === 'category'
                    ? "border-violet-500/50 bg-white/[0.05] text-white"
                    : "border-white/[0.08] bg-white/[0.02] text-gray-400 hover:border-violet-500/30 hover:bg-white/[0.05]"
                )}
              >
                <div className="flex items-center gap-2">
                  <Folder className="h-4 w-4" />
                  <span>{filters.category ? availableCategories.find(c => c.id === filters.category)?.name : 'All Categories'}</span>
                </div>
                <ChevronDown className={cn("h-4 w-4 transition-transform", openDropdown === 'category' && "rotate-180")} />
              </button>

              {/* Category Dropdown Panel */}
              {openDropdown === 'category' && availableCategories.length > 0 && (
                <div className="absolute z-50 mt-2 w-full min-w-[240px] rounded-xl border border-white/[0.08] bg-[#0d0d14] shadow-2xl shadow-black/50 max-h-[280px] overflow-y-auto">
                  <div className="p-2 space-y-1">
                    <button
                      onClick={() => {
                        setFilters({ ...filters, category: null })
                        setOpenDropdown(null)
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all text-left",
                        !filters.category
                          ? "bg-violet-500/20 text-white border border-violet-500/30"
                          : "text-gray-300 hover:bg-white/[0.05] hover:text-white"
                      )}
                    >
                      <span className="flex-1">All Categories</span>
                      {!filters.category && <CheckCircle2 className="h-4 w-4 text-violet-400 flex-shrink-0" />}
                    </button>
                    {availableCategories.map((category) => {
                      const isSelected = filters.category === category.id
                      return (
                        <button
                          key={category.id}
                          onClick={() => {
                            setFilters({ ...filters, category: category.id })
                            setOpenDropdown(null)
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all text-left",
                            isSelected
                              ? "bg-violet-500/20 text-white border border-violet-500/30"
                              : "text-gray-300 hover:bg-white/[0.05] hover:text-white"
                          )}
                        >
                          <span className="flex-1">{category.name}</span>
                          {isSelected && <CheckCircle2 className="h-4 w-4 text-violet-400 flex-shrink-0" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Date Range Filter */}
            <div className="relative">
              <button
                onClick={() => setOpenDropdown(openDropdown === 'date' ? null : 'date')}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border text-sm transition-all",
                  openDropdown === 'date'
                    ? "border-violet-500/50 bg-white/[0.05] text-white"
                    : "border-white/[0.08] bg-white/[0.02] text-gray-400 hover:border-violet-500/30 hover:bg-white/[0.05]"
                )}
              >
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {filters.dateRange === 'all' ? 'All Time' :
                     filters.dateRange === 'today' ? 'Today' :
                     filters.dateRange === '7days' ? 'Last 7 Days' :
                     filters.dateRange === '30days' ? 'Last 30 Days' :
                     filters.dateRange === '90days' ? 'Last 90 Days' :
                     'Custom Range'}
                  </span>
                </div>
                <ChevronDown className={cn("h-4 w-4 transition-transform", openDropdown === 'date' && "rotate-180")} />
              </button>

              {/* Date Range Dropdown Panel */}
              {openDropdown === 'date' && (
                <div className="absolute z-50 mt-2 w-full min-w-[200px] rounded-xl border border-white/[0.08] bg-[#0d0d14] shadow-2xl shadow-black/50">
                  <div className="p-2 space-y-1">
                    {[
                      { label: 'All Time', value: 'all' as const },
                      { label: 'Today', value: 'today' as const },
                      { label: 'Last 7 Days', value: '7days' as const },
                      { label: 'Last 30 Days', value: '30days' as const },
                      { label: 'Last 90 Days', value: '90days' as const },
                    ].map((option) => {
                      const isSelected = filters.dateRange === option.value
                      return (
                        <button
                          key={option.value}
                          onClick={() => {
                            setFilters({ ...filters, dateRange: option.value })
                            setOpenDropdown(null)
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all text-left",
                            isSelected
                              ? "bg-violet-500/20 text-white border border-violet-500/30"
                              : "text-gray-300 hover:bg-white/[0.05] hover:text-white"
                          )}
                        >
                          <span className="flex-1">{option.label}</span>
                          {isSelected && <CheckCircle2 className="h-4 w-4 text-violet-400 flex-shrink-0" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Listing Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search listings..."
                value={filters.searchQuery}
                onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] py-2.5 pl-10 pr-10 text-white text-sm placeholder:text-gray-500 focus:border-violet-500/30 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
              {filters.searchQuery && (
                <button
                  onClick={() => setFilters({ ...filters, searchQuery: '' })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Active Filter Pills & Clear All */}
          {(filters.games.length > 0 || filters.category || filters.dateRange !== 'all' || filters.searchQuery) && (
            <div className="flex flex-wrap items-center gap-2">
              {filters.games.map(gameId => {
                const game = availableGames.find(g => g.id === gameId)
                return game ? (
                  <div key={gameId} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-xs text-violet-300">
                    <Gamepad2 className="h-3 w-3" />
                    <span>{game.name}</span>
                    <button
                      onClick={() => setFilters({ ...filters, games: filters.games.filter(id => id !== gameId) })}
                      className="hover:text-violet-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : null
              })}

              {filters.category && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-xs text-violet-300">
                  <Folder className="h-3 w-3" />
                  <span>{availableCategories.find(c => c.id === filters.category)?.name}</span>
                  <button
                    onClick={() => setFilters({ ...filters, category: null })}
                    className="hover:text-violet-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

              {filters.dateRange !== 'all' && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-xs text-violet-300">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {filters.dateRange === 'today' ? 'Today' :
                     filters.dateRange === '7days' ? 'Last 7 Days' :
                     filters.dateRange === '30days' ? 'Last 30 Days' :
                     filters.dateRange === '90days' ? 'Last 90 Days' :
                     'Custom Range'}
                  </span>
                  <button
                    onClick={() => setFilters({ ...filters, dateRange: 'all' })}
                    className="hover:text-violet-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

              {filters.searchQuery && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-xs text-violet-300">
                  <Search className="h-3 w-3" />
                  <span className="max-w-[120px] truncate">{filters.searchQuery}</span>
                  <button
                    onClick={() => setFilters({ ...filters, searchQuery: '' })}
                    className="hover:text-violet-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

              <button
                onClick={() => setFilters({
                  status: 'all',
                  games: [],
                  category: null,
                  dateRange: 'all',
                  customDateStart: null,
                  customDateEnd: null,
                  searchQuery: ''
                })}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300 hover:bg-red-500/20 transition-colors"
              >
                <X className="h-3 w-3" />
                Clear All ({filters.games.length + (filters.category ? 1 : 0) + (filters.dateRange !== 'all' ? 1 : 0) + (filters.searchQuery ? 1 : 0)})
              </button>
            </div>
          )}
        </div>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.025] p-12">
          <ShoppingCart className="mb-4 h-16 w-16 text-violet-400/40" />
          <h3 className="mb-2 text-xl font-bold text-white">
            {activeTab === 'purchases' ? 'No purchases found' : 'No sales found'}
          </h3>
          <p className="text-gray-400">
            {filters.searchQuery
              ? 'Try adjusting your search'
              : activeTab === 'purchases'
              ? 'Start shopping to see your purchases here'
              : 'Your sales will appear here once customers place orders'
            }
          </p>
        </div>
        ) : (
        <div className="space-y-3">
          {filteredOrders.map((order, index) => {
            const otherParty = activeTab === 'purchases' ? order.seller : order.buyer
            const gameData = order.listing?.game || order.game
            const listingImage = order.listing?.images?.[0]
            const gameImage = gameData?.image_url
            const displayImage = listingImage || gameImage
            const gameName = gameData?.name
            const hasReview = order.has_review || false
            const disputeResolution = disputeResolutions[order.id]
            const hasDisputeResolution = order.status === 'completed' && disputeResolution

            // Determine if user won or lost dispute
            const userWonDispute = hasDisputeResolution && (
              (activeTab === 'purchases' && disputeResolution.favored_party === 'buyer') ||
              (activeTab === 'sales' && disputeResolution.favored_party === 'seller')
            )

            return (
              <Link key={order.id} href={`/account/orders/${order.id}`}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="group rounded-xl border border-white/[0.06] bg-white/[0.025] p-4 backdrop-blur-sm transition-all hover:border-white/[0.09] hover:bg-white/[0.03] cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    {/* Listing Image (fallback to Game Logo) */}
                    <div className="flex-shrink-0">
                      {displayImage ? (
                        <div className="relative h-14 w-14 overflow-hidden rounded-lg border border-white/[0.08]">
                          <Image
                            src={displayImage}
                            alt={order.listing?.title || gameName || 'Order'}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
                          <ShoppingCart className="h-6 w-6 text-gray-600" />
                        </div>
                      )}
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 min-w-0">
                      {/* Top Row: Order Number + Status */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-mono text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                          {order.order_number || order.id.slice(0, 8).toUpperCase()}
                        </span>
                        {(() => {
                          // Show "Resolved" instead of "Disputed" if dispute was resolved
                          const displayStatus = (order.status === 'disputed' && disputeResolutions[order.id])
                            ? 'resolved'
                            : order.status
                          return (
                            <div className={cn('flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', getStatusColor(displayStatus))}>
                              {getStatusIcon(displayStatus)}
                              {displayStatus}
                            </div>
                          )
                        })()}
                      </div>

                      {/* Item Name */}
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-bold text-white truncate">
                          {order.listing?.title || 'Unknown Listing'}
                        </h3>

                        {/* Dispute Outcome Badge */}
                        {hasDisputeResolution && (
                          <div className={cn(
                            'flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider flex-shrink-0',
                            userWonDispute
                              ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                              : 'bg-red-500/15 text-red-400 border border-red-500/30'
                          )}>
                            {userWonDispute ? (
                              <>
                                <ShieldCheck className="h-2.5 w-2.5" />
                                <span>Won</span>
                              </>
                            ) : (
                              <>
                                <ShieldX className="h-2.5 w-2.5" />
                                <span>Lost</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Game + Category */}
                      <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                        <span>{gameName || 'Unknown Game'}</span>
                        {order.listing?.category?.name && (
                          <>
                            <span className="text-gray-700">•</span>
                            <span>{order.listing.category.name}</span>
                          </>
                        )}
                      </div>

                      {/* Seller/Buyer Info */}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500 font-medium">
                          {activeTab === 'purchases' ? 'Seller:' : 'Buyer:'}
                        </span>
                        {otherParty ? (
                          <div
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              window.location.href = `/shop/${otherParty.shop_slug || otherParty.username}`
                            }}
                            className="flex items-center gap-1.5 group/seller hover:opacity-80 transition-opacity"
                          >
                            <div className="relative h-5 w-5 flex-shrink-0">
                              <Image
                                src={getAvatarUrl(otherParty.avatar_url, otherParty.username)}
                                alt={otherParty.username}
                                fill
                                className="rounded-full ring-1 ring-white/10"
                                unoptimized
                              />
                            </div>
                            <span className="text-xs font-medium text-white group-hover/seller:text-violet-400 transition-colors">
                              {otherParty.shop_name || otherParty.username}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">Unknown</span>
                        )}
                      </div>
                    </div>

                    {/* Right Side: Price + Actions */}
                    <div className="flex flex-col items-end justify-between gap-2">
                      {/* Price */}
                      <div className="text-right">
                        <div className="text-xl font-bold text-white">
                          ${order.total_amount?.toFixed(2) || '0.00'}
                        </div>
                        <div className="text-[10px] text-gray-500">Total</div>
                      </div>

                      {/* Review Indicator / Button */}
                      {order.status === 'completed' && (
                        <div onClick={(e) => e.stopPropagation()}>
                          {activeTab === 'sales' ? (
                            // Sold Orders - Show review indicator
                            hasReview ? (
                              <div className="flex items-center gap-1 text-[10px] text-green-400">
                                <Star className="h-3 w-3 fill-current" />
                                <span>Reviewed</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-[10px] text-gray-500">
                                <Star className="h-3 w-3" />
                                <span>No review</span>
                              </div>
                            )
                          ) : (
                            // Buy Orders - Show leave review button
                            !hasReview && (
                              <LeaveReviewButton
                                orderId={order.id}
                                orderNumber={order.order_number || order.id.slice(0, 8).toUpperCase()}
                                sellerName={otherParty?.shop_name || otherParty?.username || 'Seller'}
                                compact={true}
                                className="flex items-center gap-1 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 px-2 py-1 text-[10px] font-medium text-violet-400 transition-all"
                              />
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              </Link>
            )
          })}
        </div>
        )}
      </div>
    </div>
  )
}

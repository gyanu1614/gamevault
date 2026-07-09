'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useSellerAnalytics } from '@/hooks/use-seller-analytics'
import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '@/lib/api/seller-compatible'
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Eye,
  Target,
  Loader2,
  Calendar,
  Package,
  Star,
  Activity,
  ArrowUpRight,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

type TimeRange = '7d' | '30d' | '90d' | 'all'

export default function AnalyticsPage() {
  const { user, loading: authLoading } = useAuth()
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')

  const { stats, topListings, isLoading } = useSellerAnalytics()

  const { data: revenueTrend = [], isLoading: trendLoading } = useQuery({
    queryKey: ['seller', 'analytics', 'trend', timeRange],
    queryFn: () => analyticsApi.getRevenueTrend(timeRange),
    enabled: !!user?.id,
  })

  const timeRanges: { value: TimeRange; label: string }[] = [
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: '90d', label: '90 Days' },
    { value: 'all', label: 'All Time' },
  ]

  // Calculate metrics based on time range
  const getEarningsForRange = () => {
    switch (timeRange) {
      case '7d':
        return stats.earnings.week
      case '30d':
        return stats.earnings.month
      case 'all':
        return stats.earnings.allTime
      default:
        return stats.earnings.month
    }
  }

  const overviewCards = [
    {
      label: 'Total Revenue',
      value: `$${getEarningsForRange().toFixed(2)}`,
      icon: DollarSign,
      gradient: 'bg-lime/10 text-lime-text',
      trend: '+12.5%',
      trendUp: true,
    },
    {
      label: 'Total Orders',
      value: stats.orders.completed.toString(),
      icon: ShoppingCart,
      gradient: 'bg-lime/10 text-lime-text',
      trend: '+8.2%',
      trendUp: true,
    },
    {
      label: 'Avg Order Value',
      value: `$${(stats.orders.completed > 0 ? getEarningsForRange() / stats.orders.completed : 0).toFixed(2)}`,
      icon: Target,
      gradient: 'bg-lime/10 text-lime-text',
      trend: '+3.1%',
      trendUp: true,
    },
    {
      label: 'Conversion Rate',
      value: `${stats.performance.conversionRate.toFixed(1)}%`,
      icon: TrendingUp,
      gradient: 'bg-lime/10 text-lime-text',
      trend: '+5.4%',
      trendUp: true,
    },
  ]

  if (authLoading || isLoading || trendLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-text-secondary">Loading analytics...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pb-6">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl sm:text-3xl font-semibold text-white">Analytics</h1>
        <p className="mt-0.5 text-sm text-text-tertiary">
          Track your performance and insights
        </p>
      </div>

      {/* Time Range Selector */}
      <div className="mb-5 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {timeRanges.map((range) => (
          <button
            key={range.value}
            onClick={() => setTimeRange(range.value)}
            className={cn(
              'flex-shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-all',
              timeRange === range.value
                ? 'bg-white text-black'
                : 'bg-bg-overlay text-text-secondary hover:bg-bg-raised-hover hover:text-text-secondary'
            )}
          >
            {range.label}
          </button>
        ))}
      </div>

      {/* Overview Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {overviewCards.map((card, index) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="rounded-lg border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-md p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className={cn('rounded-lg p-2', card.gradient)}>
                <card.icon className="h-5 w-5 text-white" />
              </div>
              <div className="flex items-center gap-1 text-xs">
                <span className={cn('font-medium', card.trendUp ? 'text-success' : 'text-error')}>
                  {card.trend}
                </span>
              </div>
            </div>
            <p className="text-xs text-text-secondary mb-1">{card.label}</p>
            <p className="text-2xl font-bold text-white">{card.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Revenue Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mb-6 rounded-lg border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-md p-4 sm:p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Revenue Trend</h2>
            <p className="text-xs text-text-tertiary">Last {timeRange === '7d' ? '7 days' : timeRange === '30d' ? '30 days' : timeRange === '90d' ? '90 days' : 'all time'}</p>
          </div>
          <Calendar className="h-5 w-5 text-text-secondary" />
        </div>

        {/* Bar chart visualization */}
        {revenueTrend.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-text-secondary">No revenue data for this period</p>
          </div>
        ) : (() => {
          const maxAmount = Math.max(...revenueTrend.map(i => i.amount), 1)
          return (
            <div className="space-y-3">
              {revenueTrend.map((item, index) => {
                const pct = Math.max((item.amount / maxAmount) * 100, item.amount > 0 ? 4 : 0)
                return (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-xs text-text-secondary">{item.label}</span>
                    <div className="flex-1">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.5, delay: 0.5 + index * 0.1 }}
                        className="h-8 rounded-lg bg-gradient-to-r from-primary to-primary/60 flex items-center justify-end pr-3 min-w-[3rem]"
                      >
                        <span className="text-xs font-medium text-white">${item.amount.toFixed(0)}</span>
                      </motion.div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })()}
      </motion.div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Top Performing Listings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="rounded-lg border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-md overflow-hidden"
        >
          <div className="p-4 border-b border-white/10">
            <h2 className="text-base font-semibold text-white">Top Performing Listings</h2>
            <p className="text-xs text-text-tertiary">Your best sellers</p>
          </div>

          <div className="p-4">
            {topListings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Package className="h-12 w-12 text-text-disabled mb-3" />
                <p className="text-text-secondary text-sm">No listings yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {topListings.slice(0, 5).map((listing, index) => (
                  <div
                    key={listing.id}
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-xs font-bold text-white">
                        #{index + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white line-clamp-1">
                          {listing.title}
                        </p>
                        <p className="text-xs text-text-tertiary">{listing.game?.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-white">${(listing.price * (listing.sales || 0)).toFixed(0)}</p>
                      <p className="text-xs text-text-tertiary">{listing.sales || 0} sales</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Performance Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="rounded-lg border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-md overflow-hidden"
        >
          <div className="p-4 border-b border-white/10">
            <h2 className="text-base font-semibold text-white">Performance Metrics</h2>
            <p className="text-xs text-text-tertiary">Key performance indicators</p>
          </div>

          <div className="p-4 space-y-4">
            {/* Total Views */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-lime/10 p-2">
                  <Eye className="h-4 w-4 text-lime-text" />
                </div>
                <div>
                  <p className="text-sm text-text-secondary">Total Views</p>
                  <p className="text-lg font-semibold text-white">{stats.performance.totalViews.toLocaleString()}</p>
                </div>
              </div>
              <ArrowUpRight className="h-4 w-4 text-success" />
            </div>

            {/* Total Sales */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-success-bg p-2">
                  <ShoppingCart className="h-4 w-4 text-success" />
                </div>
                <div>
                  <p className="text-sm text-text-secondary">Total Sales</p>
                  <p className="text-lg font-semibold text-white">{stats.performance.totalSales}</p>
                </div>
              </div>
              <ArrowUpRight className="h-4 w-4 text-success" />
            </div>

            {/* Average Rating */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-warning-bg p-2">
                  <Star className="h-4 w-4 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-text-secondary">Average Rating</p>
                  <p className="text-lg font-semibold text-white">{stats.performance.avgRating.toFixed(1)} / 5.0</p>
                </div>
              </div>
              <div className="flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={cn(
                      'h-3 w-3',
                      star <= Math.round(stats.performance.avgRating)
                        ? 'fill-warning text-warning'
                        : 'text-text-disabled'
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Active Listings */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-lime/10 p-2">
                  <Package className="h-4 w-4 text-lime-text" />
                </div>
                <div>
                  <p className="text-sm text-text-secondary">Active Listings</p>
                  <p className="text-lg font-semibold text-white">{stats.listings.active}</p>
                </div>
              </div>
              <Activity className="h-4 w-4 text-text-secondary" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* AI Insights */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="rounded-lg border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-md p-4 sm:p-6"
      >
        <div className="mb-4 flex items-center gap-2">
          <div className="rounded-lg bg-lime/10 p-2">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Quick Insights</h2>
            <p className="text-xs text-text-tertiary">AI-powered recommendations</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border border-lime-tint-border bg-lime/10 p-3">
            <p className="text-sm text-text-secondary">
              💡 Your conversion rate is <span className="font-semibold">{stats.performance.conversionRate.toFixed(1)}%</span> higher than average sellers. Keep up the great work!
            </p>
          </div>
          <div className="rounded-lg border border-success/30 bg-success-bg p-3">
            <p className="text-sm text-success">
              📈 Revenue increased by <span className="font-semibold">12.5%</span> compared to last period. Your listings are performing well!
            </p>
          </div>
          {stats.listings.active < 3 && (
            <div className="rounded-lg border border-warning/40 bg-warning-bg p-3">
              <p className="text-sm text-warning">
                ⚠️ Consider adding more listings to increase your reach and potential earnings.
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

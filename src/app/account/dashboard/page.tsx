'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { useRouter } from 'next/navigation'
import { useSellerDashboard } from '@/hooks/use-seller-dashboard'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  ShoppingCart,
  Star,
  Eye,
  MessageSquare,
  ArrowRight,
  Zap,
  Target,
  Award,
  Clock,
  AlertCircle,
  CheckCircle2,
  Sparkles
} from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Meteors } from '@/components/ui/meteors'
import BuyerDashboard from '@/components/account/BuyerDashboard'

const insights = [
  {
    type: 'opportunity',
    icon: Sparkles,
    title: 'Price Optimization',
    description: 'Your Valorant account listings are 15% below market average. Consider increasing prices.',
    action: 'Adjust Prices',
    color: 'text-warning',
    bgColor: 'bg-warning-bg'
  },
  {
    type: 'warning',
    icon: AlertCircle,
    title: 'Low Stock Alert',
    description: '3 listings have less than 5 items remaining. Restock to avoid missing sales.',
    action: 'View Listings',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10'
  },
  {
    type: 'success',
    icon: CheckCircle2,
    title: 'Peak Performance',
    description: 'Your sales increased by 23% this week! Keep up the great work.',
    action: 'View Report',
    color: 'text-success',
    bgColor: 'bg-success-bg'
  }
]

const quickActions = [
  { icon: Package, label: 'Create Listing', href: '/sell/new', color: 'from-cyan-500 to-blue-500' },
  { icon: Eye, label: 'View Orders', href: '/account/orders', color: 'from-purple-500 to-pink-500' },
  { icon: MessageSquare, label: 'Messages', href: '/messages', color: 'from-green-500 to-emerald-500' },
  { icon: Star, label: 'Reviews', href: '/account/reviews', color: 'from-yellow-500 to-orange-500' },
]

export default function SellerDashboard() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('week')
  const { stats, profile, isLoading: dataLoading } = useSellerDashboard()
  const [sellerStatusChecked, setSellerStatusChecked] = useState(false)
  const [isApprovedSeller, setIsApprovedSeller] = useState(false)

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  // Verify seller status directly as a fallback
  useEffect(() => {
    const checkSellerStatus = async () => {
      if (user && !sellerStatusChecked) {
        // Trust the useAuth hook first
        if (user.isApprovedSeller === true) {
          setIsApprovedSeller(true)
          setSellerStatusChecked(true)
          return
        }

        // Fallback: check directly from database
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()

        const { data } = await supabase
          .from('seller_applications')
          .select('status')
          .eq('user_id', user.id)
          .eq('status', 'approved')
          .single()

        setIsApprovedSeller(!!data)
        setSellerStatusChecked(true)
      }
    }

    checkSellerStatus()
  }, [user, sellerStatusChecked])

  if (loading || !user || dataLoading || !sellerStatusChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  // Show buyer dashboard if user is not an approved seller
  if (!isApprovedSeller) {
    return <BuyerDashboard user={user} />
  }

  // Calculate tier progress
  const tierLimits = {
    bronze: { next: 'silver', sales: 100 },
    silver: { next: 'gold', sales: 250 },
    gold: { next: 'platinum', sales: 500 },
    platinum: { next: 'platinum', sales: 1000 },
  }

  const currentTier = profile.seller_tier || 'bronze'
  const currentTierData = tierLimits[currentTier as keyof typeof tierLimits] || tierLimits.bronze
  const salesNeeded = Math.max(0, currentTierData.sales - profile.total_sales)
  const progress = Math.min(100, (profile.total_sales / currentTierData.sales) * 100)

  const getTierColor = (tier: string) => {
    const colors = {
      bronze: 'text-orange-400',
      silver: 'text-text-secondary',
      gold: 'text-warning',
      platinum: 'text-purple-400'
    }
    return colors[tier as keyof typeof colors] || 'text-text-secondary'
  }

  return (
    <div className="min-h-screen bg-black pb-20">
      <div className="mx-auto w-full max-w-full px-4 sm:px-6 md:max-w-7xl lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Seller Dashboard</h1>
              <p className="mt-1 text-text-secondary">
                Welcome back, {user.profile?.username || 'Seller'}!
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Time Range Selector */}
              <div className="flex gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
                {(['day', 'week', 'month'] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={cn(
                      'rounded-md px-4 py-2 text-sm font-medium transition-all',
                      timeRange === range
                        ? 'bg-primary text-white'
                        : 'text-text-secondary hover:text-white'
                    )}
                  >
                    {range === 'day' ? 'Today' : range === 'week' ? 'Week' : 'Month'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* AI Insights Banner */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {insights.map((insight, index) => {
            const Icon = insight.icon
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  'relative overflow-hidden rounded-xl border border-white/10 p-4',
                  insight.bgColor
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn('rounded-lg bg-white/10 p-2', insight.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="mb-1 font-semibold text-white">{insight.title}</h3>
                    <p className="mb-3 text-sm text-text-secondary">{insight.description}</p>
                    <button className={cn('text-sm font-medium hover:underline', insight.color)}>
                      {insight.action} →
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Stats & Quick Actions */}
          <div className="space-y-6 lg:col-span-2">
            {/* Earnings Overview */}
            <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 backdrop-blur-md">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Earnings Overview</h2>
                {stats.earnings.week > 0 && (
                  <div className="flex items-center gap-2 rounded-full bg-success-bg px-3 py-1 text-sm font-medium text-success">
                    <TrendingUp className="h-4 w-4" />
                    Growing
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: 'Today', amount: stats.earnings.today, icon: Clock },
                  { label: 'This Week', amount: stats.earnings.week, icon: TrendingUp },
                  { label: 'This Month', amount: stats.earnings.month, icon: DollarSign },
                  { label: 'All Time', amount: stats.earnings.allTime, icon: Award },
                ].map((stat, index) => {
                  const Icon = stat.icon
                  return (
                    <div
                      key={index}
                      className="rounded-lg border border-white/10 bg-white/5 p-4"
                    >
                      <div className="mb-2 flex items-center gap-2 text-text-secondary">
                        <Icon className="h-4 w-4" />
                        <span className="text-sm">{stat.label}</span>
                      </div>
                      <div className="text-2xl font-bold text-white">
                        ${stat.amount.toLocaleString()}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  label: 'Active Listings',
                  value: stats.listings.active,
                  icon: Package,
                  color: 'text-cyan-400',
                  bgColor: 'bg-cyan-500/10'
                },
                {
                  label: 'Pending Orders',
                  value: stats.orders.pending,
                  icon: ShoppingCart,
                  color: 'text-purple-400',
                  bgColor: 'bg-purple-500/10'
                },
                {
                  label: 'Avg Rating',
                  value: stats.performance.avgRating.toFixed(1),
                  icon: Star,
                  color: 'text-warning',
                  bgColor: 'bg-warning-bg'
                },
                {
                  label: 'Total Sales',
                  value: stats.performance.totalSales,
                  icon: MessageSquare,
                  color: 'text-success',
                  bgColor: 'bg-success-bg'
                },
              ].map((stat, index) => {
                const Icon = stat.icon
                return (
                  <div
                    key={index}
                    className={cn(
                      'rounded-xl border border-white/10 p-4',
                      stat.bgColor
                    )}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className={cn('rounded-lg bg-white/10 p-2', stat.color)}>
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="text-3xl font-bold text-white">{stat.value}</div>
                    <div className="mt-1 text-sm text-text-secondary">{stat.label}</div>
                  </div>
                )
              })}
            </div>

            {/* Quick Actions */}
            <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 backdrop-blur-md">
              <h2 className="mb-4 text-xl font-bold text-white">Quick Actions</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {quickActions.map((action, index) => {
                  const Icon = action.icon
                  return (
                    <Link
                      key={index}
                      href={action.href}
                      className={cn(
                        'group relative overflow-hidden rounded-lg border border-white/10 bg-gradient-to-br p-4 transition-all hover:scale-105',
                        action.color
                      )}
                    >
                      <div className="relative z-10 flex flex-col items-center gap-2 text-center">
                        <div className="rounded-lg bg-white/20 p-3">
                          <Icon className="h-6 w-6 text-white" />
                        </div>
                        <span className="text-sm font-medium text-white">{action.label}</span>
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Right Column - Tier Progress & Performance */}
          <div className="space-y-6">
            {/* Tier Progress */}
            <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 backdrop-blur-md">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Seller Tier</h2>
                <div className={cn('rounded-full bg-white/10 px-3 py-1 text-sm font-bold uppercase', getTierColor(currentTier))}>
                  {currentTier}
                </div>
              </div>

              <div className="mb-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-text-secondary">Progress to {currentTierData.next}</span>
                  <span className="font-medium text-white">
                    {profile.total_sales}/{currentTierData.sales}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 1, delay: 0.2 }}
                    className="h-full bg-gradient-to-r from-cyan-500 to-purple-600"
                  />
                </div>
                <p className="mt-2 text-xs text-text-secondary">
                  {salesNeeded > 0 ? `${salesNeeded} more sales to unlock ${currentTierData.next} tier` : 'Top tier achieved!'}
                </p>
              </div>

              <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="text-xs font-medium text-text-secondary">Tier Benefits</div>
                <div className="flex items-center gap-2 text-sm text-white">
                  <Zap className="h-4 w-4 text-warning" />
                  <span>Current Fee: 6.9%</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-white">
                  <Target className="h-4 w-4 text-cyan-400" />
                  <span>Next Tier: 5.9%</span>
                </div>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 backdrop-blur-md">
              <h2 className="mb-4 text-lg font-bold text-white">Performance</h2>
              <div className="space-y-4">
                {[
                  { label: 'Total Views', value: stats.performance.totalViews, icon: Eye, color: 'text-cyan-400' },
                  { label: 'Conversion Rate', value: `${stats.performance.conversionRate.toFixed(1)}%`, icon: Target, color: 'text-purple-400' },
                  { label: 'Completed Orders', value: stats.orders.completed, icon: CheckCircle2, color: 'text-success' },
                ].map((metric, index) => {
                  const Icon = metric.icon
                  return (
                    <div key={index} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center gap-3">
                        <Icon className={cn('h-5 w-5', metric.color)} />
                        <span className="text-sm text-text-secondary">{metric.label}</span>
                      </div>
                      <span className="font-bold text-white">{metric.value}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 backdrop-blur-md">
              <h2 className="mb-4 text-lg font-bold text-white">Recent Activity</h2>
              <div className="space-y-3">
                {[
                  { type: 'sale', text: 'New order #GV-20250124-A8F2', time: '5 min ago', color: 'text-success' },
                  { type: 'message', text: 'New message from buyer', time: '12 min ago', color: 'text-blue-400' },
                  { type: 'review', text: '5-star review received', time: '1 hour ago', color: 'text-warning' },
                ].map((activity, index) => (
                  <div key={index} className="flex items-start gap-3 text-sm">
                    <div className={cn('mt-1 h-2 w-2 rounded-full', `bg-${activity.color.split('-')[1]}-400`)} />
                    <div className="flex-1">
                      <p className="text-white">{activity.text}</p>
                      <p className="text-xs text-text-secondary">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link
                href="/account/activity"
                className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                View All Activity
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

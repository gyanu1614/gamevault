/**
 * Buyer Dashboard Component
 *
 * Dashboard for buyer account overview with:
 * - Purchase history insights (total spent, items bought)
 * - Savings tracker (discounts used)
 * - Active orders status
 * - Wishlist highlights
 * - Recommended actions
 */

'use client'

import React from 'react'
import Link from 'next/link'
import {
  ShoppingBag,
  Package,
  Heart,
  TrendingDown,
  Clock,
  CheckCircle2,
  Star,
  Sparkles,
  ArrowRight,
  DollarSign,
  Tag,
  Gift,
  Zap
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface BuyerDashboardProps {
  user: any // Type this properly based on your user type
}

export default function BuyerDashboard({ user }: BuyerDashboardProps) {
  // Mock data - replace with actual API calls
  const buyerStats = {
    totalSpent: 1234.50,
    totalSavings: 156.80,
    itemsPurchased: 12,
    activeOrders: 2,
    completedOrders: 10,
    wishlistItems: 5,
    reviewsGiven: 8
  }

  const activeOrders = [
    {
      id: '1',
      item: 'Valorant Account - Platinum 3',
      seller: 'ProGamers',
      status: 'delivered',
      date: '2 days ago',
      amount: 89.99
    },
    {
      id: '2',
      item: 'CS:GO Inventory - Rare Skins',
      seller: 'SkinMaster',
      status: 'processing',
      date: '5 days ago',
      amount: 245.00
    }
  ]

  const recentPurchases = [
    { game: 'Valorant', count: 5 },
    { game: 'CS:GO', count: 4 },
    { game: 'League of Legends', count: 3 }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">
            Welcome back, {user?.username || 'Buyer'}!
          </h1>
          <p className="mt-2 text-gray-400">
            Here's an overview of your gaming marketplace activity
          </p>
        </div>

        {/* Stats Grid */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total Spent */}
          <div className="rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Spent</p>
                <p className="mt-2 text-3xl font-bold text-white">
                  ${buyerStats.totalSpent.toFixed(2)}
                </p>
              </div>
              <div className="rounded-full bg-blue-500/20 p-3">
                <DollarSign className="h-6 w-6 text-blue-400" />
              </div>
            </div>
          </div>

          {/* Total Savings */}
          <div className="rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Savings</p>
                <p className="mt-2 text-3xl font-bold text-white">
                  ${buyerStats.totalSavings.toFixed(2)}
                </p>
                <div className="mt-1 flex items-center gap-1 text-xs text-green-400">
                  <TrendingDown className="h-3 w-3" />
                  <span>From deals & discounts</span>
                </div>
              </div>
              <div className="rounded-full bg-green-500/20 p-3">
                <Tag className="h-6 w-6 text-green-400" />
              </div>
            </div>
          </div>

          {/* Active Orders */}
          <div className="rounded-xl bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Active Orders</p>
                <p className="mt-2 text-3xl font-bold text-white">
                  {buyerStats.activeOrders}
                </p>
              </div>
              <div className="rounded-full bg-yellow-500/20 p-3">
                <Package className="h-6 w-6 text-yellow-400" />
              </div>
            </div>
          </div>

          {/* Wishlist Items */}
          <div className="rounded-xl bg-gradient-to-br from-pink-500/10 to-purple-500/10 border border-pink-500/20 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Wishlist</p>
                <p className="mt-2 text-3xl font-bold text-white">
                  {buyerStats.wishlistItems}
                </p>
              </div>
              <div className="rounded-full bg-pink-500/20 p-3">
                <Heart className="h-6 w-6 text-pink-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Active Orders Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Active Orders Card */}
            <div className="rounded-xl bg-gray-900/50 border border-white/10 p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Active Orders</h2>
                <Link
                  href="/account/orders"
                  className="text-sm text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                >
                  View All
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="space-y-3">
                {activeOrders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-lg bg-black/30 border border-white/5 p-4 hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-white">{order.item}</h3>
                        <p className="mt-1 text-sm text-gray-400">
                          Seller: {order.seller} • {order.date}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          {order.status === 'delivered' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-400 border border-blue-500/20">
                              <CheckCircle2 className="h-3 w-3" />
                              Delivered
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/10 px-2 py-1 text-xs font-medium text-yellow-400 border border-yellow-500/20">
                              <Clock className="h-3 w-3" />
                              Processing
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-white">
                          ${order.amount.toFixed(2)}
                        </p>
                        <Link
                          href={`/account/orders/${order.id}`}
                          className="mt-1 text-xs text-primary hover:text-primary/80"
                        >
                          View Details
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Purchase Insights */}
            <div className="rounded-xl bg-gray-900/50 border border-white/10 p-6">
              <h2 className="mb-4 text-xl font-bold text-white">Purchase Insights</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-400 mb-2">Your favorite games</p>
                  <div className="space-y-2">
                    {recentPurchases.map((game, index) => (
                      <div key={game.game} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
                            index === 0 ? "bg-yellow-500/20 text-yellow-400" :
                            index === 1 ? "bg-gray-500/20 text-gray-400" :
                            "bg-orange-500/20 text-orange-400"
                          )}>
                            #{index + 1}
                          </div>
                          <span className="text-white">{game.game}</span>
                        </div>
                        <span className="text-sm text-gray-400">{game.count} items</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Column */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="rounded-xl bg-gray-900/50 border border-white/10 p-6">
              <h2 className="mb-4 text-lg font-bold text-white">Quick Actions</h2>
              <div className="space-y-2">
                <Link
                  href="/browse"
                  className="flex items-center gap-3 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-3 text-sm font-medium text-white transition-all hover:from-violet-700 hover:to-purple-700"
                >
                  <ShoppingBag className="h-4 w-4" />
                  Browse Marketplace
                </Link>
                <Link
                  href="/account/wishlist"
                  className="flex items-center gap-3 rounded-lg bg-white/5 px-4 py-3 text-sm font-medium text-white transition-all hover:bg-white/10"
                >
                  <Heart className="h-4 w-4" />
                  View Wishlist
                </Link>
                <Link
                  href="/account/orders"
                  className="flex items-center gap-3 rounded-lg bg-white/5 px-4 py-3 text-sm font-medium text-white transition-all hover:bg-white/10"
                >
                  <Package className="h-4 w-4" />
                  My Orders
                </Link>
              </div>
            </div>

            {/* Seller CTA */}
            <div className="rounded-xl bg-gradient-to-br from-violet-500/10 via-purple-500/10 to-pink-500/10 border border-violet-500/20 p-6">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-violet-400" />
                <h3 className="font-bold text-white">Become a Seller</h3>
              </div>
              <p className="mb-4 text-sm text-gray-400">
                Start selling your gaming accounts and earn money with the lowest fees in the industry.
              </p>
              <Link
                href="/account/become-seller"
                className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2 text-sm font-medium text-white transition-all hover:from-violet-700 hover:to-purple-700"
              >
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Stats Summary */}
            <div className="rounded-xl bg-gray-900/50 border border-white/10 p-6">
              <h2 className="mb-4 text-lg font-bold text-white">Your Stats</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Items Purchased</span>
                  <span className="text-sm font-medium text-white">{buyerStats.itemsPurchased}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Completed Orders</span>
                  <span className="text-sm font-medium text-white">{buyerStats.completedOrders}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Reviews Given</span>
                  <span className="text-sm font-medium text-white">{buyerStats.reviewsGiven}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

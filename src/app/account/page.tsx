/**
 * Account Home/Overview Page
 * Unified dashboard for both buyers and sellers
 */

import { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  ShoppingCart,
  MessageSquare,
  Package,
  TrendingUp,
  ArrowRight
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'My Account | GameVault',
  description: 'Manage your orders, messages, and account settings'
}

export default async function AccountPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check if user is an approved seller
  const { data: sellerApp } = await supabase
    .from('seller_applications')
    .select('status')
    .eq('user_id', user.id)
    .single() as any

  const isApprovedSeller = sellerApp?.status === 'approved'

  // Get recent orders count
  const { count: buyerOrdersCount } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('buyer_id', user.id)

  const { count: sellerOrdersCount } = isApprovedSeller ? await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('seller_id', user.id) : { count: 0 }

  // Get unread messages count
  const { count: unreadCount } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('receiver_id', user.id)
    .eq('read', false)

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Welcome back!
          </h1>
          <p className="text-gray-400">
            {isApprovedSeller ? 'Manage your purchases and sales' : 'Manage your account'}
          </p>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Orders Card */}
          <Link
            href="/account/orders"
            className="group bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.05] rounded-xl p-6 transition-all hover:border-violet-500/30"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-violet-500/10 rounded-lg">
                <ShoppingCart className="w-6 h-6 text-violet-400" />
              </div>
              <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-violet-400 transition-colors" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">Orders</h3>
            <p className="text-sm text-gray-400 mb-3">
              {isApprovedSeller
                ? `${buyerOrdersCount || 0} purchases, ${sellerOrdersCount || 0} sales`
                : `${buyerOrdersCount || 0} orders`}
            </p>
            <div className="text-xs text-violet-400 font-medium">
              View all orders →
            </div>
          </Link>

          {/* Messages Card */}
          <Link
            href="/account/messages"
            className="group bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.05] rounded-xl p-6 transition-all hover:border-blue-500/30"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-500/10 rounded-lg relative">
                <MessageSquare className="w-6 h-6 text-blue-400" />
                {(unreadCount || 0) > 0 && (
                  <div className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                    {unreadCount}
                  </div>
                )}
              </div>
              <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-blue-400 transition-colors" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">Messages</h3>
            <p className="text-sm text-gray-400 mb-3">
              {(unreadCount || 0) > 0
                ? `${unreadCount} unread message${(unreadCount || 0) > 1 ? 's' : ''}`
                : 'No unread messages'}
            </p>
            <div className="text-xs text-blue-400 font-medium">
              Open inbox →
            </div>
          </Link>

          {/* Seller Listings Card - Only show if approved seller */}
          {isApprovedSeller && (
            <Link
              href="/seller/listings"
              className="group bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.05] rounded-xl p-6 transition-all hover:border-green-500/30"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <Package className="w-6 h-6 text-green-400" />
                </div>
                <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-green-400 transition-colors" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">My Listings</h3>
              <p className="text-sm text-gray-400 mb-3">
                Manage your products
              </p>
              <div className="text-xs text-green-400 font-medium">
                View listings →
              </div>
            </Link>
          )}

          {/* Seller Analytics Card - Only show if approved seller */}
          {isApprovedSeller && (
            <Link
              href="/seller/analytics"
              className="group bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.05] rounded-xl p-6 transition-all hover:border-orange-500/30"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-orange-500/10 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-orange-400" />
                </div>
                <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-orange-400 transition-colors" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">Analytics</h3>
              <p className="text-sm text-gray-400 mb-3">
                View sales performance
              </p>
              <div className="text-xs text-orange-400 font-medium">
                View analytics →
              </div>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

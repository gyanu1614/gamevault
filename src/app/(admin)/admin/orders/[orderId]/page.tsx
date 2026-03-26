import React from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getOrder } from '@/lib/actions/orders'
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Shield,
  Package,
  XCircle,
  RefreshCw,
  Truck,
  User,
  Store,
  Mail,
  Calendar,
  DollarSign,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getAvatarUrl } from '@/lib/utils/avatar'

interface PageProps {
  params: Promise<{ orderId: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { orderId } = await params
  return {
    title: `Order ${orderId} | Admin | GameVault`,
    description: 'Admin order details',
  }
}

const STATUS_CONFIG: Record<string, { label: string; pill: string; dot: string; pulse: boolean; icon: React.ElementType }> = {
  pending:    { label: 'Pending',     pill: 'bg-blue-500/10 text-blue-400 border-blue-500/20',       dot: 'bg-blue-400',    pulse: true,  icon: Clock },
  processing: { label: 'Processing',  pill: 'bg-amber-500/10 text-amber-400 border-amber-500/20',   dot: 'bg-amber-400',  pulse: true,  icon: Clock },
  paid:       { label: 'Paid',        pill: 'bg-green-500/10 text-green-400 border-green-500/20',    dot: 'bg-green-400',  pulse: false, icon: CheckCircle2 },
  delivering: { label: 'Delivering',  pill: 'bg-violet-500/10 text-violet-400 border-violet-500/20', dot: 'bg-violet-400', pulse: true,  icon: Truck },
  delivered:  { label: 'Delivered',   pill: 'bg-blue-500/10 text-blue-400 border-blue-500/20',       dot: 'bg-blue-400',   pulse: false, icon: Package },
  completed:  { label: 'Completed',   pill: 'bg-green-500/10 text-green-400 border-green-500/20',    dot: 'bg-green-400',  pulse: false, icon: CheckCircle2 },
  disputed:   { label: 'Disputed',    pill: 'bg-red-500/10 text-red-400 border-red-500/20',          dot: 'bg-red-400',    pulse: true,  icon: AlertTriangle },
  refunded:   { label: 'Refunded',    pill: 'bg-gray-500/10 text-gray-400 border-gray-500/20',       dot: 'bg-gray-400',   pulse: false, icon: RefreshCw },
  cancelled:  { label: 'Cancelled',   pill: 'bg-orange-500/10 text-orange-400 border-orange-500/20', dot: 'bg-orange-400', pulse: false, icon: XCircle },
}

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
  const Icon = cfg.icon
  return (
    <div className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold', cfg.pill)}>
      <span className="relative flex h-2 w-2 flex-shrink-0">
        {cfg.pulse && <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-60', cfg.dot)} />}
        <span className={cn('relative inline-flex rounded-full h-2 w-2', cfg.dot)} />
      </span>
      <Icon className="h-3.5 w-3.5" />
      {cfg.label}
    </div>
  )
}

function EscrowPill({ escrowStatus }: { escrowStatus: string }) {
  const cfg: Record<string, { label: string; pill: string }> = {
    pending:  { label: 'Pending',         pill: 'bg-blue-500/10 text-blue-400/80 border-blue-500/15' },
    held:     { label: 'In Escrow',       pill: 'bg-violet-500/10 text-violet-400/80 border-violet-500/15' },
    released: { label: 'Escrow Released', pill: 'bg-blue-500/10 text-blue-400/80 border-blue-500/15' },
    refunded: { label: 'Refunded',        pill: 'bg-gray-500/10 text-gray-500 border-gray-500/15' },
    frozen:   { label: 'Under Review',    pill: 'bg-red-500/10 text-red-400/80 border-red-500/15' },
  }
  const c = cfg[escrowStatus] ?? cfg.pending
  return (
    <div className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium', c.pill)}>
      <Shield className="h-3 w-3" />
      {c.label}
    </div>
  )
}

export default async function AdminOrderDetailPage({ params }: PageProps) {
  const { orderId } = await params
  const supabase = await createClient()

  const orderResult = await getOrder(orderId)
  if (!orderResult.success || !orderResult.order) notFound()

  const order = orderResult.order

  // Fetch buyer and seller profiles
  const { data: buyer } = await supabase
    .from('profiles')
    .select('id, username, email, avatar_url')
    .eq('id', order.buyer_id)
    .single() as any

  const { data: seller } = await supabase
    .from('profiles')
    .select('id, username, email, avatar_url, shop_name')
    .eq('id', order.seller_id)
    .single() as any

  // Fetch game and category
  let game: { id: string; name: string; slug: string; image_url: string | null; emoji: string } | null = null
  let category: { id: string; name: string; slug: string } | null = null

  if (order.listing?.game_id) {
    const { data: gameData } = await supabase
      .from('games')
      .select('id, name, slug, image_url, emoji')
      .eq('id', order.listing.game_id)
      .single() as any
    game = gameData
  }

  if (order.listing?.category_id) {
    const { data: categoryData } = await supabase
      .from('categories')
      .select('id, name, slug')
      .eq('id', order.listing.category_id)
      .single() as any
    category = categoryData
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/orders"
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Orders
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={order.status} />
          <EscrowPill escrowStatus={order.escrow_status} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-5">
          {/* Order Info Card */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">{order.order_number}</h1>
                <p className="text-sm text-gray-500">Order ID: {order.id}</p>
              </div>
              <Link
                href={`/account/orders/${order.id}`}
                target="_blank"
                className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                View as User
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>

            {/* Listing Details */}
            {order.listing && (
              <div className="flex gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] mb-6">
                {game && (
                  game.image_url ? (
                    <img
                      src={game.image_url}
                      alt={game.name}
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-lg bg-white/[0.06] flex items-center justify-center text-2xl">
                      {game.emoji}
                    </div>
                  )
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-white mb-1">{order.listing.title}</h3>
                  {game && (
                    <p className="text-xs text-gray-500 flex items-center gap-1.5">
                      <span>{game.emoji}</span>
                      <span>{game.name}</span>
                      {category && (
                        <>
                          <span className="text-gray-700">•</span>
                          <span>{category.name}</span>
                        </>
                      )}
                    </p>
                  )}
                  <p className="text-xs text-gray-600 mt-1">Quantity: {order.quantity}</p>
                </div>
              </div>
            )}

            {/* Financial Breakdown */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white">Financial Details</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Total Amount</span>
                  <span className="font-semibold text-white">${order.total_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Platform Fee ({(order.platform_fee_percentage * 100).toFixed(1)}%)</span>
                  <span className="text-amber-400">-${order.platform_fee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-white/[0.06]">
                  <span className="text-gray-400">Seller Payout</span>
                  <span className="font-bold text-green-400">${order.seller_payout.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-6">
            <h3 className="text-sm font-semibold text-white mb-4">Order Timeline</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center flex-shrink-0">
                  <Calendar className="h-4 w-4 text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Order Created</p>
                  <p className="text-xs text-gray-500">
                    {new Date(order.created_at).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>

              {order.delivered_at && (
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <Package className="h-4 w-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Delivered</p>
                    <p className="text-xs text-gray-500">
                      {new Date(order.delivered_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              )}

              {order.completed_at && (
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Completed</p>
                    <p className="text-xs text-gray-500">
                      {new Date(order.completed_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Buyer Info */}
          {buyer && (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <User className="h-4 w-4 text-violet-400" />
                Buyer
              </h3>
              <div className="flex items-center gap-3 mb-3">
                <img
                  src={getAvatarUrl(buyer.avatar_url, buyer.username)}
                  alt={buyer.username}
                  className="h-10 w-10 rounded-full border border-white/10"
                />
                <div>
                  <p className="text-sm font-medium text-white">{buyer.username}</p>
                  <p className="text-xs text-gray-500">{buyer.email}</p>
                </div>
              </div>
              <Link
                href={`/admin/users/${buyer.id}`}
                className="text-xs text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1"
              >
                View Profile
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          )}

          {/* Seller Info */}
          {seller && (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Store className="h-4 w-4 text-violet-400" />
                Seller
              </h3>
              <div className="flex items-center gap-3 mb-3">
                <img
                  src={getAvatarUrl(seller.avatar_url, seller.username)}
                  alt={seller.username}
                  className="h-10 w-10 rounded-full border border-white/10"
                />
                <div>
                  <p className="text-sm font-medium text-white">{seller.shop_name || seller.username}</p>
                  <p className="text-xs text-gray-500">{seller.email}</p>
                </div>
              </div>
              <Link
                href={`/admin/active-sellers?seller=${seller.id}`}
                className="text-xs text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1"
              >
                View Seller Profile
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          )}

          {/* Quick Actions */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Quick Actions</h3>
            <div className="space-y-2">
              {order.dispute_id && (
                <Link
                  href={`/admin/disputes/${order.dispute_id}`}
                  className="block w-full px-3 py-2 text-sm font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/20 transition-colors text-center"
                >
                  View Dispute
                </Link>
              )}
              <Link
                href={`/account/orders/${order.id}`}
                target="_blank"
                className="block w-full px-3 py-2 text-sm font-medium bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 rounded-lg border border-violet-500/20 transition-colors text-center"
              >
                Open Order Page
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

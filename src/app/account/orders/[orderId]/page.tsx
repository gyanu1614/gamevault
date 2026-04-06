/**
 * Order Detail Page
 */

import React from 'react'
import { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import BuyerOrderDetailClient from '@/components/orders/BuyerOrderDetailClientCompact'
import SellerOrderDetailClient from '@/components/orders/SellerOrderDetailClientCompact'
import CopyOrderId from '@/components/orders/CopyOrderId'

interface PageProps {
  params: Promise<{ orderId: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { orderId } = await params
  return {
    title: `Order ${orderId} | GameVault`,
    description: 'View your order details and status',
  }
}

async function checkOrderAccess(orderId: string, userId: string) {
  const supabase = await createClient()
  const { data: order } = await supabase
    .from('orders')
    .select('buyer_id, seller_id')
    .eq('id', orderId)
    .single() as any
  if (!order) return { hasAccess: false, userRole: null }
  const isBuyer  = order.buyer_id  === userId
  const isSeller = order.seller_id === userId
  return {
    hasAccess: isBuyer || isSeller,
    userRole: isBuyer ? 'buyer' : isSeller ? 'seller' : null,
  }
}

// ── Status badge config ───────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; pill: string; dot: string; pulse: boolean; icon: React.ElementType }> = {
  paid:       { label: 'Processing',  pill: 'bg-amber-500/10 text-amber-400 border-amber-500/20',   dot: 'bg-amber-400',  pulse: true,  icon: Clock },
  delivering: { label: 'Delivering',  pill: 'bg-violet-500/10 text-violet-400 border-violet-500/20', dot: 'bg-violet-400', pulse: true,  icon: Truck },
  delivered:  { label: 'Delivered',   pill: 'bg-blue-500/10 text-blue-400 border-blue-500/20',       dot: 'bg-blue-400',   pulse: false, icon: Package },
  completed:  { label: 'Completed',   pill: 'bg-green-500/10 text-green-400 border-green-500/20',    dot: 'bg-green-400',  pulse: false, icon: CheckCircle2 },
  disputed:   { label: 'Disputed',    pill: 'bg-red-500/10 text-red-400 border-red-500/20',          dot: 'bg-red-400',    pulse: true,  icon: AlertTriangle },
  resolved:   { label: 'Resolved',    pill: 'bg-green-500/10 text-green-400 border-green-500/20',    dot: 'bg-green-400',  pulse: false, icon: CheckCircle2 },
  refunded:   { label: 'Refunded',    pill: 'bg-gray-500/10 text-gray-400 border-gray-500/20',       dot: 'bg-gray-400',   pulse: false, icon: RefreshCw },
  cancelled:  { label: 'Cancelled',   pill: 'bg-orange-500/10 text-orange-400 border-orange-500/20', dot: 'bg-orange-400', pulse: false, icon: XCircle },
}

function StatusPill({ status, disputeResolved }: { status: string; disputeResolved?: boolean }) {
  // Show "Resolved" instead of "Disputed" if dispute is resolved
  const effectiveStatus = (status === 'disputed' && disputeResolved) ? 'resolved' : status
  const cfg = STATUS_CONFIG[effectiveStatus] ?? STATUS_CONFIG.paid
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

function EscrowPill({ escrowStatus, disputeResolved }: { escrowStatus: string; disputeResolved?: boolean }) {
  const cfg: Record<string, { label: string; pill: string }> = {
    held:     { label: 'Funds in Escrow',             pill: 'bg-violet-500/10 text-violet-400/80 border-violet-500/15' },
    released: { label: 'Payment Released to Seller', pill: 'bg-blue-500/10 text-blue-400/80 border-blue-500/15' },
    refunded: { label: 'Refunded to Wallet',         pill: 'bg-cyan-500/10 text-cyan-400/80 border-cyan-500/15' },
    frozen:   { label: 'Under Review',               pill: 'bg-red-500/10 text-red-400/80 border-red-500/15' },
    resolved: { label: 'Resolved',                   pill: 'bg-green-500/10 text-green-400/80 border-green-500/15' },
  }
  // Show "Resolved" instead of "Under Review" if dispute is resolved
  const effectiveStatus = (escrowStatus === 'frozen' && disputeResolved) ? 'resolved' : escrowStatus
  const c = cfg[effectiveStatus] ?? cfg.held
  return (
    <div className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium', c.pill)}>
      <Shield className="h-3 w-3" />
      {c.label}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function OrderDetailPage({ params }: PageProps) {
  const { orderId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const orderResult = await getOrder(orderId)
  if (!orderResult.success || !orderResult.order) notFound()

  const order = orderResult.order
  const { hasAccess, userRole } = await checkOrderAccess(orderId, user.id)
  if (!hasAccess || !userRole) notFound()

  // Fetch game and category data separately (nested joins not supported without explicit FK)
  let game: { id: string; name: string; slug: string; image_url: string | null } | null = null
  let category: { id: string; name: string; slug: string } | null = null

  if (order.listing?.game_id) {
    const { data: gameData } = await supabase
      .from('games')
      .select('id, name, slug, image_url')
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

  // Attach game and category to order.listing for downstream components
  if (order.listing) {
    order.listing.game = game
    order.listing.category = category
  }

  // Fetch dispute resolution if order was disputed
  let disputeResolution: {
    status: string
    favored_party: 'buyer' | 'seller' | 'neutral'
    resolution_type: string
    refund_amount?: number
    refund_percentage?: number
    seller_payout_amount?: number
    resolution_notes?: string
    resolved_at: string
    buyer_username?: string
    seller_username?: string
  } | null = null

  if (order.disputed_at) {
    const { data: disputeData } = await supabase
      .from('disputes')
      .select('id, status')
      .eq('transaction_id', orderId)
      .in('status', ['resolved_buyer_favor', 'resolved_seller_favor', 'resolved_partial'])
      .maybeSingle() as any

    if (disputeData) {
      const { data: resolutionData } = await supabase
        .from('dispute_resolutions')
        .select('favored_party, resolution_type, refund_amount, refund_percentage, seller_payout_amount, resolution_notes, created_at')
        .eq('dispute_id', disputeData.id)
        .maybeSingle() as any

      if (resolutionData) {
        disputeResolution = {
          status: disputeData.status,
          favored_party: resolutionData.favored_party,
          resolution_type: resolutionData.resolution_type,
          refund_amount: resolutionData.refund_amount,
          refund_percentage: resolutionData.refund_percentage,
          seller_payout_amount: resolutionData.seller_payout_amount,
          resolution_notes: resolutionData.resolution_notes,
          resolved_at: resolutionData.created_at,
          buyer_username: order.buyer?.username,
          seller_username: order.seller?.username,
        }
      }
    }
  }

  // Computed timing values
  const now = new Date()

  const autoReleaseDate = order.auto_release_at ? new Date(order.auto_release_at) : null
  const timeRemaining   = autoReleaseDate ? Math.max(0, autoReleaseDate.getTime() - now.getTime()) : 0
  const hoursRemaining  = Math.floor(timeRemaining / (1000 * 60 * 60))
  const minutesRemaining = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60))

  const protectionDate    = order.protection_until ? new Date(order.protection_until) : null
  const protectionRemaining = protectionDate ? Math.max(0, protectionDate.getTime() - now.getTime()) : 0
  const protectionDays    = Math.floor(protectionRemaining / (1000 * 60 * 60 * 24))

  const orderNum       = order.order_number || order.id.slice(0, 8).toUpperCase()
  const listingImageUrl = order.listing?.images?.[0]
  const gameImageUrl   = game?.image_url
  const listingTitle   = order.listing?.title
  const gameName       = game?.name
  const categoryName   = category?.name

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] via-[#0d0d14] to-[#0a0a0f]">
      {/* Scale wrapper - 110% for better readability */}
      <div style={{ transform: 'scale(1.1)', transformOrigin: 'top' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8 md:pt-6">

        {/* Back link */}
        <Link
          href="/account/orders"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.12] text-sm text-gray-300 hover:text-white transition-all mb-7"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Orders
        </Link>

        {/* ── Page header ─────────────────────────────────────────────── */}
        <div className="mb-7 flex items-center gap-4">
          {/* Listing image (fallback to game icon) */}
          {listingImageUrl || gameImageUrl ? (
            <Image
              src={listingImageUrl || gameImageUrl}
              alt={listingTitle || gameName || 'Order'}
              width={72}
              height={72}
              className="rounded-xl object-cover flex-shrink-0 ring-1 ring-white/10 shadow-lg"
            />
          ) : (
            <div className="h-18 w-18 rounded-xl bg-white/[0.05] border border-white/[0.08] flex-shrink-0" />
          )}

          {/* Left: title + game + category + order ID */}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-white leading-tight truncate">
              {listingTitle || 'Order Details'}
            </h1>
            <div className="flex items-center gap-2 mt-1.5 truncate">
              {gameName && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-xs font-medium text-gray-400">
                  <Package className="h-3 w-3 text-gray-500" />
                  {gameName}
                </span>
              )}
              {categoryName && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-xs font-medium text-gray-400">
                  {categoryName}
                </span>
              )}
            </div>
            <div className="mt-1.5">
              <CopyOrderId orderNum={orderNum} />
            </div>
          </div>

          {/* Right: status pills — stacked when escrow released */}
          <div className={cn(
            'flex flex-shrink-0 gap-2',
            order.escrow_status === 'released' ? 'flex-col items-end' : 'flex-row items-center'
          )}>
            <StatusPill status={order.status} disputeResolved={!!disputeResolution} />
            <EscrowPill escrowStatus={order.escrow_status} disputeResolved={!!disputeResolution} />
          </div>
        </div>

        {/* Client component — buyer or seller view */}
        {userRole === 'buyer' ? (
          <BuyerOrderDetailClient
            order={order}
            disputeResolution={disputeResolution}
            timeRemaining={timeRemaining}
            hoursRemaining={hoursRemaining}
            minutesRemaining={minutesRemaining}
            protectionDays={protectionDays}
          />
        ) : (
          <SellerOrderDetailClient
            order={order}
            disputeResolution={disputeResolution}
            sellerPayout={order.seller_payout || 0}
            timeRemaining={timeRemaining}
            hoursRemaining={hoursRemaining}
            minutesRemaining={minutesRemaining}
          />
        )}

        </div>
      </div>
    </div>
  )
}

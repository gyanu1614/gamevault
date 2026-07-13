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
import { parseDeliveryMinutes } from '@/lib/utils/delivery-time'
import BuyerOrderDetailClient from '@/components/orders/BuyerOrderDetailClientCompact'
import SellerOrderDetailClient from '@/components/orders/SellerOrderDetailClientCompact'
import CopyOrderId from '@/components/orders/CopyOrderId'
import { OrderClient } from './_OrderClient'
import { PaymentReturnHandler } from './_PaymentReturnHandler'

interface PageProps {
  params: Promise<{ orderId: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { orderId } = await params
  return {
    title: `Order ${orderId}`,
    description: 'View your order details and status',
  }
}

type OrderRole = 'buyer' | 'seller' | 'admin'

async function checkOrderAccess(
  orderId: string,
  userId: string,
): Promise<{ hasAccess: boolean; userRole: OrderRole | null }> {
  const supabase = await createClient()
  const { data: order } = await supabase
    .from('orders')
    .select('buyer_id, seller_id')
    .eq('id', orderId)
    .single() as any
  if (!order) return { hasAccess: false, userRole: null }
  const isBuyer  = order.buyer_id  === userId
  const isSeller = order.seller_id === userId
  // TODO V21/P9 — also check admin role via permissions table
  return {
    hasAccess: isBuyer || isSeller,
    userRole: isBuyer ? 'buyer' : isSeller ? 'seller' : null,
  }
}

// ── Status badge config ───────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; pill: string; dot: string; pulse: boolean; icon: React.ElementType }> = {
  paid:       { label: 'Processing',  pill: 'bg-amber-500/10 text-amber-400 border-amber-500/20',   dot: 'bg-amber-400',  pulse: true,  icon: Clock },
  delivering: { label: 'Delivering',  pill: 'bg-lime-tint-bg text-lime-text border-lime-tint-border', dot: 'bg-lime', pulse: true,  icon: Truck },
  delivered:  { label: 'Delivered',   pill: 'bg-blue-500/10 text-blue-400 border-blue-500/20',       dot: 'bg-blue-400',   pulse: false, icon: Package },
  completed:  { label: 'Completed',   pill: 'bg-success-bg text-success border-green-500/20',    dot: 'bg-green-400',  pulse: false, icon: CheckCircle2 },
  disputed:   { label: 'Disputed',    pill: 'bg-error-bg text-error border-error/40',          dot: 'bg-red-400',    pulse: true,  icon: AlertTriangle },
  resolved:   { label: 'Resolved',    pill: 'bg-success-bg text-success border-green-500/20',    dot: 'bg-green-400',  pulse: false, icon: CheckCircle2 },
  refunded:   { label: 'Refunded',    pill: 'bg-gray-500/10 text-text-secondary border-gray-500/20',       dot: 'bg-gray-400',   pulse: false, icon: RefreshCw },
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
    held:     { label: 'Covered by SafeDrop',        pill: 'bg-lime/10 text-lime-text/80 border-lime-tint-border' },
    released: { label: 'Seller Paid Out',            pill: 'bg-blue-500/10 text-blue-400/80 border-blue-500/15' },
    refunded: { label: 'Refund Issued',              pill: 'bg-cyan-500/10 text-cyan-400/80 border-cyan-500/15' },
    frozen:   { label: 'Under Review',               pill: 'bg-error-bg text-error/80 border-red-500/15' },
    resolved: { label: 'Resolved',                   pill: 'bg-success-bg text-success/80 border-green-500/15' },
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

  // V21/P3.b — Display-layer rebrand: GV- → DM-. DB rows keep their
  // legacy order_number until a migration regenerates them; the URL
  // resolver work is tracked separately. New orders are emitted with
  // DM- prefix at the action level.
  const rawOrderNum    = order.order_number || order.id.slice(0, 8).toUpperCase()
  const orderNum       = rawOrderNum.replace(/^GV-/, 'DM-')
  const listingImageUrl = order.listing?.images?.[0]
  const gameImageUrl   = game?.image_url
  const listingTitle   = order.listing?.title
  const gameName       = game?.name
  const categoryName   = category?.name

  // V21/P2 — derive SLA window from the listing's delivery_time LABEL
  // ("20min" / "1hr" / "1-24 hours" …) via parseDeliveryMinutes. (The old
  // Number(delivery_time) was NaN for every stored value → always fell back to
  // 60 min, so a 20-min listing showed a 1-hour SLA.) Real start time is
  // order.delivering_at if set; otherwise created_at acts as the clock.
  const slaMinutes = parseDeliveryMinutes(order.listing?.delivery_time)
  const slaSeconds = slaMinutes * 60
  const slaStartedAt: string = (order as any).delivering_at ?? order.created_at

  const placedAtDate = new Date(order.created_at)
  const placedAtLabel = placedAtDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  // V21/P5 — Resolve (or lazily create) the order-scoped conversation
  // so the chat hero can render on first paint. Pure server-side work.
  const { data: convo } = await supabase
    .from('conversations')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle() as any

  let conversationId: string | null = convo?.id ?? null
  if (!conversationId) {
    const { data: created } = await (supabase.from('conversations').insert as any)({
      order_id:  orderId,
      buyer_id:  order.buyer_id,
      seller_id: order.seller_id,
    })
      .select('id')
      .single() as any
    conversationId = created?.id ?? null
  }

  // V21/P5.l — Pull the buyer's review for this order (if any).
  // Used on BOTH sides: buyer view morphs the strip to "Review
  // Submitted"; seller view shows a "Buyer's Review" card in the rail.
  // recommends_seller isn't a real column; derive from rating>=4.
  let existingReview: {
    rating: number
    comment: string
    recommendsSeller?: boolean | null
    createdAt: string
  } | null = null
  // Use the buyer_id for the lookup so the seller (or admin) sees the
  // SAME review the buyer wrote, not a row for themselves.
  const reviewerForLookup = order.buyer_id
  if (reviewerForLookup) {
    const { data: reviewRow, error: reviewErr } = await supabase
      .from('reviews')
      .select('rating, comment, created_at')
      .eq('order_id', orderId)
      .eq('reviewer_id', reviewerForLookup)
      .maybeSingle() as any
    if (reviewErr) {
      console.error('[order page] review lookup failed', reviewErr)
    }
    if (reviewRow) {
      const r = Number(reviewRow.rating ?? 0)
      existingReview = {
        rating: r,
        comment: String(reviewRow.comment ?? ''),
        recommendsSeller: r >= 4,
        createdAt: reviewRow.created_at,
      }
    }
  }

  return (
    <>
      {/* Post-payment return from CoinGate (?paid=1): collapse history so Back
          skips the payment page + acknowledge the payment while the webhook
          confirms. useSearchParams needs a Suspense boundary. */}
      <React.Suspense fallback={null}>
        <PaymentReturnHandler />
      </React.Suspense>
      {/* V21/P5.y — Preload the hero backdrop so it's cached by the
          time the .hero-backdrop element mounts. Otherwise the AVIF
          (referenced as a CSS background-image) is invisible to the
          HTML preloader and only starts downloading after CSS parses,
          producing visible pop-in on every navigation into the page.
          Same trick used on the homepage (src/app/page.tsx). */}
      <link
        rel="preload"
        as="image"
        href="/assets/heroes/order.avif"
        type="image/avif"
        // @ts-expect-error — fetchpriority is valid HTML; React types lag.
        fetchpriority="high"
      />
      <OrderClient
        order={order}
        userRole={userRole}
        disputeResolution={disputeResolution}
        itemImageUrl={listingImageUrl ?? gameImageUrl ?? null}
        itemTitle={listingTitle ?? 'Order Details'}
        gameName={gameName ?? null}
        gameIconUrl={game?.image_url ?? null}
        categoryName={categoryName ?? null}
        categorySlug={category?.slug ?? null}
        orderNumber={orderNum}
        slaStartedAt={slaStartedAt}
        slaSeconds={slaSeconds}
        placedAtLabel={placedAtLabel}
        conversationId={conversationId}
        currentUserId={user.id}
        existingReview={existingReview}
      />
    </>
  )
}

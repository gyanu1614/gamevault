/**
 * Order Detail Page
 */

import React from 'react'
import { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { isUuid } from '@/lib/ids'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { getOrder } from '@/lib/actions/orders'
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Package,
  XCircle,
  RefreshCw,
  Truck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { parseDeliveryMinutes } from '@/lib/utils/delivery-time'
import { displayOrderRef } from '@/lib/orders/order-number'
import { orderItemImage, orderItemTitle } from '@/lib/orders/display-title'
import { orderPaymentMethodLabel } from '@/lib/orders/payment-method-label'
import { cancelRequestEligibility } from '@/lib/orders/cancel-request-eligibility'
import { redactOrderFor } from '@/lib/orders/redact'
import { fetchCategoryConfig } from '@/lib/actions/admin-category-configs'
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

/**
 * STATE-004 — reads buyer_id/seller_id off the order the page already fetched
 * instead of re-querying the same row for the same two columns.
 */
function checkOrderAccess(
  order: { buyer_id?: string | null; seller_id?: string | null } | null,
  userId: string,
): { hasAccess: boolean; userRole: OrderRole | null } {
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
  pending:    { label: 'Awaiting Payment', pill: 'bg-amber-500/10 text-amber-400 border-amber-500/20', dot: 'bg-amber-400', pulse: true, icon: Clock },
  paid:       { label: 'Payment Confirmed',  pill: 'bg-amber-500/10 text-amber-400 border-amber-500/20',   dot: 'bg-amber-400',  pulse: true,  icon: Clock },
  delivering: { label: 'Delivering',  pill: 'bg-lime-tint-bg text-lime-text border-lime-tint-border', dot: 'bg-lime', pulse: true,  icon: Truck },
  delivered:  { label: 'Delivered',   pill: 'bg-blue-500/10 text-blue-400 border-blue-500/20',       dot: 'bg-blue-400',   pulse: false, icon: Package },
  completed:  { label: 'Completed',   pill: 'bg-success-bg text-success border-green-500/20',    dot: 'bg-green-400',  pulse: false, icon: CheckCircle2 },
  disputed:   { label: 'Disputed',    pill: 'bg-error-bg text-error border-[color-mix(in_srgb,var(--color-error)_40%,transparent)]',          dot: 'bg-red-400',    pulse: true,  icon: AlertTriangle },
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

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function OrderDetailPage({ params }: PageProps) {
  const { orderId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ROUTE-009 — a malformed id can never match a row; 404 before querying,
  // matching this route's miss behaviour below.
  if (!isUuid(orderId)) notFound()

  const orderResult = await getOrder(orderId)
  if (!orderResult.success || !orderResult.order) notFound()

  const order = orderResult.order
  const { hasAccess, userRole } = checkOrderAccess(order, user.id)
  if (!hasAccess || !userRole) notFound()

  // Workstream E — pending orders are the buyer's "awaiting payment" surface
  // only. The seller must not see (or be able to act on) an order that hasn't
  // been paid for, so a seller hitting a still-pending order 404s (bookmarks /
  // stale Live-Orders links from the old new_order-at-creation era resolve
  // here). Admins keep full visibility.
  if (order.status === 'pending' && userRole === 'seller') notFound()

  // Fetch game and category data separately (nested joins not supported without
  // explicit FK). STATE-007 — both key off the already-loaded order.listing and
  // neither consumes the other, so they fan out instead of running serially.
  const [gameRes, categoryRes] = await Promise.all([
    order.listing?.game_id
      ? (supabase
          .from('games')
          .select('id, name, slug, image_url')
          .eq('id', order.listing.game_id)
          .single() as any)
      : Promise.resolve({ data: null }),
    order.listing?.game_category_id
      ? (supabase
          .from('game_categories')
          .select('id, name, slug, type')
          .eq('id', order.listing.game_category_id)
          .single() as any)
      : Promise.resolve({ data: null }),
  ])

  const game = (gameRes as any).data as
    | { id: string; name: string; slug: string; image_url: string | null }
    | null
  const category = (categoryRes as any).data as
    | { id: string; name: string; slug: string; type: string | null }
    | null

  // Currency orders show the amount in the title ("2,000 Roblox Robux");
  // the unit (per unit / K / M, or fixed bundles) comes from the game's
  // currency config. Public read via the anon client.
  const currencyCfg =
    category?.type === 'currency' && game?.id
      ? await fetchCategoryConfig(game.id, 'currency').catch(() => null)
      : null

  // Delivery proof: the seller's photo is posted into the order chat
  // ("Delivery Evidence"), which signs it per viewer. The page itself no
  // longer renders delivery_evidence_urls, so nothing is signed here.

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
    /** Who closed it: the buyer (confirmed receipt), the seller, or an admin. */
    resolved_by_role?: 'buyer' | 'seller' | 'admin'
  } | null = null

  if (order.disputed_at) {
    // The LATEST dispute only. An order can be disputed again after an
    // earlier dispute closed (a post-completion dispute); picking "any
    // resolved dispute" showed a fresh, open one as Resolved, and with two
    // resolved rows .maybeSingle() errored and showed nothing.
    const { data: latest } = await supabase
      .from('disputes')
      .select('id, status, resolved_by')
      .eq('transaction_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle() as any
    const disputeData =
      latest && ['resolved_buyer_favor', 'resolved_seller_favor', 'resolved_partial'].includes(latest.status)
        ? latest
        : null

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
          resolved_by_role:
            disputeData.resolved_by && disputeData.resolved_by === order.buyer_id
              ? 'buyer'
              : disputeData.resolved_by && disputeData.resolved_by === order.seller_id
                ? 'seller'
                : 'admin',
        }
      }
    }
  }

  // The latest dispute on this order (open or closed): the timeline's
  // "Order Disputed" step shows its reason.
  let latestDispute: { id: string; status: string; reason: string | null; title: string | null; created_at: string } | null = null
  if (order.disputed_at) {
    const { data } = await supabase
      .from('disputes')
      .select('id, status, reason, title, created_at')
      .eq('transaction_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle() as any
    latestDispute = data ?? null
  }

  // The buyer may close a dispute THEY opened by marking the order received
  // (order_dispute_buyer_confirm). A team-opened review is closed by the team
  // only; order_dispute_events is service-role only, so this one existence
  // read goes through the service client (access to the order is already
  // checked above). The RPC re-checks all of it under its locks.
  let buyerCanCloseDispute = false
  if (
    userRole === 'buyer' &&
    order.status === 'disputed' &&
    latestDispute &&
    !['resolved_buyer_favor', 'resolved_seller_favor', 'resolved_partial', 'closed'].includes(latestDispute.status)
  ) {
    const { data: adminOpened } = await (createServiceRoleClient() as any)
      .from('order_dispute_events')
      .select('id')
      .eq('dispute_id', latestDispute.id)
      .eq('action', 'admin_opened')
      .limit(1) as any
    buyerCanCloseDispute = !(adminOpened && adminOpened.length > 0)
  }

  // PR 7 — the buyer may open a dispute for dispute_window_days after
  // delivery, even once the order has completed. The number is admin-editable
  // (platform_fee_settings, readable by every signed-in user).
  const { data: moneySettings } = await supabase
    .from('platform_fee_settings')
    .select('dispute_window_days')
    .eq('id', true)
    .maybeSingle() as any
  const disputeWindowDays = Number(moneySettings?.dispute_window_days ?? 7)
  const disputeUntil = order.delivered_at
    ? new Date(new Date(order.delivered_at).getTime() + disputeWindowDays * 86_400_000).toISOString()
    : null

  // Computed timing values
  const now = new Date()

  const autoReleaseDate = order.auto_release_at ? new Date(order.auto_release_at) : null
  const timeRemaining   = autoReleaseDate ? Math.max(0, autoReleaseDate.getTime() - now.getTime()) : 0
  const hoursRemaining  = Math.floor(timeRemaining / (1000 * 60 * 60))
  const minutesRemaining = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60))

  const protectionDate    = order.protection_until ? new Date(order.protection_until) : null
  const protectionRemaining = protectionDate ? Math.max(0, protectionDate.getTime() - now.getTime()) : 0
  const protectionDays    = Math.floor(protectionRemaining / (1000 * 60 * 60 * 24))

  // The stored order_number IS the number (DM-XXXX-XXXX since migration
  // 20260921234649; older GV- rows stay as issued and render as stored).
  const orderNum       = displayOrderRef(order.order_number, order.id)
  // What was sold, by name and picture: "50 Diamonds" / "2,000 Robux" with
  // the bundle or currency icon; items keep their own title and image. The
  // game's name and logo are shown beside it, never instead of it.
  const listingTitle   = order.listing?.title
    ? orderItemTitle({
        listingTitle: order.listing.title,
        quantity: (order as any).quantity,
        categoryType: category?.type,
        currencyConfig: currencyCfg as any,
        bundleId: (order.listing as any)?.bundle_id ?? null,
      })
    : undefined
  // Buyer (and admin): what they paid, line by line, and with what. Built
  // from the buyer's own fields; the marketplace fee is the remainder
  // (platform_fee is not in the buyer's column grant).
  const round2 = (n: number) => Math.round(n * 100) / 100
  const PAID_STATUSES = ['paid', 'delivering', 'delivered', 'disputed', 'completed', 'refunded']
  const paymentSummary =
    userRole !== 'seller' && PAID_STATUSES.includes(order.status)
      ? await (async () => {
          const itemPrice = Number((order as any).subtotal ?? 0)
          const paymentFee = Number((order as any).payment_processing_fee ?? 0)
          const promoDiscount = Number((order as any).promo_discount ?? 0)
          const total = Number((order as any).total_amount ?? 0)
          return {
            itemPrice,
            marketplaceFee: Math.max(0, round2(total - itemPrice - paymentFee + promoDiscount)),
            paymentFee,
            promoDiscount,
            total,
            paidWith: await orderPaymentMethodLabel(order as any),
          }
        })()
      : null
  // Buyer: may they ask DropMarket to cancel, and is a request already open?
  let cancelRequest: { eligible: boolean; pending: boolean } | null = null
  if (userRole === 'buyer') {
    const { data: pendingRequest } = await (supabase
      .from('order_cancellation_requests')
      .select('id')
      .eq('order_id', orderId)
      .eq('status', 'pending')
      .maybeSingle() as any)
    cancelRequest = {
      eligible: cancelRequestEligibility({
        status: order.status,
        delivered_at: (order as any).delivered_at,
        paid_at: (order as any).paid_at,
        created_at: order.created_at,
        deliveryTime: order.listing?.delivery_time,
      }).eligible,
      pending: !!pendingRequest,
    }
  }
  const itemImageUrl = orderItemImage({
    categoryType: category?.type,
    currencyConfig: currencyCfg as any,
    bundleId: (order.listing as any)?.bundle_id ?? null,
    listingImage: order.listing?.images?.[0] ?? null,
  })
  const gameName       = game?.name
  const categoryName   = category?.name

  // V21/P2 — derive SLA window from the listing's delivery_time LABEL
  // ("20min" / "1hr" / "1-24 hours" …) via parseDeliveryMinutes. (The old
  // Number(delivery_time) was NaN for every stored value → always fell back to
  // 60 min, so a 20-min listing showed a 1-hour SLA.)
  const slaMinutes = parseDeliveryMinutes(order.listing?.delivery_time)
  const slaSeconds = slaMinutes * 60
  // The delivery promise runs from PAYMENT (unpaid time doesn't count). It is
  // not restarted by delivering_at: that is stamped by the seller's first chat
  // message, and restarting there let a late seller reset "Overdue" (and the
  // buyer's dispute prompt) to a full window by saying hello.
  const slaStartedAt: string = (order as any).paid_at ?? order.created_at

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

  // Workstream E — do NOT create the order conversation while the order is
  // still 'pending' (unpaid). The seller is gated out of pending orders
  // entirely, so surfacing a chat/welcome thread before payment would create a
  // seller-facing artifact for an order that may never be paid. The
  // conversation is created lazily on the first paid render instead.
  let conversationId: string | null = convo?.id ?? null
  if (!conversationId && order.status !== 'pending') {
    const { data: created, error: createError } = await (supabase.from('conversations').insert as any)({
      order_id:  orderId,
      buyer_id:  order.buyer_id,
      seller_id: order.seller_id,
    })
      .select('id')
      .single() as any
    conversationId = created?.id ?? null
    // Both parties' first visits can race: order_id is unique, so the loser
    // gets 23505 — the conversation exists now, read it instead of showing
    // no chat on this load.
    if (!conversationId && createError) {
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('order_id', orderId)
        .maybeSingle() as any
      conversationId = existing?.id ?? null
      if (!conversationId) console.error('[order page] conversation create failed', createError)
    }
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
      {/* Post-payment return from CoinGate (?paid=1): blocking "Confirming
          Your Payment" overlay that stays up until the webhook flips the order
          off 'pending' (via the _OrderClient realtime subscription + a poll
          fallback), then collapses history so Back skips the payment page. */}
      <PaymentReturnHandler orderId={order.id} orderStatus={order.status} />
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
        // Rendered into the viewer's browser: strip the other party's private
        // money / payment fields (lib/orders/redact.ts).
        order={redactOrderFor(order, userRole)}
        disputeUntil={disputeUntil}
        userRole={userRole}
        disputeResolution={disputeResolution}
        itemImageUrl={itemImageUrl}
        paymentSummary={paymentSummary}
        cancelRequest={cancelRequest}
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
        latestDispute={latestDispute}
        buyerCanCloseDispute={buyerCanCloseDispute}
      />
    </>
  )
}

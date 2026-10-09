'use client'

/**
 * OrderClient — V21/P2
 *
 * The single page client. Branches on `userRole` for the action panel
 * + admin chrome, but keeps the shell identical across roles so the
 * conversation and order context stay coherent. Right rail collapses
 * BELOW main on mobile.
 *
 * This is the SHELL build — Phase P2. Progress bar wired. Grid in
 * place with placeholders for chat / instructions / evidence / order
 * details / action panel; those fill in across P3–P10.
 */

import { sellerDisplayName, sellerRatingPercent, sellerShopHref } from '@/lib/seller/identity'
import { OrderHeader } from './_OrderHeader'
import { DeliveryProgressBar } from './_DeliveryProgressBar'
import { OrderCard } from './_OrderCard'
import { OrderDetailsCard, type RefundToSourceState } from './_OrderDetailsCard'
import { StatusStrip } from './_StatusStrip'
import { AwaitingPaymentPanel } from './_AwaitingPaymentPanel'
import { MarkDeliveredModal } from './_MarkDeliveredModal'
import { MarkReceivedModal } from './_MarkReceivedModal'
import { DisputeModal } from './_DisputeModal'
import { CancelOrderModal } from './_CancelOrderModal'
import { RequestCancelModal } from './_RequestCancelModal'
import { cancelCancellationRequest } from '@/lib/actions/order-cancellation'
import { toast } from 'sonner'
import { AuditLog } from './_AuditLog'
import { OrderChat } from './_OrderChat'
import { DeliveryInstructions } from './_DeliveryInstructions'
import { OrderStatusCard } from './_OrderStatusCard'
import { DeliveredInRow } from './_DeliveredInRow'
import { getAvatarUrl } from '@/lib/utils/avatar'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { CurrencyDeliveryMethod } from '@/lib/types/category-configs'

interface OrderClientProps {
  order: any
  userRole: 'buyer' | 'seller' | 'admin'
  disputeResolution: any | null
  /** PR 7: end of the buyer's dispute window (delivered_at + N days), or null. */
  disputeUntil?: string | null
  itemImageUrl: string | null
  /** Buyer / admin: what was paid, line by line, and with what. */
  paymentSummary?: {
    itemPrice: number
    marketplaceFee: number
    paymentFee: number
    promoDiscount: number
    total: number
    paidWith: string | null
  } | null
  itemTitle: string
  /** Currency delivery method (Gamepass…) the order is handed over with, or null. */
  deliveryMethod?: CurrencyDeliveryMethod | null
  /** Buyer / admin: what came back as store credit and whether the service
   *  fee was kept (buyer-fault cancel). null before any refund. */
  buyerRefund?: { credited: number; feeKept: boolean } | null
  /** Buyer: refund-to-original-method request state (refund policy). */
  refundToSource?: RefundToSourceState | null
  /** Buyer: Request Cancellation eligibility, and an already pending request. */
  cancelRequest?: { eligible: boolean; pending: boolean } | null
  gameName: string | null
  gameIconUrl: string | null
  categoryName: string | null
  categorySlug: string | null
  orderNumber: string
  /** When the seller's SLA clock started — usually order placed time. */
  slaStartedAt: string
  slaSeconds: number
  placedAtLabel: string
  conversationId: string | null
  currentUserId: string
  /** Buyer's review for this order if they've already left one. */
  existingReview?: {
    rating: number
    comment: string
    recommendsSeller?: boolean | null
    createdAt: string
  } | null
  /** Latest dispute on the order (open or closed), for the timeline. */
  latestDispute?: { id: string; status: string; reason: string | null; title: string | null; created_at: string } | null
  /** Buyer view: the open dispute is theirs, so marking the order received
   *  closes it (order_dispute_buyer_confirm). */
  buyerCanCloseDispute?: boolean
}

export function OrderClient(props: OrderClientProps) {
  const {
    order,
    userRole,
    disputeResolution,
    disputeUntil = null,
    itemImageUrl,
    paymentSummary = null,
    buyerRefund = null,
    refundToSource = null,
    cancelRequest = null,
    itemTitle,
    deliveryMethod = null,
    gameName,
    gameIconUrl,
    categoryName,
    categorySlug,
    orderNumber,
    slaStartedAt,
    slaSeconds,
    placedAtLabel,
    conversationId,
    currentUserId,
    existingReview,
    latestDispute = null,
    buyerCanCloseDispute = false,
  } = props

  // When the seller marked the order delivered (null until they do).
  const deliveredAt: string | null =
    order.delivered_at ?? order.seller_marked_delivered_at ?? null

  // Hide the progress bar once delivery is done — it morphs into the
  // appropriate status strip in the right rail instead. A dispute opened
  // before delivery keeps the timer: the seller still owes the delivery.
  const showProgressBar =
    order.status === 'paid' ||
    order.status === 'delivering' ||
    (order.status === 'disputed' && !deliveredAt)

  // Overdue flag for the status strip. Starts from the load-time value and
  // flips live the moment the delivery window runs out, so the buyer sees
  // "Order Is Overdue" + Open Dispute without refreshing.
  const slaStartMs = Date.parse(slaStartedAt)
  const slaEndMs = slaStartMs + slaSeconds * 1000
  const [overdue, setOverdue] = useState(
    () => showProgressBar && Number.isFinite(slaEndMs) && Date.now() > slaEndMs,
  )
  useEffect(() => {
    if (!showProgressBar || !Number.isFinite(slaEndMs)) {
      setOverdue(false)
      return
    }
    const msLeft = slaEndMs - Date.now()
    if (msLeft <= 0) {
      setOverdue(true)
      return
    }
    setOverdue(false)
    // setTimeout caps at ~24.8 days; a longer window re-arms on the next render.
    const t = setTimeout(() => setOverdue(true), Math.min(msLeft + 250, 2_147_000_000))
    return () => clearTimeout(t)
  }, [showProgressBar, slaEndMs])

  // V21/P4.d — Seller's Mark As Delivered modal lives at the page
  // level so we can re-render the entire status strip + progress bar
  // after a successful submit (router.refresh re-fetches the server
  // component). The CTA injects through the StatusStrip prop.
  const [markDeliveredOpen, setMarkDeliveredOpen] = useState(false)
  const [markReceivedOpen, setMarkReceivedOpen] = useState(false)
  const [cancelOrderOpen, setCancelOrderOpen] = useState(false)
  const [requestCancelOpen, setRequestCancelOpen] = useState(false)
  const withdrawCancelRequest = async () => {
    const res = await cancelCancellationRequest(order.id)
    if (res.error) {
      toast.error(res.error.message)
      return
    }
    toast.success('Cancellation request withdrawn')
    router.refresh()
  }
  // V21/P5.m — Review-only opens the same modal as Confirm Receipt
  // but with confirmation step suppressed. Cleaner than a separate
  // route + form duplicate.
  const [leaveReviewOpen, setLeaveReviewOpen] = useState(false)
  // V21/P7.a — Single dispute modal shared by every "Open Dispute"
  // CTA (status strip, SafeDrop card, action panel). All callers
  // call openDispute() to raise it.
  const [disputeOpen, setDisputeOpen] = useState(false)
  const openDispute = () => setDisputeOpen(true)
  const router = useRouter()

  // V21/P5.d — Subscribe to UPDATE events on this specific order row
  // so the buyer reacts the moment the seller marks delivered (and
  // vice versa). One channel per orderId, one filter, cleaned up on
  // unmount. We use router.refresh() to re-fetch the server component
  // — keeps a single source of truth (no duplicating order state on
  // the client) and triggers every dependent prop to recompute.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`order:${order.id}`)
      .on(
        'postgres_changes' as any,
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${order.id}`,
        },
        () => {
          router.refresh()
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [order.id, router])

  // V21/P2.d — Use the shared avatar helper so users without an uploaded
  // avatar still get their DiceBear character seeded by username instead
  // of a broken-image icon.
  const presenceParty =
    userRole === 'buyer'
      ? {
          name: sellerDisplayName(order.seller),
          sellerId: order.seller?.id ?? null,
          avatarUrl: getAvatarUrl(order.seller?.avatar_url, order.seller?.username ?? 'seller'),
          roleLabel: 'Seller',
        }
      : {
          name: order.buyer?.username ?? 'Buyer',
          sellerId: null,
          avatarUrl: getAvatarUrl(order.buyer?.avatar_url, order.buyer?.username ?? 'buyer'),
          roleLabel: 'Buyer',
        }

  // V21/P3 — Full party for the bottom-of-card button. Includes verified
  // flag + rating + sales count so the row reads like a trust badge.
  const otherPartyButton =
    userRole === 'buyer'
      ? {
          name: sellerDisplayName(order.seller),
          username: order.seller?.username ?? '',
          avatarUrl: getAvatarUrl(order.seller?.avatar_url, order.seller?.username ?? 'seller'),
          verified: !!order.seller?.is_verified,
          rating: Math.min(5, Math.max(0, Number(order.seller?.seller_rating ?? 0))),
          sales: Number(order.seller?.total_sales ?? 0),
          // Shared seller line (SellerStats): "👍 100% (12) · 34 Sold · Gold",
          // or "Verified Seller" before the first sale.
          stats: {
            ratingPercent: sellerRatingPercent(order.seller),
            reviews: Number(order.seller?.total_reviews ?? 0),
            sales: Number(order.seller?.total_sales ?? 0),
            tier: order.seller?.seller_tier ?? null,
          },
          href: sellerShopHref(order.seller) ?? '#',
          ctaLabel: 'View store',
        }
      : {
          name: order.buyer?.username ?? 'Buyer',
          username: order.buyer?.username ?? '',
          avatarUrl: getAvatarUrl(order.buyer?.avatar_url, order.buyer?.username ?? 'buyer'),
          verified: false,
          rating: 0,
          sales: 0,
          // V21/P7.a — Buyer profiles don't have a public page; previous
          // `/u/${username}` href 404'd. Render as a non-link badge by
          // passing an empty href — PartyButton handles this.
          href: '',
          ctaLabel: 'View profile',
        }

  // V21/P3 — Money values for the details card. Falls back gracefully
  // if the order rows are partial / pre-completion.
  const subtotal = Number(order.subtotal ?? order.amount ?? 0)
  const fee = Number(order.platform_fee ?? order.dropmarket_fee ?? 0)
  const totalPaid = Number(order.total_amount ?? subtotal + fee)
  const escrowAmount = Number(order.escrow_amount ?? totalPaid)
  const netPayout = Number(order.seller_payout ?? Math.max(0, subtotal - fee))
  // Fee engine PR 5 (D5): the seller-side fee row reads the commission rate
  // snapshotted on the order (seller_commission_pct) and the amount it
  // implies (subtotal − seller_payout). Pre-engine orders have no snapshot
  // and keep the old derivation — minus the "8" that matched no fee.
  const hasSnapshot = order.seller_commission_pct != null && order.seller_payout != null
  const feePercent = hasSnapshot
    ? Number(order.seller_commission_pct)
    : subtotal > 0 ? Math.round((fee / subtotal) * 100) : 0
  const sellerFeeAmount = hasSnapshot ? Math.max(0, Math.round((subtotal - netPayout) * 100) / 100) : fee
  // A partial refund leaves the order completed but pays the seller less:
  // dispute_resolutions.seller_payout_amount is what they actually kept.
  const isPartialRefund = disputeResolution?.resolution_type === 'partial_refund'
  // Only the part that came out of the seller's payout (the platform covers
  // any refund beyond it), so Item Price − Fee − this = what they received.
  const refundedToBuyer = isPartialRefund
    ? Math.min(Number(disputeResolution?.refund_amount ?? 0), netPayout)
    : 0
  const actualPayout =
    isPartialRefund && disputeResolution?.seller_payout_amount != null
      ? Number(disputeResolution.seller_payout_amount)
      : netPayout
  // The seller's delivery instructions (listing.description).
  const instructionsProps = {
    role: userRole,
    instructions: order.listing?.description ?? null,
    listingId: order.listing?.id ?? null,
    active: ['paid', 'delivering', 'disputed'].includes(order.status) && !deliveredAt,
  }
  const hasInstructions = !!order.listing?.description?.trim()
  const placedAtFull = new Date(order.created_at).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })


  return (
    <div
      className="has-backdrop relative isolate min-h-screen"
      // V21/P5.x — Same hero-backdrop pattern as HomePage. The
      // .hero-backdrop child below renders the art behind the
      // navbar via --page-hero-image; --hero-offset pulls it up
      // through the 80px navbar spacer.
      style={{
        ['--page-hero-image' as any]: "url('/assets/heroes/order.avif')",
        ['--hero-offset' as any]: '80px',
      }}
    >
      <div className="hero-backdrop" aria-hidden="true" />
      {/* Page ambient — local to this route. Lime top-left + violet
          bottom-right per the handoff tokens; the body's global glow
          already provides a base layer so these are subtle additives.
          `top: calc(var(--hero-offset) * -1)` extends the gradient
          up under the (transparent) navbar pill. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10"
        style={{
          top: 'calc(var(--hero-offset, 0px) * -1)',
          background:
            'radial-gradient(680px circle at 8% -6%, rgba(198,255,61,0.10), transparent 44%),' +
            'radial-gradient(820px circle at 104% 108%, rgba(167,139,250,0.10), transparent 50%)',
        }}
      />
      {/* Faint grid overlay, masked to the top — adds "transactional
          surface" texture without competing with content. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10"
        style={{
          top: 'calc(var(--hero-offset, 0px) * -1)',
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          mask: 'radial-gradient(800px 500px at 50% 0%, #000, transparent 75%)',
          WebkitMask: 'radial-gradient(800px 500px at 50% 0%, #000, transparent 75%)',
        }}
      />

      <div className="mx-auto max-w-[1400px] px-5 pb-10 pt-6 sm:px-8 lg:px-10 lg:pt-8">
        <OrderHeader
          itemImageUrl={itemImageUrl}
          itemTitle={itemTitle}
          gameName={gameName}
          gameIconUrl={gameIconUrl}
          categoryName={categoryName}
          categorySlug={categorySlug}
          orderNumber={orderNumber}
          orderStatus={order.status}
          disputeResolved={!!disputeResolution}
          presence={presenceParty}
        />

        {/* Phone: one status card replaces the header's two pills. */}
        <OrderStatusCard
          className="mt-7 sm:hidden"
          role={userRole}
          status={order.status}
          disputeResolved={!!disputeResolution}
          disputeResolvedAt={disputeResolution?.resolved_at ?? null}
          escrowStatus={order.escrow_status}
          order={order}
        />

        {/* Main grid — left main + right rail (sticky on lg). Progress
            bar now lives at the top of the LEFT column, not above the
            grid — keeps the timer near the chat where the action is. */}
        {/* V21/P5.r — items-stretch (default) so the chat in the left
            column can grow to match the rail. The rail itself uses
            sticky positioning so it doesn't visually inflate; the
            chat just fills the remaining left-column height. */}
        <div className="mt-6 grid grid-cols-1 gap-[22px] lg:grid-cols-[1fr_412px]">
          <div className="flex flex-col gap-[18px]">
            {/* Unpaid orders have no chat/delivery surface — just the payment
                actions (resume/retry + cancel) beside the order details. */}
            {order.status === 'pending' && (
              <AwaitingPaymentPanel
                orderId={order.id}
                role={userRole}
                paymentExpiresAt={(order as any).payment_expires_at ?? null}
                hasValidInvoice={Boolean(
                  (order as any).checkout_url &&
                    (order as any).payment_expires_at &&
                    // 1-min buffer: with a ~15-min invoice window the old 5-min
                    // buffer contradicted the countdown chip for a third of it.
                    new Date((order as any).payment_expires_at).getTime() >
                      Date.now() + 60 * 1000,
                )}
              />
            )}
            <DeliveryProgressBar
              startedAt={slaStartedAt}
              slaSeconds={slaSeconds}
              placedAtLabel={placedAtLabel}
              visible={showProgressBar}
            />
            {/* V21/P5.r — StatusStrip promoted above chat. Most
                prominent action surface on the page; CTA reads as
                the primary control instead of getting lost in the
                rail. Progress bar above + strip + chat stack as
                one continuous activity column. */}
            {order.status !== 'pending' && (
            <StatusStrip
              role={userRole}
              status={order.status}
              amount={userRole === 'seller' && order.status === 'completed' ? actualPayout : undefined}
              overdue={overdue}
              disputeHref={`/account/orders/${order.id}#dispute`}
              onMarkDelivered={
                userRole === 'seller' &&
                (order.status === 'delivering' || (order.status === 'disputed' && !deliveredAt))
                  ? () => setMarkDeliveredOpen(true)
                  : undefined
              }
              onCancelOrder={
                userRole === 'seller' && (order.status === 'paid' || order.status === 'delivering') && !deliveredAt
                  ? () => setCancelOrderOpen(true)
                  : undefined
              }
              cancelRequest={
                userRole === 'buyer' && cancelRequest && (cancelRequest.pending || cancelRequest.eligible)
                  ? cancelRequest.pending
                    ? { state: 'pending', onWithdraw: withdrawCancelRequest }
                    : { state: 'eligible', onRequest: () => setRequestCancelOpen(true) }
                  : undefined
              }
              onMarkReceived={
                userRole === 'buyer' &&
                (order.status === 'delivered' || (order.status === 'disputed' && buyerCanCloseDispute))
                  ? () => setMarkReceivedOpen(true)
                  : undefined
              }
              deliveredAt={deliveredAt}
              escrowStatus={order.escrow_status}
              onLeaveReview={
                userRole === 'buyer' && order.status === 'completed' && !existingReview
                  ? () => setLeaveReviewOpen(true)
                  : undefined
              }
              onOpenDispute={openDispute}
              existingReview={existingReview}
              promoted
              hidePassiveOnMobile
            />
            )}
            {/* Mobile stacking: delivery instructions (small, actionable)
                jump ABOVE the tall chat card on max-lg via CSS order so
                neither party scrolls past ~700px of chat to reach them.
                Wrappers use empty:hidden so a null-rendering child never
                leaves a ghost gap slot in the flex column. DOM (= lg
                visual) order is unchanged: chat → instructions → evidence. */}
            {/* Desktop: the chat takes the rest of the column, so its bottom
                lines up with the rail's last card (never shorter than 580px).
                The card is absolute inside, so its messages never size the row. */}
            {order.status !== 'pending' && conversationId && (
              <div className="min-w-0 empty:hidden max-lg:order-2 lg:relative lg:min-h-[580px] lg:flex-1">
              <OrderChat
                conversationId={conversationId}
                currentUserId={currentUserId}
                currentUserAvatar={getAvatarUrl(
                  userRole === 'buyer' ? order.buyer?.avatar_url : order.seller?.avatar_url,
                  userRole === 'buyer'
                    ? order.buyer?.username ?? 'buyer'
                    : order.seller?.username ?? 'seller',
                )}
                order={{
                  id: order.id,
                  order_number: order.order_number,
                  listing: {
                    title: itemTitle,
                    // Same picture as the page header (bundle / currency icon
                    // or the item's own image), never the game's.
                    images: itemImageUrl ? [itemImageUrl] : order.listing?.images ?? [],
                    game_id: order.listing?.game_id,
                  },
                  total_amount: Number(order.total_amount ?? totalPaid),
                  status: order.status,
                  created_at: order.created_at,
                  chat_active_until: order.chat_active_until ?? null,
                  buyer: order.buyer
                    ? {
                        id: order.buyer.id,
                        username: order.buyer.username,
                        avatar_url: order.buyer.avatar_url,
                      }
                    : undefined,
                  seller: order.seller
                    ? {
                        id: order.seller.id,
                        // Display name matches the page header; the avatar is
                        // resolved here (DiceBear seeded by USERNAME, as in the
                        // header) so it doesn't change with the shop name.
                        username: sellerDisplayName(order.seller),
                        avatar_url: getAvatarUrl(order.seller.avatar_url, order.seller.username ?? 'seller'),
                      }
                    : undefined,
                }}
                otherUser={
                  userRole === 'buyer' && order.seller
                    ? {
                        id: order.seller.id,
                        // Display name matches the page header; the avatar is
                        // resolved here (DiceBear seeded by USERNAME, as in the
                        // header) so it doesn't change with the shop name.
                        username: sellerDisplayName(order.seller),
                        avatar_url: getAvatarUrl(order.seller.avatar_url, order.seller.username ?? 'seller'),
                      }
                    : userRole === 'seller' && order.buyer
                    ? {
                        id: order.buyer.id,
                        username: order.buyer.username,
                        avatar_url: order.buyer.avatar_url,
                      }
                    : undefined
                }
                disputeResolution={disputeResolution}
                presenceSellerId={userRole === 'buyer' ? order.seller?.id ?? null : null}
              />
              </div>
            )}
            {/* Phone: once delivered, the timer becomes a one-line
                "Delivered In …" row under the chat. */}
            {deliveredAt && order.status !== 'pending' && (
              <div className="min-w-0 sm:hidden max-lg:order-2">
                <DeliveredInRow
                  startedAt={order.paid_at ?? order.created_at}
                  deliveredAt={deliveredAt}
                />
              </div>
            )}
            {/* Phone + tablet: How To Receive sits above the chat (the rail
                drops below the main column there). Desktop shows it in the
                rail under the SafeDrop / Payout card instead. */}
            {hasInstructions && (
              <div className="min-w-0 lg:hidden max-lg:order-1">
                <DeliveryInstructions {...instructionsProps} />
              </div>
            )}
          </div>
          <aside className="flex flex-col gap-[18px] lg:sticky lg:top-[18px]">
            <OrderDetailsCard
              orderNumber={orderNumber}
              orderId={order.id}
              placedAtLabel={placedAtFull}
              paymentSummary={paymentSummary}
              buyerRefund={buyerRefund}
              refundToSource={refundToSource}
              subtotal={subtotal}
              fee={sellerFeeAmount}
              totalPaid={totalPaid}
              role={userRole}
              escrowAmount={escrowAmount}
              feePercent={feePercent}
              netPayout={actualPayout}
              refundedToBuyer={refundedToBuyer}
              orderStatus={order.status}
              escrowStatus={order.escrow_status}
              otherParty={otherPartyButton}
              buyerReview={existingReview}
              gameName={gameName}
              gameIconUrl={gameIconUrl}
              itemName={itemTitle}
              deliveryMethod={deliveryMethod}
              // orders.delivery_details (jsonb). There is no delivery_info
              // column; reading it showed "Username: Not Provided" everywhere.
              deliveryInfo={(order as any).delivery_details ?? null}
              onOpenDispute={openDispute}
              disputeUntil={disputeUntil}
            />
            {hasInstructions && (
              <div className="hidden lg:block">
                <DeliveryInstructions {...instructionsProps} />
              </div>
            )}
          </aside>
        </div>

        <div className="mt-[22px]">
          <AuditLog order={order as any} disputeResolution={disputeResolution} latestDispute={latestDispute} />
        </div>
      </div>

      {userRole === 'seller' && (
        <CancelOrderModal
          open={cancelOrderOpen}
          onOpenChange={setCancelOrderOpen}
          orderId={order.id}
          amount={Number(order.total_amount ?? 0)}
        />
      )}
      {userRole === 'seller' && (
        <MarkDeliveredModal
          open={markDeliveredOpen}
          onOpenChange={setMarkDeliveredOpen}
          orderId={order.id}
          orderStatus={order.status}
          onDelivered={() => router.refresh()}
        />
      )}
      {userRole === 'buyer' && (
        <>
          <RequestCancelModal open={requestCancelOpen} onOpenChange={setRequestCancelOpen} orderId={order.id} />
          <MarkReceivedModal
            open={markReceivedOpen}
            onOpenChange={setMarkReceivedOpen}
            orderId={order.id}
            amount={escrowAmount}
            closesDispute={order.status === 'disputed'}
            onConfirmed={() => router.refresh()}
          />
          <MarkReceivedModal
            open={leaveReviewOpen}
            onOpenChange={setLeaveReviewOpen}
            orderId={order.id}
            amount={escrowAmount}
            mode="review"
            onConfirmed={() => router.refresh()}
          />
        </>
      )}
      <DisputeModal
        open={disputeOpen}
        onOpenChange={setDisputeOpen}
        orderId={order.id}
        conversationId={conversationId}
      />
    </div>
  )
}

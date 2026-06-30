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

import { OrderHeader } from './_OrderHeader'
import { DeliveryProgressBar } from './_DeliveryProgressBar'
import { OrderCard } from './_OrderCard'
import { OrderDetailsCard } from './_OrderDetailsCard'
import { StatusStrip } from './_StatusStrip'
import { MarkDeliveredModal } from './_MarkDeliveredModal'
import { MarkReceivedModal } from './_MarkReceivedModal'
import { DisputeModal } from './_DisputeModal'
import { AuditLog } from './_AuditLog'
import { OrderChat } from './_OrderChat'
import { DeliveryInstructions } from './_DeliveryInstructions'
import { DeliveryEvidence } from './_DeliveryEvidence'
import { getAvatarUrl } from '@/lib/utils/avatar'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface OrderClientProps {
  order: any
  userRole: 'buyer' | 'seller' | 'admin'
  disputeResolution: any | null
  itemImageUrl: string | null
  itemTitle: string
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
}

export function OrderClient(props: OrderClientProps) {
  const {
    order,
    userRole,
    disputeResolution,
    itemImageUrl,
    itemTitle,
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
  } = props

  // Hide the progress bar once delivery is done — it morphs into the
  // appropriate status strip in the right rail instead.
  const showProgressBar =
    order.status === 'paid' || order.status === 'delivering'

  // V21/P3.e — Server-rendered overdue flag for the status strip.
  // Recomputed live by the progress bar, but the strip only flips on
  // overdue when the page first renders, which is fine — the user will
  // see the morphed strip on their next page load after SLA elapses.
  const slaStartMs = Date.parse(slaStartedAt)
  const slaEndMs = slaStartMs + slaSeconds * 1000
  const isOverdueOnLoad =
    showProgressBar && Number.isFinite(slaEndMs) && Date.now() > slaEndMs

  // V21/P4.d — Seller's Mark As Delivered modal lives at the page
  // level so we can re-render the entire status strip + progress bar
  // after a successful submit (router.refresh re-fetches the server
  // component). The CTA injects through the StatusStrip prop.
  const [markDeliveredOpen, setMarkDeliveredOpen] = useState(false)
  const [markReceivedOpen, setMarkReceivedOpen] = useState(false)
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
          name: order.seller?.shop_name ?? order.seller?.username ?? 'Seller',
          isOnline: !!order.seller?.presence?.is_online,
          avatarUrl: getAvatarUrl(order.seller?.avatar_url, order.seller?.username ?? 'seller'),
          roleLabel: 'Seller',
        }
      : {
          name: order.buyer?.username ?? 'Buyer',
          isOnline: !!order.buyer?.presence?.is_online,
          avatarUrl: getAvatarUrl(order.buyer?.avatar_url, order.buyer?.username ?? 'buyer'),
          roleLabel: 'Buyer',
        }

  // V21/P3 — Full party for the bottom-of-card button. Includes verified
  // flag + rating + sales count so the row reads like a trust badge.
  const otherPartyButton =
    userRole === 'buyer'
      ? {
          name: order.seller?.shop_name ?? order.seller?.username ?? 'Seller',
          username: order.seller?.username ?? '',
          avatarUrl: getAvatarUrl(order.seller?.avatar_url, order.seller?.username ?? 'seller'),
          verified:
            !!order.seller?.is_verified ||
            (!!order.seller?.seller_tier && order.seller.seller_tier !== 'unverified'),
          rating: Math.min(5, Math.max(0, Number(order.seller?.seller_rating ?? 0) / 20)),
          sales: Number(order.seller?.total_reviews ?? 0),
          href: order.seller?.username ? `/shop/${order.seller.username}` : '#',
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
  const feePercent = subtotal > 0 ? Math.round((fee / subtotal) * 100) : 8
  const paymentMethod = order.payment_method ?? 'Wallet · DropPay'
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
        fontFamily: 'var(--font-manrope), Inter, system-ui, sans-serif',
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
          escrowStatus={order.escrow_status}
          disputeResolved={!!disputeResolution}
          presence={presenceParty}
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
            <StatusStrip
              role={userRole}
              status={order.status}
              amount={userRole === 'seller' && order.status === 'completed' ? netPayout : undefined}
              overdue={isOverdueOnLoad}
              disputeHref={`/account/orders/${order.id}#dispute`}
              onMarkDelivered={
                userRole === 'seller' && order.status === 'delivering'
                  ? () => setMarkDeliveredOpen(true)
                  : undefined
              }
              onMarkReceived={
                userRole === 'buyer' && order.status === 'delivered'
                  ? () => setMarkReceivedOpen(true)
                  : undefined
              }
              onLeaveReview={
                userRole === 'buyer' && order.status === 'completed' && !existingReview
                  ? () => setLeaveReviewOpen(true)
                  : undefined
              }
              onOpenDispute={openDispute}
              existingReview={existingReview}
              promoted
            />
            {conversationId && (
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
                    images: order.listing?.images ?? [],
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
                        username: order.seller.username ?? order.seller.shop_name,
                        avatar_url: order.seller.avatar_url,
                      }
                    : undefined,
                }}
                otherUser={
                  userRole === 'buyer' && order.seller
                    ? {
                        id: order.seller.id,
                        username: order.seller.username ?? order.seller.shop_name,
                        avatar_url: order.seller.avatar_url,
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
              />
            )}
            <DeliveryInstructions
              role={userRole}
              instructions={order.listing?.delivery_instructions ?? null}
              listingId={order.listing?.id ?? null}
            />
            <DeliveryEvidence
              role={userRole}
              urls={order.delivery_evidence_urls}
            />
          </div>
          <aside className="flex flex-col gap-[18px] lg:sticky lg:top-[18px]">
            <OrderDetailsCard
              orderNumber={orderNumber}
              orderId={order.id}
              placedAtLabel={placedAtFull}
              paymentMethod={paymentMethod}
              subtotal={subtotal}
              fee={fee}
              totalPaid={totalPaid}
              role={userRole}
              escrowAmount={escrowAmount}
              feePercent={feePercent}
              netPayout={netPayout}
              orderStatus={order.status}
              otherParty={otherPartyButton}
              buyerReview={existingReview}
              gameName={gameName}
              gameIconUrl={gameIconUrl}
              itemName={itemTitle}
              deliveryInfo={(order as any).delivery_info ?? null}
              onOpenDispute={openDispute}
            />
          </aside>
        </div>

        <div className="mt-[22px]">
          <AuditLog order={order as any} disputeResolution={disputeResolution} />
        </div>
      </div>

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
          <MarkReceivedModal
            open={markReceivedOpen}
            onOpenChange={setMarkReceivedOpen}
            orderId={order.id}
            amount={escrowAmount}
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

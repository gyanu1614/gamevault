'use client'

/**
 * OrderDetailsCard — V21/P4.c
 *
 * Stacked right-rail surfaces:
 *  1. Order Details card — centered icon + title at top, then tabular
 *     rows. For the seller view the rows are de-duplicated against the
 *     payout block (no Sale Price / After Fees here).
 *  2. SafeDrop Buyer Protection inset (buyer + admin) inside the details card.
 *  3. Party button at the bottom of the details card.
 *  4. Payout card (seller + admin) — separate sibling card below.
 *
 * Icons live in /public/assets/order-icons (order-details.svg,
 * payout.svg, escrow.svg). Swap with final art using same filenames.
 */

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronRight, Copy, Check, ThumbsUp, ThumbsDown, Wallet, Info, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { requestRefundToSource } from '@/lib/actions/refund-to-source'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { OrderCard } from './_OrderCard'
import { cn } from '@/lib/utils'
import { VerifiedBadge } from '@/components/seller/VerifiedBadge'
import { SellerStats } from '@/components/seller/SellerStats'
import type { SellerStatInput } from '@/lib/seller/stat-line'

interface PartyInfo {
  name: string
  username: string
  avatarUrl: string
  verified: boolean
  rating: number
  sales: number
  href: string
  /** "View store →" or "View profile →" */
  ctaLabel: string
  /** Seller parties only: the shared seller line (SellerStats). */
  stats?: SellerStatInput | null
}

/** The buyer's refund-to-original-method request on this order, if any. */
export interface RefundToSourceState {
  request: { status: 'pending' | 'approved' | 'sent' | 'failed' | 'rejected'; adminNotes: string | null; amount: number } | null
  /** No request yet and a provider charge was paid (the RPC re-checks the rest). */
  canRequest: boolean
}

interface OrderDetailsCardProps {
  orderNumber: string
  /** Raw UUID — used for dispute / sub-path links inside cards. */
  orderId: string
  placedAtLabel: string
  /** Buyer / admin: the payment breakdown (null for the seller, or before
   *  payment). */
  paymentSummary?: {
    itemPrice: number
    marketplaceFee: number
    paymentFee: number
    promoDiscount: number
    total: number
    paidWith: string | null
  } | null
  /** Buyer / admin: what came back as store credit and whether the service
   *  fee was kept (buyer-fault cancel). null before any refund. */
  buyerRefund?: { credited: number; feeKept: boolean } | null
  /** Buyer: refund-to-original-method request state (refund policy). */
  refundToSource?: RefundToSourceState | null
  subtotal: number
  fee: number
  totalPaid: number
  /** Buyer view → SafeDrop inset. Seller view → payout inset. Admin → both. */
  role: 'buyer' | 'seller' | 'admin'
  escrowAmount: number
  /** For seller — the fee percentage shown next to the deduction. */
  feePercent?: number
  /** For seller — net payout = subtotal - fee (less any partial refund). */
  netPayout?: number
  /** For seller — part of the sale refunded to the buyer by a dispute. */
  refundedToBuyer?: number
  /** Drives the payout status row (held / queued / released). */
  orderStatus: string
  /** orders.escrow_status — distinguishes a refunded cancel from an
   *  unpaid cancel so the SafeDrop caption doesn't claim a credit that
   *  never happened. */
  escrowStatus?: string | null
  /** The "other party" — seller for buyer view, buyer for seller view. */
  otherParty: PartyInfo
  /** Opens the controlled DisputeModal. When provided, the SafeDrop
   *  CTA fires this instead of the legacy #dispute href. */
  onOpenDispute?: () => void
  /** PR 7: end of the buyer's dispute window (delivered_at + N days). */
  disputeUntil?: string | null
  /** Buyer's review for this order. V21/P5.r — folded into Payout
   *  body now (sibling card retired). */
  buyerReview?: {
    rating: number
    comment: string
    recommendsSeller?: boolean | null
  } | null
  // V21/P5.r — New fields for the restructured Order Details body.
  /** Game label + tiny icon (top of details). */
  gameName?: string | null
  gameIconUrl?: string | null
  /** Item line label (listing title). */
  itemName?: string | null
  /** Delivery-info entries collected at checkout — typically
   *  `{ username, email, ... }` depending on the listing's needs.
   *  Renders one Row per filled field, or a single "Not Provided"
   *  placeholder when empty. */
  deliveryInfo?: Record<string, string | null | undefined> | null
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`
}

// V21/P5.r — Convert snake_case / camelCase delivery_info keys into a
// Title Case row label. "in_game_email" → "In Game Email" etc.
function labelizeKey(key: string): string {
  return key
    .replace(/[_\-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

function CopyableId({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1400)
      }}
      className="inline-flex items-center gap-1.5 font-mono text-[12.5px] font-semibold text-text-primary transition-colors hover:text-lime-text"
    >
      #{value}
      {copied ? <Check className="h-3 w-3 text-lime-text" /> : <Copy className="h-3 w-3 text-text-tertiary" />}
    </button>
  )
}

/** Delivery-info value the seller must copy exactly (in-game email/username):
    tap-to-copy like CopyableId, wraps with break-all instead of truncating. */
function CopyableValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1400)
      }}
      aria-label={`Copy ${value}`}
      className="inline-flex max-w-[240px] items-start justify-end gap-1.5 text-right font-mono text-[12.5px] font-semibold text-text-primary transition-colors hover:text-lime-text"
    >
      <span className="min-w-0 break-all">{value}</span>
      {copied ? (
        <Check className="mt-0.5 h-3 w-3 shrink-0 text-lime-text" />
      ) : (
        <Copy className="mt-0.5 h-3 w-3 shrink-0 text-text-tertiary" />
      )}
    </button>
  )
}

function Row({
  label,
  children,
  emphasized,
}: {
  label: string
  children: React.ReactNode
  emphasized?: boolean
}) {
  return (
    <div className="flex items-center justify-between border-t border-white/[0.07] py-3 text-[13px] first:border-t-0">
      <span className={cn('text-text-secondary', emphasized && 'font-bold text-text-primary')}>
        {label}
      </span>
      <span
        className={cn(
          'font-semibold tabular-nums text-text-primary',
          emphasized && 'text-[15px]',
        )}
      >
        {children}
      </span>
    </div>
  )
}

/**
 * One "Fees" row (marketplace + payment) instead of two, with the split in
 * a tap-to-open popover (hover tooltips never fire on phones).
 */
function FeesRow({ marketplaceFee, paymentFee }: { marketplaceFee: number; paymentFee: number }) {
  const total = Math.round((marketplaceFee + paymentFee) * 100) / 100
  return (
    <div className="flex items-center justify-between border-t border-white/[0.07] py-3 text-[13px] first:border-t-0">
      <span className="inline-flex items-center gap-1.5 text-text-secondary">
        Service Fee
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Fee breakdown"
              className="-m-2 inline-flex rounded-full p-2 text-text-tertiary transition-colors hover:text-text-primary focus-visible:text-text-primary focus-visible:outline-none"
            >
              <Info className="h-3.5 w-3.5" aria-hidden />
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" className="w-56 p-0">
            <div className="divide-y divide-white/[0.07] px-3 py-1 text-[12.5px]">
              {marketplaceFee > 0 && (
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-text-secondary">Marketplace Fee</span>
                  <span className="font-semibold tabular-nums text-text-primary">{fmtUsd(marketplaceFee)}</span>
                </div>
              )}
              {paymentFee > 0 && (
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-text-secondary">Payment Fee</span>
                  <span className="font-semibold tabular-nums text-text-primary">{fmtUsd(paymentFee)}</span>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </span>
      <span className="font-semibold tabular-nums text-text-primary">{fmtUsd(total)}</span>
    </div>
  )
}

/**
 * RefundToSourceRow — "send my refund back to my payment method": the
 * request button, or the state of the request already made. The RPC behind
 * requestRefundToSource decides eligibility (unspent credit, refundable
 * rail); this only renders and refreshes.
 */
function RefundToSourceRow({ orderId, state }: { orderId: string; state: RefundToSourceState }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const req = state.request
  if (req) {
    const line =
      req.status === 'pending'
        ? 'Refund to your payment method requested — support reviews it within 24 to 48 hours. The store credit stays in your Store Balance until then.'
        : req.status === 'approved'
          ? `Refund approved — $${req.amount.toFixed(2)} is on its way to your original payment method. It usually arrives within 5 to 10 business days.`
          : req.status === 'sent'
            ? `Refund sent — $${req.amount.toFixed(2)} went back to your original payment method. Allow 5 to 10 business days for it to land.`
            : req.status === 'failed'
              ? 'The refund could not be sent to your payment method. The full amount is back in your Store Balance; support will follow up.'
              : `Refund to your payment method declined${req.adminNotes ? `: ${req.adminNotes}` : '.'} The store credit stays in your Store Balance.`
    return <p className="mt-2 text-center text-[12px] leading-[1.55] text-text-tertiary">{line}</p>
  }
  return (
    <p className="mt-2 text-center text-[12px] leading-[1.55] text-text-tertiary">
      Prefer a refund to your original payment method?{' '}
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            const r = await requestRefundToSource(orderId)
            if (!r.success) toast.error(r.error ?? 'Could not send the request')
            else {
              toast.success('Refund Requested — support reviews it within 24 to 48 hours.')
              router.refresh()
            }
          } finally {
            setBusy(false)
          }
        }}
        className="inline-flex items-center gap-1 font-semibold text-text-secondary underline underline-offset-2 transition-colors hover:text-lime-text disabled:opacity-60"
      >
        {busy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
        Request It
      </button>
    </p>
  )
}

/**
 * SafeDropBody — V21/P5.k
 *
 * Buyer's SafeDrop protection card body, mirrors PayoutBody for the
 * seller: flat rows + dynamic status row at the bottom. Lives in a
 * sibling OrderCard (not nested), so the buyer rail reads as
 *   [Order Details] → [SafeDrop Protection] → [Audit ...]
 * just like the seller's
 *   [Order Details] → [Your Payout] → [...]
 *
 * Row label + status row + caption all morph by orderStatus so the
 * card reads coherently across paid → delivering → delivered →
 * completed → disputed / refunded.
 */
function SafeDropBody({
  amount,
  refund = null,
  refundToSource = null,
  orderStatus,
  orderId,
  orderNumber,
  role,
  escrowStatus,
  onOpenDispute,
  disputeUntil,
}: {
  amount: number
  /** What came back as store credit, and whether the service fee was kept. */
  refund?: { credited: number; feeKept: boolean } | null
  refundToSource?: RefundToSourceState | null
  orderStatus: string
  orderId: string
  orderNumber: string
  role: 'buyer' | 'seller' | 'admin'
  escrowStatus?: string | null
  onOpenDispute?: () => void
  disputeUntil?: string | null
}) {
  const disputeWindowOpen = !!disputeUntil && new Date(disputeUntil).getTime() > Date.now()
  const disputeUntilLabel = disputeUntil
    ? new Date(disputeUntil).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null
  // A cancelled order only carries a refund when money was actually covered
  // and returned (escrow refunded). An unpaid order cancelled before payment
  // never charged the buyer — no store credit landed, so don't claim one.
  const cancelledWithRefund = escrowStatus === 'refunded'
  // Row + caption depend on order state.
  let amountLabel = 'Amount Covered'
  let caption: React.ReactNode = 'Not delivered or not as described? You get your money back.'
  let showDisputeCta = false

  if (orderStatus === 'completed') {
    amountLabel = 'Seller Paid'
    caption = disputeWindowOpen ? (
      <>
        The seller has been paid for this order. If anything was off, you
        can still open a dispute until {disputeUntilLabel}. SafeDrop
        Protection covers you for that window.
      </>
    ) : (
      <>The seller has been paid for this order and the dispute window has closed. Need help? Contact Support.</>
    )
    showDisputeCta = disputeWindowOpen
  } else if (orderStatus === 'delivered') {
    amountLabel = 'Amount Covered'
    caption =
      "Your order arrived. Confirm Delivery to complete the order, or open a dispute if something's off."
    showDisputeCta = true
  } else if (orderStatus === 'refunded') {
    amountLabel = 'Amount Refunded'
    caption = refund?.feeKept
      ? 'The item price was added to your Store Balance as store credit. The service fee is not refunded when you cancel a paid order. Spend your credit at checkout with no service fee.'
      : 'Your refund was added to your Store Balance as store credit. Spend it at checkout on any listing with no service fee.'
  } else if (orderStatus === 'disputed') {
    amountLabel = 'Amount In Dispute'
    caption =
      'A DropMarket admin is reviewing your dispute. Your order stays open until it resolves.'
  } else if (orderStatus === 'cancelled') {
    if (cancelledWithRefund) {
      amountLabel = 'Amount Refunded'
      caption = refund?.feeKept
        ? 'Order cancelled. The item price was added to your Store Balance as store credit; the service fee is not refunded when you cancel a paid order.'
        : 'Order cancelled. Your refund was added to your Store Balance as store credit. Spend it at checkout with no service fee.'
    } else {
      amountLabel = 'Order Total'
      caption = 'Order cancelled. You were not charged.'
    }
  }

  // Refund to the original payment method (Refund & Dispute Policy 7.2):
  // store credit is the default outcome; the buyer can ask for it to go
  // back to the method they paid with. Never automatic — an admin approves
  // (each provider refund costs a fee). Only shown when a refund landed.
  const showRefundToSource =
    role === 'buyer' &&
    (orderStatus === 'refunded' || (orderStatus === 'cancelled' && cancelledWithRefund)) &&
    refundToSource != null &&
    (refundToSource.request != null || refundToSource.canRequest)

  // After a refund the row shows what actually came back (the item price on
  // a buyer-fault cancel), not the amount that was covered.
  const shownAmount = refund && (orderStatus === 'refunded' || cancelledWithRefund) ? refund.credited : amount

  return (
    <>
      <Row label={amountLabel} emphasized>
        {fmtUsd(shownAmount)}
      </Row>
      <SafeDropStatusRow orderStatus={orderStatus} />
      <p className="mt-3 text-center text-[13px] leading-[1.55] text-text-secondary">
        {caption}
      </p>
      {showRefundToSource && <RefundToSourceRow orderId={orderId} state={refundToSource!} />}
      {showDisputeCta && (
        onOpenDispute ? (
          <button
            type="button"
            onClick={onOpenDispute}
            className={cn(
              'mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[rgba(255,178,62,0.32)] bg-warning-bg px-3 py-2.5 text-[13px] font-bold text-warning transition-colors',
              'hover:border-[rgba(255,178,62,0.5)] hover:bg-[rgba(255,178,62,0.2)]',
            )}
          >
            Issue With Your Order? Open Dispute
          </button>
        ) : (
          <Link
            href={`/account/orders/${orderId}#dispute`}
            className={cn(
              'mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[rgba(255,178,62,0.32)] bg-warning-bg px-3 py-2.5 text-[13px] font-bold text-warning transition-colors',
              'hover:border-[rgba(255,178,62,0.5)] hover:bg-[rgba(255,178,62,0.2)]',
            )}
          >
            Issue With Your Order? Open Dispute
          </Link>
        )
      )}
    </>
  )
}

/**
 * Single dynamic micro-status row at the bottom of the SafeDrop card.
 * Color + label morph with order status — mirrors the seller's
 * PayoutStatusRow so both rails share the same visual rhythm.
 */
function SafeDropStatusRow({ orderStatus }: { orderStatus: string }) {
  const tone =
    orderStatus === 'completed'
      ? { dot: 'bg-green-400', text: 'text-green-400', bg: 'bg-green-400/[0.10]' }
      : orderStatus === 'delivered'
      ? { dot: 'bg-lime-text', text: 'text-lime-text', bg: 'bg-lime-tint-bg' }
      : { dot: 'bg-warning', text: 'text-warning', bg: 'bg-warning-bg' }

  const label =
    orderStatus === 'completed'
      ? 'Seller Paid Out'
      : orderStatus === 'delivered'
      ? 'Confirm Delivery To Complete'
      : 'Covered By SafeDrop Protection'

  return (
    <div className={cn('mt-3 flex items-center gap-2 rounded-[9px] px-3 py-2', tone.bg)}>
      <span className={cn('h-2 w-2 rounded-full', tone.dot)} aria-hidden />
      <span className={cn('text-[12px] font-bold', tone.text)}>{label}</span>
    </div>
  )
}

/**
 * Payout breakdown — flat rows directly inside the parent OrderCard.
 * Same Row pattern as Order Details, no nested lime card. A single
 * state-driven status row at the bottom replaces the ETA caption.
 */
function PayoutBody({
  subtotal,
  feePercent,
  fee,
  netPayout,
  orderStatus,
  role,
  refundedToBuyer = 0,
}: {
  subtotal: number
  feePercent: number
  fee: number
  netPayout: number
  orderStatus: string
  role: 'buyer' | 'seller' | 'admin'
  refundedToBuyer?: number
}) {
  // A fully refunded or cancelled order pays the seller nothing and charges
  // no fee: the sale is reversed, so show that instead of a live payout.
  const noPayout = orderStatus === 'refunded' || orderStatus === 'cancelled'
  if (noPayout) {
    return (
      <>
        <Row label="Item Price">{fmtUsd(subtotal)}</Row>
        <Row label={orderStatus === 'refunded' ? 'Refunded To Buyer' : 'Order Cancelled'}>−{fmtUsd(subtotal)}</Row>
        <Row label="You Receive" emphasized>
          <span className="text-[18px] font-extrabold tabular-nums text-text-secondary">{fmtUsd(0)}</span>
        </Row>
        <PayoutStatusRow orderStatus={orderStatus} />
      </>
    )
  }
  return (
    <>
      <Row label="Item Price">{fmtUsd(subtotal)}</Row>
      <Row label={`DropMarket Fee · ${feePercent}%`}>−{fmtUsd(fee)}</Row>
      {refundedToBuyer > 0 && <Row label="Refunded To Buyer">−{fmtUsd(refundedToBuyer)}</Row>}
      <Row label="You Receive" emphasized>
        <span className="text-[18px] font-extrabold tabular-nums text-lime-text">
          {fmtUsd(netPayout)}
        </span>
      </Row>
      {/* Completed → the money is in the seller's wallet; link there
          instead of a status box. Admins view someone else's order, so
          they keep the status row. */}
      {orderStatus === 'completed' && role === 'seller' ? (
        <Link
          href="/account/wallet"
          className="mt-3 flex items-center justify-between rounded-[9px] border border-border-subtle bg-white/[0.02] px-3 py-2.5 text-[12.5px] font-bold text-text-primary transition-colors hover:border-lime-tint-border hover:text-lime-text"
        >
          <span className="inline-flex items-center gap-2">
            <Wallet className="h-4 w-4 text-lime-text" aria-hidden />
            View In Wallet
          </span>
          <ChevronRight className="h-4 w-4 text-text-tertiary" aria-hidden />
        </Link>
      ) : (
        <PayoutStatusRow orderStatus={orderStatus} />
      )}
    </>
  )
}

/**
 * Single dynamic micro-status row at the bottom of the payout card.
 * Color + label morph with order status.
 */
function PayoutStatusRow({ orderStatus }: { orderStatus: string }) {
  const noPayout = orderStatus === 'refunded' || orderStatus === 'cancelled'
  const tone =
    orderStatus === 'completed'
      ? { dot: 'bg-green-400', text: 'text-green-400', bg: 'bg-green-400/[0.10]' }
      : orderStatus === 'delivered'
      ? { dot: 'bg-lime-text', text: 'text-lime-text', bg: 'bg-lime-tint-bg' }
      : noPayout
      ? { dot: 'bg-text-tertiary', text: 'text-text-secondary', bg: 'bg-white/[0.05]' }
      : { dot: 'bg-warning', text: 'text-warning', bg: 'bg-warning-bg' }

  const label =
    orderStatus === 'completed'
      ? 'Added To Your Seller Balance'
      : orderStatus === 'delivered'
      ? 'Payout Pending — Protection Window Open'
      : orderStatus === 'refunded'
      ? 'Refunded To Buyer — No Payout'
      : orderStatus === 'cancelled'
      ? 'Order Cancelled — No Payout'
      : 'Payout After Delivery Is Confirmed'

  return (
    <div className={cn('mt-3 flex items-center gap-2 rounded-[9px] px-3 py-2', tone.bg)}>
      <span className={cn('h-2 w-2 rounded-full', tone.dot)} aria-hidden />
      <span className={cn('text-[12px] font-bold', tone.text)}>{label}</span>
    </div>
  )
}

/**
 * BuyerReviewBody — V21/P5.q
 *
 * Seller/admin view of the review the buyer wrote for this order.
 * Same body pattern as PayoutBody/SafeDropBody — lives inside an
 * OrderCard with the canonical CardHeader.
 */
function BuyerReviewBody({
  review,
}: {
  review: {
    rating: number
    comment: string
    recommendsSeller?: boolean | null
  }
}) {
  const isPositive =
    review.recommendsSeller === true ||
    (review.recommendsSeller == null && review.rating >= 4)
  return (
    <>
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'grid h-9 w-9 flex-shrink-0 place-items-center rounded-[9px]',
            isPositive
              ? 'bg-green-400/[0.12] text-green-400'
              : 'bg-red-400/[0.12] text-red-400',
          )}
        >
          {isPositive ? (
            <ThumbsUp className="h-4 w-4 fill-current" />
          ) : (
            <ThumbsDown className="h-4 w-4 fill-current" />
          )}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="text-[13px] font-bold text-text-primary">
            {isPositive ? 'Recommended' : "Didn't Recommend"}
          </div>
          <div className="mt-0.5 text-[12px] text-text-secondary">
            From your buyer
          </div>
        </div>
      </div>
      {review.comment && (
        <p className="mt-3 rounded-[9px] border border-border-subtle bg-[color-mix(in_srgb,var(--color-bg-overlay)_60%,transparent)] px-3 py-2 text-[12.5px] leading-[1.5] italic text-text-secondary">
          &ldquo;{review.comment}&rdquo;
        </p>
      )}
    </>
  )
}

function PartyButton({ party }: { party: PartyInfo }) {
  // V21/P7.a — When there's no real destination (e.g. buyer profiles
  // aren't public), render the same chrome without the Link so the
  // user gets the avatar + name display without a 404-bound click.
  const hasHref = !!party.href && party.href !== '#'
  const inner = (
    <>
      <Image
        src={party.avatarUrl}
        alt=""
        width={28}
        height={28}
        className="h-7 w-7 flex-shrink-0 rounded-full object-cover ring-1 ring-white/10"
        unoptimized
      />
      <div className="flex min-w-0 flex-col items-end">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[13px] font-semibold text-text-primary">{party.name}</span>
          {party.verified && <VerifiedBadge size={14} />}
        </span>
        {party.stats && <SellerStats {...party.stats} className="text-[11px]" />}
      </div>
      {hasHref && (
        <ChevronRight className="ml-auto h-3.5 w-3.5 text-text-tertiary transition-all group-hover:translate-x-0.5 group-hover:text-lime-text" />
      )}
    </>
  )
  const cls = cn(
    'group inline-flex items-center gap-2 rounded-lg px-2 py-1 transition-colors',
    hasHref && 'hover:card-frost',
  )
  if (hasHref) {
    return (
      <Link href={party.href} className={cls}>
        {inner}
      </Link>
    )
  }
  return <span className={cls}>{inner}</span>
}

/**
 * Shared compact header used by both Order Details + Payout cards.
 * Logo on the LEFT, title beside it on the same row. Tight spacing.
 * Icon swaps via `iconSrc` so the user can drop new SVGs in
 * /public/assets/order-icons later.
 */
function CardHeader({ iconSrc, title }: { iconSrc: string; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-[7px] bg-lime-tint-bg text-lime-text">
        <span
          aria-hidden
          className="h-[15px] w-[15px] bg-current"
          style={{
            WebkitMaskImage: `url(${iconSrc})`,
            maskImage: `url(${iconSrc})`,
            WebkitMaskSize: 'contain',
            maskSize: 'contain',
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center',
            maskPosition: 'center',
          }}
        />
      </span>
      <span className="text-[13.5px] font-bold tracking-tight text-text-primary">
        {title}
      </span>
    </div>
  )
}

export function OrderDetailsCard(props: OrderDetailsCardProps) {
  const {
    orderNumber,
    orderId,
    placedAtLabel,
    paymentSummary = null,
    buyerRefund = null,
    refundToSource = null,
    subtotal,
    fee,
    totalPaid,
    role,
    escrowAmount,
    feePercent = 0,
    netPayout = 0,
    refundedToBuyer = 0,
    orderStatus,
    otherParty,
    buyerReview,
    gameName,
    gameIconUrl,
    itemName,
    deliveryInfo,
    onOpenDispute,
  } = props

  // V21/P5.r — Stable, label-cased list of delivery-info entries to
  // render. Skip empty strings + nulls. Username comes first if
  // present; rest follow in insertion order. Nothing collected → no rows.
  // delivery_details is free-form jsonb: only a plain object is read.
  const deliveryEntries: Array<[string, string]> = (() => {
    if (!deliveryInfo || typeof deliveryInfo !== 'object' || Array.isArray(deliveryInfo)) return []
    const out: Array<[string, string]> = []
    const ordered = ['username', 'email', 'password', 'region', 'platform']
    const seen = new Set<string>()
    for (const k of ordered) {
      const v = deliveryInfo[k]
      if (v && String(v).trim()) {
        out.push([labelizeKey(k), String(v).trim()])
        seen.add(k)
      }
    }
    for (const [k, v] of Object.entries(deliveryInfo)) {
      if (seen.has(k)) continue
      if (v && String(v).trim()) out.push([labelizeKey(k), String(v).trim()])
    }
    return out
  })()
  const otherPartyLabel = role === 'buyer' ? 'Seller' : 'Buyer'

  return (
    <>
      <OrderCard className="px-5 pb-4 pt-5">
        <CardHeader iconSrc="/assets/order-icons/order-details.svg" title="Order Details" />

        {gameName && (
          <Row label="Game">
            <span className="inline-flex items-center gap-2 font-semibold text-text-primary">
              {gameIconUrl && (
                <Image
                  src={gameIconUrl}
                  alt=""
                  width={18}
                  height={18}
                  className="h-[18px] w-[18px] rounded-[5px] object-cover ring-1 ring-white/10"
                  unoptimized
                />
              )}
              {gameName}
            </span>
          </Row>
        )}
        {itemName && (
          <Row label="Item">
            <span className="block max-w-[220px] truncate text-right font-semibold text-text-primary">
              {itemName}
            </span>
          </Row>
        )}
        {/* Delivery info — usually buyer-collected at checkout (username,
            email, region, etc.). One row per filled field, or a single
            "Not Provided" stub when nothing was collected. */}
        {/* Only what the buyer actually gave; nothing when checkout
            collected nothing (no "Not Provided" placeholder). */}
        {deliveryEntries.map(([k, v]) => (
          <Row key={k} label={k}>
            <CopyableValue value={v} />
          </Row>
        ))}
        <Row label="Order ID">
          <CopyableId value={orderNumber} />
        </Row>
        {paymentSummary ? (
          <>
            <Row label="Item Price">{fmtUsd(paymentSummary.itemPrice)}</Row>
            {(paymentSummary.marketplaceFee > 0 || paymentSummary.paymentFee > 0) && (
              <FeesRow marketplaceFee={paymentSummary.marketplaceFee} paymentFee={paymentSummary.paymentFee} />
            )}
            {paymentSummary.promoDiscount > 0 && (
              <Row label="Promo Discount">−{fmtUsd(paymentSummary.promoDiscount)}</Row>
            )}
            <Row label="Total Paid" emphasized>
              {fmtUsd(paymentSummary.total)}
            </Row>
            {paymentSummary.paidWith && <Row label="Paid With">{paymentSummary.paidWith}</Row>}
          </>
        ) : (
          <Row label="Total Paid" emphasized>
            {fmtUsd(totalPaid)}
          </Row>
        )}
        <Row label="Date Placed">{placedAtLabel}</Row>
        <Row label={otherPartyLabel}>
          <span className="-my-1 flex justify-end">
            <PartyButton party={otherParty} />
          </span>
        </Row>
      </OrderCard>

      {(role === 'buyer' || role === 'admin') && (
        <OrderCard className="px-5 pb-4 pt-5">
          <CardHeader iconSrc="/assets/order-icons/escrow.svg" title="SafeDrop Protection" />
          <SafeDropBody
            amount={escrowAmount}
            refund={buyerRefund}
            refundToSource={refundToSource}
            orderStatus={orderStatus}
            orderId={orderId}
            orderNumber={orderNumber}
            role={role}
            escrowStatus={props.escrowStatus}
            onOpenDispute={onOpenDispute}
            disputeUntil={props.disputeUntil ?? null}
          />
        </OrderCard>
      )}

      {(role === 'seller' || role === 'admin') && (
        <OrderCard className="px-5 pb-4 pt-5">
          <CardHeader iconSrc="/assets/order-icons/payout.svg" title="Your Payout" />
          <PayoutBody
            subtotal={subtotal}
            feePercent={feePercent}
            fee={fee}
            netPayout={netPayout}
            orderStatus={orderStatus}
            role={role}
            refundedToBuyer={refundedToBuyer}
          />
        </OrderCard>
      )}
    </>
  )
}

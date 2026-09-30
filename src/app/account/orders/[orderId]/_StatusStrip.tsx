'use client'

/**
 * StatusStrip — V21/P3
 *
 * Small "waiting on …" card at the top of the right rail. Mirrors the
 * order state in plain words so the user immediately knows what to
 * expect without parsing the pills. One-line title + one-line caption.
 */

import {
  CheckCircle2,
  Wallet,
  XCircle,
  ThumbsUp,
  ThumbsDown,
  CreditCard,
  Hourglass,
  Truck,
  PackageCheck,
  BadgeCheck,
  ShieldAlert,
  MessagesSquare,
  Undo2,
  TimerOff,
  Ban,
} from 'lucide-react'
import Link from 'next/link'
import { OrderCard } from './_OrderCard'
import { cn } from '@/lib/utils'

interface StatusStripProps {
  role: 'buyer' | 'seller' | 'admin'
  status: string
  /** Optional money value interpolated into the copy (e.g. seller net payout
   *  when the order completes). Renders as "$9.20" formatted. */
  amount?: number
  /** When true and (role=buyer, status=delivering), the strip morphs into
   *  the "seller went silent" escalation prompt with a Dispute CTA. */
  overdue?: boolean
  /** Where the dispute CTA links to. Optional — falls back to a noop hash. */
  disputeHref?: string
  /** Seller only: opens the Mark As Delivered modal. */
  onMarkDelivered?: () => void
  /** Seller only (paid / delivering, not yet delivered): opens Cancel Order. */
  onCancelOrder?: () => void
  /** Buyer only: Request Cancellation (eligible) or an open request to
   *  withdraw (pending). */
  cancelRequest?:
    | { state: 'eligible'; onRequest: () => void }
    | { state: 'pending'; onWithdraw: () => void }
  /** Buyer only: opens the Confirm Receipt modal. */
  onMarkReceived?: () => void
  /** Buyer only: opens the review form (status=completed). */
  onLeaveReview?: () => void
  /** Opens the Dispute modal (any role can hit this from various states). */
  onOpenDispute?: () => void
  /** Review the buyer left for this order, if any.
   *  Buyer view (completed) → strip morphs into "Review Submitted"
   *  panel showing their own review back.
   *  Seller view (completed) → "Added To Your Seller Balance" panel
   *  grows to include "Buyer's Feedback" with a divider + review body. */
  existingReview?: {
    rating: number
    comment: string
    recommendsSeller?: boolean | null
    createdAt: string
  } | null
  /** V21/P5.r — When true, render the bigger "hero" variant used
   *  when the strip lives above the chat in the left column instead
   *  of inside the right rail. Larger icon, beefier CTA, more
   *  padding so it reads as the page's primary action. */
  promoted?: boolean
  /** When the seller marked the order delivered (also set during a
   *  dispute, where the status stays `disputed`). */
  deliveredAt?: string | null
  /** orders.escrow_status — 'refunded' on a cancelled order means it WAS
   *  paid and the money went back to the buyer's wallet. */
  escrowStatus?: string | null
  /** Phone only: hide the strip when it has no action and only repeats
   *  what the phone status card (OrderStatusCard) already says. */
  hidePassiveOnMobile?: boolean
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`
}

const STRIPS: Record<
  string,
  Record<
    string,
    {
      Icon: React.ComponentType<{ className?: string }>
      title: string
      caption: string
      tone: 'amber' | 'lime' | 'blue' | 'gray' | 'orange'
    }
  >
> = {
  buyer: {
    pending: {
      Icon: CreditCard,
      title: 'Awaiting Payment',
      caption: 'Complete your crypto payment to start this order.',
      tone: 'amber',
    },
    paid: {
      Icon: Hourglass,
      title: 'Waiting On The Seller',
      caption: "You'll be notified the moment they start delivering.",
      tone: 'amber',
    },
    delivering: {
      Icon: Truck,
      title: 'Delivery In Progress',
      caption: "The seller is preparing your order and will mark it delivered soon.",
      tone: 'amber',
    },
    delivered: {
      Icon: PackageCheck,
      title: 'Order Delivered',
      // V21/P5.d — caption dropped; the buyer-delivered state renders a
      // bespoke 2-row layout in the component body below (Confirm
      // Receipt on top, Open Dispute on bottom).
      caption: '',
      tone: 'lime',
    },
    completed: {
      Icon: BadgeCheck,
      title: 'Order Complete',
      caption: 'The seller has been paid. Leave a review when you can.',
      tone: 'lime',
    },
    disputed: {
      Icon: ShieldAlert,
      title: 'Dispute Under Review',
      caption: 'A DropMarket admin is reviewing. Support responds within 24 to 48 hours.',
      tone: 'amber',
    },
    refunded: {
      Icon: Wallet,
      title: 'Refund In Your Store Balance',
      caption: 'Your refund was added to your Store Balance as store credit. Spend it at checkout on any listing with no service fee.',
      tone: 'lime',
    },
    // 'cancelled' only ever means a NEVER-PAID order (checkout timed out or
    // was cancelled before paying) — claiming "money in your wallet" here was
    // false for the usual case where nothing was charged at all.
    cancelled: {
      Icon: XCircle,
      title: 'No Payment Received',
      caption: 'This order was cancelled because no payment arrived before the window closed. Nothing was charged — any wallet credit you applied went straight back to your wallet.',
      tone: 'orange',
    },
  },
  seller: {
    paid: {
      Icon: MessagesSquare,
      title: 'Action Required',
      caption: 'Chat with the buyer to begin delivery.',
      tone: 'amber',
    },
    delivering: {
      Icon: Truck,
      title: 'Delivery In Progress',
      caption: 'Send the goods, then mark as delivered.',
      tone: 'amber',
    },
    delivered: {
      Icon: PackageCheck,
      title: 'Order Delivered',
      caption: 'Waiting on the buyer to confirm delivery.',
      tone: 'lime',
    },
    completed: {
      Icon: Wallet,
      // V21/P3.b — Interpolated with the actual amount in the component
      // body below; see the {AMOUNT} placeholder for the substitution.
      title: 'Added To Your Seller Balance · {AMOUNT}',
      caption: 'Added to your seller balance. New sales can be withdrawn once they are released.',
      tone: 'lime',
    },
    disputed: {
      Icon: ShieldAlert,
      title: 'Dispute Opened',
      caption: 'Respond in chat. Payout paused pending dispute resolution.',
      tone: 'amber',
    },
    // V21/P7 — Terminal states so the seller strip never renders blank.
    refunded: {
      Icon: Undo2,
      title: 'Order Refunded',
      caption: 'The buyer was refunded. No payout for this order.',
      tone: 'blue',
    },
    cancelled: {
      Icon: XCircle,
      title: 'Order Cancelled',
      caption: 'Check the timeline below for the cancellation reason.',
      tone: 'orange',
    },
  },
  admin: {
    paid: { Icon: Hourglass, title: 'Pre-Delivery', caption: 'Seller has not started yet.', tone: 'gray' },
    delivering: { Icon: Truck, title: 'In Delivery', caption: 'Seller is working on the order.', tone: 'amber' },
    delivered: { Icon: PackageCheck, title: 'Awaiting Buyer Confirm', caption: 'Auto-completes when the protection window closes.', tone: 'lime' },
    completed: { Icon: BadgeCheck, title: 'Complete', caption: 'Seller paid out.', tone: 'lime' },
    disputed: { Icon: ShieldAlert, title: 'Dispute Open', caption: 'Awaiting your decision.', tone: 'amber' },
  },
}

// Tile tint + glyph colour per tone. Only classes that compile: `amber` has
// no token here and `lime` is a CSS-variable colour (opacity modifiers on it
// generate nothing), so the warning / accent tint tokens are used instead.
const TONE_BG: Record<string, string> = {
  amber:  'bg-warning-bg text-warning',
  lime:   'bg-lime-tint-bg text-lime-text',
  blue:   'bg-blue-400/[0.12] text-blue-400',
  gray:   'bg-white/[0.06] text-text-secondary',
  orange: 'bg-orange-400/[0.12] text-orange-400',
}

export function StatusStrip({
  role,
  status,
  amount,
  overdue,
  disputeHref = '#',
  onMarkDelivered,
  onCancelOrder,
  cancelRequest,
  onMarkReceived,
  onLeaveReview,
  onOpenDispute,
  existingReview,
  promoted = false,
  hidePassiveOnMobile = false,
  deliveredAt = null,
  escrowStatus = null,
}: StatusStripProps) {
  // V21/P5.r — Shared style tokens that scale with promoted variant.
  const sIcon = promoted ? 'h-12 w-12 rounded-[12px]' : 'h-9 w-9 rounded-[9px]'
  const sIconGlyph = promoted ? 'h-[22px] w-[22px]' : 'h-4 w-4'
  const sTitle = promoted ? 'text-body-lg leading-snug' : 'text-[14px]'
  const sCaption = promoted ? 'text-body-sm leading-snug' : 'text-[12.5px]'
  const sPad = promoted ? 'px-5 py-[18px]' : 'p-4'
  const sCtaCls = cn(
    'inline-flex flex-shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] font-bold transition-all',
    'bg-lime text-text-inverse hover:-translate-y-[1px] hover:bg-lime-hover',
    'shadow-[0_6px_18px_rgba(198,255,61,0.18)]',
    promoted ? 'px-5 py-2.5 text-[13.5px]' : 'px-3 py-1.5 text-[12px]',
    // Below sm the CTA drops to its own full-width row (parent rows are
    // flex-wrap) and grows to a comfortable >=44px touch target.
    'max-sm:ml-0 max-sm:min-h-[44px] max-sm:basis-full max-sm:py-3',
  )
  const sCtaGlyph = promoted ? 'h-4 w-4' : 'h-3.5 w-3.5'
  // V21/P3.e — Overdue escalation for the buyer. When the delivery
  // window has run out and the seller hasn't marked it delivered, the
  // strip morphs into a clear "next step" prompt instead of leaving the
  // buyer staring at a passive "waiting" line. Same card shape; amber
  // accent tile + Open Dispute CTA at the right.
  if (overdue && role === 'buyer' && (status === 'paid' || status === 'delivering')) {
    return (
      <OrderCard className={cn('flex flex-wrap items-center gap-3.5 max-sm:gap-y-2.5', sPad)} padded={false}>
        <span className={cn('grid flex-shrink-0 place-items-center', sIcon, TONE_BG.amber)}>
          <TimerOff className={sIconGlyph} />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className={cn(sTitle, 'font-bold text-text-primary')}>Order Is Overdue</div>
          <div className={cn('mt-0.5 text-text-secondary', sCaption)}>
            The delivery time has passed. Seller not responding? Open a dispute.
          </div>
        </div>
        <DisputeCTA
          onOpenDispute={onOpenDispute}
          fallbackHref={disputeHref}
          tone="amber"
          size={promoted ? 'lg' : 'sm'}
        />
      </OrderCard>
    )
  }

  // V21/P5.l — Buyer completed + existing review → passive "Review
  // Submitted" panel. Shows the thumb verdict + their comment back to
  // them. No CTA — replaces the Leave Review prompt since they already
  // did it.
  // V21/P5.u — Buyer side mirrors the seller layout: section label +
  // thumb tile beside the comment itself. No verdict copy, no italics.
  if (role === 'buyer' && status === 'completed' && existingReview) {
    const isPositive =
      existingReview.recommendsSeller === true ||
      (existingReview.recommendsSeller == null && existingReview.rating >= 4)
    return (
      <OrderCard className={cn(sPad, 'max-sm:px-5 max-sm:py-3')} padded={false}>
        <div className="text-[11px] font-bold uppercase tracking-wider text-text-secondary max-sm:text-[10.5px]">
          Your Review
        </div>
        <div className="mt-3.5 flex items-center gap-3 max-sm:mt-2 max-sm:gap-2.5">
          <span
            className={cn(
              'grid h-10 w-10 flex-shrink-0 place-items-center rounded-[10px] max-sm:h-7 max-sm:w-7 max-sm:rounded-[7px]',
              isPositive ? 'bg-green-400/[0.12] text-green-400' : 'bg-red-400/[0.12] text-red-400',
            )}
          >
            {isPositive ? (
              <ThumbsUp className="h-[18px] w-[18px] fill-current max-sm:h-3.5 max-sm:w-3.5" />
            ) : (
              <ThumbsDown className="h-[18px] w-[18px] fill-current max-sm:h-3.5 max-sm:w-3.5" />
            )}
          </span>
          <p className="min-w-0 flex-1 text-[14.5px] font-semibold leading-[1.4] text-text-primary max-sm:text-[13.5px]">
            {existingReview.comment || (isPositive ? 'Recommended' : "Didn't Recommend")}
          </p>
        </div>
      </OrderCard>
    )
  }

  const baseCfg = STRIPS[role]?.[status]
  if (!baseCfg) return null
  // Disputes the parties can settle themselves: the seller can still deliver
  // (then waits on the buyer), and the buyer can mark it received, which
  // closes their dispute.
  const cfg =
    status === 'disputed' && role === 'seller'
      ? deliveredAt
        ? { ...baseCfg, Icon: CheckCircle2, tone: 'lime' as const, title: 'Marked As Delivered', caption: 'Waiting for the buyer to confirm. Payout is paused until the dispute closes.' }
        : { ...baseCfg, caption: 'Deliver the order and mark it delivered. Payout is paused until the dispute closes.' }
      : status === 'disputed' && role === 'buyer' && onMarkReceived
        ? deliveredAt
          ? { ...baseCfg, Icon: CheckCircle2, tone: 'lime' as const, title: 'Seller Marked It Delivered', caption: 'Got your order? Mark it received to close your dispute.' }
          : { ...baseCfg, caption: 'Already got your order? Mark it received to close your dispute.' }
        : status === 'cancelled' && escrowStatus === 'refunded'
          ? // Cancelled AFTER payment: the money was returned, not "never charged".
            role === 'buyer'
            ? { ...baseCfg, Icon: Wallet, tone: 'lime' as const, title: 'Order Cancelled, Refunded', caption: 'Your refund was returned to your Store Balance as store credit. Spend it at checkout with no service fee.' }
            : { ...baseCfg, title: 'Order Cancelled', caption: "The order was cancelled and the buyer's payment was returned to them." }
          : baseCfg
  const { Icon, title, caption, tone } = cfg
  const renderedTitle =
    amount != null ? title.replace('{AMOUNT}', fmtUsd(amount)) : title.replace(' · {AMOUNT}', '')

  const showMarkDeliveredCTA =
    role === 'seller' && (status === 'delivering' || status === 'disputed') && !!onMarkDelivered
  const showMarkReceivedCTA =
    role === 'buyer' && (status === 'delivered' || status === 'disputed') && !!onMarkReceived
  const showLeaveReviewCTA = role === 'buyer' && status === 'completed' && !!onLeaveReview
  // Delivering (buyer): Open Dispute is a button at the card's right edge.
  // A completed order keeps its dispute entry in the SafeDrop card only
  // (the 7-day window lives there), not on this card.
  const showDisputeButton = role === 'buyer' && status === 'delivering'

  // V21/P5.d — Buyer's delivered state: bespoke 2-row card.
  //   Row 1 (left): Order Delivered title       (right): Confirm Receipt CTA
  //   Row 2 (left): Didn't Receive Order label  (right): Open Dispute outlined CTA
  if (role === 'buyer' && status === 'delivered' && (onMarkReceived || disputeHref)) {
    return (
      <OrderCard className={sPad} padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 max-sm:gap-y-2.5">
          <div className="flex items-center gap-3.5 min-w-0">
            <span className={cn('grid flex-shrink-0 place-items-center', TONE_BG.lime, sIcon)}>
              <PackageCheck className={sIconGlyph} />
            </span>
            <div className="min-w-0 leading-tight">
              <div className={cn(sTitle, 'font-bold text-text-primary')}>Order Delivered</div>
              {promoted && (
                <div className={cn('mt-0.5 text-text-secondary', sCaption)}>
                  Review your order, then confirm delivery.
                </div>
              )}
            </div>
          </div>
          {onMarkReceived && (
            <button type="button" onClick={onMarkReceived} className={sCtaCls}>
              <CheckCircle2 className={sCtaGlyph} />
              Confirm Delivery
            </button>
          )}
        </div>
        <div className={cn('flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle max-sm:gap-y-2.5', promoted ? 'mt-4 pt-4' : 'mt-3 pt-3')}>
          <span className={cn('text-text-secondary', sCaption)}>Didn&apos;t receive your order?</span>
          <DisputeCTA
            onOpenDispute={onOpenDispute}
            fallbackHref={disputeHref}
            tone="neutral"
            size={promoted ? 'md' : 'sm'}
          />
        </div>
      </OrderCard>
    )
  }

  const ctaLabel = showMarkDeliveredCTA
    ? 'Mark As Delivered'
    : showMarkReceivedCTA
    ? status === 'disputed'
      ? 'Mark As Received'
      : 'Confirm Delivery'
    : showLeaveReviewCTA
    ? 'Leave Review'
    : null
  const ctaOnClick = showMarkDeliveredCTA
    ? onMarkDelivered
    : showMarkReceivedCTA
    ? onMarkReceived
    : showLeaveReviewCTA
    ? onLeaveReview
    : undefined

  // V21/P5.s — When the seller's "Added To Your Seller Balance" panel has a
  // buyer review attached, show the review inside the same card with
  // a divider — no second card. Otherwise the original single-row
  // layout (icon + title/caption + optional CTA).
  const showSellerReview =
    role === 'seller' && status === 'completed' && !!existingReview
  const isPositive =
    !!existingReview &&
    (existingReview.recommendsSeller === true ||
      (existingReview.recommendsSeller == null && existingReview.rating >= 4))

  // V21/P5.t — Seller-completed + has review → strip the balance
  // header entirely. The payout status already lives on the
  // Payout card below; no need to repeat it here. The card becomes
  // a dedicated Buyer's Feedback panel.
  if (showSellerReview && existingReview) {
    return (
      <OrderCard className={cn(sPad, 'max-sm:px-5 max-sm:py-3')} padded={false}>
        <div className="text-[11px] font-bold uppercase tracking-wider text-text-secondary max-sm:text-[10.5px]">
          Buyer&rsquo;s Feedback
        </div>
        <div className="mt-3.5 flex items-center gap-3 max-sm:mt-2 max-sm:gap-2.5">
          <span
            className={cn(
              'grid h-10 w-10 flex-shrink-0 place-items-center rounded-[10px] max-sm:h-7 max-sm:w-7 max-sm:rounded-[7px]',
              isPositive
                ? 'bg-green-400/[0.12] text-green-400'
                : 'bg-red-400/[0.12] text-red-400',
            )}
          >
            {isPositive ? (
              <ThumbsUp className="h-[18px] w-[18px] fill-current max-sm:h-3.5 max-sm:w-3.5" />
            ) : (
              <ThumbsDown className="h-[18px] w-[18px] fill-current max-sm:h-3.5 max-sm:w-3.5" />
            )}
          </span>
          <p className="min-w-0 flex-1 text-[14.5px] font-semibold leading-[1.4] text-text-primary max-sm:text-[13.5px]">
            {existingReview.comment || (isPositive ? 'Recommended' : "Didn't Recommend")}
          </p>
        </div>
      </OrderCard>
    )
  }

  // Nothing to click here (no CTA, no dispute link, no wallet link): on a
  // phone the status card above already says the same thing.
  const showCancelOrder = role === 'seller' && (status === 'paid' || status === 'delivering') && !!onCancelOrder
  const buyerCancel = role === 'buyer' && (status === 'paid' || status === 'delivering') ? cancelRequest : undefined
  const isPassive =
    !ctaLabel &&
    !showDisputeButton &&
    !showCancelOrder &&
    !buyerCancel &&
    !(role === 'buyer' && (status === 'refunded' || (status === 'cancelled' && escrowStatus === 'refunded')))

  return (
    <OrderCard
      className={cn(
        'flex flex-wrap items-center gap-3.5 max-sm:gap-y-2.5',
        sPad,
        hidePassiveOnMobile && isPassive && 'max-sm:hidden',
      )}
      padded={false}
    >
      <span className={`grid flex-shrink-0 place-items-center ${sIcon} ${TONE_BG[tone]}`}>
        <Icon className={sIconGlyph} />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <div className={cn(sTitle, 'font-bold text-text-primary')}>{renderedTitle}</div>
        <div className={cn('mt-0.5 text-text-secondary', sCaption)}>
          {buyerCancel?.state === 'pending' ? 'Cancellation requested. DropMarket is reviewing it.' : caption}
        </div>
      </div>
      {buyerCancel && (
        <button
          type="button"
          onClick={buyerCancel.state === 'pending' ? buyerCancel.onWithdraw : buyerCancel.onRequest}
          className={cn(
            'inline-flex flex-shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] border border-border-default bg-white/[0.02] font-semibold text-text-secondary transition-colors',
            'hover:border-white/25 hover:text-text-primary',
            promoted ? 'px-4 py-2.5 text-[13.5px]' : 'px-3 py-1.5 text-[12px]',
            'max-sm:min-h-[44px] max-sm:basis-full max-sm:py-3',
          )}
        >
          <Ban className={sCtaGlyph} aria-hidden />
          {buyerCancel.state === 'pending' ? 'Withdraw Request' : 'Request Cancellation'}
        </button>
      )}
      {showDisputeButton && (
        <DisputeCTA
          onOpenDispute={onOpenDispute}
          fallbackHref={disputeHref}
          tone="amber"
          size={promoted ? 'lg' : 'sm'}
        />
      )}
      {showCancelOrder && (
        <button
          type="button"
          onClick={onCancelOrder}
          className={cn(
            'inline-flex flex-shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] border border-border-default bg-white/[0.02] font-semibold text-text-secondary transition-colors',
            'hover:border-red-400/40 hover:text-red-400',
            promoted ? 'px-4 py-2.5 text-[13.5px]' : 'px-3 py-1.5 text-[12px]',
            'max-sm:min-h-[44px] max-sm:basis-full max-sm:py-3',
          )}
        >
          <XCircle className={sCtaGlyph} aria-hidden />
          Cancel Order
        </button>
      )}
      {ctaLabel && (
        <button type="button" onClick={ctaOnClick} className={cn('ml-1', sCtaCls)}>
          <CheckCircle2 className={sCtaGlyph} />
          {ctaLabel}
        </button>
      )}
      {/* Buyer's money returned to the wallet → give them a direct route
          there so a refund never reads as "I lost my money". Not for
          'cancelled' — nothing was charged on a never-paid order, so a
          wallet CTA would imply money that isn't there. */}
      {role === 'buyer' && (status === 'refunded' || (status === 'cancelled' && escrowStatus === 'refunded')) && (
        <Link href="/account/wallet" className={cn('ml-1', sCtaCls)}>
          <Wallet className={sCtaGlyph} />
          Go To Wallet
        </Link>
      )}
    </OrderCard>
  )
}

/**
 * DisputeCTA — V21/P7.a
 *
 * Shared trigger for "Open Dispute" used in multiple status-strip
 * branches. Renders a <button> when an onOpenDispute handler is
 * provided (current path — opens the controlled DisputeModal), or
 * falls back to a Link with `fallbackHref` if not (back-compat for
 * any call site that hasn't wired the handler yet).
 */
function DisputeCTA({
  onOpenDispute,
  fallbackHref,
  tone,
  size,
}: {
  onOpenDispute?: () => void
  fallbackHref: string
  /** amber = the light warning button (delivering / overdue);
   *  neutral = outlined, turns warning on hover (delivered card). */
  tone: 'amber' | 'neutral'
  size: 'sm' | 'md' | 'lg'
}) {
  const cls = cn(
    'inline-flex flex-shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] border font-bold transition-all',
    tone === 'amber'
      ? 'border-[rgba(255,178,62,0.32)] bg-warning-bg text-warning hover:-translate-y-[1px] hover:bg-[rgba(255,178,62,0.2)]'
      : 'border-border-default bg-white/[0.02] text-text-primary hover:border-[rgba(255,178,62,0.4)] hover:text-warning',
    size === 'lg' ? 'px-5 py-2.5 text-[13.5px]' : size === 'md' ? 'px-4 py-2 text-[13px]' : 'px-3 py-1.5 text-[12px]',
    // Below sm the button takes its own full-width row, >=44px tall.
    'max-sm:min-h-[44px] max-sm:basis-full max-sm:py-3',
  )
  const glyph = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'
  if (onOpenDispute) {
    return (
      <button type="button" onClick={onOpenDispute} className={cls}>
        <ShieldAlert className={glyph} aria-hidden />
        Open Dispute
      </button>
    )
  }
  return (
    <Link href={fallbackHref} className={cls}>
      <ShieldAlert className={glyph} aria-hidden />
      Open Dispute
    </Link>
  )
}

'use client'

/**
 * StatusStrip — V21/P3
 *
 * Small "waiting on …" card at the top of the right rail. Mirrors the
 * order state in plain words so the user immediately knows what to
 * expect without parsing the pills. One-line title + one-line caption.
 */

import { Clock, CheckCircle2, AlertTriangle, Wallet, RefreshCw, XCircle, ChevronRight, ThumbsUp, ThumbsDown } from 'lucide-react'
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
      Icon: Clock,
      title: 'Awaiting Payment',
      caption: 'Complete your crypto payment to start this order.',
      tone: 'amber',
    },
    paid: {
      Icon: Clock,
      title: 'Waiting On The Seller',
      caption: "You'll be notified the moment they start delivering.",
      tone: 'amber',
    },
    delivering: {
      Icon: Clock,
      title: 'Delivery In Progress',
      caption: "Seller is preparing your order — they'll mark it delivered soon.",
      tone: 'amber',
    },
    delivered: {
      Icon: CheckCircle2,
      title: 'Order Delivered',
      // V21/P5.d — caption dropped; the buyer-delivered state renders a
      // bespoke 2-row layout in the component body below (Confirm
      // Receipt on top, Open Dispute on bottom).
      caption: '',
      tone: 'lime',
    },
    completed: {
      Icon: CheckCircle2,
      title: 'Order Complete',
      caption: 'The seller has been paid. Leave a review when you can.',
      tone: 'lime',
    },
    disputed: {
      Icon: AlertTriangle,
      title: 'Dispute Under Review',
      caption: 'A DropMarket admin is reviewing. Support responds within 24h.',
      tone: 'amber',
    },
    refunded: {
      Icon: Wallet,
      title: 'Money In Your Wallet',
      caption: 'Your refund landed in your DropMarket wallet as store credit — spend it instantly or withdraw it anytime.',
      tone: 'lime',
    },
    cancelled: {
      Icon: Wallet,
      title: 'Money In Your Wallet',
      caption: 'This order was cancelled and refunded to your DropMarket wallet as store credit — spend it instantly or withdraw it anytime.',
      tone: 'lime',
    },
  },
  seller: {
    paid: {
      Icon: AlertTriangle,
      title: 'Action Required',
      caption: 'Chat with the buyer to begin delivery.',
      tone: 'amber',
    },
    delivering: {
      Icon: Clock,
      title: 'Delivery In Progress',
      caption: 'Send the goods, then mark as delivered.',
      tone: 'amber',
    },
    delivered: {
      Icon: CheckCircle2,
      title: 'Order Delivered',
      caption: 'Waiting on the buyer to confirm delivery.',
      tone: 'lime',
    },
    completed: {
      Icon: Wallet,
      // V21/P3.b — Interpolated with the actual amount in the component
      // body below; see the {AMOUNT} placeholder for the substitution.
      title: 'Added To Your Seller Balance · {AMOUNT}',
      caption: 'Available to withdraw or use for purchases.',
      tone: 'lime',
    },
    disputed: {
      Icon: AlertTriangle,
      title: 'Dispute Opened',
      caption: 'Respond in chat. Payout paused pending dispute resolution.',
      tone: 'amber',
    },
    // V21/P7 — Terminal states so the seller strip never renders blank.
    refunded: {
      Icon: RefreshCw,
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
    paid: { Icon: Clock, title: 'Pre-Delivery', caption: 'Seller has not started yet.', tone: 'gray' },
    delivering: { Icon: Clock, title: 'In Delivery', caption: 'Seller is working on the order.', tone: 'amber' },
    delivered: { Icon: CheckCircle2, title: 'Awaiting Buyer Confirm', caption: 'Auto-completes when the protection window closes.', tone: 'lime' },
    completed: { Icon: CheckCircle2, title: 'Complete', caption: 'Seller paid out.', tone: 'lime' },
    disputed: { Icon: AlertTriangle, title: 'Dispute Open', caption: 'Awaiting your decision.', tone: 'amber' },
  },
}

const TONE_BG: Record<string, string> = {
  amber:  'bg-amber/[0.12] text-amber',
  lime:   'bg-lime/[0.14] text-lime-text',
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
  onMarkReceived,
  onLeaveReview,
  onOpenDispute,
  existingReview,
  promoted = false,
}: StatusStripProps) {
  // V21/P5.r — Shared style tokens that scale with promoted variant.
  const sIcon = promoted ? 'h-11 w-11 rounded-[11px]' : 'h-9 w-9 rounded-[9px]'
  const sIconGlyph = promoted ? 'h-5 w-5' : 'h-4 w-4'
  const sTitle = promoted ? 'text-[16px]' : 'text-[14px]'
  const sCaption = promoted ? 'text-[13.5px]' : 'text-[12.5px]'
  const sPad = promoted ? 'px-5 py-4' : 'p-4'
  const sCtaCls = cn(
    'inline-flex flex-shrink-0 items-center gap-1.5 rounded-[10px] font-bold transition-all',
    'bg-lime text-text-inverse hover:-translate-y-[1px] hover:bg-lime-hover',
    'shadow-[0_6px_18px_rgba(198,255,61,0.18)]',
    promoted ? 'px-5 py-2.5 text-[13.5px]' : 'px-3 py-1.5 text-[12px]',
  )
  const sCtaGlyph = promoted ? 'h-4 w-4' : 'h-3.5 w-3.5'
  // V21/P3.e — Overdue escalation for the buyer. When the delivery
  // window has run out and the seller hasn't marked it delivered, the
  // strip morphs into a clear "next step" prompt instead of leaving the
  // buyer staring at a passive "waiting" line. Same card shape; amber
  // accent tile + Open Dispute CTA at the right.
  if (overdue && role === 'buyer' && (status === 'paid' || status === 'delivering')) {
    return (
      <OrderCard className="flex items-center gap-3 p-4" padded={false}>
        <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-[9px] bg-amber/[0.12] text-amber">
          <AlertTriangle className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="text-[14px] font-bold text-text-primary">
            Order Is Overdue
          </div>
          <div className="mt-0.5 text-[12.5px] text-text-secondary">
            No response? Open a dispute.
          </div>
        </div>
        <DisputeCTA
          onOpenDispute={onOpenDispute}
          fallbackHref={disputeHref}
          tone="amber"
          showChevron
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
      <OrderCard className={sPad} padded={false}>
        <div className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
          Your Review
        </div>
        <div className="mt-3.5 flex items-center gap-3">
          <span
            className={cn(
              'grid h-10 w-10 flex-shrink-0 place-items-center rounded-[10px]',
              isPositive ? 'bg-green-400/[0.12] text-green-400' : 'bg-red-400/[0.12] text-red-400',
            )}
          >
            {isPositive ? (
              <ThumbsUp className="h-[18px] w-[18px] fill-current" />
            ) : (
              <ThumbsDown className="h-[18px] w-[18px] fill-current" />
            )}
          </span>
          <p className="min-w-0 flex-1 text-[14.5px] font-semibold leading-[1.4] text-text-primary">
            {existingReview.comment || (isPositive ? 'Recommended' : "Didn't Recommend")}
          </p>
        </div>
      </OrderCard>
    )
  }

  const cfg = STRIPS[role]?.[status]
  if (!cfg) return null
  const { Icon, title, caption, tone } = cfg
  const renderedTitle =
    amount != null ? title.replace('{AMOUNT}', fmtUsd(amount)) : title.replace(' · {AMOUNT}', '')

  const showMarkDeliveredCTA = role === 'seller' && status === 'delivering' && !!onMarkDelivered
  const showMarkReceivedCTA = role === 'buyer' && status === 'delivered' && !!onMarkReceived
  const showLeaveReviewCTA = role === 'buyer' && status === 'completed' && !!onLeaveReview
  const showCaptionDisputeLink = role === 'buyer' && status === 'delivering'

  // V21/P5.d — Buyer's delivered state: bespoke 2-row card.
  //   Row 1 (left): Order Delivered title       (right): Confirm Receipt CTA
  //   Row 2 (left): Didn't Receive Order label  (right): Open Dispute outlined CTA
  if (role === 'buyer' && status === 'delivered' && (onMarkReceived || disputeHref)) {
    return (
      <OrderCard className={sPad} padded={false}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <span className={cn('grid flex-shrink-0 place-items-center bg-lime/[0.12] text-lime-text', sIcon)}>
              <CheckCircle2 className={sIconGlyph} />
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
        <div className={cn('flex items-center justify-between gap-3 border-t border-border-subtle', promoted ? 'mt-4 pt-4' : 'mt-3 pt-3')}>
          <span className={cn('text-text-secondary', sCaption)}>Didn&apos;t receive your order?</span>
          <DisputeCTA
            onOpenDispute={onOpenDispute}
            fallbackHref={disputeHref}
            tone="neutral"
            className={cn(promoted ? 'px-4 py-2 text-[13px]' : 'px-3 py-1.5 text-[12px]')}
          />
        </div>
      </OrderCard>
    )
  }

  const ctaLabel = showMarkDeliveredCTA
    ? 'Mark As Delivered'
    : showMarkReceivedCTA
    ? 'Confirm Delivery'
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
      <OrderCard className={sPad} padded={false}>
        <div className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
          Buyer&rsquo;s Feedback
        </div>
        <div className="mt-3.5 flex items-center gap-3">
          <span
            className={cn(
              'grid h-10 w-10 flex-shrink-0 place-items-center rounded-[10px]',
              isPositive
                ? 'bg-green-400/[0.12] text-green-400'
                : 'bg-red-400/[0.12] text-red-400',
            )}
          >
            {isPositive ? (
              <ThumbsUp className="h-[18px] w-[18px] fill-current" />
            ) : (
              <ThumbsDown className="h-[18px] w-[18px] fill-current" />
            )}
          </span>
          <p className="min-w-0 flex-1 text-[14.5px] font-semibold leading-[1.4] text-text-primary">
            {existingReview.comment || (isPositive ? 'Recommended' : "Didn't Recommend")}
          </p>
        </div>
      </OrderCard>
    )
  }

  return (
    <OrderCard className={cn('flex items-center gap-3.5', sPad)} padded={false}>
      <span className={`grid flex-shrink-0 place-items-center ${sIcon} ${TONE_BG[tone]}`}>
        <Icon className={sIconGlyph} />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <div className={cn(sTitle, 'font-bold text-text-primary')}>{renderedTitle}</div>
        <div className={cn('mt-0.5 text-text-secondary', sCaption)}>
          {caption}
          {showCaptionDisputeLink && (
            <>
              {' · '}
              {onOpenDispute ? (
                <button
                  type="button"
                  onClick={onOpenDispute}
                  className="font-semibold text-lime-text hover:underline"
                >
                  Open Dispute
                </button>
              ) : (
                <Link href={disputeHref} className="font-semibold text-lime-text hover:underline">
                  Open Dispute
                </Link>
              )}
            </>
          )}
        </div>
      </div>
      {ctaLabel && (
        <button type="button" onClick={ctaOnClick} className={cn('ml-1', sCtaCls)}>
          <CheckCircle2 className={sCtaGlyph} />
          {ctaLabel}
        </button>
      )}
      {/* Buyer's money returned to the wallet → give them a direct route
          there so a cancel/refund never reads as "I lost my money". */}
      {role === 'buyer' && (status === 'refunded' || status === 'cancelled') && (
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
  showChevron,
  className,
}: {
  onOpenDispute?: () => void
  fallbackHref: string
  tone: 'amber' | 'neutral'
  showChevron?: boolean
  className?: string
}) {
  const base = cn(
    'inline-flex flex-shrink-0 items-center gap-1.5 rounded-[8px] font-bold transition-colors',
    tone === 'amber'
      ? 'border border-amber/30 bg-amber/[0.08] px-3 py-1.5 text-[12px] text-amber hover:bg-amber/[0.14]'
      : 'border border-border-default bg-white/[0.02] px-3 py-1.5 text-[12px] font-semibold text-text-primary hover:border-amber/40 hover:text-amber',
    className,
  )
  if (onOpenDispute) {
    return (
      <button type="button" onClick={onOpenDispute} className={cn('ml-1', base)}>
        Open Dispute
        {showChevron && <ChevronRight className="h-3.5 w-3.5" />}
      </button>
    )
  }
  return (
    <Link href={fallbackHref} className={cn('ml-1', base)}>
      Open Dispute
      {showChevron && <ChevronRight className="h-3.5 w-3.5" />}
    </Link>
  )
}

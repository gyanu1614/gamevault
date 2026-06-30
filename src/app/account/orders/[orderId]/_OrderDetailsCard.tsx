'use client'

/**
 * OrderDetailsCard — V21/P4.c
 *
 * Stacked right-rail surfaces:
 *  1. Order Details card — centered icon + title at top, then tabular
 *     rows. For the seller view the rows are de-duplicated against the
 *     payout block (no Sale Price / After Fees here).
 *  2. SafeDrop Escrow inset (buyer + admin) inside the details card.
 *  3. Party button at the bottom of the details card.
 *  4. Payout card (seller + admin) — separate sibling card below.
 *
 * Icons live in /public/assets/order-icons (order-details.svg,
 * payout.svg, escrow.svg). Swap with final art using same filenames.
 */

import Link from 'next/link'
import Image from 'next/image'
import { ChevronRight, Star, BadgeCheck, Copy, Check, ThumbsUp, ThumbsDown } from 'lucide-react'
import { useState } from 'react'
import { OrderCard } from './_OrderCard'
import { cn } from '@/lib/utils'

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
}

interface OrderDetailsCardProps {
  orderNumber: string
  /** Raw UUID — used for dispute / sub-path links inside cards. */
  orderId: string
  placedAtLabel: string
  paymentMethod: string
  subtotal: number
  fee: number
  totalPaid: number
  /** Buyer view → SafeDrop inset. Seller view → payout inset. Admin → both. */
  role: 'buyer' | 'seller' | 'admin'
  escrowAmount: number
  /** For seller — the fee percentage shown next to the deduction. */
  feePercent?: number
  /** For seller — net payout = subtotal - fee. */
  netPayout?: number
  /** Drives the payout status row (held / queued / released). */
  orderStatus: string
  /** The "other party" — seller for buyer view, buyer for seller view. */
  otherParty: PartyInfo
  /** Opens the controlled DisputeModal. When provided, the SafeDrop
   *  CTA fires this instead of the legacy #dispute href. */
  onOpenDispute?: () => void
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
 * SafeDropBody — V21/P5.k
 *
 * Buyer's escrow card body, mirrors PayoutBody for the seller:
 * flat rows + dynamic status row at the bottom. Lives in a sibling
 * OrderCard (not nested), so the buyer rail reads as
 *   [Order Details] → [SafeDrop Escrow] → [Audit ...]
 * just like the seller's
 *   [Order Details] → [Your Payout] → [...]
 *
 * Row label + status row + caption all morph by orderStatus so the
 * card reads coherently across paid → delivering → delivered →
 * completed → disputed / refunded.
 */
function SafeDropBody({
  amount,
  orderStatus,
  orderId,
  onOpenDispute,
}: {
  amount: number
  orderStatus: string
  orderId: string
  onOpenDispute?: () => void
}) {
  // Row + caption depend on order state.
  let amountLabel = 'Amount Held'
  let caption: React.ReactNode =
    "Your funds are held with us. Confirm Receipt once your order arrives, and we'll release them to the seller."
  let showDisputeCta = false

  if (orderStatus === 'completed') {
    amountLabel = 'Amount Released'
    caption = (
      <>
        Funds have been released to the seller. If anything was off with
        your order, you can still open a dispute within the protection
        window.
      </>
    )
    showDisputeCta = true
  } else if (orderStatus === 'delivered') {
    amountLabel = 'Amount Held'
    caption =
      "Your order arrived. Confirm Receipt to release the funds to the seller, or open a dispute if something's off."
    showDisputeCta = true
  } else if (orderStatus === 'refunded') {
    amountLabel = 'Amount Refunded'
    caption =
      'Funds have been refunded to your DropMarket wallet. The order is closed.'
  } else if (orderStatus === 'disputed') {
    amountLabel = 'Amount Frozen'
    caption =
      'A DropMarket admin is reviewing your dispute. Funds stay frozen until resolved.'
  } else if (orderStatus === 'cancelled') {
    amountLabel = 'Amount Refunded'
    caption =
      'Order cancelled. Funds returned to your DropMarket wallet.'
  }

  return (
    <>
      <Row label={amountLabel} emphasized>
        {fmtUsd(amount)}
      </Row>
      <SafeDropStatusRow orderStatus={orderStatus} />
      <p className="mt-3 text-center text-[13px] leading-[1.55] text-text-secondary">
        {caption}
      </p>
      {showDisputeCta && (
        onOpenDispute ? (
          <button
            type="button"
            onClick={onOpenDispute}
            className={cn(
              'mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-amber/30 bg-amber/[0.08] px-3 py-2.5 text-[13px] font-bold text-amber transition-colors',
              'hover:border-amber/50 hover:bg-amber/[0.14]',
            )}
          >
            Issues With Your Order? Open Dispute
          </button>
        ) : (
          <Link
            href={`/account/orders/${orderId}#dispute`}
            className={cn(
              'mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-amber/30 bg-amber/[0.08] px-3 py-2.5 text-[13px] font-bold text-amber transition-colors',
              'hover:border-amber/50 hover:bg-amber/[0.14]',
            )}
          >
            Issues With Your Order? Open Dispute
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
      ? { dot: 'bg-lime-text', text: 'text-lime-text', bg: 'bg-lime/[0.12]' }
      : { dot: 'bg-amber', text: 'text-amber', bg: 'bg-amber/[0.12]' }

  const label =
    orderStatus === 'completed'
      ? 'Funds Released To Seller'
      : orderStatus === 'delivered'
      ? 'Confirm Receipt To Release'
      : 'Funds Held In Escrow'

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
}: {
  subtotal: number
  feePercent: number
  fee: number
  netPayout: number
  orderStatus: string
}) {
  return (
    <>
      <Row label="Item Price">{fmtUsd(subtotal)}</Row>
      <Row label={`DropMarket Fee · ${feePercent}%`}>−{fmtUsd(fee)}</Row>
      <Row label="You Receive" emphasized>
        <span className="text-[18px] font-extrabold tabular-nums text-lime-text">
          {fmtUsd(netPayout)}
        </span>
      </Row>
      <PayoutStatusRow orderStatus={orderStatus} />
    </>
  )
}

/**
 * Single dynamic micro-status row at the bottom of the payout card.
 * Color + label morph with order status.
 */
function PayoutStatusRow({ orderStatus }: { orderStatus: string }) {
  const tone =
    orderStatus === 'completed'
      ? { dot: 'bg-green-400', text: 'text-green-400', bg: 'bg-green-400/[0.10]' }
      : orderStatus === 'delivered'
      ? { dot: 'bg-lime-text', text: 'text-lime-text', bg: 'bg-lime/[0.12]' }
      : { dot: 'bg-amber', text: 'text-amber', bg: 'bg-amber/[0.12]' }

  const label =
    orderStatus === 'completed'
      ? 'Funds Released To Wallet'
      : orderStatus === 'delivered'
      ? 'Funds Queued For Release'
      : 'Funds Held In Escrow'

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
        <p className="mt-3 rounded-[9px] border border-border-subtle bg-bg-overlay/60 px-3 py-2 text-[12.5px] leading-[1.5] italic text-text-secondary">
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
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-[13px] font-semibold text-text-primary">{party.name}</span>
        {party.verified && (
          <BadgeCheck className="h-3.5 w-3.5 flex-shrink-0 text-lime-text" aria-label="Verified" />
        )}
        {party.sales > 0 && (
          <span className="inline-flex items-center gap-1 text-[11.5px] text-text-tertiary">
            <Star className="h-3 w-3 fill-amber text-amber" />
            <span className="tabular-nums">{party.rating.toFixed(2)}</span>
          </span>
        )}
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
      <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-[7px] bg-lime/[0.12] text-lime-text">
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
    paymentMethod,
    subtotal,
    fee,
    totalPaid,
    role,
    escrowAmount,
    feePercent = 0,
    netPayout = 0,
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
  // present; rest follow in insertion order. When nothing was
  // collected, surface a single placeholder row so the seller knows
  // the buyer hasn't filled it in yet (or the listing didn't ask).
  const deliveryEntries: Array<[string, string]> = (() => {
    if (!deliveryInfo) return []
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
        {deliveryEntries.length > 0 ? (
          deliveryEntries.map(([k, v]) => (
            <Row key={k} label={k}>
              <span className="block max-w-[220px] truncate text-right font-mono text-[12.5px] font-semibold text-text-primary">
                {v}
              </span>
            </Row>
          ))
        ) : (
          <Row label="Username">
            <span className="text-[12.5px] font-semibold italic text-text-tertiary">
              Not Provided
            </span>
          </Row>
        )}
        <Row label="Order ID">
          <CopyableId value={orderNumber} />
        </Row>
        <Row label="Total Paid" emphasized>
          {fmtUsd(totalPaid)}
        </Row>
        <Row label="Date Placed">{placedAtLabel}</Row>
        <Row label={otherPartyLabel}>
          <span className="-my-1 flex justify-end">
            <PartyButton party={otherParty} />
          </span>
        </Row>
      </OrderCard>

      {(role === 'buyer' || role === 'admin') && (
        <OrderCard className="px-5 pb-4 pt-5">
          <CardHeader iconSrc="/assets/order-icons/escrow.svg" title="SafeDrop™ Escrow" />
          <SafeDropBody
            amount={escrowAmount}
            orderStatus={orderStatus}
            orderId={orderId}
            onOpenDispute={onOpenDispute}
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
          />
        </OrderCard>
      )}
    </>
  )
}

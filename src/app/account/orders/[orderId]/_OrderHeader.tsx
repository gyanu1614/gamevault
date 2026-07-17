'use client'

/**
 * OrderHeader — V21/P2
 *
 * Top bar (back link + party presence chip) + header row (image, title,
 * chips, order id, status pills). Standalone client component because
 * the copy-on-click order id + presence pulse animation need browser.
 */

import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Copy, Shield, Truck, Clock, CheckCircle2, Package, AlertTriangle, XCircle, RefreshCw, Check } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface PartyPresence {
  name: string
  isOnline: boolean
  avatarUrl: string | null
  /** "Buyer" or "Seller" — shown above the name */
  roleLabel: string
}

interface OrderHeaderProps {
  itemImageUrl: string | null
  itemTitle: string
  gameName: string | null
  /** Small icon shown before the game name chip. Pass game.image_url. */
  gameIconUrl?: string | null
  categoryName: string | null
  /** Category slug used to look up an SVG icon in /public/assets/categories.
   *  Falls back to default.svg if not found. */
  categorySlug?: string | null
  orderNumber: string
  orderStatus: string
  escrowStatus: string
  disputeResolved?: boolean
  /** The "other" party for the presence chip — seller for buyer, buyer for seller. */
  presence?: PartyPresence
}

const STATUS_CFG: Record<
  string,
  { label: string; color: string; bg: string; border: string; pulse: boolean; Icon: React.ComponentType<{ className?: string }> }
> = {
  // Unpaid orders must NOT read as "Processing" — buyers assumed payment
  // had gone through and waited on delivery that could never start.
  pending:    { label: 'Awaiting Payment', color: 'text-amber', bg: 'bg-amber/[0.08]', border: 'border-amber/30',     pulse: true,  Icon: Clock },
  paid:       { label: 'Payment Confirmed',  color: 'text-amber',    bg: 'bg-amber/[0.08]',   border: 'border-amber/30',     pulse: true,  Icon: Clock },
  delivering: { label: 'Delivering',  color: 'text-amber',    bg: 'bg-amber/[0.08]',   border: 'border-amber/30',     pulse: true,  Icon: Truck },
  delivered:  { label: 'Delivered',   color: 'text-green-400',bg: 'bg-green-400/[0.08]',border: 'border-green-400/30',pulse: false, Icon: Package },
  completed:  { label: 'Completed',   color: 'text-green-400',bg: 'bg-green-400/[0.08]',border: 'border-green-400/30',pulse: false, Icon: CheckCircle2 },
  disputed:   { label: 'Disputed',    color: 'text-red-400',  bg: 'bg-red-400/[0.08]', border: 'border-red-400/40',   pulse: true,  Icon: AlertTriangle },
  resolved:   { label: 'Resolved',    color: 'text-green-400',bg: 'bg-green-400/[0.08]',border: 'border-green-400/30',pulse: false, Icon: CheckCircle2 },
  refunded:   { label: 'Refunded',    color: 'text-text-secondary',bg: 'card-frost',border: 'border-white/15',  pulse: false, Icon: RefreshCw },
  cancelled:  { label: 'Cancelled',   color: 'text-orange-400',bg: 'bg-orange-400/[0.08]',border: 'border-orange-400/30',pulse:false,Icon: XCircle },
}

const ESCROW_CFG: Record<string, { label: string; color: string; border: string }> = {
  held:     { label: 'Covered By SafeDrop™',        color: 'text-text-primary', border: 'border-white/10' },
  released: { label: 'Seller Paid Out',             color: 'text-green-400',    border: 'border-green-400/25' },
  refunded: { label: 'Refund Issued',               color: 'text-blue-400',     border: 'border-blue-400/25' },
  frozen:   { label: 'Payout Paused — Under Review', color: 'text-violet-400',   border: 'border-violet-400/25' },
  resolved: { label: 'Resolved',                    color: 'text-green-400',    border: 'border-green-400/25' },
}

function StatusPill({ status, disputeResolved }: { status: string; disputeResolved?: boolean }) {
  const effective = status === 'disputed' && disputeResolved ? 'resolved' : status
  const cfg = STATUS_CFG[effective] ?? STATUS_CFG.paid
  const Icon = cfg.Icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 whitespace-nowrap rounded-[9px] border px-3 py-1.5 text-[12.5px] font-semibold',
        cfg.bg,
        cfg.border,
        cfg.color,
      )}
    >
      <span className="relative flex h-[7px] w-[7px]">
        {cfg.pulse && (
          <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60', cfg.color.replace('text-', 'bg-'))} />
        )}
        <span className={cn('relative inline-flex h-[7px] w-[7px] rounded-full', cfg.color.replace('text-', 'bg-'))} />
      </span>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {cfg.label}
    </span>
  )
}

function EscrowPill({ escrowStatus, disputeResolved }: { escrowStatus: string; disputeResolved?: boolean }) {
  const effective = escrowStatus === 'frozen' && disputeResolved ? 'resolved' : escrowStatus
  const cfg = ESCROW_CFG[effective] ?? ESCROW_CFG.held
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 whitespace-nowrap rounded-[9px] border bg-white/[0.03] px-3 py-1.5 text-[12.5px] font-semibold',
        cfg.color,
        cfg.border,
      )}
    >
      <Shield className="h-3.5 w-3.5 text-lime-text" aria-hidden />
      {cfg.label}
    </span>
  )
}

function OrderIdInline({ orderNumber }: { orderNumber: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(orderNumber)
        setCopied(true)
        setTimeout(() => setCopied(false), 1400)
      }}
      className="inline-flex items-center gap-1.5 font-mono text-[13.5px] font-semibold text-text-secondary transition-colors hover:text-text-primary"
      aria-label={copied ? 'Copied order id' : 'Copy order id'}
    >
      #{orderNumber}
      {copied ? <Check className="h-3.5 w-3.5 text-lime-text" /> : <Copy className="h-3 w-3 text-text-tertiary" />}
    </button>
  )
}

/** Normalize a category slug to one of the SVG filenames we ship. */
function resolveCategoryIcon(slug: string | null | undefined): string {
  if (!slug) return '/assets/categories/default.svg'
  const s = slug.toLowerCase()
  if (s.includes('currency') || s.includes('robux') || s.includes('vbuck') || s.includes('coin')) return '/assets/categories/currency.svg'
  if (s.includes('item')) return '/assets/categories/items.svg'
  if (s.includes('account')) return '/assets/categories/accounts.svg'
  if (s.includes('boost')) return '/assets/categories/boosting.svg'
  if (s.includes('top-up') || s.includes('topup')) return '/assets/categories/top-up.svg'
  if (s.includes('unlock')) return '/assets/categories/unlocks.svg'
  return '/assets/categories/default.svg'
}

export function OrderHeader({
  itemImageUrl,
  itemTitle,
  gameName,
  gameIconUrl,
  categoryName,
  categorySlug,
  orderNumber,
  orderStatus,
  escrowStatus,
  disputeResolved,
  presence,
}: OrderHeaderProps) {
  const categoryIcon = resolveCategoryIcon(categorySlug)
  return (
    <>
      {/* Top bar — quiet back link, slim presence chip on the right */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/account/orders"
          className="inline-flex items-center gap-2 text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back To Orders
        </Link>
        {presence && <PresenceChip presence={presence} />}
      </div>

      {/* Header row — large framed item image + title block + status pills */}
      <div className="flex items-start gap-5">
        {/* Item image — bigger, framed, with subtle inner border */}
        <div className="relative flex-shrink-0">
          {itemImageUrl ? (
            <div className="relative h-[88px] w-[88px] overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-1.5">
              <div className="h-full w-full overflow-hidden rounded-[12px]">
                <Image
                  src={itemImageUrl}
                  alt={itemTitle}
                  width={88}
                  height={88}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          ) : (
            <div className="h-[88px] w-[88px] rounded-2xl border border-white/[0.08] card-frost" />
          )}
        </div>

        <div className="min-w-0 flex-1 pt-1">
          <h1 className="truncate text-[28px] font-extrabold leading-[1.08] tracking-[-0.025em] text-text-primary">
            {itemTitle}
          </h1>
          {/* Game + category chips + inline order ID — all on one row */}
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] font-semibold text-text-secondary">
            {gameName && (
              <span className="inline-flex items-center gap-2">
                {gameIconUrl ? (
                  <Image
                    src={gameIconUrl}
                    alt=""
                    width={18}
                    height={18}
                    className="h-[18px] w-[18px] rounded-[5px] object-cover"
                  />
                ) : (
                  <span className="h-[18px] w-[18px] rounded-[5px] card-frost" />
                )}
                {gameName}
              </span>
            )}
            {categoryName && (
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-[18px] w-[18px] bg-lime-text"
                  style={{
                    WebkitMaskImage: `url(${categoryIcon})`,
                    maskImage: `url(${categoryIcon})`,
                    WebkitMaskSize: 'contain',
                    maskSize: 'contain',
                    WebkitMaskRepeat: 'no-repeat',
                    maskRepeat: 'no-repeat',
                    WebkitMaskPosition: 'center',
                    maskPosition: 'center',
                  }}
                />
                {categoryName}
              </span>
            )}
            <span className="h-3 w-px bg-white/10" aria-hidden />
            <OrderIdInline orderNumber={orderNumber} />
          </div>
        </div>

        <div className="flex flex-shrink-0 flex-col items-end gap-2 pt-1">
          <StatusPill status={orderStatus} disputeResolved={disputeResolved} />
          <EscrowPill escrowStatus={escrowStatus} disputeResolved={disputeResolved} />
        </div>
      </div>
    </>
  )
}

/**
 * Floating presence indicator — no chrome. Avatar + role label + name
 * with a small presence dot inset on the avatar. The full party
 * button (with rating + chevron) lives inside the Order Details card.
 */
function PresenceChip({ presence }: { presence: PartyPresence }) {
  const initial = presence.name.charAt(0).toUpperCase()
  const hasAvatar = !!presence.avatarUrl && presence.avatarUrl.trim().length > 0
  return (
    <div className="flex items-center gap-2.5">
      <span className="relative">
        {hasAvatar ? (
          <Image
            src={presence.avatarUrl as string}
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 rounded-full object-cover ring-1 ring-white/10"
            unoptimized
          />
        ) : (
          <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-lime/30 to-lime/10 text-[12px] font-bold text-lime-text ring-1 ring-white/10">
            {initial}
          </span>
        )}
        <span
          aria-hidden
          className={cn(
            'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-bg-base',
            presence.isOnline ? 'bg-green-400' : 'bg-text-tertiary',
          )}
        />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary">
          {presence.roleLabel}
        </span>
        <span className="text-[13px] font-semibold text-text-primary">
          {presence.name}
        </span>
      </span>
    </div>
  )
}

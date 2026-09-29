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
import { ArrowLeft, Copy, Truck, Clock, CheckCircle2, Package, AlertTriangle, XCircle, RefreshCw, Check } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useSellerOnline } from '@/hooks/use-seller-presence'

interface PartyPresence {
  name: string
  /** The other party is the SELLER: their id drives a live online dot.
   *  Buyers have no presence, so no dot is drawn for them. */
  sellerId?: string | null
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
  // Warning tone as arbitrary rgba: there is no `amber` token.
  pending:    { label: 'Awaiting Payment',  color: 'text-warning', bg: 'bg-[rgba(255,178,62,0.08)]', border: 'border-[rgba(255,178,62,0.30)]', pulse: true,  Icon: Clock },
  paid:       { label: 'Payment Confirmed', color: 'text-warning', bg: 'bg-[rgba(255,178,62,0.08)]', border: 'border-[rgba(255,178,62,0.30)]', pulse: true,  Icon: Clock },
  delivering: { label: 'Delivering',        color: 'text-warning', bg: 'bg-[rgba(255,178,62,0.08)]', border: 'border-[rgba(255,178,62,0.30)]', pulse: true,  Icon: Truck },
  delivered:  { label: 'Delivered',   color: 'text-green-400',bg: 'bg-green-400/[0.08]',border: 'border-green-400/30',pulse: false, Icon: Package },
  completed:  { label: 'Completed',   color: 'text-green-400',bg: 'bg-green-400/[0.08]',border: 'border-green-400/30',pulse: false, Icon: CheckCircle2 },
  disputed:   { label: 'Disputed',    color: 'text-red-400',  bg: 'bg-red-400/[0.08]', border: 'border-red-400/40',   pulse: true,  Icon: AlertTriangle },
  resolved:   { label: 'Resolved',    color: 'text-green-400',bg: 'bg-green-400/[0.08]',border: 'border-green-400/30',pulse: false, Icon: CheckCircle2 },
  refunded:   { label: 'Refunded',    color: 'text-text-secondary',bg: 'card-frost',border: 'border-white/15',  pulse: false, Icon: RefreshCw },
  cancelled:  { label: 'Cancelled',   color: 'text-orange-400',bg: 'bg-orange-400/[0.08]',border: 'border-orange-400/30',pulse:false,Icon: XCircle },
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
  disputeResolved,
  presence,
}: OrderHeaderProps) {
  const categoryIcon = resolveCategoryIcon(categorySlug)
  return (
    <>
      {/* Top bar — quiet back link, slim presence chip on the right */}
      <div className="mb-6 flex items-center justify-between max-sm:mb-7">
        <Link
          href="/account/orders"
          className="inline-flex items-center gap-2 text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back To Orders
        </Link>
        {/* sm+: nudged down to sit closer to the status pill below. */}
        {presence && (
          <div className="sm:translate-y-1.5">
            <PresenceChip presence={presence} />
          </div>
        )}
      </div>

      {/* Header row — large framed item image + title block + status pills.
          Below sm it is one compact unit (small image + title + chips,
          vertically centred); the pills and the order id are hidden there,
          the status card below the header and the Order Details card carry
          them instead. */}
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3 max-sm:flex-nowrap max-sm:items-center max-sm:gap-x-3 sm:flex-nowrap sm:gap-5">
        {/* Item image — bigger, framed, with subtle inner border */}
        <div className="relative flex-shrink-0">
          {itemImageUrl ? (
            <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-1.5 max-sm:h-12 max-sm:w-12 max-sm:rounded-xl max-sm:p-1 sm:h-[88px] sm:w-[88px]">
              <div className="h-full w-full overflow-hidden rounded-[12px] max-sm:rounded-[9px]">
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
            // No item picture: a neutral tile with the category's icon (the
            // game's logo already sits in the chip row below).
            <div className="grid h-16 w-16 place-items-center rounded-2xl border border-white/[0.08] card-frost max-sm:h-12 max-sm:w-12 max-sm:rounded-xl sm:h-[88px] sm:w-[88px]">
              <span
                aria-hidden
                className="h-8 w-8 bg-text-tertiary max-sm:h-6 max-sm:w-6"
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
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 pt-1 max-sm:pt-0">
          <h1 className="truncate text-[22px] font-extrabold leading-[1.08] tracking-[-0.025em] text-text-primary max-sm:text-[18px] max-sm:leading-[1.15] sm:text-[28px]">
            {itemTitle}
          </h1>
          {/* Game + category chips + inline order ID — all on one row */}
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] font-semibold text-text-secondary max-sm:mt-1 max-sm:gap-x-3 max-sm:text-[12px]">
            {gameName && (
              <span className="inline-flex items-center gap-2">
                {gameIconUrl ? (
                  <Image
                    src={gameIconUrl}
                    alt=""
                    width={18}
                    height={18}
                    className="h-[18px] w-[18px] rounded-[5px] object-cover max-sm:h-4 max-sm:w-4 max-sm:rounded-[4px]"
                  />
                ) : (
                  <span className="h-[18px] w-[18px] rounded-[5px] card-frost max-sm:h-4 max-sm:w-4" />
                )}
                {gameName}
              </span>
            )}
            {categoryName && (
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-[18px] w-[18px] bg-lime-text max-sm:h-4 max-sm:w-4"
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
            <span className="h-3 w-px bg-white/10 max-sm:hidden" aria-hidden />
            <span className="max-sm:hidden">
              <OrderIdInline orderNumber={orderNumber} />
            </span>
          </div>
        </div>

        {/* Order status only: payout / SafeDrop state lives in the SafeDrop
            card, so no second pill here. */}
        <div className="flex w-full flex-shrink-0 flex-row flex-wrap items-center gap-2 max-sm:hidden sm:w-auto sm:flex-col sm:items-end sm:pt-3">
          <StatusPill status={orderStatus} disputeResolved={disputeResolved} />
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
  const online = useSellerOnline(presence.sellerId ?? null)
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
          <span className="grid h-8 w-8 place-items-center rounded-full bg-lime-tint-bg text-[12px] font-bold text-lime-text ring-1 ring-white/10">
            {initial}
          </span>
        )}
        {online !== null && (
          <span
            aria-label={online ? 'Online' : 'Offline'}
            className={cn(
              'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-bg-base',
              online ? 'bg-green-400' : 'bg-text-tertiary',
            )}
          />
        )}
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary">
          {presence.roleLabel}
        </span>
        <span className="max-w-[40vw] truncate text-[13px] font-semibold text-text-primary sm:max-w-none">
          {presence.name}
        </span>
      </span>
    </div>
  )
}

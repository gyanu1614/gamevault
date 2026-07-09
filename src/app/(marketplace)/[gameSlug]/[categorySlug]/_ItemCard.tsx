'use client'

/**
 * V24 — Horizontal landscape listing card (data-rich rebuild).
 *
 * Layout (wider, not taller — Eldorado/PlayerAuctions style):
 *
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │  Brainrot · Secret                          ┌──────┐ Best deal│
 *   │  Garama and Madundung — Quick Delivery       │ img  │         │
 *   │  ⚡ Instant  ▣ 4 in stock  ✦ Neon            │      │         │
 *   │                                              └──────┘         │
 *   │  $49.00  $̶5̶9̶.̶0̶0̶  −17%  / unit                                 │
 *   ├──────────────────────────────────────────────────────────────┤
 *   │  ●  gyanu1614 ✓            ★ 99.9% (1,381)              →     │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * The whole card links to the listing; the seller chip is a nested
 * click target (→ /shop) with stopPropagation.
 *
 * Everything below the title is DATA-DRIVEN — the meta-chip row renders
 * only the chips a listing actually carries (delivery + stock always;
 * then attribute chips: mutations/modifiers like "Neon", which is also
 * how per-game Region/Platform attributes surface). One component, no
 * per-game branching.
 */

import Link from 'next/link'
import { SmartLink } from '@/components/global/SmartLink'
import { Bolt, Clock, ThumbsUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDeliveryLabel, parseDeliveryMinutes } from '@/lib/utils/delivery-time'
import type { ItemOffer } from './_itemsTypes'

const fmtPrice = (n: number) => {
  if (n === 0) return '$0.00'
  if (Math.abs(n) < 0.01) return `$${n.toFixed(4)}`
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const fmtCount = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 10_000) return `${Math.round(n / 1_000)}K`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return n.toLocaleString('en-US')
}

function VerifiedDot({ size = 14 }: { size?: number }) {
  return (
    <span
      aria-label="Verified seller"
      title="Verified seller"
      style={{ width: size, height: size }}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-lime"
    >
      <svg viewBox="0 0 12 12" className="h-2 w-2" fill="none" aria-hidden>
        <path
          d="M2.5 6.2 4.7 8.4 9.5 3.6"
          stroke="#0A0A0F"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

/** Plain seller avatar (image or initial fallback). */
function SellerAvatar({ seller, size = 34 }: { seller: ItemOffer['seller']; size?: number }) {
  const initial = (seller.shopName || seller.username || 'S').charAt(0).toUpperCase()
  if (seller.avatarUrl) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={seller.avatarUrl}
        alt=""
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full object-cover ring-1 ring-border-subtle"
      />
    )
  }
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      className="flex shrink-0 items-center justify-center rounded-full bg-bg-overlay-2 font-bold text-text-primary ring-1 ring-border-subtle"
    >
      {initial}
    </span>
  )
}

type ChipTone = 'default' | 'success'

/** One meta chip in the data-driven row (delivery, stock, attribute). */
function MetaPill({
  icon: Icon,
  label,
  tone = 'default',
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  tone?: ChipTone
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12.5px] font-semibold',
        tone === 'success'
          ? 'border-success/30 bg-success/12 text-success'
          // Default tone kept greyish/faded — softer label + dimmer icon +
          // lighter border/bg so it reads as quiet metadata, not stark white.
          : 'border-border-subtle bg-bg-base/50 text-text-secondary',
      )}
    >
      <Icon className={cn('h-3.5 w-3.5', tone === 'success' ? 'text-success' : 'text-text-tertiary')} />
      {label}
    </span>
  )
}

export default function ItemCard({
  offer,
  gameSlug,
  isOwn,
  isBestDeal,
}: {
  offer: ItemOffer
  gameSlug: string
  isOwn?: boolean
  isBestDeal?: boolean
}) {
  const stop = (e: React.MouseEvent) => e.stopPropagation()
  const href = `/${gameSlug}/${offer.detailCategorySlug}/${offer.detailSlug}`
  const sellerName = offer.seller.shopName || offer.seller.username

  // Delivery: green chip + bolt for instant, neutral clock + window label
  // otherwise. parseDeliveryMinutes treats "instant" as the 5-min SLA, so
  // anything ≤5 reads as effectively instant.
  const isInstant =
    !!offer.deliveryTime && parseDeliveryMinutes(offer.deliveryTime) <= 5
  const deliveryText = offer.deliveryTime ? formatDeliveryLabel(offer.deliveryTime) : 'Instant'

  const discountPct =
    offer.originalPrice && offer.originalPrice > offer.pricePerUnit
      ? Math.round((1 - offer.pricePerUnit / offer.originalPrice) * 100)
      : 0

  return (
    <article
      className={cn(
        // V48 — Bundle-tile hover language: gentle lift + deepened
        // shadow + surface fill (was color-fill only). Thumbnail stays
        // static and there's no lime tint — the card remains
        // data-forward; only the surface gains depth.
        'group relative flex cursor-pointer flex-col overflow-hidden rounded-lg border border-border-default bg-bg-overlay',
        'transition-all duration-200',
        'hover:-translate-y-0.5 hover:border-border-strong hover:bg-bg-overlay-2 hover:shadow-[0_12px_24px_-12px_rgba(0,0,0,0.6)]',
      )}
    >
      {/* Whole-card stretched link (see V15g pattern). */}
      <Link
        href={href}
        aria-label={offer.name}
        className="absolute inset-0 z-0 pointer-events-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-lime-tint-bg"
      />
      {/* Top sheen — faint light falling from above (bundle-tile look).
          Sits after the stretched link in the DOM so it paints above the
          card surface; pointer-events-none keeps the link clickable. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.05),transparent)]"
      />

      {/* MAIN BLOCK — pointer-events-none so the whole-card Link gets clicks;
          interactive children opt back in. */}
      <div className="pointer-events-none relative z-10 flex flex-col p-3.5 sm:p-4">
        {/* Breadcrumb — full-width row across the top so long category
            chains have the whole card width to wrap into (the image no
            longer crowds it from the right). Muted/light, not accent —
            it's metadata, kept minimal. */}
        {offer.breadcrumb.length > 0 && (
          <div className="mb-2 line-clamp-1 text-[12px] font-medium text-text-tertiary">
            {offer.breadcrumb.join(' · ')}
          </div>
        )}

        {/* CONTENT ROW — left (title + delivery), right (image). The image
            aligns to the TITLE, not the breadcrumb above. */}
        <div className="flex items-stretch gap-4">
        {/* Left column — name + delivery chip */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Title reserves a fixed 2-line height (min-h) even for 1-line
              names, so the delivery chip below always lands at the same
              vertical spot across cards — no drift, uniform card heights. */}
          <h3 className="min-h-[2.75rem] text-[15.5px] font-bold leading-snug text-text-primary line-clamp-2 sm:text-[16px]">
            {offer.name}
          </h3>

          {/* Meta row — Delivery Time only (per product decision). Stock and
              attribute chips live on the listing detail page, not the card. */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <MetaPill
              icon={isInstant ? Bolt : Clock}
              label={deliveryText}
              tone={isInstant ? 'success' : 'default'}
            />
          </div>
        </div>

        {/* Right column — square thumbnail + optional Best deal flag */}
        <div className="relative z-10 aspect-square h-full w-[88px] shrink-0 self-start overflow-hidden rounded-md bg-bg-base sm:w-[110px]">
          {offer.imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={offer.imageUrl}
              alt={offer.name}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-text-tertiary">
              <span className="text-[10px] font-medium uppercase tracking-wider">No image</span>
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Bottom strip — single row: price (left) + seller chip & rating
          (right). The green "buy" arrow is gone — the whole card is the
          click target.

          V26 — Fixed min-height so the "Yours" pill branch (short) and the
          full seller-chip branch (avatar + 2 text lines, tall) occupy the
          SAME vertical space. Without this the strip collapses on owned
          listings and the card ends up shorter than its neighbours, which
          broke row alignment in the detail-page carousel. */}
      <div className="pointer-events-none relative z-10 mt-auto flex min-h-[58px] items-center justify-between gap-3 border-t border-border-subtle px-3 py-2.5 sm:px-3.5">
        {/* Price / unit — left. Optional strikethrough original + a small
            lowest-price icon (tooltip-on-hover, no default text). */}
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className="text-[20px] font-bold tabular-nums leading-none text-text-primary sm:text-[22px]">
            {fmtPrice(offer.pricePerUnit)}
          </span>
          {discountPct > 0 && offer.originalPrice != null && (
            <span className="text-[12px] font-medium tabular-nums text-text-tertiary line-through">
              {fmtPrice(offer.originalPrice)}
            </span>
          )}
          <span className="text-[13px] font-semibold text-text-secondary">/ Unit</span>

          {/* Lowest-price signal: icon only by default, label on hover.
              The `bd-tip` group reveals the tooltip via CSS (see globals
              — or the inline peer below). Kept subtle so it doesn't crowd
              the price. */}
          {isBestDeal && (
            <span className="group/tip pointer-events-auto relative inline-flex shrink-0 self-center">
              <span
                aria-label="Lowest price"
                className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-success/20 text-success ring-1 ring-success/30"
              >
                <TrendingDown className="h-4 w-4" strokeWidth={2.5} aria-hidden />
              </span>
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-border-default bg-bg-overlay-2 px-2 py-1 text-[10.5px] font-semibold text-text-primary opacity-0 shadow-md transition-opacity duration-150 group-hover/tip:opacity-100"
              >
                Lowest Price
              </span>
            </span>
          )}
        </div>

        {/* Right — seller block, OR the owner "Yours" edit link.
            Direction 2: reputation collapses into ONE trust-score token on
            the far right; the seller identity (name + verified) + sold count
            sit quietly beside it, right-aligned. One click target → shop. */}
        {isOwn ? (
          <Link
            href={`/sell/edit/${offer.id}`}
            onClick={stop}
            className="pointer-events-auto relative z-10 inline-flex shrink-0 items-center gap-1.5 rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-300 transition-colors hover:bg-amber-500/15"
          >
            Yours
          </Link>
        ) : (
          <SmartLink
            href={`/shop/${offer.seller.username}`}
            onClick={stop}
            className="pointer-events-auto inline-flex min-w-0 shrink items-center gap-2.5 rounded-lg py-0.5 pl-0.5 pr-1 transition-colors hover:bg-bg-overlay-2"
          >
            {/* Plain seller avatar. */}
            <SellerAvatar seller={offer.seller} size={34} />

            {/* Seller identity — name + verified on top, rating below. */}
            <div className="flex min-w-0 flex-col gap-0.5 leading-tight">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="max-w-[104px] truncate text-[12.5px] font-semibold text-text-primary">
                  {sellerName}
                </span>
                {offer.seller.verified && <VerifiedDot size={12} />}
              </div>
              {/* Sub-line — rating + order count, so it reads at roughly the
                  name's width instead of a lonely short number. */}
              <span className="inline-flex items-center gap-1.5 text-[11.5px]">
                <span className="inline-flex items-center gap-1 font-semibold text-success">
                  <ThumbsUp className="h-3 w-3 fill-success" aria-hidden />
                  <span className="tabular-nums">{offer.seller.rating.toFixed(1)}%</span>
                </span>
                <span className="tabular-nums text-text-tertiary">
                  · {fmtCount(offer.seller.sales)} orders
                </span>
              </span>
            </div>
          </SmartLink>
        )}
      </div>
    </article>
  )
}

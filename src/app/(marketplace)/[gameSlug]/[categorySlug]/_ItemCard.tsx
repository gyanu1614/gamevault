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

import { sellerDisplayName, sellerInitial, sellerShopSlug } from '@/lib/seller/identity'
import Link from 'next/link'
import { SmartLink } from '@/components/global/SmartLink'
import { Bolt, Clock, ThumbsUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { VerifiedBadge } from '@/components/seller/VerifiedBadge'
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

/** Plain seller avatar (image or initial fallback). */
function SellerAvatar({ seller, size = 34 }: { seller: ItemOffer['seller']; size?: number }) {
  const initial = sellerInitial(seller)
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
  const sellerName = sellerDisplayName(offer.seller)

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
        // Hover is colour only — no lift, no shadow bloom. In a dense
        // grid a per-card translate makes the whole wall twitch as the
        // pointer crosses it; the surface/border shift is enough to
        // show which card is live. Transition is scoped to colours so
        // nothing else can animate back in by accident.
        'group relative flex cursor-pointer flex-col overflow-hidden rounded-lg border border-border-default bg-bg-overlay',
        'transition-colors duration-200',
        'hover:border-border-strong hover:bg-bg-overlay-2',
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
            href={`/shop/${sellerShopSlug(offer.seller) ?? ''}`}
            onClick={stop}
            className="pointer-events-auto inline-flex min-w-0 shrink items-center gap-2.5 rounded-lg py-0.5 pl-0.5 pr-1 transition-colors hover:bg-bg-overlay-2"
          >
            <SellerAvatar seller={offer.seller} size={32} />

            {/* Identity above, reputation below. Both lines are right-
                aligned so the block reads as one column flush to the
                card edge instead of two ragged lines; `items-end` plus
                the avatar's own centring keeps the pair optically
                balanced against the 32px circle. */}
            <div className="flex min-w-0 flex-col items-end gap-[3px] leading-none">
              <div className="flex min-w-0 items-center gap-1">
                <span className="max-w-[112px] truncate text-[12.5px] font-semibold text-text-primary">
                  {sellerName}
                </span>
                {offer.seller.verified && <VerifiedBadge size={13} />}
              </div>

              {/* Reputation. A rated seller gets the figure; an unrated
                  one gets a quiet "New seller" — never inside the green
                  thumbs-up, where it read as though it were a score. */}
              {offer.seller.ratingPercent != null &&
              offer.seller.reviewCount > 0 ? (
                <span className="inline-flex items-center gap-1 text-[11px]">
                  <ThumbsUp
                    className="h-[11px] w-[11px] shrink-0 fill-success text-success"
                    aria-hidden
                  />
                  <span className="font-semibold tabular-nums text-success">
                    {Number.isInteger(offer.seller.ratingPercent)
                      ? offer.seller.ratingPercent
                      : offer.seller.ratingPercent.toFixed(1)}
                    %
                  </span>
                  <span className="tabular-nums text-text-tertiary">
                    ({fmtCount(offer.seller.reviewCount)})
                  </span>
                </span>
              ) : (
                <span className="text-[11px] text-text-tertiary">
                  New seller
                </span>
              )}
            </div>
          </SmartLink>
        )}
      </div>
    </article>
  )
}

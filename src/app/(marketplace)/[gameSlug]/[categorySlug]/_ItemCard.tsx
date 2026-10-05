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
import LocalOfferRoundedIcon from '@mui/icons-material/LocalOfferRounded'
import { IconBolt, IconClock, IconPackage } from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import { MARKET_CARD, MARKET_CARD_HOVER } from '@/lib/ui/surfaces'
import { TierIcon } from '@/components/seller/tiers/TierIcon'
import { PencilSimpleIcon } from '@phosphor-icons/react'
import { VerifiedBadge } from '@/components/seller/VerifiedBadge'
import { SellerStats } from '@/components/seller/SellerStats'
import { formatDeliveryLabel, parseDeliveryMinutes } from '@/lib/utils/delivery-time'
import type { ItemOffer } from './_itemsTypes'

const fmtPrice = (n: number) => {
  if (n === 0) return '$0.00'
  if (Math.abs(n) < 0.01) return `$${n.toFixed(4)}`
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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

/** One meta chip: a small dark pill with an icon; hovering names what the
 *  number is ("Delivery Time", "Available Stock") in a tooltip above it. */
function MetaPill({
  icon: Icon,
  label,
  tip,
  tone = 'default',
  ariaLabel,
}: {
  icon: typeof IconClock
  label: string
  tip: string
  tone?: ChipTone
  ariaLabel?: string
}) {
  return (
    <span className="group/pill pointer-events-auto relative inline-flex">
      <span
        aria-label={`${tip}: ${label}`}
        className={cn(
          'inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium',
          'bg-white/[0.06] ring-1 ring-inset ring-white/[0.05]',
          tone === 'success' ? 'text-success' : 'text-text-primary',
        )}
      >
        <Icon size={13} stroke={2} className={tone === 'success' ? 'text-success' : 'text-text-secondary'} />
        {label}
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-[#111214] px-3 py-1.5 text-[12.5px] font-semibold text-text-primary opacity-0 shadow-[0_10px_24px_-8px_rgba(0,0,0,0.7)] transition-opacity duration-150 group-hover/pill:opacity-100"
      >
        {tip}
      </span>
    </span>
  )
}

/** 14 · 1.2K · 999.9K — stock in the fewest characters. */
function fmtStock(n: number): string {
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`
  return `${(n / 1_000_000).toFixed(1)}M`
}

export default function ItemCard({
  offer,
  gameSlug,
  gameName,
  isOwn,
  isBestDeal,
  href: hrefOverride,
}: {
  offer: ItemOffer
  gameSlug: string
  /** Shown on the top line when the listing has no filter values. */
  gameName?: string
  isOwn?: boolean
  isBestDeal?: boolean
  /** Card link override (e.g. a currency offer opens the currency page with
   *  this seller selected instead of the listing route's redirect). */
  href?: string
}) {
  const stop = (e: React.MouseEvent) => e.stopPropagation()
  const href = hrefOverride ?? `/${gameSlug}/${offer.detailCategorySlug}/${offer.detailSlug}`
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
        // Hover = highlight in place: the surface lightens one step and the
        // border brightens toward white, with a faint lit top edge. NO lift
        // and no drop shadow — the card must not move. Colour + border only,
        // so it transitions `colors` and `box-shadow`, never `transform`.
        // Premium black: a quiet top-to-bottom gradient (#24252B → #1D1E23),
        // a 10% hairline, a 1px inner highlight on the top edge and a soft
        // drop shadow for depth. Hover lifts the whole gradient one step and
        // clears the hairline — still black, never the grey tokens.
        // h-full: every card fills its grid row, so a row never mixes heights.
        // Fill only (owner, 2026-09-30: no outlines anywhere): the shared
        // marketplace surface, hover lifts the gradient one step.
        'group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-lg',
        MARKET_CARD,
        MARKET_CARD_HOVER,
      )}
    >
      {/* Whole-card stretched link (see V15g pattern). */}
      <Link
        href={href}
        aria-label={offer.name}
        className="absolute inset-0 z-0 pointer-events-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-soft"
      />

      {/* MAIN BLOCK — pointer-events-none so the whole-card Link gets clicks;
          interactive children opt back in. */}
      <div className="pointer-events-none relative z-10 flex flex-col" style={{ padding: 'var(--gap-card)' }}>
        {/* Breadcrumb — full-width row across the top so long category
            chains have the whole card width to wrap into (the image no
            longer crowds it from the right). Muted/light, not accent —
            it's metadata, kept minimal. */}
        {/* The row is ALWAYS there (one line), so a card with no filter
            values is exactly as tall as one with them (owner, 2026-09-30:
            "some cards have filters and some don't"). No filter values:
            the game's name (owner: "Steal a Brainrot", not "Buy Items"). */}
        <div
          className="mb-2 line-clamp-1 min-h-[1.4em] font-medium text-text-tertiary"
          style={{ fontSize: 'var(--fs-caption)', letterSpacing: '0.02em' }}
        >
          {offer.breadcrumb.length > 0 ? offer.breadcrumb.join(' · ') : gameName || '\u00A0'}
        </div>

        {/* CONTENT ROW — left (title + delivery), right (image). The image
            aligns to the TITLE, not the breadcrumb above. */}
        <div className="flex items-stretch gap-4">
        {/* Left column — name + delivery chip */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Title reserves a fixed 2-line height (min-h) even for 1-line
              names, so the delivery chip below always lands at the same
              vertical spot across cards — no drift, uniform card heights. */}
          <h3 className="min-h-[2.75rem] line-clamp-2 text-text-primary" style={{ fontSize: 'var(--fs-card-title)', fontWeight: 500, letterSpacing: '-0.01em', lineHeight: 'var(--lh-card-title)' }}>
            {offer.name}
          </h3>

          {/* Meta row — delivery time + stock as pills (owner call 2026-09-28). */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <MetaPill
              icon={isInstant ? IconBolt : IconClock}
              label={deliveryText}
              tip="Delivery Time"
              tone={isInstant ? 'success' : 'default'}
            />
            {!offer.isUnlimited && offer.stock != null && offer.stock > 0 && (
              <MetaPill icon={IconPackage} label={fmtStock(offer.stock)} tip="Available Stock" />
            )}
          </div>
        </div>

        {/* Right column — square thumbnail + optional Best deal flag */}
        {/* No background on the thumbnail slot — it is transparent, so a
            PNG cutout (most pet/item art) floats directly on the card and
            takes the card's colour, including on hover. An opaque image
            fills the slot with object-cover and keeps its rounded corners,
            so it looks exactly as it did on the old dark tile. */}
        <div className="relative z-10 aspect-square h-full w-[88px] shrink-0 self-start overflow-hidden rounded-md sm:w-[110px]">
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
              <span className="font-medium uppercase tracking-wider" style={{ fontSize: 'var(--fs-micro)' }}>No image</span>
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
      <div className="pointer-events-none relative z-10 mt-auto flex items-center justify-between gap-3 border-t border-white/[0.07] bg-[#17181C] transition-colors group-hover:bg-[#1C1D22]" style={{ minHeight: '58px', padding: 'calc(var(--gap-card) * 0.6) var(--gap-card)' }}>
        {/* Price / unit — left. Optional strikethrough original + a small
            lowest-price icon (tooltip-on-hover, no default text). */}
        <div className="flex min-w-0 shrink-0 items-baseline gap-1.5 whitespace-nowrap">
          <span className="tabular-nums leading-none text-text-primary" style={{ fontSize: 'var(--fs-price)', fontWeight: 'var(--fw-heading)', fontVariantNumeric: 'tabular-nums' }}>
            {fmtPrice(offer.pricePerUnit)}
          </span>
          {discountPct > 0 && offer.originalPrice != null && (
            <span className="tabular-nums text-text-tertiary line-through" style={{ fontSize: 'var(--fs-micro)' }}>
              {fmtPrice(offer.originalPrice)}
            </span>
          )}
          <span className="font-semibold text-text-secondary" style={{ fontSize: 'var(--fs-meta)' }}>/ Unit</span>

          {/* Lowest-price signal: icon only by default, label on hover.
              The `bd-tip` group reveals the tooltip via CSS (see globals
              — or the inline peer below). Kept subtle so it doesn't crowd
              the price. */}
          {isBestDeal && (
            <span className="group/tip pointer-events-auto relative inline-flex shrink-0 self-center">
              {/* A price tag (Material LocalOffer), in the same filled
                  rectangle as the card's chips. */}
              <span
                aria-label="Best Offer"
                className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-success-bg text-success"
              >
                <LocalOfferRoundedIcon aria-hidden style={{ fontSize: 14 }} />
              </span>
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 -translate-x-1/2 whitespace-nowrap rounded border border-border-default bg-bg-overlay-2 px-2 py-1 font-semibold text-text-primary opacity-0 shadow-md transition-opacity duration-150 group-hover/tip:opacity-100"
                style={{ fontSize: 'var(--fs-micro)' }}
              >
                Best Offer
              </span>
            </span>
          )}
        </div>

        {/* Right — seller block, OR the owner "Yours" edit link.
            Direction 2: reputation collapses into ONE trust-score token on
            the far right; the seller identity (name + verified) + sold count
            sit beside the avatar as one unit. One click target → shop. */}
        {isOwn ? (
          <Link
            href={`/sell/edit/${offer.id}`}
            onClick={stop}
            aria-label="Edit your offer"
            className="pointer-events-auto relative z-10 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-amber-400/10 px-3 text-[13px] font-semibold text-amber-300 transition-colors hover:bg-amber-400/[0.16]"
          >
            <PencilSimpleIcon size={14} weight="bold" aria-hidden />
            Yours
          </Link>
        ) : (
          <SmartLink
            href={`/shop/${sellerShopSlug(offer.seller) ?? ''}`}
            onClick={stop}
            className="pointer-events-auto -mr-1 inline-flex min-w-0 shrink items-center gap-2.5 rounded-lg py-1 pl-2 pr-1 transition-colors hover:bg-white/[0.05]"
          >
            {/* Anchored to the corner: text right-aligned into the avatar,
                the avatar on the card's right edge under the thumbnail.
                Top line: name, verified, tier icon. Bottom: 👍 % · Sold. */}
            <div className="flex min-w-0 flex-col items-end gap-1 leading-none">
              <div className="flex min-w-0 max-w-full items-center gap-1">
                <span className="truncate text-[13px] font-semibold text-text-primary">
                  {sellerName}
                </span>
                {offer.seller.verified && <VerifiedBadge size={13} />}
                <TierIcon tier={offer.seller.tier} size={14} />
              </div>
              <SellerStats
                ratingPercent={offer.seller.ratingPercent}
                reviews={offer.seller.reviewCount}
                sales={offer.seller.sales}
                tier={offer.seller.tier}
                hideTier
                className="text-[12px]"
              />
            </div>
            <SellerAvatar seller={offer.seller} size={34} />
          </SmartLink>
        )}
      </div>
    </article>
  )
}

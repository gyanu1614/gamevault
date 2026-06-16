'use client'

/**
 * V15e — Horizontal landscape listing card.
 *
 * New layout (wider, not taller — inspired by Eldorado/PlayerAuctions
 * style cards):
 *
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │  Name                                              ┌──────┐ │
 *   │                                                    │ img  │ │
 *   │  ⏱ 20 min   📦 527                                 │      │ │
 *   │                                                    └──────┘ │
 *   │  $3.48 /unit                            ┌──── Buy now ────┐ │
 *   │                                          └─────────────────┘│
 *   ├──────────────────────────────────────────────────────────────┤
 *   │  ●  StoreGoodMan ✓             35,323 sold    👍 99.86%     │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * The whole card is clickable to the listing; the seller chip and Buy
 * button are nested clickable surfaces with stopPropagation.
 */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { ArrowRight, Clock, Package, ThumbsUp } from 'lucide-react'
import { cn } from '@/lib/utils'
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

function SellerAvatar({ seller, size = 28 }: { seller: ItemOffer['seller']; size?: number }) {
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
      className="flex shrink-0 items-center justify-center rounded-full bg-bg-overlay font-bold text-text-primary ring-1 ring-border-subtle"
    >
      {initial}
    </span>
  )
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

/**
 * Pick a sensible "delivery time" pill value.
 *
 * We don't have a normalised delivery_time on the ItemOffer right now —
 * cards in the screenshots show "20 min" which is a seller-set window.
 * Falling back to "Instant" reads well for digital items where the
 * default is automated delivery.
 */
function deliveryLabel(_offer: ItemOffer): string {
  return 'Instant'
}

export default function ItemCard({
  offer,
  gameSlug,
  isOwn,
}: {
  offer: ItemOffer
  gameSlug: string
  isOwn?: boolean
}) {
  // V15f — Whole-card click goes to the listing page. The Buy CTA on the
  // card is gone (replaced by a small lime arrow chip bottom-right). The
  // /checkout/{id} navigation happens from the detail page now.
  // V15h — Use the canonical detail URL the listing detail page expects
  // (with price-history chart, full template fields, etc) instead of the
  // SEO alias. The SEO alias still works via the resolver redirect.
  const stop = (e: React.MouseEvent) => e.stopPropagation()
  // V15z — Direct link to the canonical detail URL. The /marketplace/...
  // prefix is a legacy redirect route that just bounces to this same
  // shape; routing through it caused the visible "click → /marketplace/X
  // → /X" double-nav and the related scroll glitch.
  const href = `/${gameSlug}/${offer.detailCategorySlug}/${offer.detailSlug}`

  const sellerName = offer.seller.shopName || offer.seller.username

  return (
    <article
      className={cn(
        // V15e — Wider, shorter landscape card. Outer wrapper is the
        // border surface; inner content is split top (main) + bottom
        // (seller bar) with a hairline divider.
        // V15g — `cursor-pointer` on the article so the hover state
        // clearly signals the whole card is clickable.
        // V15y — Card surface bumped from `bg-bg-raised` to `bg-bg-overlay`
        // so it matches the filter chips above. The page is bg-base
        // (near-black); cards on bg-overlay (subtle grey) now visibly
        // lift off the background instead of melting into it.
        'group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-border-default bg-bg-overlay',
        'transition-[transform,border-color,box-shadow] duration-150',
        'hover:-translate-y-0.5 hover:border-lime-tint-border hover:shadow-[0_18px_40px_-14px_rgba(0,0,0,0.6)]',
      )}
    >
      {/* V15g — Whole-card link. Stretched-link pattern: this Link's
          ::after creates a pseudo-element that covers the entire article,
          so clicking anywhere on the card navigates without needing each
          inner element to be a Link. Interactive children (seller chip,
          edit) use position:relative + z-10 to lift themselves above the
          pseudo-element and pointer-events:auto on the link target. */}
      <Link
        href={href}
        aria-label={offer.name}
        className={cn(
          'absolute inset-0 z-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-lime-tint-bg',
          // Make the link surface explicitly clickable across its area.
          'pointer-events-auto',
        )}
      />

      {/* MAIN ROW — left content, right image.
          V15g — `pointer-events-none` so the whole-card Link beneath
          gets every click. Interactive descendants (seller chip, owner
          edit chip) opt back in via `pointer-events-auto`. */}
      <div className="pointer-events-none relative z-10 flex items-stretch gap-4 p-3.5 sm:p-4">
        {/* Left column — name + meta pills + price + buy */}
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="text-[15.5px] font-bold leading-snug text-text-primary line-clamp-2 sm:text-[16px]">
            {offer.name}
          </h3>

          {/* Meta pills row — delivery + stock */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <MetaPill icon={Clock} label={deliveryLabel(offer)} />
            <MetaPill icon={Package} label={fmtCount(offer.seller.sales || 0)} />
          </div>

          {/* V15f — Price (no Buy button). The card itself is the click
              target → listing page. Bottom-right gets a small lime arrow
              chip (rendered at the card level below) as a visual hint. */}
          <div className="mt-auto flex items-end justify-between gap-3 pt-3">
            <div className="min-w-0">
              <div className="flex items-baseline gap-1">
                <span className="text-[22px] font-bold tabular-nums leading-none text-text-primary sm:text-[24px]">
                  {fmtPrice(offer.pricePerUnit)}
                </span>
                <span className="text-[12px] font-medium text-text-tertiary">/ unit</span>
              </div>
            </div>
            {isOwn && (
              // Keep an explicit "Yours" affordance for owner since they
              // shouldn't be funneled to the listing detail page; they go
              // to edit.
              <Link
                href={`/account/listings/${offer.id}/edit`}
                onClick={stop}
                className="pointer-events-auto relative z-10 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-500/10 px-3 py-1.5 text-[11.5px] font-bold uppercase tracking-wider text-amber-300 transition-colors hover:bg-amber-500/15"
              >
                Yours
              </Link>
            )}
          </div>
        </div>

        {/* Right column — square thumbnail */}
        <div className="relative z-10 aspect-square h-full w-[88px] shrink-0 self-start overflow-hidden rounded-xl bg-bg-base sm:w-[110px]">
          {offer.imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={offer.imageUrl}
              alt={offer.name}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-text-tertiary">
              <span className="text-[10px] font-medium uppercase tracking-wider">No image</span>
            </div>
          )}
        </div>
      </div>

      {/* V15g — Bottom strip. Hairline divider, transparent background.
          Inside: a small seller chip on the left (its own click target →
          /shop) + meta on the middle + lime arrow chip on the right
          (whole card → listing). The strip is `pointer-events-none` so
          the gap falls through to the whole-card Link; the seller chip
          opts back in via `pointer-events-auto`. */}
      <div className="pointer-events-none relative z-10 flex items-center justify-between gap-3 border-t border-border-subtle px-3 py-2 sm:px-3.5">
        {/* Seller chip — small, only as wide as the avatar + name */}
        <Link
          href={`/shop/${offer.seller.username}`}
          onClick={stop}
          className={cn(
            'pointer-events-auto inline-flex max-w-[55%] items-center gap-2 rounded-full border border-border-subtle bg-bg-base/60 px-1.5 py-1 pr-2.5 transition-colors',
            'hover:border-lime-tint-border hover:bg-lime-tint-bg/30',
          )}
        >
          <SellerAvatar seller={offer.seller} size={22} />
          <span className="max-w-full truncate text-[12px] font-semibold text-text-primary">
            {sellerName}
          </span>
          {offer.seller.verified && <VerifiedDot size={12} />}
        </Link>

        {/* Inline meta — sold count + rating. pointer-events-none so the
            whole-card click passes through. */}
        <div className="pointer-events-none flex shrink-0 items-center gap-2 text-[11.5px]">
          <span className="tabular-nums text-text-tertiary">
            {fmtCount(offer.seller.sales || 0)} sold
          </span>
          <span className="inline-flex items-center gap-1 text-success">
            <ThumbsUp className="h-3 w-3 fill-success text-success" aria-hidden />
            <span className="tabular-nums">{offer.seller.rating.toFixed(1)}%</span>
          </span>
        </div>

        {/* Lime arrow chip — visual buy-now affordance. The chip itself
            doesn't take clicks; clicking anywhere on the card still goes
            to the listing. */}
        {!isOwn && (
          <span
            aria-hidden
            className={cn(
              'pointer-events-none flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-lime-tint-border bg-lime-tint-bg text-lime-text shadow-sm transition-all duration-150',
              'group-hover:scale-105 group-hover:border-lime group-hover:bg-lime group-hover:text-text-inverse',
            )}
          >
            <ArrowRight className="h-4 w-4" />
          </span>
        )}
      </div>
    </article>
  )
}

function MetaPill({
  icon: Icon, label,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-bg-base/70 px-2 py-1 text-[11.5px] font-semibold text-text-secondary">
      <Icon className="h-3 w-3 text-text-tertiary" />
      {label}
    </span>
  )
}

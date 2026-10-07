'use client'

/**
 * HomeListingCard — one live listing in the homepage Latest Listings rail,
 * phone and desktop alike.
 *
 * Owner, 2026-10-06: the standard marketplace surface (no outline, no glow),
 * the listing tray #24252B under the picture, and each currency's real icon
 * instead of a "1K CURRENCY" placeholder. The picture is what's for sale: the
 * item art, the currency's icon (tilted, it straightens on hover), or the
 * game's cover for an account. Price reads like the game hub: "$0.0052/Robux".
 */

import { useState } from 'react'
import Link from '@/components/navigation/AppLink'
import { cn } from '@/lib/utils'
import { MARKET_CARD, MARKET_CARD_HOVER } from '@/lib/ui/surfaces'
import { formatUnitPrice } from '@/lib/currency/price-format'
import type { LatestListing } from '../lib/latest-listings'

const TRAY = 'bg-[#24252B]'

function Art({ listing }: { listing: LatestListing }) {
  const [failed, setFailed] = useState(false)
  const src = !failed ? listing.art : null

  if (!src) {
    return (
      <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">
        {listing.categoryLabel}
      </span>
    )
  }

  if (listing.cardType === 'currency') {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={src}
        alt=""
        aria-hidden
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-[58%] w-[58%] -rotate-[10deg] object-contain drop-shadow-[0_14px_18px_rgba(0,0,0,0.45)] transition-transform duration-300 ease-out group-hover:rotate-0 group-hover:scale-[1.06] motion-reduce:transition-none"
      />
    )
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt=""
      aria-hidden
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn(
        'transition-transform duration-300 ease-out group-hover:scale-[1.04] motion-reduce:transition-none',
        listing.cardType === 'account'
          ? 'absolute inset-0 h-full w-full object-cover'
          : 'h-[82%] w-[82%] object-contain',
      )}
    />
  )
}

export function HomeListingCard({ listing }: { listing: LatestListing }) {
  return (
    <Link
      href={listing.href}
      aria-label={`${listing.title}, ${listing.gameName}, from ${formatUnitPrice(listing.price)}`}
      className={cn(
        'group flex h-full flex-col overflow-hidden rounded-lg p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-soft',
        MARKET_CARD,
        MARKET_CARD_HOVER,
      )}
    >
      <div className={cn('relative grid aspect-[4/3] place-items-center overflow-hidden rounded-md', TRAY)}>
        <Art listing={listing} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col px-1.5 pb-1 pt-3 sm:px-2 sm:pb-1.5">
        <p className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">
          {listing.gameName}
        </p>
        <p className="mt-1 truncate text-[14px] font-semibold text-text-primary sm:text-[15px]" title={listing.title}>
          {listing.title}
        </p>
        <p className="mt-auto flex min-w-0 items-baseline gap-1 whitespace-nowrap pt-2.5">
          <span className="text-[12px] text-text-tertiary">From</span>
          <span className="min-w-0 truncate">
            <span className="text-[16px] font-bold leading-none tabular-nums text-text-primary sm:text-[18px]">
              {formatUnitPrice(listing.price)}
            </span>
            {listing.priceSuffix && <span className="text-[12px] text-text-tertiary">/{listing.priceSuffix}</span>}
          </span>
        </p>
      </div>
    </Link>
  )
}

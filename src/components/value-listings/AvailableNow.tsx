'use client'

import Link from 'next/link'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import type { ItemOffer } from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_itemsTypes'
import { itemBuyHref } from '@/lib/value-listings/buy-state'
import { trackValueEvent } from '@/lib/value-listings/track'
import { ValueOfferGrid } from './ValueOfferGrid'
import { TrackOnMount } from './TrackOnMount'

/**
 * "Available Now" on a value item page (Bundle 2, task C): up to four of
 * DropMarket's own live listings for this item, cheapest first, using the
 * marketplace's listing card. With none, the state-3 actions instead. Also
 * records the value page view for the funnel.
 */
export function AvailableNow({
  gameSlug,
  gameName,
  categorySlug,
  itemSlug,
  itemName,
  offers,
  total,
  sellHref,
}: {
  gameSlug: string
  gameName: string
  categorySlug: string
  itemSlug: string
  itemName: string
  offers: ItemOffer[]
  total: number
  sellHref: string
}) {
  const itemHref = itemBuyHref({ gameSlug, categorySlug, itemSlug })
  const shown = offers.slice(0, 4)
  return (
    <section aria-labelledby="available-now" className="mx-auto w-full max-w-7xl px-4 pt-7 sm:px-6 lg:px-8">
      <TrackOnMount event={{ event: 'value_view', surface: 'value_item', game: gameSlug, item: itemSlug }} />
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 id="available-now" className="text-lg font-semibold text-text-primary">
          Available Now
        </h2>
        {total > 0 ? (
          <Link
            href={itemHref}
            className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-text-secondary transition-colors hover:text-text-primary"
          >
            View All {total}
            <ArrowForwardIcon sx={{ fontSize: 15 }} />
          </Link>
        ) : null}
      </div>

      {shown.length > 0 ? (
        <ValueOfferGrid
          offers={shown}
          gameSlug={gameSlug}
          gameName={gameName}
          surface="value_item"
          itemSlug={itemSlug}
          columns={2}
        />
      ) : (
        <div className="rounded-lg bg-bg-raised px-5 py-6 sm:px-6">
          <p className="text-text-secondary" style={{ fontSize: 'var(--fs-meta)' }}>
            No {itemName} listed right now.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Link
              href={itemHref}
              onClick={() => trackValueEvent({ event: 'cta_click', surface: 'value_item', game: gameSlug, item: itemSlug, state: 'none' })}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-white/[0.07] px-5 font-semibold text-text-primary transition-colors hover:bg-white/[0.11]"
              style={{ minHeight: 'var(--h-btn-primary)', fontSize: 'var(--fs-meta)' }}
            >
              Browse Similar Items
            </Link>
            <Link
              href={sellHref}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-lime px-5 font-bold text-text-inverse transition-colors hover:bg-lime-hover active:bg-lime-pressed"
              style={{ minHeight: 'var(--h-btn-primary)', fontSize: 'var(--fs-meta)' }}
            >
              Sell Yours For Cash
              <ArrowForwardIcon sx={{ fontSize: 16 }} />
            </Link>
          </div>
        </div>
      )}
    </section>
  )
}

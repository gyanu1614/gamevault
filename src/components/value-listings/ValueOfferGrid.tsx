'use client'

import ItemCard from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_ItemCard'
import type { ItemOffer } from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_itemsTypes'
import { useAuth } from '@/hooks/use-auth'
import { trackValueEvent } from '@/lib/value-listings/track'
import type { ValueSurface } from '@/lib/value-listings/events'

/**
 * Grid of the existing listing cards for a value item (item listings page,
 * "Available Now" block). Opening a card records `listing_opened` for the
 * funnel. The viewer (own-listing controls) comes from useAuth on the
 * client, so the page stays static.
 */
interface OfferCellProps {
  offer: ItemOffer
  gameSlug: string
  gameName: string
  surface: ValueSurface
  itemSlug: string
  variant?: string | null
  viewerId: string | null
  isBestDeal: boolean
}

/** One listing card + its `listing_opened` funnel event (grid and carousel). */
export function ValueOfferCell({ offer, gameSlug, gameName, surface, itemSlug, variant, viewerId, isBestDeal }: OfferCellProps) {
  return (
    <div
      onClickCapture={() =>
        trackValueEvent({ event: 'listing_opened', surface, game: gameSlug, item: itemSlug, variant: variant ?? null, listing: offer.id })
      }
    >
      <ItemCard
        offer={offer}
        gameSlug={gameSlug}
        gameName={gameName}
        isOwn={!!viewerId && offer.sellerId === viewerId}
        isBestDeal={isBestDeal}
      />
    </div>
  )
}

/** The cheapest offer gets the "Best deal" tag once there is a choice. */
export function bestDealId(offers: readonly ItemOffer[]): string | null {
  return offers.length > 1 ? offers[0].id : null
}

export function ValueOfferGrid({
  offers,
  gameSlug,
  gameName,
  surface,
  itemSlug,
  variant,
  columns = 3,
}: {
  offers: ItemOffer[]
  gameSlug: string
  gameName: string
  surface: ValueSurface
  itemSlug: string
  variant?: string | null
  /** 3 on full-width pages; 2 inside the value page's narrower column. */
  columns?: 2 | 3
}) {
  const { user } = useAuth()
  const viewerId = user?.id ?? null
  const best = bestDealId(offers)
  return (
    <div
      className={columns === 3 ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3' : 'grid grid-cols-1 md:grid-cols-2'}
      style={{ gap: 'var(--gap-grid)' }}
    >
      {offers.map((o) => (
        <ValueOfferCell
          key={o.id}
          offer={o}
          gameSlug={gameSlug}
          gameName={gameName}
          surface={surface}
          itemSlug={itemSlug}
          variant={variant}
          viewerId={viewerId}
          isBestDeal={o.id === best}
        />
      ))}
    </div>
  )
}

import 'server-only'
import { cache } from 'react'
import { getItemsPair, getValueCatalog, getValueListings, type ValueListingRow } from '@/lib/value-listings/stock-server'
import { buildItemPage, isKnownVariant } from '@/lib/value-listings/item-page'
import { aggregateStock } from '@/lib/value-listings/stock'
import type { ItemStock } from '@/lib/value-listings/buy-state'
import { loadItemsTaxonomy, listingToOffer, type RawListing } from './_itemsData'
import type { ItemOffer } from './_itemsTypes'

/**
 * Server data for the value → listing surfaces (Bundle 2): the item listings
 * page and the value pages' buy button + "Available Now" block. All reads are
 * cookie-free and cached per game (value-listings/stock-server), so these
 * pages stay ISR.
 */

const toOffers = async (gameId: string, rows: readonly ValueListingRow[]): Promise<ItemOffer[]> => {
  if (rows.length === 0) return []
  const taxonomy = await loadItemsTaxonomy(gameId, 'items')
  return rows.map((r) => listingToOffer(r as unknown as RawListing, taxonomy))
}

/**
 * The item listings page. Null = 404, decided from the game, pair and
 * catalogue BEFORE any listing is read.
 */
export const loadItemListingsPage = cache(
  async (gameSlug: string, categorySlug: string, itemSlug: string, variant: string | null) => {
    const pair = await getItemsPair(gameSlug)
    if (!pair || pair.categorySlug !== categorySlug) return null
    const catalog = await getValueCatalog(gameSlug)
    if (!catalog || !catalog.items.some((i) => i.slug === itemSlug)) return null
    if (variant && !isKnownVariant(catalog, variant)) return null

    const listings = await getValueListings(gameSlug)
    const model = buildItemPage({ gameSlug, categorySlug, catalog, itemSlug, variant, rows: listings?.rows ?? [] })
    if (!model) return null
    const [offers, otherOffers] = await Promise.all([
      toOffers(pair.gameId, model.results),
      toOffers(pair.gameId, model.fallback?.otherVariantRows ?? []),
    ])
    return { pair, catalog, model, offers, otherOffers }
  },
)

export interface ValueItemBuyData {
  categorySlug: string
  /** null when the item has no live listing at all. */
  stock: ItemStock | null
  /** Up to `limit` cheapest live listings of the item (all variants). */
  offers: ItemOffer[]
  /** Variant per offer id, so the client can put the chosen variant first. */
  offerVariants: Record<string, string | null>
}

/** Buy button + "Available Now" data for one value item page. */
export async function getValueItemBuyData(gameSlug: string, itemSlug: string, limit = 12): Promise<ValueItemBuyData | null> {
  const listings = await getValueListings(gameSlug)
  if (!listings) return null
  const rows = listings.rows.filter((r) => r.value_item_slug === itemSlug)
  const stock =
    aggregateStock(rows.map((r) => ({ itemSlug, variant: r.value_variant, unitPriceUsd: Number(r.price) }))).get(itemSlug) ?? null
  const top = [...rows].sort((a, b) => Number(a.price) - Number(b.price)).slice(0, limit)
  return {
    categorySlug: listings.pair.categorySlug,
    stock,
    offers: await toOffers(listings.pair.gameId, top),
    offerVariants: Object.fromEntries(top.map((r) => [r.id, r.value_variant])),
  }
}

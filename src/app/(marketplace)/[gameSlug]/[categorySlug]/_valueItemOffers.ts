import 'server-only'
import { cache } from 'react'
import {
  getItemsPair,
  getValueCatalog,
  getValueItemDescriptions,
  getValueItemListings,
  getValueListings,
  type ValueListingRow,
} from '@/lib/value-listings/stock-server'
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
 * Does this item page exist? Null = 404, decided from the game, pair and
 * catalogue BEFORE any listing is read. The route awaits it ahead of its
 * Suspense boundary, so an unknown pet or trait is a real 404, not a 200.
 */
export const resolveItemRoute = cache(
  async (gameSlug: string, categorySlug: string, itemSlug: string, variant: string | null) => {
    const pair = await getItemsPair(gameSlug)
    if (!pair || pair.categorySlug !== categorySlug) return null
    const catalog = await getValueCatalog(gameSlug)
    const item = catalog?.items.find((i) => i.slug === itemSlug)
    if (!catalog || !item) return null
    if (variant && (item.kind || !isKnownVariant(catalog, variant))) return null
    return { pair, catalog }
  },
)

/** The item listings page: every offer of the item with its trait and seller description. Null = 404. */
export const loadItemListingsPage = cache(
  async (gameSlug: string, categorySlug: string, itemSlug: string, variant: string | null) => {
    const route = await resolveItemRoute(gameSlug, categorySlug, itemSlug, variant)
    if (!route) return null
    const { pair, catalog } = route

    const [listings, descriptions] = await Promise.all([getValueListings(gameSlug), getValueItemDescriptions(gameSlug, itemSlug)])
    const model = buildItemPage({ gameSlug, categorySlug, catalog, itemSlug, variant, rows: listings?.rows ?? [] })
    if (!model) return null
    // The seller's own words for the buy panel (a separate, item-scoped read).
    const offers = (await toOffers(pair.gameId, model.itemRows)).map((o) => ({ ...o, description: descriptions[o.id] ?? null }))
    // Trait per offer: the pet page's trait picker works on the client.
    const offerVariants: Record<string, string | null> = Object.fromEntries(model.itemRows.map((r) => [r.id, r.value_variant]))
    return { pair, catalog, model, offers, offerVariants }
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

/**
 * Buy button + "Available Now" data for one value item page. Reads only this
 * item's listings, under this item's stock tag (T1): a listing change
 * rebuilds this page, not every item page of the game.
 */
export async function getValueItemBuyData(gameSlug: string, itemSlug: string, limit = 12): Promise<ValueItemBuyData | null> {
  const listings = await getValueItemListings(gameSlug, itemSlug)
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

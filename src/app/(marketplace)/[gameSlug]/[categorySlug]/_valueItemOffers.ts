import 'server-only'
import { cache } from 'react'
import {
  getItemsPair,
  getValueCatalog,
  getValueItemDescriptions,
  getValueItemListings,
  getValueListings,
  itemPageExistsFresh,
  type ValueListingRow,
} from '@/lib/value-listings/stock-server'
import { PublicReadError } from '@/lib/supabase/failed-read'
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
 *
 * Those three reads are saved copies, and a saved 404 stays until the next
 * release. So a "no such item" is confirmed once with the database first. If the
 * item is there, the render throws: nothing is saved, the last good page stays,
 * and the next request tries again (2026-11-06: emberbow was saved as a 404
 * seconds after its first listing went live, with no failed read to explain it).
 */
export const resolveItemRoute = cache(
  async (gameSlug: string, categorySlug: string, itemSlug: string, variant: string | null) => {
    const pair = await getItemsPair(gameSlug)
    const catalog = pair?.categorySlug === categorySlug ? await getValueCatalog(gameSlug) : null
    const item = catalog?.items.find((i) => i.slug === itemSlug)
    if (!pair || !catalog || !item) {
      if (await itemPageExistsFresh(gameSlug, categorySlug, itemSlug)) {
        console.error('[item-route] saved data has no such item, the database does', {
          gameSlug,
          categorySlug,
          itemSlug,
          hasPair: !!pair,
          pairCategory: pair?.categorySlug ?? null,
          catalogItems: catalog?.items.length ?? null,
        })
        throw new PublicReadError('Saved data disagrees with the database about an item page', 0, 'STALE_ITEM_ROUTE')
      }
      return null
    }
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

    const listings = await getValueListings(gameSlug)
    const model = buildItemPage({ gameSlug, categorySlug, catalog, itemSlug, variant, rows: listings?.rows ?? [] })
    if (!model) return null
    // The seller's own words for the buy panel (a separate, item-scoped read):
    // for these offers, and none at all for an item with no offers.
    const descriptions = model.itemRows.length
      ? await getValueItemDescriptions(gameSlug, itemSlug, model.itemRows.map((r) => r.id))
      : {}
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

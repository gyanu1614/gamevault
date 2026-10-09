import 'server-only'
import { unstable_cache } from 'next/cache'
import { createAnonClient } from '@/lib/supabase/anon'
import { categoryListingsTag } from '@/lib/revalidation/listings'
import { GAME_DIRECTORY_TAG } from '@/lib/revalidation/tags'
import { getHiddenSellerIds } from '@/lib/seo/hidden-sellers'
import { requestMemo } from '@/lib/revalidation/request-memo'
import { valuesTag } from '@/lib/values/revalidation'
import { valueItemStockTag, valueStockTag } from './tags'
import { aggregateStock } from './stock'
import { loadValueCatalog, type LoadedCatalog } from './catalogs'
import { matchListingToValueItem } from './match'
import type { ItemStock } from './buy-state'

/**
 * DropMarket's own live stock per value item — the source of every value-page
 * button price and the item listings pages. One cached read per game, reading
 * the STORED link (`listings.value_item_slug` / `value_variant`, set by
 * value-listings/link.ts).
 *
 * Freshness: the per-GAME read is tagged with the game's items-pair listings
 * tag, which every listing mutation already revalidates through
 * `revalidateListingSurfaces`, plus `valueStockTag(game)` for the nightly
 * reconcile. The value ITEM page reads its own per-ITEM slice
 * (getValueItemListings) under `valueItemStockTag(game, item)` only — so one
 * listing change rebuilds one item page, not all ~500 of the game (T1).
 * Cookie-free (anon), so value pages stay ISR.
 */

export { valueItemStockTag, valueStockTag }

export const VALUE_LISTING_SELECT = `
  id, slug, title, price, original_price, delivery_time,
  quantity, is_unlimited, images, template_data, status, seller_id,
  value_item_slug, value_variant,
  seller:public_profiles!listings_seller_id_fkey(
    id, username, shop_name, shop_slug, avatar_url, seller_tier,
    seller_rating, total_reviews, total_sales, is_verified
  ),
  category:game_categories!listings_game_category_id_fkey(slug, name)
`

export type ValueListingRow = Record<string, any> & {
  id: string
  price: number | string
  seller_id: string
  value_item_slug: string
  value_variant: string | null
}

export interface ItemsPair {
  gameId: string
  gameName: string
  gameImageUrl: string | null
  pairId: string
  categorySlug: string
}

/** The game's "items" pair (e.g. /adopt-me/buy-items). */
export const getItemsPair = unstable_cache(
  async (gameSlug: string): Promise<ItemsPair | null> => {
    const sb = createAnonClient() as any
    const { data: game } = await sb.from('games').select('id, name, image_url').eq('slug', gameSlug).eq('is_active', true).maybeSingle()
    if (!game) return null
    const { data: pair } = await sb
      .from('game_categories')
      .select('id, slug, type')
      .eq('game_id', game.id)
      .eq('type', 'items')
      .eq('is_enabled', true)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (!pair) return null
    return { gameId: game.id, gameName: game.name, gameImageUrl: game.image_url ?? null, pairId: pair.id, categorySlug: pair.slug }
  },
  ['value-items-pair'],
  // 7 days + the directory tag (admin game/category edits, nightly backstop):
  // value item pages call this, and a shorter window here would cap their
  // 7-day ISR interval at it — Next uses the minimum across a render's reads.
  { revalidate: 604800, tags: [GAME_DIRECTORY_TAG] },
)

/**
 * Live, linked listings of the game — all of them, or one item's.
 *
 * Runs INSIDE the listings unstable_cache callbacks below, so it loads
 * nothing shared itself: the hidden sellers (paused ∪ test) and the
 * catalogue are resolved by the caller, outside the callback, and passed in.
 * Called inside the callback, Next 14.2 skipped those reads' own data cache
 * and hit the database on every miss of this entry (2026-10-09: 17.7k test-
 * seller, 17.5k paused-seller and 7.4k Adopt Me catalogue reads a day).
 */
export async function readValueListings(
  pair: ItemsPair,
  itemSlug: string | null,
  hidden: readonly string[],
  catalog: LoadedCatalog | null,
): Promise<ValueListingRow[]> {
  let q: any = (createAnonClient() as any)
    .from('listings')
    .select(VALUE_LISTING_SELECT)
    .eq('game_id', pair.gameId)
    .eq('status', 'active')
  q = itemSlug ? q.eq('value_item_slug', itemSlug) : q.not('value_item_slug', 'is', null)
  q = q.order('price', { ascending: true }).limit(2000)
  if (hidden.length) q = q.not('seller_id', 'in', `(${hidden.join(',')})`)
  const { data, error } = await q
  if (error) {
    console.error('[value-listings] stock read failed', error.message)
    return []
  }
  const rows = (data ?? []) as ValueListingRow[]
  // Re-check each stored link against today's matcher: a link written by
  // an older matcher ("Fairy Bat Dragon NFR" → Bat Dragon) stays in the
  // row until the listing is edited, but must never show on the item page.
  if (!catalog) return rows
  return rows.filter(
    (r) =>
      matchListingToValueItem({ title: String(r.title ?? ''), templateData: r.template_data }, catalog.catalog)
        ?.itemSlug === r.value_item_slug,
  )
}

/** Every live, linked listing of the game (card columns included). */
export async function getValueListings(gameSlug: string): Promise<{ pair: ItemsPair; rows: ValueListingRow[] } | null> {
  const pair = await getItemsPair(gameSlug)
  if (!pair) return null
  // Resolved here, outside the cached callback (see readValueListings). A
  // pause / test flag change refreshes this entry through the seller's
  // listings (revalidateListingSurfaces → the items-pair category tag).
  const [hidden, catalog] = await Promise.all([getHiddenSellerIds(), getValueCatalog(gameSlug)])
  const rows = await unstable_cache(
    async (): Promise<ValueListingRow[]> => readValueListings(pair, null, hidden, catalog),
    ['value-listings', 'whole-name-v2', gameSlug, pair.pairId],
    { revalidate: 86400, tags: [valueStockTag(gameSlug), categoryListingsTag(pair.pairId), valuesTag(gameSlug)] },
  )()
  return { pair, rows }
}

/**
 * ONE item's live listings, for that item's value page (buy button +
 * "Available Now"). Tagged with the item's own stock tag — revalidated by the
 * listing mutation seam for listings linked to this item — and the game's
 * content tag (catalogue edits, `?full=1`). Deliberately NOT the items-pair
 * category tag or the per-game stock tag: both fire for any listing of the
 * game, and every item page carrying them rebuilt on every listing change.
 *
 * `revalidate` (1 day) is the backstop for what the seam cannot name: a
 * HARD-deleted listing (the row is gone before the seam reads it) and a relink
 * (a listing edited from item A to item B refreshes B; A drops it within the
 * day). Same staleness bound as the old nightly per-game reconcile. Note it
 * also caps the item page's ISR interval at 1 day (Next takes the minimum
 * across a render's reads); passing the deleted listing's item to the seam
 * from the delete paths would let this go to 7 days.
 */
export async function getValueItemListings(
  gameSlug: string,
  itemSlug: string,
): Promise<{ pair: ItemsPair; rows: ValueListingRow[] } | null> {
  const pair = await getItemsPair(gameSlug)
  if (!pair) return null
  // Outside the cached callback (see readValueListings); a pause / test flag
  // change refreshes this entry through the seller's linked listings
  // (revalidateListingSurfaces → valueItemStockTag).
  const [hidden, catalog] = await Promise.all([getHiddenSellerIds(), getValueCatalog(gameSlug)])
  const rows = await unstable_cache(
    async (): Promise<ValueListingRow[]> => readValueListings(pair, itemSlug, hidden, catalog),
    ['value-item-listings', 'whole-name-v2', gameSlug, pair.pairId, itemSlug],
    { revalidate: 86400, tags: [valueItemStockTag(gameSlug, itemSlug), valuesTag(gameSlug)] },
  )()
  return { pair, rows }
}

export function unitPrice(row: Pick<ValueListingRow, 'price'>): number {
  return Number(row.price)
}

/** Stock for every item of the game, keyed by item slug (plain object: serialisable). */
export async function getValueStock(gameSlug: string): Promise<{ pair: ItemsPair; byItem: Record<string, ItemStock> } | null> {
  const listings = await getValueListings(gameSlug)
  if (!listings) return null
  const map = aggregateStock(
    listings.rows.map((r) => ({ itemSlug: r.value_item_slug, variant: r.value_variant, unitPriceUsd: unitPrice(r) })),
  )
  return { pair: listings.pair, byItem: Object.fromEntries(map) }
}

/**
 * The game's value catalogue (items + variants) for public pages. Tagged with
 * the values pages' own `values:<game>` tag, so a catalogue edit refreshes it.
 * Memoised per render (requestMemo); never call it inside another
 * unstable_cache callback — resolve it first and pass it in.
 */
export const getValueCatalog = requestMemo(async (gameSlug: string): Promise<LoadedCatalog | null> => {
  const pair = await getItemsPair(gameSlug)
  if (!pair) return null
  return unstable_cache(
    async () => {
      try {
        return await loadValueCatalog(createAnonClient() as any, { id: pair.gameId, slug: gameSlug })
      } catch (e) {
        console.error('[value-listings] catalogue read failed', e instanceof Error ? e.message : e)
        return null
      }
    },
    ['value-catalog', gameSlug],
    { revalidate: 86400, tags: [valuesTag(gameSlug)] },
  )()
})

import 'server-only'
import { unstable_cache } from 'next/cache'
import { createAnonClient } from '@/lib/supabase/anon'
import { categoryListingsTag } from '@/lib/revalidation/listings'
import { getPausedSellerIds } from '@/lib/actions/seller-presence'
import { getTestSellerIds } from '@/lib/seo/public-hygiene'
import { valuesTag } from '@/lib/values/revalidation'
import { aggregateStock } from './stock'
import { loadValueCatalog, type LoadedCatalog } from './catalogs'
import type { ItemStock } from './buy-state'

/**
 * DropMarket's own live stock per value item — the source of every value-page
 * button price and the item listings pages. One cached read per game, reading
 * the STORED link (`listings.value_item_slug` / `value_variant`, set by
 * value-listings/link.ts).
 *
 * Freshness: tagged with the game's items-pair listings tag, which every
 * listing mutation already revalidates through `revalidateListingSurfaces`,
 * plus `valueStockTag(game)` for the nightly reconcile. Cookie-free (anon),
 * so value pages stay ISR.
 */

export function valueStockTag(gameSlug: string): string {
  return `value-stock:${gameSlug}`
}

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
  { revalidate: 86400 },
)

/** Every live, linked listing of the game (card columns included). */
export async function getValueListings(gameSlug: string): Promise<{ pair: ItemsPair; rows: ValueListingRow[] } | null> {
  const pair = await getItemsPair(gameSlug)
  if (!pair) return null
  const rows = await unstable_cache(
    async (): Promise<ValueListingRow[]> => {
      const [paused, test] = await Promise.all([getPausedSellerIds(), getTestSellerIds()])
      const hidden = [...new Set([...paused, ...test])]
      let q: any = (createAnonClient() as any)
        .from('listings')
        .select(VALUE_LISTING_SELECT)
        .eq('game_id', pair.gameId)
        .eq('status', 'active')
        .not('value_item_slug', 'is', null)
        .order('price', { ascending: true })
        .limit(2000)
      if (hidden.length) q = q.not('seller_id', 'in', `(${hidden.join(',')})`)
      const { data, error } = await q
      if (error) {
        console.error('[value-listings] stock read failed', error.message)
        return []
      }
      return (data ?? []) as ValueListingRow[]
    },
    ['value-listings', gameSlug, pair.pairId],
    { revalidate: 86400, tags: [valueStockTag(gameSlug), categoryListingsTag(pair.pairId)] },
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
 */
export async function getValueCatalog(gameSlug: string): Promise<LoadedCatalog | null> {
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
}

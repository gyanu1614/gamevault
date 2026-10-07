import 'server-only'

/**
 * Game hub (/[gameSlug]) loaders. Cookie-free (anon client) so the page stays
 * ISR; the hub binds every category's listings tag (page.tsx) so a listing
 * change anywhere in the game refreshes it, like the category pages. Listing
 * reads are cached under those tags (lib/listings/read-client), so the
 * refresh re-reads the data instead of reusing the cached rows.
 *
 * Parity with the category grids and page titles: offline (paused) and
 * test/demo sellers are left out of both the numbers and the offer rows.
 */

import { createCategoryListingsReadClient } from '@/lib/listings/read-client'
import { getPausedSellerIds } from '@/lib/actions/seller-presence'
import { getTestSellerIds } from '@/lib/seo/public-hygiene'
import { getCategoryStats } from '@/lib/seo/page-stats'
import { fetchCategoryConfigBySlug } from '@/lib/actions/admin-category-configs'
import { quantityUnit } from '@/lib/currency/quantity-unit'
import { loadItemsTaxonomy, listingToOffer } from './[categorySlug]/_itemsData'
import type { ItemOffer } from './[categorySlug]/_itemsTypes'
import type { HubCategory, HubCategoryStat } from './_hubModel'

/** Live count / from-price / delivery per category — the category titles' numbers. */
export async function getHubCategoryStats(
  gameId: string,
  categories: HubCategory[],
): Promise<Record<string, HubCategoryStat>> {
  const rows = await Promise.all(
    categories.map(async (c) => [c.id, await getCategoryStats(gameId, c.id)] as const),
  )
  return Object.fromEntries(rows)
}

/** The currency card's art + unit suffix (per-unit games only, as the title does). */
export async function getHubCurrency(
  gameSlug: string,
): Promise<{ iconUrl: string | null; unitSuffix: string | null; unitsPerPrice: number | null }> {
  const cfg = await fetchCategoryConfigBySlug(gameSlug, 'currency')
  if (!cfg) return { iconUrl: null, unitSuffix: null, unitsPerPrice: null }
  const perUnit = !!cfg.unit_label && (cfg.bundles?.length ?? 0) === 0
  return {
    iconUrl: cfg.currency_icon_url ?? null,
    unitSuffix: perUnit ? quantityUnit(cfg.quantity_granularity, cfg.unit_label) : null,
    // How many units the listed price buys (1, 1,000 or 1,000,000): turns
    // "from $0.0052/Robux" into "1,000 Robux costs about $5.20" in the FAQ.
    unitsPerPrice: perUnit
      ? cfg.quantity_granularity === 'million' ? 1_000_000 : cfg.quantity_granularity === 'thousand' ? 1_000 : 1
      : null,
  }
}

/**
 * Item and account offers for the hub's two rows, mapped to the catalog's
 * ItemOffer shape (the real ItemCard). The newest 60 of each kind; the model
 * then orders them top selling first (pickTopSelling).
 */
export async function getHubOffers(
  gameId: string,
  categories: HubCategory[],
): Promise<{ items: ItemOffer[]; accounts: ItemOffer[] }> {
  const itemIds = categories.filter((c) => c.type === 'items').map((c) => c.id)
  const accountIds = categories.filter((c) => c.type === 'account').map((c) => c.id)
  if (itemIds.length === 0 && accountIds.length === 0) return { items: [], accounts: [] }

  const supabase = createCategoryListingsReadClient([...itemIds, ...accountIds])
  const [paused, test] = await Promise.all([getPausedSellerIds(), getTestSellerIds()])
  const hidden = Array.from(new Set([...paused, ...test]))

  const load = async (ids: string[], taxonomySlug: 'items' | 'accounts'): Promise<ItemOffer[]> => {
    if (ids.length === 0) return []
    let query = supabase
      .from('listings')
      .select(
        `
        id, slug, title, price, original_price, delivery_time, sales,
        quantity, is_unlimited, images, template_data, status,
        seller:public_profiles!listings_seller_id_fkey(
          id, username, shop_name, shop_slug, avatar_url, seller_tier,
          seller_rating, total_reviews, total_sales, is_verified
        ),
        category:game_categories!listings_game_category_id_fkey(slug, name, type)
      `,
      )
      .eq('game_id', gameId)
      .eq('status', 'active')
      .in('game_category_id', ids)
    if (hidden.length > 0) query = query.not('seller_id', 'in', `(${hidden.join(',')})`)
    const [{ data }, taxonomy] = await Promise.all([
      query.order('updated_at', { ascending: false }).limit(60) as unknown as Promise<{ data: unknown[] | null }>,
      loadItemsTaxonomy(gameId, taxonomySlug),
    ])
    return ((data ?? []) as any[])
      .map((row) => listingToOffer(row, taxonomy))
      .filter((o) => Number.isFinite(o.pricePerUnit) && o.pricePerUnit > 0)
  }

  const [items, accounts] = await Promise.all([load(itemIds, 'items'), load(accountIds, 'accounts')])
  return { items, accounts }
}

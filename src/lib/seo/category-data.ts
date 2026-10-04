import { getPausedSellerIds } from '@/lib/actions/seller-presence'
import { fetchAllRows } from '@/lib/seo/paged-read'

import type { SitemapInput } from '@/lib/seo/sitemap-builder'

type Db = any

/**
 * The rows the category rule needs, shared by the sitemap and the OG-image
 * prerender set so both read the same data the same way. `db` is any Supabase
 * client (the sitemap passes its own; the prerender set passes the anon client).
 * No cookie client is imported here: this module is safe in a static route's graph.
 */
export type CoreSitemapRows = Pick<
  SitemapInput,
  'games' | 'categories' | 'currencyConfigs' | 'listings' | 'pausedSellerIds'
>

export async function loadCoreRows(db: Db): Promise<CoreSitemapRows> {
  const [games, categories, currencyConfigs, listings, paused] = await Promise.all([
    fetchAllRows<CoreSitemapRows['games'][number]>((from, to) =>
      db.from('games').select('id, slug, content_tier, updated_at, seo_indexable').eq('is_active', true).order('id').range(from, to),
    ),
    fetchAllRows<CoreSitemapRows['categories'][number]>((from, to) =>
      db.from('game_categories').select('id, slug, type, game_id').eq('is_enabled', true).order('id').range(from, to),
    ),
    fetchAllRows<CoreSitemapRows['currencyConfigs'][number]>((from, to) =>
      db.from('category_configs').select('game_id, config, updated_at').eq('category_type', 'currency').order('id').range(from, to),
    ),
    fetchAllRows<CoreSitemapRows['listings'][number]>((from, to) =>
      db
        .from('listings')
        // SEO hygiene: a test/demo seller's listings never count.
        .select('slug, updated_at, game_id, game_category_id, seller_id, price, seller:public_profiles!listings_seller_id_fkey!inner(is_test)')
        .eq('status', 'active')
        .eq('seller.is_test', false)
        .order('id')
        .range(from, to),
    ),
    getPausedSellerIds(),
  ])
  return { games, categories, currencyConfigs, listings, pausedSellerIds: new Set(paused) }
}

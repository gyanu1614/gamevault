import { createAnonClient } from '@/lib/supabase/anon'
import { isGameHubIndexable } from '@/lib/games/indexability'
import { rethrowFailedRead } from '@/lib/supabase/failed-read'

/**
 * Game hubs the sitemap advertises: the prerender set for `/[gameSlug]` and its
 * opengraph-image. Any other game renders on its first visit. Same rule and inputs as
 * src/app/sitemap.ts: isGameHubIndexable over (content_tier, active non-test
 * listing count, curated currency config, admin override). Cookie-free. A failed
 * read stops the build, which leaves the live site as it is.
 */
export async function getIndexableGameSlugs(): Promise<string[]> {
  try {
    const supabase = createAnonClient()
    const [{ data: games }, { data: listings }, { data: currencyConfigs }] = await Promise.all([
      supabase
        .from('games')
        .select('id, slug, content_tier, seo_indexable')
        .eq('is_active', true) as unknown as Promise<{
        data: { id: string; slug: string; content_tier: string | null; seo_indexable: boolean | null }[] | null
      }>,
      supabase
        .from('listings')
        .select('seller:public_profiles!listings_seller_id_fkey!inner(is_test), game:games!listings_game_id_fkey(slug)')
        .eq('status', 'active')
        .eq('seller.is_test', false) as unknown as Promise<{
        data: { game: { slug: string } | null }[] | null
      }>,
      supabase.from('category_configs').select('game_id').eq('category_type', 'currency') as unknown as Promise<{
        data: { game_id: string }[] | null
      }>,
    ])

    const activeGameSlugs = new Set((listings ?? []).map((l) => l.game?.slug).filter(Boolean))
    const curatedGameIds = new Set((currencyConfigs ?? []).map((c) => c.game_id))

    return (games ?? [])
      .filter((game) =>
        isGameHubIndexable({
          contentTier: game.content_tier,
          activeListingCount: activeGameSlugs.has(game.slug) ? 1 : 0,
          hasCuratedCurrencyConfig: curatedGameIds.has(game.id),
          seoIndexable: game.seo_indexable,
        }),
      )
      .map((g) => g.slug)
      .sort()
  } catch (e) {
    rethrowFailedRead(e)
    return []
  }
}

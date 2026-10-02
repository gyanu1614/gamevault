import { loadCoreRows } from '@/lib/seo/category-data'
import { fetchAllRows } from '@/lib/seo/paged-read'
import { getAllPosts, getFlatPosts } from '@/lib/blog/posts'
import { LANDING_PAGES } from '@/lib/seo/landingPages'
import { isLandingPageIndexable } from '@/lib/seo/landingPageInventory'

import type { SitemapInput } from '@/lib/seo/sitemap-builder'

type Db = any

/** Everything buildSitemap needs, read through `db` (the sitemap's Supabase client). */
export async function loadSitemapInput(db: Db, baseUrl: string): Promise<SitemapInput> {
  const [core, sab, adoptMe, pipeline, gamePosts, landingChecks] =
    await Promise.all([
      loadCoreRows(db),
      fetchAllRows<SitemapInput['sabBrainrots'][number]>((from, to) =>
        db.from('sab_brainrot_catalog').select('slug, updated_at').order('slug').range(from, to),
      ),
      // Only PUBLISHABLE pets (has_page): a pet without a description 404s.
      fetchAllRows<SitemapInput['adoptMePets'][number]>((from, to) =>
        db.from('adopt_me_pets').select('slug, updated_at').eq('has_page', true).order('slug').range(from, to),
      ),
      fetchAllRows<{
        slug: string
        games: { slug: string } | null
        values_prices: { price_changed_at: string | null; sample_size: number | null } | null
      }>((from, to) =>
        db
          .from('values_items')
          .select('id, slug, games!inner(slug), values_prices!inner(price_changed_at, sample_size)')
          .eq('is_enabled', true)
          .eq('is_priced', true)
          .order('id')
          .range(from, to),
      ),
      fetchAllRows<SitemapInput['gamePosts'][number]>((from, to) =>
        db
          .from('blog_posts')
          .select('slug, primary_game_slug, updated_at')
          .eq('status', 'published')
          .not('primary_game_slug', 'is', null)
          .order('slug')
          .range(from, to),
      ),
      Promise.all(LANDING_PAGES.map((page) => isLandingPageIndexable(page))),
    ])

  return {
    baseUrl,
    ...core,
    sabBrainrots: sab,
    adoptMePets: adoptMe,
    pipelineItems: pipeline
      .filter((r) => r.games?.slug)
      .map((r) => ({
        gameSlug: r.games!.slug,
        slug: r.slug,
        priceChangedAt: r.values_prices?.price_changed_at ?? null,
        sampleSize: r.values_prices?.sample_size ?? null,
      })),
    gamePosts,
    posts: getAllPosts(),
    flatPosts: getFlatPosts(),
    landingSlugs: LANDING_PAGES.filter((_, i) => landingChecks[i]).map((p) => p.slug),
  }
}

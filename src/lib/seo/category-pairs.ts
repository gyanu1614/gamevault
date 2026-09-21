import { createAnonClient } from '@/lib/supabase/anon'

export interface CategoryPair {
  gameSlug: string
  categorySlug: string
}

/**
 * The (game, category) pairs the sitemap advertises — the prerender set for
 * `/[gameSlug]/[categorySlug]` (Step 7a).
 *
 * Same rule as src/app/sitemap.ts: a pair with at least one active listing
 * from a non-test seller, plus every enabled currency category of a game that
 * has an admin currency config (curated content makes the page indexable
 * before its first listing). Cookie-free: this runs in generateStaticParams at
 * build time, where there is no request.
 *
 * Any read failure yields [] — the long tail renders on demand into the same
 * ISR cache, so a bad build-time read costs first-hit renders, not pages.
 */
export async function getIndexableCategoryPairs(): Promise<CategoryPair[]> {
  try {
    const supabase = createAnonClient()
    const [{ data: listings }, { data: currencyConfigs }, { data: currencyCategories }] =
      await Promise.all([
        supabase
          .from('listings')
          .select(
            `
            slug,
            seller:public_profiles!listings_seller_id_fkey!inner(is_test),
            game:games!listings_game_id_fkey(slug),
            category:game_categories!listings_game_category_id_fkey(slug)
          `,
          )
          .eq('status', 'active')
          .eq('seller.is_test', false) as unknown as Promise<{
          data: { game: { slug: string } | null; category: { slug: string } | null }[] | null
        }>,
        supabase.from('category_configs').select('game_id').eq('category_type', 'currency') as unknown as Promise<{
          data: { game_id: string }[] | null
        }>,
        supabase
          .from('game_categories')
          .select('slug, game_id, game:games!game_categories_game_id_fkey(slug)')
          .eq('is_enabled', true)
          .eq('type', 'currency') as unknown as Promise<{
          data: { slug: string; game_id: string; game: { slug: string } | null }[] | null
        }>,
      ])

    const keys = new Set<string>()
    for (const l of listings ?? []) {
      if (l.game?.slug && l.category?.slug) keys.add(`${l.game.slug}/${l.category.slug}`)
    }
    const curated = new Set((currencyConfigs ?? []).map((c) => c.game_id))
    for (const c of currencyCategories ?? []) {
      if (c.game?.slug && curated.has(c.game_id)) keys.add(`${c.game.slug}/${c.slug}`)
    }

    return [...keys]
      .sort()
      .map((k) => {
        const [gameSlug, categorySlug] = k.split('/')
        return { gameSlug, categorySlug }
      })
  } catch {
    return []
  }
}

/**
 * EVERY enabled (active game, enabled category) pair — the prerender set for
 * `/[gameSlug]/[categorySlug]` from Step 7b on. With ~12 deploys a day, any
 * pair not built at deploy re-renders on its first visit after each one; the
 * sitemap's subset (above) stays the rule for indexability and OG images.
 * One read; [] on failure so the long tail simply renders on demand.
 */
export async function getAllEnabledCategoryPairs(): Promise<CategoryPair[]> {
  try {
    const supabase = createAnonClient()
    const { data } = (await supabase
      .from('game_categories')
      .select('slug, game:games!game_categories_game_id_fkey(slug, is_active)')
      .eq('is_enabled', true)) as unknown as {
      data: { slug: string; game: { slug: string; is_active: boolean } | null }[] | null
    }
    return (data ?? [])
      .filter((c) => c.game?.slug && c.game.is_active)
      .map((c) => ({ gameSlug: c.game!.slug, categorySlug: c.slug }))
      .sort((a, b) =>
        a.gameSlug === b.gameSlug
          ? a.categorySlug.localeCompare(b.categorySlug)
          : a.gameSlug.localeCompare(b.gameSlug),
      )
  } catch {
    return []
  }
}

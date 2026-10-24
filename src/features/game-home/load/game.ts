import 'server-only'
import { cache } from 'react'
import { createAnonClient } from '@/lib/supabase/anon'
import { withCurrencyNavLabel } from '@/lib/categories/currency-nav-label'

/**
 * The games row + its enabled categories for /[gameSlug]. `cache()` makes
 * generateMetadata and the page body share one read per request (STATE-004).
 * Cookie-free, so the page stays ISR. Null = no such active game (404); a
 * database error throws so ISR keeps serving the last good page.
 */
export const getGameData = cache(async function getGameData(gameSlug: string) {
  const supabase = createAnonClient()

  const { data: game, error: gameError } = (await supabase
    .from('games')
    // STATE-012: explicit columns. resolveGameSeo() reads the four seo_* overrides.
    .select(
      'id, name, slug, description, ecosystem, content_tier, image_url, seo_indexable, seo_title, seo_description, seo_h1, seo_intro',
    )
    .eq('slug', gameSlug)
    .eq('is_active', true)
    .maybeSingle()) as any

  if (gameError) throw new Error(`games(${gameSlug}): ${gameError.message}`)
  if (!game) return null

  const [{ data: categories, error: categoriesError }, { data: currencyCfg, error: cfgError }] = await Promise.all([
    supabase
      .from('game_categories')
      .select('id, name, slug, description, icon_emoji, icon_url, type, sub_types')
      .eq('game_id', game.id)
      .eq('is_enabled', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }) as any,
    supabase
      .from('category_configs')
      .select('config')
      .eq('game_id', game.id)
      .eq('category_type', 'currency')
      .maybeSingle() as any,
  ])

  if (categoriesError) throw new Error(`game_categories(${gameSlug}): ${categoriesError.message}`)
  if (cfgError) throw new Error(`category_configs(${gameSlug}): ${cfgError.message}`)

  return {
    ...game,
    // The currency tab/card reads like its page title ("Gems", not "Currency").
    categories: withCurrencyNavLabel((categories || []) as any[], currencyCfg?.config?.unit_label),
  }
})

export type GameData = NonNullable<Awaited<ReturnType<typeof getGameData>>>

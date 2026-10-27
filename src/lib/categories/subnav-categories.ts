import 'server-only'
import { unstable_cache } from 'next/cache'
import { createAnonClient } from '@/lib/supabase/anon'
import { withCurrencyNavLabel } from '@/lib/categories/currency-nav-label'
import { GAME_DIRECTORY_TAG } from '@/lib/revalidation/tags'
import type { GameCategory } from '@/components/marketplace/GameSubNav'

/**
 * A game's sub-navbar tabs (Step 7b) — per game, not per page: the tabs are
 * identical on every category and pet page of the game, so this is one tagged
 * cache entry per game. Cookie-free (public pages stay static).
 */
export const getSubnavCategories = unstable_cache(
  async (gameId: string): Promise<GameCategory[]> => {
    const supabase = createAnonClient()
    const [{ data }, { data: currencyCfg }] = await Promise.all([
      supabase
        .from('game_categories')
        .select('id, name, slug, type')
        .eq('game_id', gameId)
        .eq('is_enabled', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true }) as any,
      supabase
        .from('category_configs')
        .select('config')
        .eq('game_id', gameId)
        .eq('category_type', 'currency')
        .maybeSingle() as any,
    ])
    // The currency tab reads like its page title ("Gems", not "Currency").
    return withCurrencyNavLabel((data || []) as GameCategory[], currencyCfg?.config?.unit_label)
  },
  ['game-categories-nav'],
  // Admin category edits revalidate GAME_DIRECTORY_TAG; daily is the backstop
  // (hourly capped every category page at one hour).
  { tags: [GAME_DIRECTORY_TAG], revalidate: 86400 },
)

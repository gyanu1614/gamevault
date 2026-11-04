import 'server-only'
import { unstable_cache } from 'next/cache'

import { createAnonClient } from '@/lib/supabase/anon'
import { getGamesForGlobalCategory, getGlobalCategories, type GlobalCategory } from '@/lib/actions/new-schema'
import { GAME_DIRECTORY_TAG } from '@/lib/revalidation/tags'
import { SELL_TEMPLATE_TAG } from './template-tags'
import type { SellGameOption } from '@/lib/actions/sell-wizard'

/**
 * The sell wizard's category and game lists, cached (speed audit 2026-10-29).
 * They are the same for every seller, yet each wizard visit read them fresh:
 * three round trips in a row for the games of a category, on the critical
 * path of /sell/new (pick a category) and /sell/edit (its prefill). Game and
 * category writes revalidate GAME_DIRECTORY_TAG, template writes
 * SELL_TEMPLATE_TAG; the hour TTL only backstops script and migration
 * writes. A read error throws, so a failure is never cached as "no games".
 */
export function getSellGames(categorySlug: string): Promise<SellGameOption[]> {
  return unstable_cache(() => loadSellGames(categorySlug), ['sell-games', categorySlug], {
    tags: [GAME_DIRECTORY_TAG, SELL_TEMPLATE_TAG],
    revalidate: 3600,
  })()
}

export function getSellCategories(): Promise<GlobalCategory[]> {
  return unstable_cache(
    async () => {
      const res = await getGlobalCategories({ includeDisabled: true })
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    ['sell-categories'],
    { tags: [GAME_DIRECTORY_TAG], revalidate: 3600 },
  )()
}

async function loadSellGames(categorySlug: string): Promise<SellGameOption[]> {
  const gcRes = await getGamesForGlobalCategory(categorySlug)
  if (!gcRes.success) throw new Error(gcRes.error)
  const joins = gcRes.data
  if (joins.length === 0) return []

  const { data: games, error } = await createAnonClient()
    .from('games')
    .select('id, name, slug, image_url, cover_url, emoji, sort_order, is_active')
    .in('id', joins.map((j) => j.game_id))
    .eq('is_active', true)
  if (error) throw new Error(error.message)

  const byGameId = new Map<string, any>()
  for (const g of (games ?? []) as any[]) byGameId.set(g.id, g)

  return joins
    .map((j): SellGameOption | null => {
      const g = byGameId.get(j.game_id)
      if (!g) return null
      return {
        game_category_id: j.id,
        game_id: j.game_id,
        game_name: g.name,
        game_slug: g.slug,
        game_logo_url: g.image_url ?? null,
        game_cover_url: g.cover_url ?? null,
        game_emoji: g.emoji ?? null,
        game_sort_order: g.sort_order ?? 99,
        game_is_active: !!g.is_active,
        requires_region: j.requires_region,
        available_regions: j.available_regions ?? [],
        requires_platform: j.requires_platform,
        available_platforms: j.available_platforms ?? [],
        delivery_modes: j.delivery_modes ?? ['manual'],
      }
    })
    .filter((x): x is SellGameOption => !!x)
    .sort((a, b) => a.game_sort_order - b.game_sort_order || a.game_name.localeCompare(b.game_name))
}

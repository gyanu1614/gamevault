import { cache } from 'react'
import { createAnonClient } from '@/lib/supabase/anon'
import { resolveItemBySlug } from './_itemResolver'

/**
 * Route gate for /{gameSlug}/{categorySlug} — decides 200 / 301 / 404 before
 * anything streams, and BEFORE any listing/seller read.
 *
 * This segment is a catch-all for every two-segment URL, so scanner junk
 * (`/wp-admin/setup-config.php`) and typos land here. Order matters for cost:
 *
 *   1. game by slug            — unknown game → 404 after ONE query
 *   2. category by (game,slug) — known pair → render
 *   3. SEO item slug           — one scoped listings read → 301 to the listing
 *   4. otherwise               → 404
 *
 * Cookie-free (anon client) so the route stays static (ISR); the 404 itself is
 * then cached for the route's revalidate window. `cache()` shares the lookups
 * with generateMetadata and the page body within one render.
 */

export interface GateGame {
  id: string
  name: string
  slug: string
  image_url: string | null
  ecosystem: string | null
}

export interface GateCategory {
  id: string
  name: string
  slug: string
  description: string | null
  icon_emoji: string | null
  type: string | null
  sub_types: string[] | null
  seo_title: string | null
  seo_description: string | null
  seo_h1: string | null
  seo_intro: string | null
}

export type CategoryRouteResolution =
  | { kind: 'category'; game: GateGame; category: GateCategory }
  | { kind: 'item-redirect'; href: string }
  | { kind: 'not-found' }

export const getActiveGame = cache(async function getActiveGame(
  gameSlug: string,
): Promise<GateGame | null> {
  const supabase = createAnonClient()
  const { data, error } = (await supabase
    .from('games')
    .select('id, name, slug, image_url, ecosystem')
    .eq('slug', gameSlug)
    .eq('is_active', true)
    .single()) as { data: GateGame | null; error: unknown }
  return error || !data ? null : data
})

// STATE-012 — explicit columns instead of select('*'). Only game.id/name and
// the category fields below are read anywhere in this route; the seo_* set
// mirrors the metadata query so template resolution has what it needs.
export const getEnabledCategory = cache(async function getEnabledCategory(
  gameId: string,
  categorySlug: string,
): Promise<GateCategory | null> {
  const supabase = createAnonClient()
  const { data, error } = (await supabase
    .from('game_categories')
    .select(
      'id, name, slug, description, icon_emoji, type, sub_types, seo_title, seo_description, seo_h1, seo_intro',
    )
    .eq('slug', categorySlug)
    .eq('game_id', gameId)
    .eq('is_enabled', true)
    .single()) as { data: GateCategory | null; error: unknown }
  return error || !data ? null : data
})

/** The (game, category) pair the page body renders, or null. */
export async function getGameAndCategory(
  gameSlug: string,
  categorySlug: string,
): Promise<{ game: GateGame; category: GateCategory } | null> {
  const game = await getActiveGame(gameSlug)
  if (!game) return null
  const category = await getEnabledCategory(game.id, categorySlug)
  return category ? { game, category } : null
}

export async function resolveCategoryRoute(
  gameSlug: string,
  categorySlug: string,
): Promise<CategoryRouteResolution> {
  const game = await getActiveGame(gameSlug)
  if (!game) return { kind: 'not-found' }

  const category = await getEnabledCategory(game.id, categorySlug)
  if (category) return { kind: 'category', game, category }

  // V15 — not a category: it may be an SEO item slug
  // (/steal-a-brainrot/neon-garama-mandundung), which 301s to the canonical
  // listing URL.
  const item = await resolveItemBySlug(game.id, categorySlug)
  if (item) {
    return { kind: 'item-redirect', href: `/${gameSlug}/${item.categorySlug}/${item.listingSlug}` }
  }
  return { kind: 'not-found' }
}

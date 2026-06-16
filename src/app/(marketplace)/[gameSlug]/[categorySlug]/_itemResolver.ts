/**
 * V15 — Item-slug resolver.
 *
 * Maps `/{gameSlug}/{itemSlug}` to a single active listing under that
 * game's items category. The slug is matched against the computed
 * `buildItemSlug` for every active item listing for that game.
 *
 * Strategy:
 *   1. Fetch all active item listings for the game (capped at 500 — items
 *      pages typically have far fewer than this, and this query only
 *      fires on a slug miss, not on every category visit).
 *   2. Compute the canonical slug for each, then look for an exact match.
 *      If multiple match, prefer the one whose listing id matches the
 *      disambiguator suffix; otherwise return the most recently updated.
 *   3. Return null when nothing matches → caller 404s.
 */

import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { buildItemSlug, withDisambiguator } from '@/lib/utils/item-seo-slug'

export interface ResolvedItem {
  listingId: string
  /** category_id the listing belongs to — caller uses it to render the right page. */
  categoryId: string
  categorySlug: string
  /** V15h — stored listings.slug used to build the canonical detail URL
   *  /marketplace/{game}/{category}/{listingSlug}. Falls back to the id. */
  listingSlug: string
}

export async function resolveItemBySlug(
  gameId: string,
  rawSlug: string,
): Promise<ResolvedItem | null> {
  const slug = rawSlug.toLowerCase()
  if (!slug) return null
  const supabase = await createClient()

  // Find the per-game items category id so we can scope the lookup.
  const { data: catRow } = await supabase
    .from('categories')
    .select('id, slug')
    .eq('game_id', gameId)
    .or('slug.eq.items,metadata->>type.eq.items')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle() as any
  if (!catRow?.id) return null

  const { data: rows } = await supabase
    .from('listings')
    .select('id, slug, title, template_data, updated_at')
    .eq('game_id', gameId)
    .eq('category_id', catRow.id)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(500) as any

  if (!rows || rows.length === 0) return null

  const wrap = (row: any): ResolvedItem => ({
    listingId: row.id,
    categoryId: catRow.id,
    categorySlug: catRow.slug,
    listingSlug: (row.slug && String(row.slug).trim()) || row.id,
  })

  // Pass 1: clean-slug match.
  const matches = rows.filter((r: any) =>
    buildItemSlug({ templateData: r.template_data, title: r.title, id: r.id }) === slug,
  )

  if (matches.length >= 1) {
    // Most recent active listing wins the canonical slug; older duplicates
    // would only be reachable via the disambiguated URL.
    return wrap(matches[0])
  }

  // Pass 2: disambiguated form ("slug-<6char>").
  const disambiguated = rows.find((r: any) => {
    const base = buildItemSlug({ templateData: r.template_data, title: r.title, id: r.id })
    return withDisambiguator(base, r.id) === slug
  })
  if (disambiguated) {
    return wrap(disambiguated)
  }

  return null
}

/**
 * Global search server actions for the navbar.
 *
 * `searchAttributeOptions` matches the admin-curated filter VALUES (the
 * `attribute_options` rows — e.g. "garama", "nfr parrot") so a buyer can
 * type an in-game item name and land on the right game ▸ category with
 * that filter pre-applied.
 *
 * Chain walked:
 *   attribute_options.label
 *     → attributes (template_id, slug)
 *     → attribute_templates (game_category_id)
 *     → game_categories (game_id, global_category_id)
 *     → global_categories.slug   (canonical: items/accounts/boosting/top-up)
 *     → games (slug, name, image_url)
 *
 * The buyer-facing URL uses the `categories` table slug (e.g. `buy-items`),
 * NOT the canonical `global_categories` slug, so we map back through the
 * game's `categories` rows by their `metadata.type`.
 *
 * Reads use the service client because option labels are public catalogue
 * data and the search must work for anonymous visitors regardless of RLS.
 */

'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'

function getServiceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export interface AttrOptionHit {
  /** Buyer-facing game slug for the URL. */
  gameSlug: string
  gameName: string
  gameImage: string | null
  /** Buyer-facing category slug for the URL (from `categories`). */
  categorySlug: string
  categoryLabel: string
  /** Attribute slug — used to build the ?attr_<slug>= query param. */
  attrSlug: string
  /** Matched option slug — the pre-applied filter value. */
  optionSlug: string
  optionLabel: string
}

// Canonical global_categories slug → category `metadata.type` candidates.
// Mirrors the forward mapping in the category page (page.tsx ~L542).
const GLOBAL_TO_TYPES: Record<string, string[]> = {
  items: ['items'],
  accounts: ['account'],
  boosting: ['service'],
  'top-up': ['top_up'],
}

/**
 * Match filter option labels by substring. Returns at most `limit` hits,
 * deduped by (game, category, option). Empty array on blank/short query.
 */
export async function searchAttributeOptions(
  rawQuery: string,
  limit = 8,
): Promise<AttrOptionHit[]> {
  const q = rawQuery.trim()
  if (q.length < 2) return []

  const supabase = getServiceSupabase()

  // 1. Match option labels. Pull the attribute (slug) and walk up to the
  //    game_category → global_category → game in one nested select.
  const { data: opts, error } = await supabase
    .from('attribute_options')
    .select(
      `
      slug,
      label,
      attribute:attributes!attribute_options_attribute_id_fkey(
        slug,
        template:attribute_templates!attributes_template_id_fkey(
          game_category:game_categories!attribute_templates_game_category_id_fkey(
            game:games!game_categories_game_id_fkey(id, name, slug, image_url, is_active),
            global_category:global_categories!game_categories_global_category_id_fkey(slug)
          )
        )
      )
    `,
    )
    .ilike('label', `%${q}%`)
    .limit(limit * 4) // over-fetch; we filter + dedupe below

  if (error || !opts) return []

  // 2. Resolve each match's buyer-facing category slug. We need the
  //    `categories` row for the game whose metadata.type maps to the
  //    canonical global_category slug. Batch the category lookups per game.
  const rows = opts as any[]
  const gameIds = Array.from(
    new Set(
      rows
        .map((r) => r.attribute?.template?.game_category?.game?.id)
        .filter(Boolean),
    ),
  )
  if (gameIds.length === 0) return []

  const { data: cats } = await supabase
    .from('categories')
    .select('slug, name, game_id, metadata, is_active')
    .in('game_id', gameIds)
    .eq('is_active', true)

  // (game_id, type) → { slug, name }. First active category wins.
  const catByGameType = new Map<string, { slug: string; name: string }>()
  for (const c of (cats ?? []) as any[]) {
    const type = (c.metadata?.type as string | undefined) ?? 'items'
    const key = `${c.game_id}:${type}`
    if (!catByGameType.has(key)) {
      catByGameType.set(key, { slug: c.slug, name: c.name })
    }
  }

  const seen = new Set<string>()
  const hits: AttrOptionHit[] = []
  for (const r of rows) {
    const gc = r.attribute?.template?.game_category
    const game = gc?.game
    const globalSlug = gc?.global_category?.slug as string | undefined
    const attrSlug = r.attribute?.slug as string | undefined
    if (!game?.slug || !game.is_active || !globalSlug || !attrSlug) continue

    // Resolve the buyer category slug from the canonical global slug.
    const types = GLOBAL_TO_TYPES[globalSlug] ?? [globalSlug]
    let cat: { slug: string; name: string } | undefined
    for (const t of types) {
      cat = catByGameType.get(`${game.id}:${t}`)
      if (cat) break
    }
    if (!cat) continue

    const dedupeKey = `${game.slug}|${cat.slug}|${r.slug}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)

    hits.push({
      gameSlug: game.slug,
      gameName: game.name,
      gameImage: game.image_url ?? null,
      categorySlug: cat.slug,
      categoryLabel: cat.name,
      attrSlug,
      optionSlug: r.slug,
      optionLabel: r.label,
    })
    if (hits.length >= limit) break
  }

  return hits
}

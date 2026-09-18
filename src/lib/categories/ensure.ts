/**
 * ensureGameCategory — the ONE way a (game, global category) pair comes into
 * existence. The admin wizard, scripts/seed-games.mjs and any later script
 * (Step 2 trend radar) all go through here, so a category created from a
 * script is wired exactly like one created in the wizard.
 *
 * Import-free on purpose: Node loads this file directly with
 * --experimental-strip-types (see scripts/seed-games.mjs), where `@/` aliases
 * and extensionless relative imports do not resolve. The two TS-side deps
 * (canonical slug rule, default currency config) are injected; app code
 * imports the pre-wired wrapper from `@/lib/categories` instead.
 *
 * Idempotent: an existing pair is returned untouched unless the caller passes
 * a field to change. Never deletes; never flips is_enabled unless asked.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export interface EnsureGameCategoryInput {
  gameId: string
  /** global_categories.slug — 'currency' | 'items' | 'accounts' | 'top-up' | 'boosting' | a sub-category. */
  globalSlug: string
  /** URL segment override. Defaults to the canonical slug for the type (currency → buy-{name}) or the global's default_slug. */
  slug?: string
  /** Per-game display name override. Defaults to the global's name. */
  name?: string
  /** Set only when the caller wants to change it. New pairs default to true. */
  enabled?: boolean
}

export interface EnsureGameCategoryDeps {
  /** lib/utils/category-canonical getCanonicalCategorySlug — (gameSlug, type) → slug | null. */
  canonicalSlug: (gameSlug: string, type: string) => string | null
  /** lib/types/category-configs DEFAULT_CURRENCY_CONFIG — seeded for new currency pairs. */
  currencyConfig: unknown
}

export interface EnsureGameCategoryResult {
  id: string
  created: boolean
  slug: string
  type: string
  is_enabled: boolean
}

type Client = SupabaseClient<any, any, any, any, any>

export async function ensureGameCategory(
  supabase: Client,
  input: EnsureGameCategoryInput,
  deps: EnsureGameCategoryDeps,
): Promise<EnsureGameCategoryResult> {
  const { data: global, error: gErr } = await supabase
    .from('global_categories')
    .select('id, slug, name, description, icon_emoji, default_type, default_slug, parent_id')
    .eq('slug', input.globalSlug)
    .maybeSingle()
  if (gErr) throw new Error(`global_categories lookup failed: ${gErr.message}`)
  if (!global) throw new Error(`unknown global category slug: ${input.globalSlug}`)

  const { data: existing, error: eErr } = await supabase
    .from('game_categories')
    .select('id, slug, type, is_enabled')
    .eq('game_id', input.gameId)
    .eq('global_category_id', global.id)
    .maybeSingle()
  if (eErr) throw new Error(`game_categories lookup failed: ${eErr.message}`)

  if (existing) {
    const patch: Record<string, unknown> = {}
    if (input.enabled !== undefined && input.enabled !== existing.is_enabled) patch.is_enabled = input.enabled
    if (input.slug !== undefined && input.slug !== existing.slug) patch.slug = input.slug
    if (input.name !== undefined) patch.name = input.name
    if (Object.keys(patch).length > 0) {
      const { error } = await supabase.from('game_categories').update(patch).eq('id', existing.id)
      if (error) throw new Error(`game_categories update failed: ${error.message}`)
    }
    return {
      id: existing.id,
      created: false,
      slug: (patch.slug as string | undefined) ?? existing.slug,
      type: existing.type,
      is_enabled: (patch.is_enabled as boolean | undefined) ?? existing.is_enabled,
    }
  }

  const { data: game, error: gameErr } = await supabase
    .from('games')
    .select('slug')
    .eq('id', input.gameId)
    .maybeSingle()
  if (gameErr) throw new Error(`games lookup failed: ${gameErr.message}`)
  if (!game) throw new Error(`unknown game id: ${input.gameId}`)

  // Sub-categories keep their own established slug (limiteds, buy-skins…);
  // primaries follow the SEO rule so currency becomes buy-{name}.
  const slug =
    input.slug ??
    (global.parent_id
      ? global.default_slug
      : deps.canonicalSlug(game.slug, global.default_type) ?? global.default_slug)

  const { data: created, error: cErr } = await supabase
    .from('game_categories')
    .insert({
      game_id: input.gameId,
      global_category_id: global.id,
      is_enabled: input.enabled ?? true,
      slug,
      name: input.name ?? global.name,
      description: global.description,
      type: global.default_type,
      icon_emoji: global.icon_emoji,
    })
    .select('id, slug, type, is_enabled')
    .single()
  if (cErr || !created) {
    throw new Error(`game_categories insert failed for ${game.slug}/${slug}: ${cErr?.message ?? 'no row'}`)
  }

  // V19/P5 — a currency page needs a category_configs row or it falls back
  // to the legacy layout. INSERT … ON CONFLICT DO NOTHING keeps a tuned row.
  if (created.type === 'currency') {
    const { error } = await supabase
      .from('category_configs')
      .upsert(
        { game_id: input.gameId, category_type: 'currency', config: deps.currencyConfig },
        { onConflict: 'game_id,category_type', ignoreDuplicates: true },
      )
    if (error) throw new Error(`category_configs seed failed: ${error.message}`)
  }

  return { id: created.id, created: true, slug: created.slug, type: created.type, is_enabled: created.is_enabled }
}

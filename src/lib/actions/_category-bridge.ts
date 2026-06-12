/**
 * Helpers that bridge the NEW schema (global_categories + game_categories
 * join) and the LEGACY public.categories table that listings.category_id
 * still points at.
 *
 * Used by:
 *   - publishListing (sell-wizard.ts) — finds or creates the legacy row
 *     so the inserted listing has a valid category_id FK.
 *   - upsertGameCategory (admin-game-wizard.ts) — keeps the legacy table
 *     in sync when an admin enables a (game, category) pair.
 *
 * The mapping is intentionally bidirectional and authoritative — anywhere
 * else that needs to translate between global category slug and legacy
 * metadata.type should import these.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ─── slug ↔ metadata.type mapping (single source of truth) ───────────────────

export const GLOBAL_SLUG_TO_LEGACY_TYPE: Record<string, string> = {
  'currency': 'currency',
  'items':    'items',
  'accounts': 'account',
  'top-up':   'top_up',
  'boosting': 'service',
}

/** Reverse of the above — for code paths that read legacy and need the slug. */
export const LEGACY_TYPE_TO_GLOBAL_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(GLOBAL_SLUG_TO_LEGACY_TYPE).map(([k, v]) => [v, k])
)

/** Display names and default metadata when we synthesise a legacy row. */
const GLOBAL_SLUG_DEFAULTS: Record<string, { name: string; slug: string; icon: string; description: string }> = {
  'currency': { name: 'Currency', slug: 'currency', icon: '💰', description: 'In-game currency' },
  'items':    { name: 'Items',    slug: 'items',    icon: '🎒', description: 'In-game items' },
  'accounts': { name: 'Accounts', slug: 'accounts', icon: '👤', description: 'Game accounts' },
  'top-up':   { name: 'Top Up',   slug: 'top-up',   icon: '⚡', description: 'Official top-ups' },
  'boosting': { name: 'Boosting', slug: 'boosting', icon: '🚀', description: 'Boosting services' },
}

// ─── Operations ──────────────────────────────────────────────────────────────

/**
 * Look up the legacy categories.id for a (game_id, global_category_slug)
 * pair, creating the row if it doesn't exist. Returns the id or null on
 * failure (caller decides whether that's a hard error).
 *
 * Pass a service-role supabase client for write access — the categories
 * table is RLS-protected and only admins can insert via the user client.
 */
export async function ensureLegacyCategoryRow(
  supabase: SupabaseClient<any>,
  gameId: string,
  globalCategorySlug: string,
): Promise<string | null> {
  const legacyType = GLOBAL_SLUG_TO_LEGACY_TYPE[globalCategorySlug]
  if (!legacyType) return null

  // Look for an existing matching row first (any is_active state).
  const { data: existing } = await supabase
    .from('categories')
    .select('id, is_active')
    .eq('game_id', gameId)
    .filter('metadata->>type', 'eq', legacyType)
    .maybeSingle()

  if (existing) {
    const row = existing as { id: string; is_active: boolean }
    // If it exists but is inactive, flip it back on — the admin enabling
    // (game, category) in the new wizard is the source of truth now.
    if (!row.is_active) {
      await supabase.from('categories').update({ is_active: true }).eq('id', row.id)
    }
    return row.id
  }

  // Doesn't exist — synthesise it.
  const defaults = GLOBAL_SLUG_DEFAULTS[globalCategorySlug]
  if (!defaults) return null

  const { data: created, error } = await supabase
    .from('categories')
    .insert({
      game_id: gameId,
      name: defaults.name,
      slug: defaults.slug,
      icon: defaults.icon,
      description: defaults.description,
      display_order: 0,
      is_active: true,
      metadata: { type: legacyType },
    })
    .select('id')
    .single()

  if (error || !created) return null
  return (created as { id: string }).id
}

/**
 * Mark a (game_id, global_category_slug) pair as inactive in the legacy
 * categories table. Used when admin DISABLES the pair in the wizard.
 * We don't delete the row — listings might still reference it, and a
 * delete would cascade them away. Just hide it.
 */
export async function deactivateLegacyCategoryRow(
  supabase: SupabaseClient<any>,
  gameId: string,
  globalCategorySlug: string,
): Promise<void> {
  const legacyType = GLOBAL_SLUG_TO_LEGACY_TYPE[globalCategorySlug]
  if (!legacyType) return

  await supabase
    .from('categories')
    .update({ is_active: false })
    .eq('game_id', gameId)
    .filter('metadata->>type', 'eq', legacyType)
}

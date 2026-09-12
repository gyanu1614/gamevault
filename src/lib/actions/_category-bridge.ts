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
import { getCanonicalCategorySlug, type CategoryType } from '@/lib/utils/category-canonical'
import { DEFAULT_CURRENCY_CONFIG } from '@/lib/types/category-configs'

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

/**
 * Display name + icon defaults for when we synthesise a legacy row.
 * Slug is intentionally NOT in here anymore — we derive it from the
 * canonical slug resolver so every newly-created row follows the SEO
 * pattern (buy-{currency} / buy-accounts / buy-items / boosting /
 * top-up). See lib/utils/category-canonical.ts.
 */
const GLOBAL_SLUG_DEFAULTS: Record<string, { name: string; icon: string; description: string }> = {
  'currency': { name: 'Currency', icon: '💰', description: 'In-game currency' },
  'items':    { name: 'Items',    icon: '🎒', description: 'In-game items' },
  'accounts': { name: 'Accounts', icon: '👤', description: 'Game accounts' },
  'top-up':   { name: 'Top Up',   icon: '⚡', description: 'Official top-ups' },
  'boosting': { name: 'Boosting', icon: '🚀', description: 'Boosting services' },
}

// ─── Operations ──────────────────────────────────────────────────────────────

/**
 * AUTH-010 — is (game_id, global_category_slug) an admin-enabled pair?
 *
 * Reads `game_categories` (public SELECT policy already restricts to
 * `is_enabled = true`) joined by slug to an active `global_categories` row.
 * Seller-facing publish paths call this with the SESSION client before any
 * service-role catalogue access, so a signed-in user can only make the
 * bridge act on pairs an admin has explicitly switched on.
 */
export async function isEnabledGameCategory(
  // Accepts both the typed session client and the untyped service client.
  supabase: SupabaseClient<any, any, any, any, any>,
  gameId: string,
  globalCategorySlug: string,
): Promise<boolean> {
  const { data: gc } = await supabase
    .from('global_categories')
    .select('id')
    .eq('slug', globalCategorySlug)
    .eq('is_active', true)
    .maybeSingle()
  const gcId = (gc as { id: string } | null)?.id
  if (!gcId) return false

  const { data: pair } = await supabase
    .from('game_categories')
    .select('id')
    .eq('game_id', gameId)
    .eq('global_category_id', gcId)
    .eq('is_enabled', true)
    .maybeSingle()
  return Boolean((pair as { id: string } | null)?.id)
}

/**
 * Look up the legacy categories.id for a (game_id, global_category_slug)
 * pair, creating the row if it doesn't exist. Returns the id or null on
 * failure (caller decides whether that's a hard error).
 *
 * Pass a service-role supabase client for write access — the categories
 * table is RLS-protected and only admins can insert via the user client.
 *
 * AUTH-010: because this runs under the service role, every non-admin caller
 * MUST first pass `isEnabledGameCategory` for the same (game, slug) pair, and
 * must NOT pass `reactivate` — see publishListing / bulkPublishListings.
 */
export async function ensureLegacyCategoryRow(
  supabase: SupabaseClient<any>,
  gameId: string,
  globalCategorySlug: string,
  opts: { reactivate?: boolean } = {},
): Promise<string | null> {
  const legacyType = GLOBAL_SLUG_TO_LEGACY_TYPE[globalCategorySlug]
  if (!legacyType) return null

  // Resolve the game slug up front — we need it both to pick the canonical
  // row among duplicates and to synthesise a new row's slug.
  const { data: gameRow } = await supabase
    .from('games')
    .select('slug')
    .eq('id', gameId)
    .maybeSingle()
  const gameSlug = (gameRow as { slug: string } | null)?.slug ?? ''

  const canonicalSlug =
    getCanonicalCategorySlug(gameSlug, legacyType as CategoryType) ?? globalCategorySlug

  // Look for existing matching rows (any is_active state).
  //
  // V24 — A game can now legitimately have MORE THAN ONE legacy categories
  // row sharing the same metadata.type. The new admin lets admins add
  // sub-categories like "Limiteds" alongside "Items" — both carry
  // metadata.type='items'. The old `.maybeSingle()` errored on that
  // ("cannot coerce to single object"), which surfaced as the seller-facing
  // "Couldn't resolve a category" bug. So fetch ALL matches and pick
  // deterministically: prefer the canonical-slug row (e.g. buy-items) so
  // listings land in the primary browse category, then any active row,
  // then the first.
  const { data: matches } = await supabase
    .from('categories')
    .select('id, is_active, slug')
    .eq('game_id', gameId)
    .filter('metadata->>type', 'eq', legacyType)

  const rows = (matches ?? []) as { id: string; is_active: boolean; slug: string }[]
  if (rows.length > 0) {
    const chosen =
      rows.find((r) => r.slug === canonicalSlug) ??
      rows.find((r) => r.is_active) ??
      rows[0]
    // AUTH-010 — only the admin wizard (opts.reactivate) may flip an
    // admin-deactivated row back on. A seller publish path that lands on an
    // inactive-only row gets null and a "contact support" error instead of
    // silently undoing the admin's deactivateLegacyCategoryRow.
    if (!chosen.is_active) {
      if (!opts.reactivate) return null
      await supabase.from('categories').update({ is_active: true }).eq('id', chosen.id)
    }
    return chosen.id
  }

  // Doesn't exist — synthesise it with the SEO-canonical slug.
  const defaults = GLOBAL_SLUG_DEFAULTS[globalCategorySlug]
  if (!defaults) return null

  const { data: created, error } = await supabase
    .from('categories')
    .insert({
      game_id: gameId,
      name: defaults.name,
      slug: canonicalSlug,
      icon: defaults.icon,
      description: defaults.description,
      display_order: 0,
      is_active: true,
      metadata: { type: legacyType },
    })
    .select('id')
    .single()

  if (error || !created) return null

  // V19/P5 — Auto-seed a category_configs row for currency categories.
  // Without this, new games created via the admin wizard fall back to
  // the legacy CategoryPageLayout because getCurrencyShell finds no
  // config. We INSERT ... ON CONFLICT DO NOTHING (Supabase upsert with
  // ignoreDuplicates) so an existing manually-tuned row is preserved.
  if (legacyType === 'currency') {
    await (supabase.from('category_configs') as any).upsert(
      {
        game_id: gameId,
        category_type: 'currency',
        config: DEFAULT_CURRENCY_CONFIG,
      },
      { onConflict: 'game_id,category_type', ignoreDuplicates: true },
    )
  }

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

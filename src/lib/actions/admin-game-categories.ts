/**
 * Admin reads of game ↔ category state for the redesigned admin pages.
 *
 * Phase B (parallel route, additive): used only by /admin/games and the
 * new game wizard. Nothing in the live app calls these. Safe to evolve.
 */

'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/actions/admin-permissions'

// Service-role client — bypasses RLS for admin reads (matches admin-games.ts pattern)
function getAdminSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export interface AdminGameCategoryBadge {
  game_id: string
  game_category_id: string
  global_category_id: string
  category_slug: string   // global_categories.slug — stable, used as a key
  category_name: string
  icon_emoji: string | null
  is_enabled: boolean
  is_active_global: boolean  // global category active flag (Boosting=false at launch)
}

/**
 * Fetch every (game, category) badge across all games in one query.
 *
 * V17n — Rewritten to read from the LEGACY `categories` table as the
 * primary source. The previous version read from `game_categories`
 * (Phase A's join table), which only gets populated when the Phase A
 * backfill migration runs. On DBs where Phase A never ran, that query
 * returned empty and every game showed "none enabled" in the admin.
 *
 * Strategy:
 *   1. Read all active rows from `categories` (the marketplace source
 *      of truth — also what we just canonicalized in V17g).
 *   2. Map their metadata.type → global_category slug so the admin UI
 *      still has the global-category names + icons to render.
 *   3. Join in `global_categories` for those names/icons. If a global
 *      row is missing we fall back to a sensible default from the
 *      category's own name field.
 */
export async function fetchAdminGameCategoryBadges(): Promise<AdminGameCategoryBadge[]> {
  await requireAdmin()
  const supabase = getAdminSupabase()

  // Map legacy categories.metadata.type → global slug. Mirrors the
  // bridge in _category-bridge.ts and Phase A's migration logic.
  const TYPE_TO_GLOBAL_SLUG: Record<string, string> = {
    currency: 'currency',
    items: 'items',
    account: 'accounts',
    top_up: 'top-up',
    service: 'boosting',
  }

  const [catsRes, globalsRes] = await Promise.all([
    supabase
      .from('categories')
      .select('id, game_id, name, slug, icon, metadata, is_active'),
    supabase
      .from('global_categories')
      .select('id, slug, name, icon_emoji, is_active'),
  ])

  if (catsRes.error || !catsRes.data) return []

  // Build a lookup for global category metadata by slug.
  const globalsBySlug = new Map<string, any>()
  for (const g of (globalsRes.data ?? []) as any[]) {
    globalsBySlug.set(g.slug, g)
  }

  return (catsRes.data as any[])
    .filter((row) => !!row.is_active && !!row.game_id)
    .map((row) => {
      const type: string | undefined = row.metadata?.type
      const globalSlug = type ? TYPE_TO_GLOBAL_SLUG[type] : undefined
      const global = globalSlug ? globalsBySlug.get(globalSlug) : undefined
      return {
        game_id: row.game_id,
        // Use the legacy category id as the row identifier — there's no
        // game_categories row guaranteed to exist for it.
        game_category_id: row.id,
        global_category_id: global?.id ?? row.id,
        category_slug: globalSlug ?? row.slug,
        // Prefer the global category's display name, fall back to the
        // per-game category's name (e.g. "V-Bucks" vs generic "Currency").
        category_name: row.name ?? global?.name ?? globalSlug ?? 'Category',
        icon_emoji: row.icon ?? global?.icon_emoji ?? null,
        is_enabled: true,
        is_active_global: global ? !!global.is_active : true,
      }
    })
}

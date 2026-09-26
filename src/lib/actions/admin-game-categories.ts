/**
 * Admin reads of game ↔ category state for the redesigned admin pages.
 *
 * Used by /admin/games and the game wizard.
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
 * Fetch every enabled (game, category) badge across all games in one query.
 *
 * Step 1b — reads game_categories (the only category table) joined with
 * global_categories for the stable slug + icon. Sub-category rows (global
 * parent_id set) are included so the badge list shows what is live.
 */
export async function fetchAdminGameCategoryBadges(): Promise<AdminGameCategoryBadge[]> {
  await requireAdmin()
  const supabase = getAdminSupabase()

  const { data, error } = await supabase
    .from('game_categories')
    .select(`
      id, game_id, global_category_id, is_enabled, name, icon_emoji, sort_order,
      global_category:global_categories!game_categories_global_category_id_fkey(slug, name, icon_emoji, is_active)
    `)
    .eq('is_enabled', true)
    .order('sort_order', { ascending: true })

  if (error || !data) return []

  return (data as any[]).map((row) => ({
    game_id: row.game_id,
    game_category_id: row.id,
    global_category_id: row.global_category_id,
    category_slug: row.global_category?.slug ?? '',
    // Prefer the per-game display name (e.g. "V-Bucks" vs generic "Currency").
    category_name: row.name ?? row.global_category?.name ?? 'Category',
    icon_emoji: row.icon_emoji ?? row.global_category?.icon_emoji ?? null,
    is_enabled: true,
    is_active_global: !!row.global_category?.is_active,
  }))
}

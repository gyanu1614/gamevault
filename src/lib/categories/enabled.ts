/**
 * AUTH-010 — is (game_id, global_category_slug) an admin-enabled pair, and
 * which game_categories row is it?
 *
 * Seller-facing publish paths call this with the SESSION client before any
 * service-role write, so a signed-in user can only publish into pairs an
 * admin has explicitly switched on. Both filters are explicit here (the
 * public SELECT policy on game_categories is USING (true) for parity with
 * the legacy table — see migration 20260917190852).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CategoryType } from '@/lib/utils/category-canonical'

export interface EnabledGameCategory {
  id: string
  slug: string
  name: string
  type: CategoryType
  /** Phase A only: the mirrored public.categories row. Dropped in Phase B. */
  legacy_category_id: string | null
}

type Client = SupabaseClient<any, any, any, any, any>

export async function findEnabledGameCategory(
  supabase: Client,
  gameId: string,
  globalCategorySlug: string,
): Promise<EnabledGameCategory | null> {
  const { data: gc } = await supabase
    .from('global_categories')
    .select('id, parent_id')
    .eq('slug', globalCategorySlug)
    .eq('is_active', true)
    .maybeSingle()
  const gcId = (gc as { id: string; parent_id: string | null } | null)?.id
  if (!gcId) return null

  // A sub-category (limiteds, coaching, …) inherits its primary's switch:
  // with boosting disabled globally, coaching / servers are not publishable
  // either, exactly as before the sub-categories existed as global rows.
  const parentId = (gc as { parent_id: string | null }).parent_id
  if (parentId) {
    const { data: parent } = await supabase
      .from('global_categories')
      .select('id')
      .eq('id', parentId)
      .eq('is_active', true)
      .maybeSingle()
    if (!(parent as { id: string } | null)?.id) return null
  }

  const { data: pair } = await supabase
    .from('game_categories')
    .select('id, slug, name, type, legacy_category_id')
    .eq('game_id', gameId)
    .eq('global_category_id', gcId)
    .eq('is_enabled', true)
    .maybeSingle()
  return (pair as EnabledGameCategory | null) ?? null
}

export async function isEnabledGameCategory(
  supabase: Client,
  gameId: string,
  globalCategorySlug: string,
): Promise<boolean> {
  return Boolean(await findEnabledGameCategory(supabase, gameId, globalCategorySlug))
}

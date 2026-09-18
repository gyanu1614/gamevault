/**
 * One category system (Step 1b). global_categories is the taxonomy,
 * game_categories is the per-game row every page and listing points at.
 *
 *   ensureGameCategory     — create / update a (game, global) pair. Wizard,
 *                            seeder and scripts all use it.
 *   findEnabledGameCategory — AUTH-010 gate for seller publish paths.
 *
 * Phase A rollback note: public.categories and listings.category_id are kept
 * in sync by two DB triggers, so pointing readers back at the legacy table is
 * a `git revert` of the reader commit — no data migration.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { getCanonicalCategorySlug, type CategoryType } from '@/lib/utils/category-canonical'
import { DEFAULT_CURRENCY_CONFIG } from '@/lib/types/category-configs'
import {
  ensureGameCategory as ensureGameCategoryCore,
  type EnsureGameCategoryInput,
  type EnsureGameCategoryResult,
} from './ensure'

export type { EnsureGameCategoryInput, EnsureGameCategoryResult }
export { findEnabledGameCategory, isEnabledGameCategory, type EnabledGameCategory } from './enabled'
export { CATEGORY_TYPES, isCategoryType, type CategoryType } from '@/lib/utils/category-canonical'

const deps = {
  canonicalSlug: (gameSlug: string, type: string) => getCanonicalCategorySlug(gameSlug, type as CategoryType),
  currencyConfig: DEFAULT_CURRENCY_CONFIG,
}

/** Service-role client required — game_categories has admin-only write policies. */
export function ensureGameCategory(
  supabase: SupabaseClient<any, any, any, any, any>,
  input: EnsureGameCategoryInput,
): Promise<EnsureGameCategoryResult> {
  return ensureGameCategoryCore(supabase, input, deps)
}

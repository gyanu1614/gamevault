/**
 * fees/config — DB-backed fee configuration (server-side).
 *
 * Loads the admin-editable fee tables (category_fee_config, game_fee_overrides,
 * seller_tier_config.fee_multiplier) into a FeeConfigSnapshot for the pure
 * calculators in lib/fees. Falls back to DEFAULT_FEE_CONFIG when the DB is
 * unreachable or a migration hasn't been applied yet.
 *
 * Short in-process cache (5 min) — fee config changes rarely, and every order
 * snapshots its applied rate anyway. Admin fee actions call
 * invalidateFeeConfigCache() after writes.
 */

import { createClient } from '@supabase/supabase-js'
import {
  DEFAULT_FEE_CONFIG,
  type FeeCategory,
  type FeeConfigSnapshot,
} from '@/lib/fees'

let _cache: FeeConfigSnapshot | null = null
let _cacheExpiry = 0

const CACHE_TTL_MS = 5 * 60 * 1000

export async function loadFeeConfig(): Promise<FeeConfigSnapshot> {
  if (_cache && Date.now() < _cacheExpiry) return _cache

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    const [categoriesRes, overridesRes, multipliersRes] = await Promise.all([
      supabase.from('category_fee_config').select('category, base_pct, rank_discount'),
      supabase.from('game_fee_overrides').select('game_slug, category, pct').eq('active', true),
      supabase.from('seller_tier_config').select('tier, fee_multiplier'),
    ])

    if (
      categoriesRes.error ||
      !categoriesRes.data ||
      categoriesRes.data.length === 0
    ) {
      console.warn('[fees/config] category_fee_config not available, using defaults')
      return DEFAULT_FEE_CONFIG
    }

    const categories = { ...DEFAULT_FEE_CONFIG.categories }
    for (const row of categoriesRes.data) {
      categories[row.category as FeeCategory] = {
        basePct: Number(row.base_pct),
        rankDiscount: !!row.rank_discount,
      }
    }

    const gameOverrides: Record<string, number> = {}
    for (const row of overridesRes.data ?? []) {
      gameOverrides[`${String(row.game_slug).toLowerCase()}:${row.category}`] = Number(row.pct)
    }

    const multipliers = { ...DEFAULT_FEE_CONFIG.multipliers }
    for (const row of multipliersRes.data ?? []) {
      if (row.fee_multiplier != null) multipliers[row.tier as string] = Number(row.fee_multiplier)
    }

    _cache = { categories, gameOverrides, multipliers }
    _cacheExpiry = Date.now() + CACHE_TTL_MS
    return _cache
  } catch (err) {
    console.warn('[fees/config] Exception loading fee config, using defaults:', err)
    return DEFAULT_FEE_CONFIG
  }
}

/** Invalidate after admin fee edits so the next order picks up new rates. */
export function invalidateFeeConfigCache() {
  _cache = null
  _cacheExpiry = 0
}

/**
 * tier-commission.ts
 *
 * ⚠️ DEPRECATED (12 Jul 2026, fee spec): checkout/orders now use the
 * per-category commission in src/lib/fees. No call sites remain; kept
 * only because the admin seller_tier_config UI still reads the table.
 * Remove together with that admin surface.
 *
 * Single source of truth for commission-rate lookups.
 * Reads from the `seller_tier_config` DB table so rates are
 * always in sync with the migration — no more hardcoded values.
 *
 * Returns a PERCENTAGE (e.g. 8.9 for 0.0890) to be compatible
 * with the `platformFeeRate / 100` usage in the checkout/order flow
 * (checkout.ts, orders.ts).
 *
 * Uses a short in-process cache (5 min) to avoid a round-trip on
 * every checkout — safe because tier configs change very rarely.
 */

import { createClient } from '@supabase/supabase-js'

// ── In-process cache ──────────────────────────────────────────────────────────

let _cache: Map<string, number> | null = null
let _cacheExpiry = 0

// Hardcoded fallback rates (used before the migration is applied or if DB is down)
const FALLBACK_RATES: Record<string, number> = {
  unverified: 9.9,
  bronze: 8.9,
  silver: 7.9,
  gold: 6.9,
  platinum: 5.9,
  diamond: 4.9,
}

async function loadRates(): Promise<Map<string, number>> {
  if (_cache && Date.now() < _cacheExpiry) return _cache

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await supabase
      .from('seller_tier_config')
      .select('tier, commission_rate')

    if (error || !data || data.length === 0) {
      console.warn('[tier-commission] seller_tier_config not available, using fallback rates')
      return new Map(Object.entries(FALLBACK_RATES))
    }

    const map = new Map<string, number>()
    for (const row of data) {
      // commission_rate is stored as decimal (0.0890); convert to pct (8.9)
      map.set(row.tier as string, parseFloat(row.commission_rate) * 100)
    }

    _cache = map
    _cacheExpiry = Date.now() + 5 * 60 * 1000 // 5-minute TTL
    return map
  } catch (err) {
    console.warn('[tier-commission] Exception loading rates, using fallback:', err)
    return new Map(Object.entries(FALLBACK_RATES))
  }
}

// ── Public helper ─────────────────────────────────────────────────────────────

/**
 * Returns the commission rate as a PERCENTAGE for the given tier.
 * e.g. "bronze" → 8.9, "gold" → 6.9, "unverified" → 9.9
 *
 * Falls back to 9.9 (unverified rate) if the tier is unknown or the
 * DB is unreachable.
 */
export async function getCommissionRate(tier: string | null | undefined): Promise<number> {
  const rates = await loadRates()
  const key = (tier ?? 'unverified').toLowerCase()
  // Direct match → else fall through to 'unverified' → else hardcoded default
  return rates.get(key) ?? rates.get('unverified') ?? 9.9
}

/** Invalidate the in-process cache (call after running the seed migration). */
export function invalidateTierRateCache() {
  _cache = null
  _cacheExpiry = 0
}

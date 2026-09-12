'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { TIERS, DEFAULT_TIER } from '@/lib/seller/tiers'

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ─── Hardcoded fallback (used when the config table is empty / unreadable) ────
// Derived from the single tier source of truth so it never drifts from the DB.

const FALLBACK_TIER_CONFIGS = TIERS.map((t) => ({
  tier: t.key,
  display_name: t.label,
  description: t.description,
  gmv_90d_min: t.thresholds.gmv90d,
  orders_90d_min: t.thresholds.orders90d,
  positive_rating_min: t.thresholds.positivePct,
  min_completion_rate: t.thresholds.completionPct,
  fee_multiplier: t.feeMultiplier,
  commission_rate: t.commissionRate,
  listing_limit: t.listingLimit,
  banner_access: t.bannerAccess,
  badge_color: t.colors.badgeColor,
  sort_order: t.sortOrder,
}))

// ─── All tier configs (public, no auth needed) ────────────────────────────────

export async function getAllTierConfigs() {
  try {
    const supabase = getServiceClient()
    const { data, error } = await supabase
      .from('seller_tier_config')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error || !data || data.length === 0) {
      // Migration not applied yet — return hardcoded data
      return FALLBACK_TIER_CONFIGS
    }
    return data
  } catch {
    return FALLBACK_TIER_CONFIGS
  }
}

// ─── Current seller's tier info + trailing-90-day window stats ────────────────

export interface MyTierInfo {
  current_tier: string
  eligible_tier: string
  tier_strikes: number
  commission_rate: number
  fee_multiplier: number
  banner_access: boolean
  /** Trailing-90-day window facts (what promotion/demotion actually uses). */
  window_gmv: number
  window_orders: number
  window_positive_pct: number | null
  window_completion_pct: number
  next_tier: string | null
  next_fee_multiplier: number | null
  next_gmv_90d_min: number | null
  next_orders_90d_min: number | null
  next_positive_rating_min: number | null
  next_completion_min: number | null
}

export async function getMyTierInfo(): Promise<{ tierInfo: MyTierInfo } | null> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const service = getServiceClient()

  // The RPC computes the same trailing-90-day window facts the rank engine
  // uses (counted GMV with the single-buyer cap, orders, % positive,
  // completion), so the page shows exactly what promotions are judged on.
  const { data: tierInfo, error: tierError } = await service.rpc(
    'get_seller_tier_info',
    { p_user_id: user.id }
  )

  if (!tierError && tierInfo && (tierInfo as any).window_gmv !== undefined) {
    return { tierInfo: tierInfo as unknown as MyTierInfo }
  }

  // RPC (new shape) not available — migration not applied yet. Fall back to
  // the profile tier + static config with an empty window.
  console.warn('[getMyTierInfo] RPC unavailable/stale, using fallback tier config')
  const { data: profile } = await service
    .from('profiles')
    .select('seller_tier, tier_strikes')
    .eq('id', user.id)
    .single()

  const currentTier = (profile?.seller_tier as string) ?? DEFAULT_TIER
  const tierConfig = FALLBACK_TIER_CONFIGS.find(t => t.tier === currentTier)
    ?? FALLBACK_TIER_CONFIGS[0]
  const nextConfig = FALLBACK_TIER_CONFIGS.find(t => t.sort_order === tierConfig.sort_order + 1) ?? null

  return {
    tierInfo: {
      current_tier: currentTier,
      eligible_tier: currentTier, // can't compute without SQL function
      tier_strikes: (profile as any)?.tier_strikes ?? 0,
      commission_rate: tierConfig.commission_rate,
      fee_multiplier: tierConfig.fee_multiplier,
      banner_access: tierConfig.banner_access,
      window_gmv: 0,
      window_orders: 0,
      window_positive_pct: null,
      window_completion_pct: 100,
      next_tier: nextConfig?.tier ?? null,
      next_fee_multiplier: nextConfig?.fee_multiplier ?? null,
      next_gmv_90d_min: nextConfig?.gmv_90d_min ?? null,
      next_orders_90d_min: nextConfig?.orders_90d_min ?? null,
      next_positive_rating_min: nextConfig?.positive_rating_min ?? null,
      next_completion_min: nextConfig?.min_completion_rate ?? null,
    },
  }
}

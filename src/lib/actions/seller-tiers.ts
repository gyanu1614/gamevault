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
  min_sales: t.thresholds.minSales,
  min_rating: t.thresholds.minRating,
  min_age_days: t.thresholds.minAgeDays,
  min_completion_rate: t.thresholds.minCompletionRate,
  // Rank steps are DATA (seller_tier_config.discount_pts, fee engine); the
  // TS fallback claims no discount rather than inventing a ladder.
  discount_pts: 0,
  // Same rule for the volume bars (the real rank criteria since the volume
  // ranks): no numbers are claimed when the table can't be read.
  gmv_90d_min: null,
  orders_90d_min: null,
  positive_rating_min: null,
  pre_moderation_listings: t.preModerationListings,
  bulk_daily_cap: null,
  listing_limit: t.listingLimit,
  banner_access: t.bannerAccess,
  badge_color: t.colors.badgeColor,
  sort_order: t.sortOrder,
}))

// ─── Platform fee settings the tier pages quote (floor) ───────────────────────

export async function getRankFloorPct(): Promise<number | null> {
  try {
    const { data } = await getServiceClient().from('platform_fee_settings').select('rank_floor_pct').eq('id', true).maybeSingle()
    const v = Number((data as any)?.rank_floor_pct)
    return Number.isFinite(v) ? v : null
  } catch {
    return null
  }
}

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

// ─── Current seller's rank + 90-day window facts ──────────────────────────────

export interface MyTierInfo {
  /** profiles.role === 'seller' (buyers see the ladder, not a rank). */
  isSeller: boolean
  currentTier: string
  /** What the 90-day window qualifies for today (the daily check only
   *  ever moves a seller UP to it). */
  eligibleTier: string
  /** The same window facts check_seller_tier_eligibility uses. */
  window: {
    gmv: number
    orders: number
    positivePct: number | null
    completionPct: number
  }
}

/**
 * The signed-in seller's rank and the 90-day facts it is judged on, from
 * get_seller_tier_info (service role, scoped to the session user). The old
 * version also read all-time sales, account age and every order status
 * (unbounded) — the legacy criteria the page no longer shows.
 */
export async function getMyTierInfo(): Promise<MyTierInfo | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const service = getServiceClient()
  const [profileResult, rpcResult] = await Promise.all([
    service.from('profiles').select('role, seller_tier').eq('id', user.id).single(),
    service.rpc('get_seller_tier_info', { p_user_id: user.id }),
  ])

  const profile = profileResult.data as { role: string | null; seller_tier: string | null } | null
  const info = (rpcResult.error ? null : rpcResult.data) as {
    current_tier?: string
    eligible_tier?: string
    window_gmv?: number | string | null
    window_orders?: number | null
    window_positive_pct?: number | string | null
    window_completion_pct?: number | string | null
  } | null
  if (rpcResult.error) console.warn('[getMyTierInfo] get_seller_tier_info failed:', rpcResult.error.message)

  const currentTier = info?.current_tier ?? profile?.seller_tier ?? DEFAULT_TIER
  const n = (v: unknown, d: number) => (v == null || !Number.isFinite(Number(v)) ? d : Number(v))
  return {
    isSeller: profile?.role === 'seller',
    currentTier,
    eligibleTier: info?.eligible_tier ?? currentTier,
    window: {
      gmv: n(info?.window_gmv, 0),
      orders: n(info?.window_orders, 0),
      positivePct: info?.window_positive_pct == null ? null : n(info.window_positive_pct, 0),
      completionPct: n(info?.window_completion_pct, 100),
    },
  }
}

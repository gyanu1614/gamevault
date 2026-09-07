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

// ─── Current seller's tier info + stats ───────────────────────────────────────

export async function getMyTierInfo() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const service = getServiceClient()

  // Get live seller stats (always available regardless of migration)
  const [salesResult, profileResult, completionResult] = await Promise.all([
    service
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', user.id)
      .eq('status', 'completed'),

    service
      .from('profiles')
      .select('seller_rating, created_at, seller_tier')
      .eq('id', user.id)
      .single(),

    service
      .from('orders')
      .select('status')
      .eq('seller_id', user.id)
      .not('status', 'in', '(cancelled,refunded)'),
  ])

  const totalSales = salesResult.count ?? 0
  const rating = profileResult.data?.seller_rating ?? null
  const createdAt = profileResult.data?.created_at
  const accountAgeDays = createdAt
    ? Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000)
    : 0
  const orders = completionResult.data ?? []
  const completionRate =
    orders.length === 0
      ? 100
      : (orders.filter((o: any) => o.status === 'completed').length / orders.length) * 100

  const stats = {
    totalSales,
    rating,
    accountAgeDays,
    completionRate: Math.round(completionRate * 10) / 10,
  }

  // Try the RPC first (requires migration to be applied)
  const { data: tierInfo, error: tierError } = await service.rpc(
    'get_seller_tier_info',
    { p_user_id: user.id }
  )

  if (!tierError && tierInfo) {
    return {
      tierInfo: tierInfo as {
        current_tier: string
        eligible_tier: string
        commission_rate: number
        listing_limit: number | null
        banner_access: boolean
        next_tier: string | null
        next_commission_rate: number | null
        next_min_sales: number | null
        next_min_rating: number | null
      },
      stats,
    }
  }

  // RPC not available — build fallback from profile + hardcoded config
  console.warn('[getMyTierInfo] RPC unavailable, using fallback tier config')
  const currentTier = profileResult.data?.seller_tier ?? DEFAULT_TIER
  const tierConfig = FALLBACK_TIER_CONFIGS.find(t => t.tier === currentTier)
    ?? FALLBACK_TIER_CONFIGS[0]
  const nextConfig = FALLBACK_TIER_CONFIGS.find(t => t.sort_order === tierConfig.sort_order + 1) ?? null

  return {
    tierInfo: {
      current_tier: currentTier,
      eligible_tier: currentTier, // can't compute without SQL function
      commission_rate: tierConfig.commission_rate,
      listing_limit: tierConfig.listing_limit,
      banner_access: tierConfig.banner_access,
      next_tier: nextConfig?.tier ?? null,
      next_commission_rate: nextConfig?.commission_rate ?? null,
      next_min_sales: nextConfig?.min_sales ?? null,
      next_min_rating: nextConfig?.min_rating ?? null,
    },
    stats,
  }
}

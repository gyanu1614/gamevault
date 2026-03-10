'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ─── Hardcoded fallback (used when migration not yet applied) ─────────────────

const FALLBACK_TIER_CONFIGS = [
  { tier: 'unverified', display_name: 'Unverified', description: 'New seller awaiting first sale',
    min_sales: 0,   min_rating: null, min_age_days: 0,   min_completion_rate: null,
    commission_rate: 0.0990, listing_limit: 5,    banner_access: false, badge_color: 'zinc',   sort_order: 0 },
  { tier: 'bronze',     display_name: 'Bronze',     description: 'Getting started — first sale completed',
    min_sales: 1,   min_rating: 3.5,  min_age_days: 7,   min_completion_rate: 80.0,
    commission_rate: 0.0890, listing_limit: 20,   banner_access: false, badge_color: 'orange', sort_order: 1 },
  { tier: 'silver',     display_name: 'Silver',     description: 'Established seller',
    min_sales: 10,  min_rating: 4.0,  min_age_days: 30,  min_completion_rate: 90.0,
    commission_rate: 0.0790, listing_limit: 50,   banner_access: true,  badge_color: 'slate',  sort_order: 2 },
  { tier: 'gold',       display_name: 'Gold',       description: 'Trusted & reliable seller',
    min_sales: 50,  min_rating: 4.3,  min_age_days: 90,  min_completion_rate: 95.0,
    commission_rate: 0.0690, listing_limit: 100,  banner_access: true,  badge_color: 'yellow', sort_order: 3 },
  { tier: 'platinum',   display_name: 'Platinum',   description: 'Top-tier seller with proven track record',
    min_sales: 200, min_rating: 4.6,  min_age_days: 180, min_completion_rate: 97.0,
    commission_rate: 0.0590, listing_limit: null, banner_access: true,  badge_color: 'cyan',   sort_order: 4 },
  { tier: 'diamond',    display_name: 'Diamond',    description: 'Elite seller — the best of the best',
    min_sales: 500, min_rating: 4.8,  min_age_days: 365, min_completion_rate: 99.0,
    commission_rate: 0.0490, listing_limit: null, banner_access: true,  badge_color: 'violet', sort_order: 5 },
]

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
  const currentTier = profileResult.data?.seller_tier ?? 'unverified'
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

/**
 * /account/tiers — the seller rank page. Server half: the ladder
 * (seller_tier_config), the viewer's rank + 90-day facts
 * (get_seller_tier_info) and the platform floor; the page itself is
 * _TiersClient (rank hero, progress, rules, rank switcher).
 */

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAllTierConfigs, getMyTierInfo, getRankFloorPct } from '@/lib/actions/seller-tiers'
import { DEFAULT_TIER } from '@/lib/seller/tiers'
import { TiersClient } from './_TiersClient'
import { sortLadder, type RankConfig } from './_tiers-model'

export const metadata: Metadata = {
  title: 'Seller Tiers',
  description: 'Your seller rank, what the next one takes, and what each rank unlocks.',
}

export default async function SellerTiersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/account/tiers')

  const [configs, mine, floorPct] = await Promise.all([getAllTierConfigs(), getMyTierInfo(), getRankFloorPct()])
  const ladder = sortLadder(configs as unknown as RankConfig[])

  return (
    <TiersClient
      ladder={ladder}
      isSeller={mine?.isSeller ?? false}
      currentTier={mine?.currentTier ?? DEFAULT_TIER}
      eligibleTier={mine?.eligibleTier ?? mine?.currentTier ?? DEFAULT_TIER}
      window={mine?.window ?? { gmv: 0, orders: 0, positivePct: null, completionPct: 100 }}
      floorPct={floorPct}
    />
  )
}

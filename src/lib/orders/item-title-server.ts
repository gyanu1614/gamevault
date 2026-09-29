/**
 * The item an order sold, for emails and in-app notifications: "50 Diamonds",
 * "2,000 Robux", "3 × Dragon Pet" (same rule as the order page and lists,
 * see orderItemTitle). Server only; reads with the service role because a
 * sold or paused listing is hidden from other sessions by RLS.
 *
 * Best-effort: comms must never fail over a title, so any error falls back
 * to the caller's fallback (usually the listing title).
 */
import 'server-only'

import { createServiceRoleClient } from '@/lib/supabase/service'
import { orderItemTitle } from './display-title'

export async function orderItemTitleFor(orderId: string, fallback = 'your item'): Promise<string> {
  try {
    const supabase = createServiceRoleClient()
    const { data: order } = await (supabase
      .from('orders')
      .select(
        'quantity, listing:listings!orders_listing_id_fkey(title, game_id, bundle_id, category:game_categories!listings_game_category_id_fkey(type))',
      )
      .eq('id', orderId)
      .maybeSingle() as any)
    const listing = order?.listing
    if (!listing?.title) return fallback

    const categoryType: string | null = listing.category?.type ?? null
    let currencyConfig = null
    if (categoryType === 'currency' && listing.game_id) {
      const { data: cfg } = await (supabase
        .from('category_configs')
        .select('config')
        .eq('game_id', listing.game_id)
        .eq('category_type', 'currency')
        .maybeSingle() as any)
      currencyConfig = cfg?.config ?? null
    }

    return orderItemTitle({
      listingTitle: listing.title,
      quantity: order?.quantity ?? 1,
      categoryType,
      currencyConfig,
      bundleId: listing.bundle_id ?? null,
    })
  } catch {
    return fallback
  }
}

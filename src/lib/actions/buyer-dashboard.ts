/**
 * Buyer Dashboard (real data).
 *
 * One server action returning everything BuyerDashboard renders, computed from
 * real tables — no dummy data:
 *   - Stats: total spent, active/completed order counts, wishlist + reviews
 *   - Active orders (paid/delivered) with listing title + seller username
 *   - Favorite games (grouped from completed purchases)
 */

'use server'

import { createClient } from '@/lib/supabase/server'
import { lifetimeSpentOf } from '@/lib/wallet/wallet-rows'
import { sellerDisplayName } from '@/lib/seller/identity'
import { fetchAllRows } from '@/lib/db/fetch-all'

export interface BuyerActiveOrder {
  id: string
  title: string
  seller: string
  status: string
  createdAt: string
  amount: number
}

export interface BuyerFavoriteGame {
  game: string
  count: number
}

export interface BuyerDashboardData {
  totalSpent: number
  activeOrders: number
  completedOrders: number
  wishlistItems: number
  reviewsGiven: number
  active: BuyerActiveOrder[]
  favoriteGames: BuyerFavoriteGame[]
}

// Every paid, unfinished order (was missing 'delivering').
const ACTIVE_STATUSES = ['paid', 'delivering', 'delivered', 'disputed']

export async function getBuyerDashboard(): Promise<BuyerDashboardData | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [ordersRes, wishlistRes, reviewsRes] = await Promise.all([
    // Paged: Total Spent is a sum — a 1000-row cap would under-count it.
    fetchAllRows<any>((from, to) =>
      supabase
        .from('orders')
        .select(
          'id, status, total_amount, created_at, completed_at, listing:listings!orders_listing_id_fkey(title, game:game_id(name)), seller:profiles!seller_id(username, shop_name)',
        )
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to),
    ),
    supabase
      .from('wishlists')
      .select('id', { count: 'exact' })
      .eq('user_id', user.id).limit(1),
    supabase
      .from('reviews')
      .select('id', { count: 'exact' })
      .eq('reviewer_id', user.id).limit(1),
  ])

  const orders = (ordersRes.data ?? []) as any[]

  const completed = orders.filter((o) => o.status === 'completed')
  // Same rule as the wallet's Total Spent: every paid order not cancelled or
  // refunded (the two pages used to disagree).
  const totalSpent = lifetimeSpentOf(orders)

  const activeList = orders.filter((o) => ACTIVE_STATUSES.includes(o.status ?? ''))
  const active: BuyerActiveOrder[] = activeList.slice(0, 5).map((o) => ({
    id: o.id,
    title: o.listing?.title ?? 'Order',
    seller: sellerDisplayName(o.seller),
    status: o.status,
    createdAt: o.created_at,
    amount: Number(o.total_amount ?? 0),
  }))

  // Favorite games — group completed purchases by game name.
  const gameCounts = new Map<string, number>()
  for (const o of completed) {
    const g = o.listing?.game?.name
    if (g) gameCounts.set(g, (gameCounts.get(g) ?? 0) + 1)
  }
  const favoriteGames: BuyerFavoriteGame[] = Array.from(gameCounts, ([game, count]) => ({ game, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)

  return {
    totalSpent,
    activeOrders: activeList.length,
    completedOrders: completed.length,
    wishlistItems: wishlistRes.count ?? 0,
    reviewsGiven: reviewsRes.count ?? 0,
    active,
    favoriteGames,
  }
}

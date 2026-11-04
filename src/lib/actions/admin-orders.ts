'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/actions/admin-permissions'
import { normalizeOrderNumber, orderNumberSearchPattern } from '@/lib/orders/order-number'
import { ilikeContains } from '@/lib/db/ilike'
import { getAdminOverviewStats } from '@/lib/admin/overview-stats'

// The orders_status_check / orders_escrow_status_check values.
export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'delivering'
  | 'delivered'
  | 'disputed'
  | 'completed'
  | 'cancelled'
  | 'refunded'
export type EscrowStatus = 'pending' | 'held' | 'released' | 'refunded' | 'frozen'


export interface OrderFilters {
  status?: OrderStatus[]
  escrowStatus?: EscrowStatus[]
  search?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}

export interface AdminOrder {
  id: string
  order_number: string
  status: OrderStatus
  escrow_status: EscrowStatus
  total_amount: number
  platform_fee: number
  seller_payout: number
  created_at: string
  completed_at: string | null
  buyer: {
    id: string
    username: string
    email: string
    avatar_url: string | null
  }
  seller: {
    id: string
    username: string
    email: string
    avatar_url: string | null
    shop_name: string | null
  }
  listing: {
    id: string
    title: string
    slug: string
    game: {
      name: string
      slug: string
      emoji: string
      image_url: string | null
    } | null
  } | null
}

export async function getOrders(filters: OrderFilters = {}) {
  // Outside the try: requireAdmin redirects (throws NEXT_REDIRECT) for a
  // non-admin, and the catch below must not swallow that.
  await requireAdmin()
  try {
    const supabase = await createClient()

    const {
      status = [],
      escrowStatus = [],
      search = '',
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
    } = filters

    // Payout + fee are private order columns a session client cannot select
    // (orders column grant) — read orders with the service role, only after
    // requireAdmin above.
    let query = createServiceRoleClient()
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        escrow_status,
        total_amount,
        platform_fee,
        seller_payout,
        created_at,
        completed_at,
        buyer:profiles!buyer_id (
          id,
          username,
          email,
          avatar_url
        ),
        seller:profiles!seller_id (
          id,
          username,
          email,
          avatar_url,
          shop_name
        ),
        listing:listing_id (
          id,
          title,
          slug,
          game:game_id (
            name,
            slug,
            emoji,
            image_url
          )
        )
      `, { count: 'exact' })

    // Apply filters
    if (status.length > 0) {
      query = query.in('status', status)
    }

    if (escrowStatus.length > 0) {
      query = query.in('escrow_status', escrowStatus)
    }

    const term = search.trim()
    if (term) {
      // Order number: normalised lookup against orders.order_number_search
      // (upper-cased, dashes/spaces stripped — GV- and DM- orders alike).
      // Buyer / seller (username or shop name) and listing title: resolve
      // the matching ids first, then OR them in. Ids are uuids and the
      // order-number key is alphanumeric, so nothing typed reaches the
      // PostgREST filter string itself.
      const like = ilikeContains(term)
      const [byUsername, byShop, byTitle] = await Promise.all([
        supabase.from('profiles').select('id').ilike('username', like).limit(50),
        supabase.from('profiles').select('id').ilike('shop_name', like).limit(50),
        supabase.from('listings').select('id').ilike('title', like).limit(50),
      ])
      const profileIds = Array.from(
        new Set([...(byUsername.data ?? []), ...(byShop.data ?? [])].map((r: any) => r.id as string)),
      )
      const listingIds = (byTitle.data ?? []).map((r: any) => r.id as string)

      const clauses: string[] = []
      if (normalizeOrderNumber(term)) {
        clauses.push(`order_number_search.ilike.${orderNumberSearchPattern(term)}`)
      }
      if (profileIds.length > 0) {
        clauses.push(`buyer_id.in.(${profileIds.join(',')})`)
        clauses.push(`seller_id.in.(${profileIds.join(',')})`)
      }
      if (listingIds.length > 0) {
        clauses.push(`listing_id.in.(${listingIds.join(',')})`)
      }
      // Nothing searchable matched: a pattern no key can match (never
      // "list everything").
      query = clauses.length > 0
        ? query.or(clauses.join(','))
        : query.ilike('order_number_search', orderNumberSearchPattern('-'))
    }

    if (dateFrom) {
      query = query.gte('created_at', dateFrom)
    }

    if (dateTo) {
      query = query.lte('created_at', dateTo)
    }

    // Pagination
    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw error

    return {
      success: true,
      orders: data as unknown as AdminOrder[],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    }
  } catch (error: any) {
    console.error('Error fetching orders:', error)
    return {
      success: false,
      error: error.message || 'Failed to fetch orders',
      orders: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    }
  }
}

export async function getOrderStats() {
  await requireAdmin()
  try {
    // One cached call shared with the dashboard (lib/admin/overview-stats). Was
    // four counts plus a walk of every collected order.
    const { orders } = await getAdminOverviewStats()
    return {
      success: true,
      stats: {
        totalOrders: orders.total,
        completedOrders: orders.completed,
        pendingOrders: orders.in_progress,
        disputedOrders: orders.disputed,
        totalRevenue: orders.revenue_total,
        totalFees: orders.fees_total,
      },
    }
  } catch (error: any) {
    console.error('Error fetching order stats:', error)
    return {
      success: false,
      error: error.message || 'Failed to fetch stats',
      stats: {
        totalOrders: 0,
        completedOrders: 0,
        pendingOrders: 0,
        disputedOrders: 0,
        totalRevenue: 0,
        totalFees: 0,
      },
    }
  }
}

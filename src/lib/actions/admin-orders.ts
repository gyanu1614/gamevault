'use server'

import { createClient } from '@/lib/supabase/server'

export type OrderStatus = 'pending' | 'processing' | 'paid' | 'completed' | 'cancelled' | 'refunded'
export type EscrowStatus = 'pending' | 'held' | 'released' | 'refunded'

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

    let query = supabase
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

    if (search) {
      // Use textSearch or multiple or conditions for searching across related tables
      query = query.or(`order_number.ilike.%${search}%`)
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
  try {
    const supabase = await createClient()

    // Get total orders
    const { count: totalOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })

    // Get completed orders
    const { count: completedOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')

    // Get pending orders
    const { count: pendingOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'processing', 'paid'])

    // Get disputed orders
    const { count: disputedOrders } = await supabase
      .from('disputes')
      .select('*', { count: 'exact', head: true })
      .in('status', ['open', 'under_review'])

    // Get total revenue
    const { data: revenueData } = await supabase
      .from('orders')
      .select('total_amount')
      .in('status', ['completed', 'paid'])

    const totalRevenue = revenueData?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0

    // Get total platform fees
    const { data: feesData } = await supabase
      .from('orders')
      .select('platform_fee')
      .in('status', ['completed', 'paid'])

    const totalFees = feesData?.reduce((sum, order) => sum + (order.platform_fee || 0), 0) || 0

    return {
      success: true,
      stats: {
        totalOrders: totalOrders || 0,
        completedOrders: completedOrders || 0,
        pendingOrders: pendingOrders || 0,
        disputedOrders: disputedOrders || 0,
        totalRevenue,
        totalFees,
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

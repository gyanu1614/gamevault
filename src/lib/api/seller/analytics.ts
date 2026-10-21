/**
 * Seller dashboard stats and analytics.
 *
 * Part of the browser seller API, split out of lib/api/seller-compatible.ts
 * (2026-10-20, files under ~400 lines). Import from '@/lib/api/seller-compatible'.
 */
import { supabase } from './client'
import type { Listing, DashboardStats } from './types'

// =====================================================
// ANALYTICS API
// =====================================================

export const analyticsApi = {
  /**
   * Get dashboard overview stats (using the view we created)
   */
  async getDashboardStats(): Promise<DashboardStats> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Use the seller_dashboard_stats view
    const { data, error } = await supabase
      .from('seller_dashboard_stats')
      .select('*')
      .eq('seller_id', user.id)
      .single() as any

    if (error) {
      // If view doesn't exist or returns no data, return empty stats
      console.error('Dashboard stats error:', error)
      return {
        earnings: { today: 0, week: 0, month: 0, allTime: 0 },
        listings: { active: 0, paused: 0, draft: 0, sold: 0 },
        orders: { pending: 0, processing: 0, completed: 0, disputed: 0 },
        performance: { totalViews: 0, totalSales: 0, conversionRate: 0, avgRating: 0 },
      }
    }

    const totalViews = Number((data as any).total_views) || 0
    const totalSales = Number((data as any).total_listing_sales) || 0

    return {
      earnings: {
        today: Number((data as any).earnings_today) || 0,
        week: Number((data as any).earnings_week) || 0,
        month: Number((data as any).earnings_month) || 0,
        allTime: Number((data as any).earnings_all_time) || 0,
      },
      listings: {
        active: Number((data as any).active_listings) || 0,
        paused: Number((data as any).paused_listings) || 0,
        draft: Number((data as any).draft_listings) || 0,
        sold: Number((data as any).sold_listings) || 0,
      },
      orders: {
        pending: Number((data as any).pending_orders) || 0,
        processing: Number((data as any).processing_orders) || 0,
        completed: Number((data as any).completed_orders) || 0,
        disputed: Number((data as any).disputed_orders) || 0,
      },
      performance: {
        totalViews,
        totalSales,
        conversionRate: totalViews > 0 ? (totalSales / totalViews) * 100 : 0,
        avgRating: Number((data as any).seller_rating) || 0,
      },
    }
  },

  /**
   * Get top performing listings
   */
  async getTopListings(limit: number = 5): Promise<Listing[]> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('listings')
      .select(`
        *,
        game:game_id (id, name, slug, emoji, image_url),
        category:game_categories!listings_game_category_id_fkey (id, name, slug, type)
      `)
      .eq('seller_id', user.id)
      .order('sales', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  },

  /**
   * Get revenue trend grouped by period for chart display.
   * Returns an array of { label, amount } sorted oldest → newest.
   */
  async getRevenueTrend(timeRange: '7d' | '30d' | '90d' | 'all'): Promise<{ label: string; amount: number }[]> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const now = new Date()
    let since: Date | null = null
    if (timeRange === '7d') {
      since = new Date(now)
      since.setDate(since.getDate() - 7)
    } else if (timeRange === '30d') {
      since = new Date(now)
      since.setDate(since.getDate() - 30)
    } else if (timeRange === '90d') {
      since = new Date(now)
      since.setDate(since.getDate() - 90)
    }

    let query = supabase
      .from('orders')
      .select('created_at, total_amount, status')
      .eq('seller_id', user.id)
      // Realised sales only ('processing' is not an order status).
      .eq('status', 'completed')

    if (since) {
      query = query.gte('created_at', since.toISOString())
    }

    const { data: orders, error } = await query
    if (error || !orders || orders.length === 0) return []

    // Group into buckets based on time range
    const buckets: Record<string, number> = {}

    if (timeRange === '7d') {
      // Group by day: "Mon", "Tue" etc.
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now)
        d.setDate(d.getDate() - i)
        const label = d.toLocaleDateString('en-US', { weekday: 'short' })
        buckets[label] = 0
      }
      for (const order of orders) {
        const d = new Date((order as any).created_at)
        const label = d.toLocaleDateString('en-US', { weekday: 'short' })
        if (label in buckets) {
          buckets[label] += Number((order as any).total_amount) || 0
        }
      }
    } else if (timeRange === '30d') {
      // Group by week: "Week 1", "Week 2", etc.
      for (let i = 3; i >= 0; i--) {
        const label = i === 0 ? 'This Week' : `Week -${i}`
        buckets[label] = 0
      }
      for (const order of orders) {
        const d = new Date((order as any).created_at)
        const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
        const weekIndex = Math.floor(diffDays / 7)
        const label = weekIndex === 0 ? 'This Week' : weekIndex <= 3 ? `Week -${weekIndex}` : null
        if (label && label in buckets) {
          buckets[label] += Number((order as any).total_amount) || 0
        }
      }
    } else {
      // 90d or all: group by month "Jan", "Feb" etc.
      const monthsSeen = new Set<string>()
      for (const order of orders) {
        const d = new Date((order as any).created_at)
        const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
        monthsSeen.add(label)
        buckets[label] = (buckets[label] || 0) + (Number((order as any).total_amount) || 0)
      }
    }

    return Object.entries(buckets).map(([label, amount]) => ({ label, amount }))
  },
}

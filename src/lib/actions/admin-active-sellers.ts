'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from './admin-permissions'

export interface ActiveSeller {
  id: string
  user_id: string
  username: string
  full_name: string | null
  email: string
  avatar_url: string | null
  seller_tier: string
  approved_at: string
  status: 'active' | 'restricted' | 'banned' | 'warning' | 'suspended'
  stats: {
    total_sales: number
    active_listings: number
    total_earnings: number
    avg_rating: number
    review_count: number
    response_rate: number
    completion_rate: number
  }
  primary_games: string[]
  seller_type: string
  last_active: string
}

/**
 * Get all active sellers with their stats
 */
export async function getActiveSellers(filters?: {
  status?: 'active' | 'restricted' | 'banned' | 'warning' | 'suspended'
  tier?: 'bronze' | 'silver' | 'gold' | 'platinum'
  searchQuery?: string
  sortBy?: 'sales' | 'earnings' | 'rating' | 'listings' | 'joined' | 'activity'
  sortOrder?: 'asc' | 'desc'
}): Promise<{
  success: boolean
  sellers?: ActiveSeller[]
  error?: string
}> {
  try {
    // Check admin permissions
    await requireAdmin()

    const supabase = await createClient()

    // Get all approved seller applications with user details
    // Use profiles!user_id to specify which foreign key relationship to use
    // (seller_applications has both user_id and reviewed_by referencing profiles)
    let query = supabase
      .from('seller_applications')
      .select(`
        id,
        user_id,
        seller_type,
        primary_games,
        reviewed_at,
        profiles!user_id (
          username,
          full_name,
          email,
          avatar_url,
          seller_tier,
          seller_status,
          updated_at
        )
      `)
      .eq('status', 'approved')

    // Apply filters
    if (filters?.tier) {
      query = query.eq('profiles.seller_tier', filters.tier)
    }

    const { data: applications, error } = await query

    if (error) {
      console.error('Error fetching active sellers:', error)
      return { success: false, error: error.message }
    }

    if (!applications || applications.length === 0) {
      return { success: true, sellers: [] }
    }

    // TODO: Fetch actual stats from orders/listings tables when they exist
    const sellers: ActiveSeller[] = applications
      .filter((app: any) => app.profiles) // Filter out any applications without profile data
      .map((app: any) => {
        const username = app.profiles?.username || 'Unknown'
        // Use DiceBear avatar as fallback
        const { getAvatarUrl } = require('@/lib/utils/avatar')
        const avatar_url = getAvatarUrl(app.profiles?.avatar_url, username)

        return {
          id: app.id,
          user_id: app.user_id,
          username,
          full_name: app.profiles?.full_name || null,
          email: app.profiles?.email || 'No email',
          avatar_url,
          seller_tier: app.profiles?.seller_tier || 'bronze',
          approved_at: app.reviewed_at || new Date().toISOString(),
          status: app.profiles?.seller_status || 'active',
          stats: {
            // Real stats will come from orders/listings tables - showing 0 until implemented
            total_sales: 0,
            active_listings: 0,
            total_earnings: 0,
            avg_rating: 0,
            review_count: 0,
            response_rate: 0,
            completion_rate: 0
          },
          primary_games: Array.isArray(app.primary_games) ? app.primary_games : [],
          seller_type: app.seller_type || 'individual',
          last_active: app.profiles?.updated_at || new Date().toISOString()
        }
      })

    // Apply search filter
    let filteredSellers = sellers
    if (filters?.searchQuery) {
      const query = filters.searchQuery.toLowerCase()
      filteredSellers = sellers.filter(s =>
        s.username.toLowerCase().includes(query) ||
        s.full_name?.toLowerCase().includes(query) ||
        s.email.toLowerCase().includes(query) ||
        s.primary_games.some(g => g.toLowerCase().includes(query))
      )
    }

    // Apply status filter
    if (filters?.status) {
      filteredSellers = filteredSellers.filter(s => s.status === filters.status)
    }

    // Sort
    if (filters?.sortBy) {
      filteredSellers.sort((a, b) => {
        let aValue: any
        let bValue: any

        switch (filters.sortBy) {
          case 'sales':
            aValue = a.stats.total_sales
            bValue = b.stats.total_sales
            break
          case 'earnings':
            aValue = a.stats.total_earnings
            bValue = b.stats.total_earnings
            break
          case 'rating':
            aValue = a.stats.avg_rating
            bValue = b.stats.avg_rating
            break
          case 'listings':
            aValue = a.stats.active_listings
            bValue = b.stats.active_listings
            break
          case 'joined':
            aValue = new Date(a.approved_at).getTime()
            bValue = new Date(b.approved_at).getTime()
            break
          case 'activity':
            aValue = new Date(a.last_active).getTime()
            bValue = new Date(b.last_active).getTime()
            break
          default:
            aValue = a.stats.total_sales
            bValue = b.stats.total_sales
        }

        return filters.sortOrder === 'asc' ? aValue - bValue : bValue - aValue
      })
    }

    return { success: true, sellers: filteredSellers }
  } catch (error: any) {
    console.error('Error in getActiveSellers:', error)
    return { success: false, error: error.message || 'Failed to fetch active sellers' }
  }
}

/**
 * Get seller statistics overview
 */
export async function getSellerStats(): Promise<{
  success: boolean
  stats?: {
    total: number
    active: number
    warning: number
    suspended: number
    totalEarnings: number
    totalSales: number
    totalListings: number
  }
  error?: string
}> {
  try {
    await requireAdmin()

    const supabase = await createClient()

    // Get count of approved sellers
    const { count: totalSellers, error: countError } = await supabase
      .from('seller_applications')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')

    if (countError) {
      return { success: false, error: countError.message }
    }

    // TODO: Replace with real queries when orders/listings tables exist
    return {
      success: true,
      stats: {
        total: totalSellers || 0,
        active: totalSellers || 0,
        warning: 0,
        suspended: 0,
        totalEarnings: 0,
        totalSales: 0,
        totalListings: 0
      }
    }
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to fetch stats' }
  }
}

/**
 * Update seller status (active/warning/suspended)
 */
export async function updateSellerStatus(
  sellerId: string,
  status: 'active' | 'warning' | 'suspended',
  reason?: string
): Promise<{
  success: boolean
  message?: string
  error?: string
}> {
  try {
    const admin = await requireAdmin()
    const supabase = await createClient()

    // TODO: Create a seller_status table to track status changes
    // For now, we'll log this action
    const { error: logError } = await (supabase
      .from('seller_verification_logs')
      .insert as any)({
        application_id: sellerId,
        action: `status_changed_to_${status}`,
        performed_by: admin.userId,
        details: { status, reason }
      })

    if (logError) {
      console.error('Error logging status change:', logError)
    }

    return {
      success: true,
      message: `Seller status updated to ${status}`
    }
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to update status' }
  }
}

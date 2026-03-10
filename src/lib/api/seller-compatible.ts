/**
 * GAMEVAULT SELLER API (Compatible with existing schema)
 * Works with your existing database structure
 * Date: January 25, 2026
 */

import { createClient } from '@/lib/supabase/client'
import { slugify } from '@/lib/utils'

const supabase = createClient()

// =====================================================
// TYPES (matching your existing schema)
// =====================================================

export type ListingStatus = 'draft' | 'active' | 'sold' | 'archived' | 'suspended' | 'paused'
export type OrderStatus = 'pending' | 'paid' | 'processing' | 'completed' | 'disputed' | 'refunded' | 'cancelled'
export type SellerTier = 'bronze' | 'silver' | 'gold' | 'platinum'

export interface Listing {
  id: string
  seller_id: string
  game_id: string
  category_id: string
  title: string
  description: string
  price: number
  currency: string
  quantity: number
  is_unlimited: boolean
  status: ListingStatus
  images: string[]
  delivery_time: string
  delivery_method: string
  views: number
  sales: number
  created_at: string
  updated_at: string
  // Joined data
  game?: {
    id: string
    name: string
    slug: string
    emoji: string
    image_url?: string | null
  }
  category?: {
    id: string
    name: string
    slug: string
  }
}

export interface Order {
  id: string
  buyer_id: string
  seller_id: string
  listing_id: string
  order_number?: string
  quantity: number
  unit_price: number
  subtotal: number
  platform_fee_rate: number
  payment_processing_fee_rate: number
  platform_fee: number
  payment_processing_fee: number
  total_amount: number
  seller_payout: number
  status: OrderStatus
  delivery_details?: any
  delivered_at?: string
  dispute_reason?: string
  disputed_at?: string
  created_at: string
  updated_at: string
  completed_at?: string
  // Joined data
  listing?: Listing
  buyer?: {
    id: string
    username: string
    avatar_url?: string
  }
}

export interface Review {
  id: string
  order_id: string
  reviewer_id: string
  reviewed_user_id: string
  rating: number
  comment?: string
  review_type: 'buyer_to_seller' | 'seller_to_buyer'
  seller_response?: string
  seller_responded_at?: string
  helpful_count?: number
  created_at: string
  updated_at: string
  // Joined data
  reviewer?: {
    id: string
    username: string
    avatar_url?: string
  }
  order?: {
    listing_id: string
    listing?: {
      title: string
    }
  }
}

export interface DashboardStats {
  earnings: {
    today: number
    week: number
    month: number
    allTime: number
  }
  listings: {
    active: number
    paused: number
    draft: number
    sold: number
  }
  orders: {
    pending: number
    processing: number
    completed: number
    disputed: number
  }
  performance: {
    totalViews: number
    totalSales: number
    conversionRate: number
    avgRating: number
  }
}

export interface SellerProfile {
  id: string
  username: string
  seller_tier: SellerTier
  total_sales: number
  seller_rating: number
  total_reviews: number
  shop_name: string | null
  shop_slug: string | null
  shop_name_updated_at: string | null
}

// =====================================================
// LISTINGS API
// =====================================================

export const listingsApi = {
  /**
   * Get all listings for the current seller
   */
  async getAll(filters?: {
    status?: ListingStatus
    game_id?: string
    category_id?: string
    search?: string
  }): Promise<Listing[]> {
    // CRITICAL: Get current user and filter by seller_id
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    let query = supabase
      .from('listings')
      .select(`
        *,
        game:game_id (id, name, slug, emoji, image_url),
        category:category_id (id, name, slug)
      `)
      .eq('seller_id', user.id)  // CRITICAL: Only show current user's listings
      .order('created_at', { ascending: false })

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }
    if (filters?.game_id) {
      query = query.eq('game_id', filters.game_id)
    }
    if (filters?.category_id) {
      query = query.eq('category_id', filters.category_id)
    }
    if (filters?.search) {
      query = query.ilike('title', `%${filters.search}%`)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  },

  /**
   * Get a single listing by ID
   */
  async getById(id: string): Promise<Listing | null> {
    // CRITICAL: Verify ownership
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('listings')
      .select(`
        *,
        game:game_id (id, name, slug, emoji, image_url),
        category:category_id (id, name, slug)
      `)
      .eq('id', id)
      .eq('seller_id', user.id)  // CRITICAL: Only allow access to own listings
      .single()

    if (error) throw error
    return data
  },

  /**
   * Create a new listing
   */
  async create(listing: {
    game_id: string
    category_id: string
    title: string
    description: string
    price: number
    quantity?: number
    is_unlimited?: boolean
    delivery_time?: string
    delivery_method?: string
    images?: string[]
    status?: ListingStatus
  }): Promise<Listing> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('listings')
      .insert([{
        seller_id: user.id,
        ...listing,
      }])
      .select(`
        *,
        game:game_id (id, name, slug, emoji, image_url),
        category:category_id (id, name, slug)
      `)
      .single()

    if (error) throw error
    return data
  },

  /**
   * Update a listing
   */
  async update(id: string, updates: Partial<Listing>): Promise<Listing> {
    // CRITICAL: Verify ownership before updating
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('listings')
      .update(updates)
      .eq('id', id)
      .eq('seller_id', user.id)  // CRITICAL: Only allow updating own listings
      .select(`
        *,
        game:game_id (id, name, slug, emoji, image_url),
        category:category_id (id, name, slug)
      `)
      .single()

    if (error) throw error
    return data
  },

  /**
   * Delete a listing
   */
  async delete(id: string): Promise<void> {
    // CRITICAL: Verify ownership before deleting
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
      .from('listings')
      .delete()
      .eq('id', id)
      .eq('seller_id', user.id)  // CRITICAL: Only allow deleting own listings

    if (error) throw error
  },

  /**
   * Bulk update listings
   */
  async bulkUpdate(ids: string[], updates: Partial<Listing>): Promise<void> {
    // CRITICAL: Verify ownership before bulk updating
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
      .from('listings')
      .update(updates)
      .in('id', ids)
      .eq('seller_id', user.id)  // CRITICAL: Only allow updating own listings

    if (error) throw error
  },

  /**
   * Bulk delete listings
   */
  async bulkDelete(ids: string[]): Promise<void> {
    // CRITICAL: Verify ownership before bulk deleting
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
      .from('listings')
      .delete()
      .in('id', ids)
      .eq('seller_id', user.id)  // CRITICAL: Only allow deleting own listings

    if (error) throw error
  },
}

// =====================================================
// ORDERS API
// =====================================================

export const ordersApi = {
  /**
   * Get all orders for the current seller
   */
  async getAll(filters?: {
    status?: OrderStatus
    search?: string
  }): Promise<Order[]> {
    // CRITICAL: Get current user and filter by seller_id
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    let query = supabase
      .from('orders')
      .select(`
        *,
        listing:listing_id (
          id,
          title,
          game_id,
          category_id,
          images,
          game:games!listings_game_id_fkey (
            id,
            name,
            slug,
            image_url
          ),
          category:categories!listings_category_id_fkey (
            id,
            name,
            slug
          )
        ),
        buyer:buyer_id (
          id,
          username,
          avatar_url,
          shop_name,
          shop_slug
        )
      `)
      .eq('seller_id', user.id)  // CRITICAL: Only show current seller's orders
      .order('created_at', { ascending: false })

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }
    if (filters?.search && filters.search.trim()) {
      query = query.or(`order_number.ilike.%${filters.search}%`)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  },

  /**
   * Get a single order by ID
   */
  async getById(id: string): Promise<Order | null> {
    // CRITICAL: Verify ownership
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        listing:listing_id (
          id,
          title,
          game_id,
          category_id,
          images
        ),
        buyer:buyer_id (
          id,
          username,
          avatar_url
        )
      `)
      .eq('id', id)
      .eq('seller_id', user.id)  // CRITICAL: Only allow access to own orders
      .single()

    if (error) throw error
    return data
  },

  /**
   * Update order status
   */
  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    const updates: any = { status }

    if (status === 'completed') {
      updates.completed_at = new Date().toISOString()
      updates.delivered_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Deliver order
   */
  async deliver(id: string, deliveryDetails: any): Promise<Order> {
    const { data, error } = await supabase
      .from('orders')
      .update({
        status: 'completed',
        delivery_details: deliveryDetails,
        delivered_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },
}

// =====================================================
// BUYER ORDERS API
// =====================================================

export const buyerOrdersApi = {
  /**
   * Get all orders for the current buyer
   */
  async getAll(filters?: {
    status?: OrderStatus
    search?: string
  }): Promise<Order[]> {
    // Get current user and filter by buyer_id
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    let query = supabase
      .from('orders')
      .select(`
        *,
        listing:listing_id (
          id,
          title,
          game_id,
          category_id,
          images,
          delivery_method,
          delivery_time,
          game:games!listings_game_id_fkey (
            id,
            name,
            slug,
            image_url
          ),
          category:categories!listings_category_id_fkey (
            id,
            name,
            slug
          )
        ),
        seller:seller_id (
          id,
          username,
          avatar_url,
          seller_tier,
          shop_name,
          shop_slug
        )
      `)
      .eq('buyer_id', user.id)  // Filter by buyer_id instead of seller_id
      .order('created_at', { ascending: false })

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }
    if (filters?.search && filters.search.trim()) {
      query = query.or(`order_number.ilike.%${filters.search}%`)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  },

  /**
   * Get a single order by ID (buyer perspective)
   */
  async getById(id: string): Promise<Order | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        listing:listing_id (
          id,
          title,
          game_id,
          category_id,
          images,
          delivery_method,
          delivery_time
        ),
        seller:seller_id (
          id,
          username,
          avatar_url,
          seller_tier
        )
      `)
      .eq('id', id)
      .eq('buyer_id', user.id)  // Only allow access to own purchases
      .single()

    if (error) throw error
    return data
  },
}

// =====================================================
// REVIEWS API
// =====================================================

export const reviewsApi = {
  /**
   * Get all reviews for the current seller
   */
  async getAll(filters?: {
    rating?: number
    search?: string
  }): Promise<Review[]> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    let query = supabase
      .from('reviews')
      .select(`
        *,
        reviewer:reviewer_id (
          id,
          username,
          avatar_url
        ),
        order:order_id (
          listing_id,
          listing:listing_id (title)
        )
      `)
      .eq('reviewed_user_id', user.id)
      .eq('review_type', 'buyer_to_seller')
      .order('created_at', { ascending: false })

    if (filters?.rating) {
      query = query.eq('rating', filters.rating)
    }
    if (filters?.search) {
      query = query.ilike('comment', `%${filters.search}%`)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  },

  /**
   * Respond to a review
   */
  async respond(id: string, response: string): Promise<Review> {
    const { data, error } = await supabase
      .from('reviews')
      .update({
        seller_response: response,
        seller_responded_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Get review statistics
   */
  async getStats(): Promise<{
    avgRating: number
    totalReviews: number
    ratingCounts: Record<number, number>
    responseRate: number
  }> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('rating, seller_response')
      .eq('reviewed_user_id', user.id)
      .eq('review_type', 'buyer_to_seller')

    if (error) throw error

    const totalReviews = reviews?.length || 0
    const avgRating = totalReviews > 0
      ? reviews!.reduce((sum, r) => sum + r.rating, 0) / totalReviews
      : 0

    const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    reviews?.forEach(r => {
      ratingCounts[r.rating as keyof typeof ratingCounts]++
    })

    const responsesCount = reviews?.filter(r => r.seller_response).length || 0
    const responseRate = totalReviews > 0 ? (responsesCount / totalReviews) * 100 : 0

    return {
      avgRating,
      totalReviews,
      ratingCounts,
      responseRate,
    }
  },
}

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
      .single()

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

    const totalViews = Number(data.total_views) || 0
    const totalSales = Number(data.total_listing_sales) || 0

    return {
      earnings: {
        today: Number(data.earnings_today) || 0,
        week: Number(data.earnings_week) || 0,
        month: Number(data.earnings_month) || 0,
        allTime: Number(data.earnings_all_time) || 0,
      },
      listings: {
        active: Number(data.active_listings) || 0,
        paused: Number(data.paused_listings) || 0,
        draft: Number(data.draft_listings) || 0,
        sold: Number(data.sold_listings) || 0,
      },
      orders: {
        pending: Number(data.pending_orders) || 0,
        processing: Number(data.processing_orders) || 0,
        completed: Number(data.completed_orders) || 0,
        disputed: Number(data.disputed_orders) || 0,
      },
      performance: {
        totalViews,
        totalSales,
        conversionRate: totalViews > 0 ? (totalSales / totalViews) * 100 : 0,
        avgRating: Number(data.seller_rating) || 0,
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
        category:category_id (id, name, slug)
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
      .in('status', ['completed', 'processing'])

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
        const d = new Date(order.created_at)
        const label = d.toLocaleDateString('en-US', { weekday: 'short' })
        if (label in buckets) {
          buckets[label] += Number(order.total_amount) || 0
        }
      }
    } else if (timeRange === '30d') {
      // Group by week: "Week 1", "Week 2", etc.
      for (let i = 3; i >= 0; i--) {
        const label = i === 0 ? 'This Week' : `Week -${i}`
        buckets[label] = 0
      }
      for (const order of orders) {
        const d = new Date(order.created_at)
        const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
        const weekIndex = Math.floor(diffDays / 7)
        const label = weekIndex === 0 ? 'This Week' : weekIndex <= 3 ? `Week -${weekIndex}` : null
        if (label && label in buckets) {
          buckets[label] += Number(order.total_amount) || 0
        }
      }
    } else {
      // 90d or all: group by month "Jan", "Feb" etc.
      const monthsSeen = new Set<string>()
      for (const order of orders) {
        const d = new Date(order.created_at)
        const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
        monthsSeen.add(label)
        buckets[label] = (buckets[label] || 0) + (Number(order.total_amount) || 0)
      }
    }

    return Object.entries(buckets).map(([label, amount]) => ({ label, amount }))
  },
}

// =====================================================
// SETTINGS API
// =====================================================

export const settingsApi = {
  /**
   * Update seller profile
   */
  async updateProfile(updates: {
    username?: string
    full_name?: string
    bio?: string
    avatar_url?: string
    business_name?: string
    paypal_email?: string
    shop_name?: string
  }): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const updateData: any = { ...updates }

    // If shop_name is being updated, validate and generate shop_slug
    if (updates.shop_name !== undefined) {
      // Validate shop_name format
      if (updates.shop_name.length < 3 || updates.shop_name.length > 50) {
        throw new Error('Shop name must be between 3 and 50 characters')
      }

      // Get current profile to check last update time
      const { data: currentProfile, error: profileError } = await supabase
        .from('profiles')
        .select('shop_name_updated_at')
        .eq('id', user.id)
        .single()

      if (profileError) throw profileError

      // Check 30-day restriction (only if shop_name was previously updated)
      if (currentProfile.shop_name_updated_at) {
        const lastUpdate = new Date(currentProfile.shop_name_updated_at)
        const now = new Date()
        const daysSinceLastUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24)

        if (daysSinceLastUpdate < 30) {
          const daysRemaining = Math.ceil(30 - daysSinceLastUpdate)
          throw new Error(`You can change your shop name again in ${daysRemaining} days`)
        }
      }

      // Generate shop_slug using the database function
      const baseSlug = slugify(updates.shop_name)

      // Call database function to get unique slug
      const { data: slugData, error: slugError } = await supabase
        .rpc('generate_shop_slug', { name: updates.shop_name })

      if (slugError) throw slugError

      // Add generated slug and timestamp to updates
      updateData.shop_slug = slugData || baseSlug
      updateData.shop_name_updated_at = new Date().toISOString()
    }

    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id)

    if (error) throw error
  },

  /**
   * Get current seller profile
   */
  async getProfile(): Promise<SellerProfile> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error} = await supabase
      .from('profiles')
      .select('id, username, seller_tier, total_sales, seller_rating, total_reviews, shop_name, shop_slug, shop_name_updated_at')
      .eq('id', user.id)
      .single()

    if (error) throw error
    return data
  },
}

// =====================================================
// MESSAGES API
// =====================================================

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  attachments: string[]
  is_read: boolean
  read_at: string | null
  created_at: string
  sender?: {
    id: string
    username: string
    avatar_url: string
  }
}

export interface Conversation {
  id: string
  order_id: string | null
  buyer_id: string
  seller_id: string
  last_message_at: string
  created_at: string
  buyer?: {
    id: string
    username: string
    avatar_url: string
  }
  seller?: {
    id: string
    username: string
    avatar_url: string
  }
  last_message?: {
    content: string
    sender_id: string
  }
  unread_count?: number
  order?: {
    id: string
    order_number?: string
    status: OrderStatus
    total_amount: number
    listing?: {
      id: string
      title: string
      images: string[]
    }
  }
}

export const messagesApi = {
  /**
   * Get all conversations for current seller
   */
  async getConversations(): Promise<Conversation[]> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        buyer:profiles!buyer_id(id, username, avatar_url),
        seller:profiles!seller_id(id, username, avatar_url),
        order:orders!order_id(
          id,
          order_number,
          status,
          total_amount,
          listing:listings!listing_id(
            id,
            title,
            images
          )
        )
      `)
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order('last_message_at', { ascending: false })

    if (error) throw error

    // Get unread count and last message for each conversation
    const conversationsWithDetails = await Promise.all(
      (data || []).map(async (conv) => {
        // Get last message
        const { data: lastMsg } = await supabase
          .from('messages')
          .select('content, sender_id')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        // Get unread count
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .eq('is_read', false)
          .neq('sender_id', user.id)

        return {
          ...conv,
          last_message: lastMsg,
          unread_count: count || 0
        }
      })
    )

    return conversationsWithDetails
  },

  /**
   * Get messages for a conversation
   */
  async getMessages(conversationId: string): Promise<Message[]> {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:profiles!sender_id(id, username, avatar_url)
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return data || []
  },

  /**
   * Send a message
   */
  async sendMessage(conversationId: string, content: string, attachments?: string[]): Promise<Message> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content,
        attachments: attachments || [],
        is_read: false
      })
      .select()
      .single()

    if (error) throw error

    // Update conversation last_message_at
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId)

    return data
  },

  /**
   * Mark messages as read
   */
  async markAsRead(conversationId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
      .from('messages')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .neq('sender_id', user.id)
      .eq('is_read', false)

    if (error) throw error
  },

  /**
   * Create or get existing conversation with seller and send first message
   */
  async startConversation(sellerId: string, initialMessage: string): Promise<{ conversationId: string }> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Check if conversation already exists
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('id')
      .eq('buyer_id', user.id)
      .eq('seller_id', sellerId)
      .single()

    let conversationId = existingConv?.id

    // Create conversation if it doesn't exist
    if (!conversationId) {
      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({
          buyer_id: user.id,
          seller_id: sellerId,
          last_message_at: new Date().toISOString()
        })
        .select('id')
        .single()

      if (convError) throw convError
      conversationId = newConv.id
    }

    // Send the initial message
    const { error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: initialMessage,
        is_read: false
      })

    if (msgError) throw msgError

    // Update conversation last_message_at
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId)

    return { conversationId }
  },

  /**
   * Get conversation by order ID
   */
  async getConversationByOrder(orderId: string): Promise<Conversation | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        buyer:profiles!buyer_id(id, username, avatar_url),
        seller:profiles!seller_id(id, username, avatar_url),
        order:orders!order_id(
          id,
          order_number,
          status,
          total_amount,
          listing:listings!listing_id(
            id,
            title,
            images
          )
        )
      `)
      .eq('order_id', orderId)
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw error
    }

    return data
  },

  /**
   * Get or create conversation for an order
   */
  async getOrCreateConversationByOrder(orderId: string): Promise<Conversation> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Check if conversation already exists
    const existing = await this.getConversationByOrder(orderId)
    if (existing) return existing

    // Get order details to create conversation
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        buyer_id,
        seller_id,
        listing_id,
        order_number,
        status,
        total_amount,
        listing:listings!listing_id(
          id,
          title,
          images
        )
      `)
      .eq('id', orderId)
      .single()

    if (orderError) throw orderError
    if (!order) throw new Error('Order not found')

    // Create conversation
    const { data: newConv, error: convError } = await supabase
      .from('conversations')
      .insert({
        buyer_id: order.buyer_id,
        seller_id: order.seller_id,
        listing_id: order.listing_id,
        order_id: orderId,
        last_message_at: new Date().toISOString()
      })
      .select(`
        *,
        buyer:profiles!buyer_id(id, username, avatar_url),
        seller:profiles!seller_id(id, username, avatar_url),
        order:orders!order_id(
          id,
          order_number,
          status,
          total_amount,
          listing:listings!listing_id(
            id,
            title,
            images
          )
        )
      `)
      .single()

    if (convError) throw convError

    // Send welcome message from seller
    const welcomeMessage = `Hi! Thank you for your purchase. I'll deliver your order shortly. Feel free to message me if you have any questions!`

    await supabase
      .from('messages')
      .insert({
        conversation_id: newConv.id,
        sender_id: order.seller_id,
        content: welcomeMessage,
        is_read: false
      })

    return newConv
  },

  /**
   * Send smart action message (auto-generated messages for order actions)
   */
  async sendSmartActionMessage(
    conversationId: string,
    action: 'delivered' | 'received' | 'disputed' | 'cancelled',
    customMessage?: string
  ): Promise<Message> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Generate message based on action
    const messageTemplates = {
      delivered: customMessage || "I've marked your order as delivered! Please check and confirm receipt when you receive it.",
      received: customMessage || "Order received! Thank you for a smooth transaction.",
      disputed: customMessage || "I've opened a dispute for this order. Please see the details.",
      cancelled: customMessage || "This order has been cancelled."
    }

    const content = messageTemplates[action]

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content,
        is_read: false
      })
      .select()
      .single()

    if (error) throw error

    // Update conversation last_message_at
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId)

    return data
  },
}

// =====================================================
// EARNINGS API
// =====================================================

export interface EarningsStats {
  total_earnings: number
  pending_balance: number
  available_balance: number
  total_payouts: number
  this_month_earnings: number
}

export interface Transaction {
  id: string
  order_id: string
  order_number: string
  buyer_username: string
  amount: number
  platform_fee: number
  net_amount: number
  status: string
  created_at: string
  listing_title: string
}

export interface Payout {
  id: string
  amount: number
  status: string
  method: string
  created_at: string
  completed_at: string | null
}

export const earningsApi = {
  /**
   * Get earnings statistics
   */
  async getStats(): Promise<EarningsStats> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Get all completed orders for seller
    const { data: orders } = await supabase
      .from('orders')
      .select('seller_payout, total_amount, platform_fee, created_at')
      .eq('seller_id', user.id)
      .eq('status', 'completed')

    if (!orders) {
      return {
        total_earnings: 0,
        pending_balance: 0,
        available_balance: 0,
        total_payouts: 0,
        this_month_earnings: 0
      }
    }

    const total_earnings = orders.reduce((sum, order) => sum + (order.seller_payout || 0), 0)

    // Calculate this month's earnings
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const this_month_earnings = orders
      .filter(order => new Date(order.created_at) >= startOfMonth)
      .reduce((sum, order) => sum + (order.seller_payout || 0), 0)

    return {
      total_earnings,
      pending_balance: 0, // TODO: Implement pending balance logic
      available_balance: total_earnings, // Simplified for now
      total_payouts: 0, // TODO: Get from payouts table
      this_month_earnings
    }
  },

  /**
   * Get transaction history
   */
  async getTransactions(): Promise<Transaction[]> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        total_amount,
        platform_fee,
        seller_payout,
        status,
        created_at,
        buyer:profiles!buyer_id(username),
        listing:listings!listing_id(title)
      `)
      .eq('seller_id', user.id)
      .in('status', ['completed', 'processing', 'paid'])
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data || []).map(order => ({
      id: order.id,
      order_id: order.id,
      order_number: order.order_number || `#${order.id.slice(0, 8)}`,
      buyer_username: order.buyer?.username || 'Unknown',
      amount: order.total_amount,
      platform_fee: order.platform_fee,
      net_amount: order.seller_payout,
      status: order.status,
      created_at: order.created_at,
      listing_title: order.listing?.title || 'N/A'
    }))
  },

  /**
   * Get payout history (placeholder - requires payouts table)
   */
  async getPayouts(): Promise<Payout[]> {
    // TODO: Implement when payouts table is created
    return []
  },
}

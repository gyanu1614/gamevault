import { createClient } from '@/lib/supabase/client'

// =====================================================
// Types & Interfaces
// =====================================================

export interface Review {
  id: string
  order_id: string
  reviewer_id: string
  seller_id: string
  listing_id: string
  game_id: string | null
  rating: number
  title: string | null
  comment: string
  is_positive: boolean
  seller_response: string | null
  seller_responded_at: string | null
  is_verified_purchase: boolean
  is_visible: boolean
  flagged_for_moderation: boolean
  moderation_reason: string | null
  created_at: string
  updated_at: string
}

export interface ReviewWithRelations extends Review {
  buyer?: {
    id: string
    username: string
    avatar_url: string | null
  }
  seller?: {
    id: string
    username: string
    shop_name: string | null
    avatar_url: string | null
  }
  listing?: {
    id: string
    title: string
    slug: string
  }
  game?: {
    id: string
    name: string
    slug: string
  }
  order?: {
    id: string
    order_number: string
  }
}

export interface ReviewFilters {
  sellerId?: string
  listingId?: string
  gameId?: string
  reviewerId?: string
  minRating?: number
  maxRating?: number
  sortBy?: 'created_at' | 'rating'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export interface CreateReviewData {
  orderId: string
  rating: number
  title?: string
  comment: string
}

export interface ReviewEligibility {
  canReview: boolean
  reason?: string
  order?: {
    id: string
    order_number: string
    seller_id: string
    listing_id: string
  }
}

// =====================================================
// API Functions
// =====================================================

/**
 * Check if a user can leave a review for an order
 */
export async function checkReviewEligibility(orderId: string): Promise<{
  data: ReviewEligibility | null
  error: any
}> {
  const supabase = createClient()

  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return {
        data: { canReview: false, reason: 'Not authenticated' },
        error: null
      }
    }

    // Check if order exists and belongs to user
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, buyer_id, seller_id, listing_id, status')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return {
        data: { canReview: false, reason: 'Order not found' },
        error: orderError
      }
    }

    // Check if user is the buyer
    if (order.buyer_id !== user.id) {
      return {
        data: { canReview: false, reason: 'Not the buyer' },
        error: null
      }
    }

    // Check if order is completed
    if (order.status !== 'completed') {
      return {
        data: { canReview: false, reason: 'Order not completed' },
        error: null
      }
    }

    // Check if review already exists
    const { data: existingReview, error: reviewError } = await supabase
      .from('reviews')
      .select('id')
      .eq('order_id', orderId)
      .single()

    if (existingReview) {
      return {
        data: { canReview: false, reason: 'Review already exists' },
        error: null
      }
    }

    // All checks passed
    return {
      data: {
        canReview: true,
        order: {
          id: order.id,
          order_number: order.order_number,
          seller_id: order.seller_id,
          listing_id: order.listing_id
        }
      },
      error: null
    }
  } catch (err) {
    console.error('Error checking review eligibility:', err)
    return { data: null, error: err }
  }
}

/**
 * Create a new review
 */
export async function createReview(reviewData: CreateReviewData): Promise<{
  data: Review | null
  error: any
}> {
  const supabase = createClient()

  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { data: null, error: new Error('Not authenticated') }
    }

    // Check eligibility first
    const { data: eligibility, error: eligibilityError } = await checkReviewEligibility(reviewData.orderId)
    if (eligibilityError || !eligibility?.canReview) {
      return {
        data: null,
        error: new Error(eligibility?.reason || 'Cannot create review')
      }
    }

    // Create the review (without complex joins to avoid RLS recursion)
    const reviewInsert = {
      order_id: reviewData.orderId,
      reviewer_id: user.id,
      seller_id: eligibility.order!.seller_id,
      listing_id: eligibility.order!.listing_id,
      rating: reviewData.rating,
      title: reviewData.title || null,
      comment: reviewData.comment,
      is_verified_purchase: true,
      is_visible: true
    }

    const { data, error } = await supabase
      .from('reviews')
      .insert(reviewInsert)
      .select('*')
      .single()

    if (error) {
      console.error('Error creating review:', error)
      return { data: null, error }
    }

    return { data, error: null }
  } catch (err) {
    console.error('Error in createReview:', err)
    return { data: null, error: err }
  }
}

/**
 * Get reviews with optional filters
 */
export async function getReviews(filters: ReviewFilters = {}): Promise<{
  data: ReviewWithRelations[] | null
  error: any
}> {
  const supabase = createClient()

  try {
    let query = supabase
      .from('reviews')
      .select(`
        *,
        buyer:profiles!reviews_reviewer_id_fkey(id, username, avatar_url),
        seller:profiles!reviews_seller_id_fkey(id, username, shop_name, avatar_url),
        listing:listings(id, title, slug),
        game:games(id, name, slug),
        order:orders(id, order_number)
      `)
      .eq('is_visible', true)

    // Apply filters
    if (filters.sellerId) {
      query = query.eq('seller_id', filters.sellerId)
    }

    if (filters.listingId) {
      query = query.eq('listing_id', filters.listingId)
    }

    if (filters.gameId) {
      query = query.eq('game_id', filters.gameId)
    }

    if (filters.reviewerId) {
      query = query.eq('reviewer_id', filters.reviewerId)
    }

    if (filters.minRating !== undefined) {
      query = query.gte('rating', filters.minRating)
    }

    if (filters.maxRating !== undefined) {
      query = query.lte('rating', filters.maxRating)
    }

    // Apply sorting
    const sortBy = filters.sortBy || 'created_at'
    const sortOrder = filters.sortOrder || 'desc'
    query = query.order(sortBy, { ascending: sortOrder === 'asc' })

    // Apply pagination
    if (filters.limit) {
      query = query.limit(filters.limit)
    }

    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching reviews:', error)
      return { data: null, error }
    }

    return { data: data as ReviewWithRelations[], error: null }
  } catch (err) {
    console.error('Error in getReviews:', err)
    return { data: null, error: err }
  }
}

/**
 * Get seller reviews with stats
 */
export async function getSellerReviews(sellerId: string, filters: ReviewFilters = {}): Promise<{
  data: {
    reviews: ReviewWithRelations[]
    stats: {
      avgRating: number
      totalReviews: number
      positivePercentage: number
      ratingDistribution: { [key: number]: number }
    }
  } | null
  error: any
}> {
  const supabase = createClient()

  try {
    // Get reviews
    const { data: reviews, error: reviewsError } = await getReviews({
      ...filters,
      sellerId
    })

    if (reviewsError) {
      return { data: null, error: reviewsError }
    }

    // Get seller profile for stats
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('seller_rating, total_reviews, positive_reviews')
      .eq('id', sellerId)
      .single()

    if (profileError) {
      console.error('Error fetching seller profile:', profileError)
    }

    // Calculate rating distribution
    const ratingDistribution: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    reviews?.forEach(review => {
      ratingDistribution[review.rating] = (ratingDistribution[review.rating] || 0) + 1
    })

    const stats = {
      avgRating: profile?.seller_rating || 0,
      totalReviews: profile?.total_reviews || 0,
      positivePercentage: profile?.total_reviews
        ? Math.round(((profile?.positive_reviews || 0) / profile.total_reviews) * 100)
        : 0,
      ratingDistribution
    }

    return {
      data: {
        reviews: reviews || [],
        stats
      },
      error: null
    }
  } catch (err) {
    console.error('Error in getSellerReviews:', err)
    return { data: null, error: err }
  }
}

/**
 * Get listing reviews
 */
export async function getListingReviews(listingId: string, filters: ReviewFilters = {}): Promise<{
  data: ReviewWithRelations[] | null
  error: any
}> {
  return getReviews({ ...filters, listingId })
}

/**
 * Get a single review by ID
 */
export async function getReview(reviewId: string): Promise<{
  data: ReviewWithRelations | null
  error: any
}> {
  const supabase = createClient()

  try {
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        *,
        buyer:profiles!reviews_reviewer_id_fkey(id, username, avatar_url),
        seller:profiles!reviews_seller_id_fkey(id, username, shop_name, avatar_url),
        listing:listings(id, title, slug),
        game:games(id, name, slug),
        order:orders(id, order_number)
      `)
      .eq('id', reviewId)
      .single()

    if (error) {
      console.error('Error fetching review:', error)
      return { data: null, error }
    }

    return { data: data as ReviewWithRelations, error: null }
  } catch (err) {
    console.error('Error in getReview:', err)
    return { data: null, error: err }
  }
}

/**
 * Update a review (buyer can edit within 30 days, once per 24 hours)
 */
export async function updateReview(
  reviewId: string,
  updates: { rating?: number; title?: string; comment?: string }
): Promise<{
  data: Review | null
  error: any
}> {
  const supabase = createClient()

  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { data: null, error: new Error('Not authenticated') }
    }

    // First, fetch the current review to check constraints
    const { data: currentReview, error: fetchError } = await supabase
      .from('reviews')
      .select('id, reviewer_id, created_at, last_edited_at, edit_count')
      .eq('id', reviewId)
      .eq('reviewer_id', user.id)
      .single()

    if (fetchError || !currentReview) {
      return { data: null, error: new Error('Review not found or you don\'t have permission to edit it') }
    }

    // Check 30-day window (client-side check before DB)
    const createdDate = new Date(currentReview.created_at)
    const now = new Date()
    const daysDifference = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24))

    if (daysDifference > 30) {
      return { data: null, error: new Error('Edit window expired. Reviews can only be edited within 30 days of creation.') }
    }

    // Check 24-hour frequency limit (if last_edited_at exists)
    if (currentReview.last_edited_at) {
      const lastEditDate = new Date(currentReview.last_edited_at)
      const hoursSinceLastEdit = Math.floor((now.getTime() - lastEditDate.getTime()) / (1000 * 60 * 60))

      if (hoursSinceLastEdit < 24) {
        const hoursRemaining = 24 - hoursSinceLastEdit
        return {
          data: null,
          error: new Error(`You can only edit once per 24 hours. Please wait ${hoursRemaining} more ${hoursRemaining === 1 ? 'hour' : 'hours'}.`)
        }
      }
    }

    // Update the review (triggers will handle edit_count, last_edited_at, and history)
    const { data, error } = await supabase
      .from('reviews')
      .update(updates)
      .eq('id', reviewId)
      .eq('reviewer_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating review:', error)

      // Parse specific RLS policy errors
      if (error.message?.includes('violates row-level security policy')) {
        return { data: null, error: new Error('Unable to edit review. Check edit window and frequency limits.') }
      }

      return { data: null, error }
    }

    return { data, error: null }
  } catch (err) {
    console.error('Error in updateReview:', err)
    return { data: null, error: err }
  }
}

/**
 * Add seller response to a review
 */
export async function addSellerResponse(
  reviewId: string,
  response: string
): Promise<{
  data: Review | null
  error: any
}> {
  const supabase = createClient()

  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { data: null, error: new Error('Not authenticated') }
    }

    // Update the review with seller response
    const { data, error } = await supabase
      .from('reviews')
      .update({
        seller_response: response,
        seller_responded_at: new Date().toISOString()
      })
      .eq('id', reviewId)
      .eq('seller_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error adding seller response:', error)
      return { data: null, error }
    }

    return { data, error: null }
  } catch (err) {
    console.error('Error in addSellerResponse:', err)
    return { data: null, error: err }
  }
}

/**
 * Delete a review (admin only)
 */
export async function deleteReview(reviewId: string): Promise<{
  data: boolean
  error: any
}> {
  const supabase = createClient()

  try {
    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', reviewId)

    if (error) {
      console.error('Error deleting review:', error)
      return { data: false, error }
    }

    return { data: true, error: null }
  } catch (err) {
    console.error('Error in deleteReview:', err)
    return { data: false, error: err }
  }
}

/**
 * Flag a review for moderation
 */
export async function flagReview(reviewId: string, reason: string): Promise<{
  data: boolean
  error: any
}> {
  const supabase = createClient()

  try {
    const { error } = await supabase
      .from('reviews')
      .update({
        flagged_for_moderation: true,
        moderation_reason: reason
      })
      .eq('id', reviewId)

    if (error) {
      console.error('Error flagging review:', error)
      return { data: false, error }
    }

    return { data: true, error: null }
  } catch (err) {
    console.error('Error in flagReview:', err)
    return { data: false, error: err }
  }
}

/**
 * Get review for a specific order (check if user has already reviewed)
 */
export async function getOrderReview(orderId: string): Promise<{
  data: ReviewWithRelations | null
  error: any
}> {
  const supabase = createClient()

  try {
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        *,
        buyer:profiles!reviews_reviewer_id_fkey(id, username, avatar_url),
        seller:profiles!reviews_seller_id_fkey(id, username, shop_name, avatar_url),
        listing:listings(id, title, slug),
        game:games(id, name, slug),
        order:orders(id, order_number)
      `)
      .eq('order_id', orderId)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is fine
      console.error('Error fetching order review:', error)
      return { data: null, error }
    }

    return { data: data as ReviewWithRelations || null, error: null }
  } catch (err) {
    console.error('Error in getOrderReview:', err)
    return { data: null, error: err }
  }
}


/**
 * Get review edit history (admin only)
 */
export async function getReviewEditHistory(
  reviewId: string
): Promise<{
  data: any[] | null
  error: any
}> {
  const supabase = createClient()

  try {
    const { data, error } = await supabase
      .from('review_edit_history')
      .select(`
        id,
        old_rating,
        new_rating,
        old_comment,
        new_comment,
        old_title,
        new_title,
        edited_at,
        editor_id
      `)
      .eq("review_id", reviewId)
      .order("edited_at", { ascending: false })

    if (error) {
      console.error("Error fetching review edit history:", error)
      return { data: null, error }
    }

    return { data, error: null }
  } catch (err) {
    console.error("Error in getReviewEditHistory:", err)
    return { data: null, error: err }
  }
}

/**
 * Check if user can edit a specific review
 */
export async function canEditReview(reviewId: string): Promise<{
  canEdit: boolean
  reason?: string
  error?: any
}> {
  const supabase = createClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { canEdit: false, reason: "Not authenticated" }
    }

    const { data: review, error } = await supabase
      .from("reviews")
      .select("reviewer_id, created_at, last_edited_at")
      .eq("id", reviewId)
      .single()

    if (error || !review) {
      return { canEdit: false, reason: "Review not found" }
    }

    if (review.reviewer_id !== user.id) {
      return { canEdit: false, reason: "Not your review" }
    }

    const createdDate = new Date(review.created_at)
    const now = new Date()
    const daysDifference = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24))

    if (daysDifference > 30) {
      return { canEdit: false, reason: "30-day edit window expired" }
    }

    if (review.last_edited_at) {
      const lastEditDate = new Date(review.last_edited_at)
      const hoursSinceLastEdit = Math.floor((now.getTime() - lastEditDate.getTime()) / (1000 * 60 * 60))

      if (hoursSinceLastEdit < 24) {
        return { canEdit: false, reason: `Wait ${24 - hoursSinceLastEdit} more hours` }
      }
    }

    return { canEdit: true }
  } catch (err) {
    console.error("Error in canEditReview:", err)
    return { canEdit: false, error: err }
  }
}


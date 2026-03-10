/**
 * Admin Reviews Actions
 *
 * Server actions for admin review management
 */

'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface AdminReviewFilters {
  status?: string[] // flagged, hidden, visible
  rating?: number[]
  sellerId?: string
  buyerId?: string
  gameId?: string
  search?: string
  page?: number
  limit?: number
}

export interface AdminReviewStats {
  total_reviews: number
  flagged_reviews: number
  hidden_reviews: number
  avg_rating: number
  positive_reviews: number
  negative_reviews: number
}

/**
 * Get reviews with filters (admin)
 */
export async function getAdminReviews(filters: AdminReviewFilters = {}) {
  const supabase = await createClient()

  try {
    const {
      status = [],
      rating = [],
      sellerId,
      buyerId,
      gameId,
      search,
      page = 1,
      limit = 20
    } = filters

    let query = supabase
      .from('reviews')
      .select(`
        *,
        buyer:profiles!reviews_reviewer_id_fkey (
          id,
          username,
          avatar_url
        ),
        seller:profiles!reviews_seller_id_fkey (
          id,
          username,
          shop_name,
          avatar_url
        ),
        listing:listings (
          id,
          title,
          slug
        ),
        game:games (
          id,
          name,
          slug
        ),
        order:orders (
          id,
          order_number
        )
      `, { count: 'exact' })

    // Status filters
    if (status.includes('flagged')) {
      query = query.eq('flagged_for_moderation', true)
    }
    if (status.includes('hidden')) {
      query = query.eq('is_visible', false)
    }
    if (status.includes('visible')) {
      query = query.eq('is_visible', true)
    }

    // Rating filter
    if (rating.length > 0) {
      query = query.in('rating', rating)
    }

    // Seller filter
    if (sellerId) {
      query = query.eq('seller_id', sellerId)
    }

    // Buyer filter
    if (buyerId) {
      query = query.eq('reviewer_id', buyerId)
    }

    // Game filter
    if (gameId) {
      query = query.eq('game_id', gameId)
    }

    // Search filter
    if (search) {
      query = query.or(`comment.ilike.%${search}%,title.ilike.%${search}%`)
    }

    // Pagination
    const offset = (page - 1) * limit
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching admin reviews:', error)
      return {
        success: false,
        error: error.message,
        reviews: [],
        pagination: null
      }
    }

    return {
      success: true,
      reviews: data || [],
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      }
    }
  } catch (error: any) {
    console.error('Error in getAdminReviews:', error)
    return {
      success: false,
      error: error.message,
      reviews: [],
      pagination: null
    }
  }
}

/**
 * Get review statistics (admin)
 */
export async function getReviewStats(): Promise<{
  success: boolean
  stats?: AdminReviewStats
  error?: string
}> {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('id, rating, flagged_for_moderation, is_visible')

    if (error) {
      console.error('Error fetching review stats:', error)
      return { success: false, error: error.message }
    }

    const reviews = data || []

    const stats: AdminReviewStats = {
      total_reviews: reviews.length,
      flagged_reviews: reviews.filter(r => r.flagged_for_moderation).length,
      hidden_reviews: reviews.filter(r => !r.is_visible).length,
      avg_rating: reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0,
      positive_reviews: reviews.filter(r => r.rating >= 4).length,
      negative_reviews: reviews.filter(r => r.rating <= 2).length,
    }

    return { success: true, stats }
  } catch (error: any) {
    console.error('Error in getReviewStats:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Hide/Show review (admin)
 */
export async function toggleReviewVisibility(
  reviewId: string,
  isVisible: boolean,
  reason?: string
) {
  const supabase = await createClient()

  try {
    const { error } = await supabase
      .from('reviews')
      .update({
        is_visible: isVisible,
        moderation_reason: reason || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', reviewId)

    if (error) {
      console.error('Error toggling review visibility:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/reviews')
    return { success: true }
  } catch (error: any) {
    console.error('Error in toggleReviewVisibility:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Flag/Unflag review for moderation (admin)
 */
export async function toggleReviewFlag(
  reviewId: string,
  flagged: boolean,
  reason?: string
) {
  const supabase = await createClient()

  try {
    const { error } = await supabase
      .from('reviews')
      .update({
        flagged_for_moderation: flagged,
        moderation_reason: reason || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', reviewId)

    if (error) {
      console.error('Error toggling review flag:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/reviews')
    return { success: true }
  } catch (error: any) {
    console.error('Error in toggleReviewFlag:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Delete review (admin)
 */
export async function deleteReview(reviewId: string) {
  const supabase = await createClient()

  try {
    const { error} = await supabase
      .from('reviews')
      .delete()
      .eq('id', reviewId)

    if (error) {
      console.error('Error deleting review:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/reviews')
    return { success: true }
  } catch (error: any) {
    console.error('Error in deleteReview:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get review edit history (admin)
 */
export async function getReviewHistory(reviewId: string) {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from('review_edit_history')
      .select(`
        *,
        editor:profiles!review_edit_history_editor_id_fkey (
          username,
          avatar_url
        )
      `)
      .eq('review_id', reviewId)
      .order('edited_at', { ascending: false })

    if (error) {
      console.error('Error fetching review history:', error)
      return { success: false, error: error.message, history: [] }
    }

    return { success: true, history: data || [] }
  } catch (error: any) {
    console.error('Error in getReviewHistory:', error)
    return { success: false, error: error.message, history: [] }
  }
}

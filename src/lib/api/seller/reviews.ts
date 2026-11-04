/**
 * Reviews a seller has received, and replies.
 *
 * Part of the browser seller API, split out of lib/api/seller-compatible.ts
 * (2026-10-20, files under ~400 lines). Import from '@/lib/api/seller-compatible'.
 */
import { supabase } from './client'
import type { Review } from './types'

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
        reviewer:public_profiles!reviews_reviewer_id_fkey (
          id,
          username,
          avatar_url
        ),
        order:order_id (
          listing_id,
          listing:listing_id (title)
        )
      `)
      .eq('seller_id', user.id)
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
    const { data, error } = await (supabase
      .from('reviews')
      .update as any)({
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
      .eq('seller_id', user.id) as any

    if (error) throw error

    const totalReviews = reviews?.length || 0
    const avgRating = totalReviews > 0
      ? reviews!.reduce((sum: number, r: any) => sum + r.rating, 0) / totalReviews
      : 0

    const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    reviews?.forEach((r: any) => {
      ratingCounts[r.rating as keyof typeof ratingCounts]++
    })

    const responsesCount = reviews?.filter((r: any) => r.seller_response).length || 0
    const responseRate = totalReviews > 0 ? (responsesCount / totalReviews) * 100 : 0

    return {
      avgRating,
      totalReviews,
      ratingCounts,
      responseRate,
    }
  },
}

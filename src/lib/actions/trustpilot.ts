/**
 * Trustpilot Integration Actions
 *
 * Invitation status and review tracking.
 */

'use server'

import { createClient } from '@/lib/supabase/server'

// Sending an invitation lives in src/lib/trustpilot/send-invitation.ts: it
// runs as the service role for the cron and must not be a public action.

/**
 * Get Trustpilot invitation status for an order
 */
export async function getTrustpilotInvitationStatus(orderId: string): Promise<{
  success: boolean
  invitation?: any
  error?: string
}> {
  try {
    const supabase = await createClient()

    const { data: invitation, error } = await supabase
      .from('trustpilot_invitations')
      .select('*')
      .eq('order_id', orderId)
      .single()

    if (error && error.code !== 'PGRST116') {
      return { success: false, error: error.message }
    }

    return { success: true, invitation: invitation || null }
  } catch (error: any) {
    console.error('Error in getTrustpilotInvitationStatus:', error)
    return { success: false, error: error.message || 'Failed to get invitation status' }
  }
}

/**
 * Mark invitation as reviewed (called by webhook handler)
 */
export async function markTrustpilotReviewReceived(
  referenceId: string,
  reviewData?: {
    rating?: number
    reviewUrl?: string
  }
): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = await createClient()

    const { error } = await (supabase
      .from('trustpilot_invitations')
      .update as any)({
        review_submitted: true,
        review_submitted_at: new Date().toISOString(),
        ...(reviewData?.rating && { review_rating: reviewData.rating }),
        ...(reviewData?.reviewUrl && { review_url: reviewData.reviewUrl }),
      })
      .eq('order_id', referenceId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error in markTrustpilotReviewReceived:', error)
    return { success: false, error: error.message || 'Failed to mark review as received' }
  }
}

/**
 * Get Trustpilot stats (for admin dashboard)
 */
export async function getTrustpilotStats(): Promise<{
  success: boolean
  stats?: {
    totalInvitations: number
    reviewsSubmitted: number
    pendingReviews: number
    averageRating: number | null
    conversionRate: number
  }
  error?: string
}> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase.from('trustpilot_stats').select('*').single() as any

    if (error) {
      return { success: false, error: error.message }
    }

    const totalInvitations = Number(data?.total_invitations || 0)
    const reviewsSubmitted = Number(data?.reviews_submitted || 0)

    return {
      success: true,
      stats: {
        totalInvitations,
        reviewsSubmitted,
        pendingReviews: Number(data?.pending_reviews || 0),
        averageRating: data?.average_rating ? Number(data.average_rating) : null,
        conversionRate:
          totalInvitations > 0 ? Math.round((reviewsSubmitted / totalInvitations) * 100) : 0,
      },
    }
  } catch (error: any) {
    console.error('Error in getTrustpilotStats:', error)
    return { success: false, error: error.message || 'Failed to get Trustpilot stats' }
  }
}

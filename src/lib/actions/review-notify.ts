'use server'

/**
 * Tell a seller they got a review: one bell notification and (when their
 * "New Reviews" email switch is on) one email.
 *
 * Reviews are inserted from the browser (src/lib/api/reviews.ts createReview,
 * RLS-checked), so there was no server step to hang a notification on; the
 * review form calls this right after its insert succeeds. It trusts nothing
 * from the client but the review id:
 *   - the caller must be the review's author,
 *   - the review must be fresh (so calling it again later does nothing),
 *   - notify_once dedupes on the review id, and the email only goes out on
 *     the call that actually created the notification.
 * Comms only: never throws to the caller.
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { emailAllowed } from '@/lib/email/preferences'

const FRESH_MS = 10 * 60 * 1000

export async function notifySellerOfReview(reviewId: string): Promise<void> {
  try {
    if (typeof reviewId !== 'string' || !reviewId) return

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const service = createServiceRoleClient() as any
    const { data: review } = await service
      .from('reviews')
      .select('id, reviewer_id, seller_id, rating, comment, created_at')
      .eq('id', reviewId)
      .maybeSingle()
    if (!review || review.reviewer_id !== user.id || !review.seller_id) return
    if (Date.now() - new Date(review.created_at).getTime() > FRESH_MS) return

    const { data: reviewer } = await service.from('profiles').select('username').eq('id', review.reviewer_id).maybeSingle()
    const reviewerName: string = reviewer?.username || 'A buyer'
    const rating = Number(review.rating) || 0

    const { data: created } = await service.rpc('notify_once', {
      p_user_id: review.seller_id,
      p_type: 'review_received',
      p_title: 'New Review',
      p_message: `${reviewerName} rated you ${rating} out of 5`,
      p_link: '/account/reviews',
      p_dedupe_key: `review_received:${review.id}`,
    })
    if (created !== true) return

    if (!(await emailAllowed(review.seller_id, 'new_review'))) return

    const { data: seller } = await service
      .from('profiles')
      .select('email, username, full_name, shop_name')
      .eq('id', review.seller_id)
      .maybeSingle()
    if (!seller?.email) return

    const { sendNewReviewEmail } = await import('@/lib/email')
    await sendNewReviewEmail({
      to: seller.email,
      name: seller.shop_name || seller.full_name || seller.username || 'there',
      reviewerName,
      rating,
      comment: review.comment ?? '',
    })
  } catch (err) {
    console.error('[notifySellerOfReview] comms failed:', err)
  }
}

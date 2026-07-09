/**
 * V54 — /admin/reviews server wrapper.
 *
 * Fetches the default (unfiltered) review list + stats ON THE SERVER
 * (same server actions the client uses) and seeds the client component
 * via props. The page ships fully rendered — no client-side "Loading
 * reviews…" pass on refresh. Filter changes and moderation actions keep
 * their client-side loadData() refresh flow.
 */

import { getAdminReviews, getReviewStats } from '@/lib/actions/admin-reviews'
import ReviewsPageClient from './_components/ReviewsPageClient'

export const metadata = { title: 'Reviews' }

export default async function AdminReviewsPage() {
  // Same call shape as the client's initial loadData(): default filters
  // are empty arrays. Filtered views are fetched client-side as before.
  const [reviewsResult, statsResult] = await Promise.all([
    getAdminReviews({ status: [], rating: [] }),
    getReviewStats(),
  ])

  return (
    <ReviewsPageClient
      initialReviews={reviewsResult.success ? reviewsResult.reviews ?? [] : []}
      initialStats={statsResult.success ? statsResult.stats ?? null : null}
    />
  )
}

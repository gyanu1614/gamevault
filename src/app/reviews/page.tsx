/**
 * Legacy /reviews → /account/reviews redirect.
 *
 * This top-level route was an orphaned page rendering hardcoded MOCK reviewers
 * ("gamer123", fabricated stats) — nothing in the app links to it; all review
 * navigation points to /account/reviews (the real, data-backed page).
 * Redirect there rather than ship fake data.
 */

import { redirect } from 'next/navigation'

export default function LegacyReviewsRedirect() {
  redirect('/account/reviews')
}

/**
 * Our Trustpilot pages. Plain constants (no 'server-only'): the order page,
 * the receipt email and the admin card all link to the same two URLs.
 */

/** Where a buyer writes a review. */
export const TRUSTPILOT_REVIEW_URL = 'https://www.trustpilot.com/evaluate/dropmarket.gg'

/** Our public profile (reviews, TrustScore). */
export const TRUSTPILOT_PROFILE_URL = 'https://www.trustpilot.com/review/dropmarket.gg'

/** The public TrustBox stays hidden below this many reviews — no "0 reviews" anywhere. */
export const TRUSTBOX_MIN_REVIEWS = 10

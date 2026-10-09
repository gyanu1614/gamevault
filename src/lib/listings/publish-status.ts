import { UNVERIFIED_REVIEW_PRICE_USD } from '@/lib/fees'

/**
 * The status a NEW submission lands in, given the seller's publish policy
 * (get_seller_publish_policy). One rule for publishListing, bulk (with its
 * own auto_approve_bulk flag) and the drafts submitted on application
 * approval (GRO-08), so moderation cannot differ by entry point.
 *
 * Open seller signup (2026-10-08): a seller who has not verified their
 * identity (profiles.is_verified false — no blue badge yet) lists freely,
 * but any listing priced above UNVERIFIED_REVIEW_PRICE_USD is held for
 * review. The DB trigger check_listing_moderation enforces the same rule as
 * a safety net; deciding it here too means the wizard shows the right status
 * back immediately.
 */
export interface PublishPolicyForStatus {
  needs_moderation: boolean
  auto_approve_single: boolean
  /** Missing = unverified (fail closed). */
  is_verified?: boolean
}

export function decidePublishStatus(
  policy: PublishPolicyForStatus,
  requested: 'draft' | 'active',
  /** The listing's `price` as stored (USD). Omit when the call only flips status. */
  price?: number | null,
): 'draft' | 'active' | 'pending_approval' {
  if (requested === 'draft') return 'draft'
  if (policy.needs_moderation || !policy.auto_approve_single) return 'pending_approval'
  if (needsUnverifiedPriceReview(policy.is_verified, price)) return 'pending_approval'
  return 'active'
}

/** True when an unverified seller's price is above the review line. */
export function needsUnverifiedPriceReview(isVerified: boolean | undefined, price: number | null | undefined): boolean {
  if (isVerified === true) return false
  if (price == null || !Number.isFinite(price)) return false
  return price > UNVERIFIED_REVIEW_PRICE_USD
}

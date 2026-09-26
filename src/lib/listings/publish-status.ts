/**
 * The status a NEW submission lands in, given the seller's publish policy
 * (get_seller_publish_policy). One rule for publishListing, bulk (with its
 * own auto_approve_bulk flag) and the drafts submitted on application
 * approval (GRO-08), so moderation cannot differ by entry point.
 */
export interface PublishPolicyForStatus {
  needs_moderation: boolean
  auto_approve_single: boolean
}

export function decidePublishStatus(
  policy: PublishPolicyForStatus,
  requested: 'draft' | 'active',
): 'draft' | 'active' | 'pending_approval' {
  if (requested === 'draft') return 'draft'
  return policy.needs_moderation || !policy.auto_approve_single ? 'pending_approval' : 'active'
}

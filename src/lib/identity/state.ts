/** What a seller sees for their ID check. Plain module: safe from client code. */
export type IdentityState = 'not_started' | 'in_review' | 'verified' | 'needs_attention'

export type IdentityCheckStatus = 'started' | 'in_review' | 'approved' | 'declined'

/**
 * profiles.is_verified decides; the latest check only explains why a seller is
 * not there yet. A check opened and never finished is the same as none.
 */
export function identityStateFrom(isVerified: boolean | null | undefined, latest: IdentityCheckStatus | null | undefined): IdentityState {
  if (isVerified === true) return 'verified'
  if (latest === 'in_review') return 'in_review'
  if (latest === 'declined') return 'needs_attention'
  return 'not_started'
}

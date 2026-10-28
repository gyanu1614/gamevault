/**
 * Submit card dispute evidence to Stripe (the admin's one-click action).
 * `submit: true` sends it to the bank at once; Stripe accepts one submission.
 * Needs Disputes: Write on the restricted key.
 */
import 'server-only'

import { stripeClient } from './client'
import type { DisputeEvidence } from './dispute-evidence'

export async function submitStripeDisputeEvidence(disputeId: string, evidence: DisputeEvidence): Promise<{ status: string }> {
  if (!/^dp_[A-Za-z0-9]+$/.test(disputeId)) throw new Error('stripe: not a dispute id')
  const dispute = await stripeClient().disputes.update(disputeId, { evidence, submit: true })
  return { status: dispute.status }
}

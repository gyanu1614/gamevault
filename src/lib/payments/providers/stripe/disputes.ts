/**
 * Submit card dispute evidence to Stripe (the admin's one-click action).
 * `submit: true` sends it to the bank at once; Stripe accepts one submission.
 * Needs Disputes: Write on the restricted key, and Files: Write for the
 * delivery-photo PDF.
 */
import 'server-only'

import { stripeClient } from './client'
import type { DisputeEvidence } from './dispute-evidence'

export async function submitStripeDisputeEvidence(disputeId: string, evidence: DisputeEvidence): Promise<{ status: string }> {
  if (!/^dp_[A-Za-z0-9]+$/.test(disputeId)) throw new Error('stripe: not a dispute id')
  const dispute = await stripeClient().disputes.update(disputeId, { evidence, submit: true })
  return { status: dispute.status }
}

/** Uploads the delivery-photo PDF for a dispute; returns the Stripe file id. */
export async function uploadStripeDisputeFile(pdf: Uint8Array, name: string): Promise<string> {
  const file = await stripeClient().files.create({ purpose: 'dispute_evidence', file: { data: pdf, name, type: 'application/pdf' } })
  return file.id
}

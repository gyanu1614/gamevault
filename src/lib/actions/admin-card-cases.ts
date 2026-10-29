'use server'

/**
 * Admin actions on card cases (2026-10-28): submit dispute evidence to Stripe,
 * decide who pays for a card refund made after the seller was paid, unblock a
 * buyer. Each re-checks the admin permission server-side and goes through its
 * service-role SQL seam; the money itself only ever moves inside SQL.
 */

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { requirePermission } from '@/lib/actions/admin-permissions'
import { logAdminActivity } from '@/lib/admin/activity-log'
import { ADMIN_ACTIONS } from '@/lib/admin/permissions-constants'
import { loadCardCase, loadDisputeEvidenceInput } from '@/lib/admin/card-cases'
import { orderItemTitleFor } from '@/lib/orders/item-title-server'

type Result = { success: true; message: string } | { success: false; error: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function adminSubmitCardDisputeEvidence(caseId: string): Promise<Result> {
  const admin = await requirePermission('disputes.resolve')
  if (!UUID.test(caseId)) return { success: false, error: 'Unknown card case.' }
  const c = await loadCardCase(caseId)
  if (!c || c.kind !== 'dispute') return { success: false, error: 'Unknown card dispute.' }
  if (c.status !== 'open') return { success: false, error: 'This dispute is already closed.' }
  if (c.evidence_submitted_at) return { success: false, error: 'Evidence was already submitted for this dispute.' }

  const input = await loadDisputeEvidenceInput(c.order_id, await orderItemTitleFor(c.order_id, 'Game item'))
  if (!input) return { success: false, error: 'The order for this dispute was not found.' }
  const { buildDisputeEvidence } = await import('@/lib/payments/providers/stripe/dispute-evidence')
  const { submitStripeDisputeEvidence } = await import('@/lib/payments/providers/stripe/disputes')
  try {
    await submitStripeDisputeEvidence(c.provider_ref, buildDisputeEvidence(input))
  } catch (e) {
    return { success: false, error: `Stripe refused the evidence: ${(e as Error)?.message ?? 'unknown error'}` }
  }
  const { error } = await (createServiceRoleClient().rpc as any)('card_dispute_mark_evidence', { p_case_id: caseId })
  if (error) console.error(`[CardCases] evidence sent for ${caseId} but not stamped:`, error.message)

  await logAdminActivity({
    action: ADMIN_ACTIONS.DISPUTE_RESOLVED,
    actionCategory: 'dispute',
    resourceType: 'order',
    resourceId: c.order_id,
    resourceName: `Card dispute ${c.provider_ref}`,
    newState: { card_case: caseId, evidence_submitted: true, by: admin.userId },
    notes: 'Card dispute evidence submitted to Stripe',
  }).catch(() => undefined)
  revalidatePath(`/admin/orders/${c.order_id}`)
  return { success: true, message: 'Evidence submitted to the bank through Stripe.' }
}

export async function adminSettleCardCase(caseId: string, bearer: 'seller' | 'platform'): Promise<Result> {
  const admin = await requirePermission('disputes.resolve')
  if (!UUID.test(caseId) || (bearer !== 'seller' && bearer !== 'platform')) return { success: false, error: 'Invalid request.' }
  const { data, error } = await (createServiceRoleClient().rpc as any)('card_case_settle', {
    p_case_id: caseId,
    p_bearer: bearer,
    p_actor_id: admin.userId,
  })
  if (error) return { success: false, error: error.message }
  if (!data?.settled) return { success: false, error: `This case cannot be settled (${data?.reason ?? 'unknown'}).` }

  const c = await loadCardCase(caseId)
  await logAdminActivity({
    action: ADMIN_ACTIONS.DISPUTE_RESOLVED,
    actionCategory: 'dispute',
    resourceType: 'order',
    resourceId: c?.order_id ?? caseId,
    resourceName: `Card case ${c?.provider_ref ?? caseId}`,
    newState: { card_case: caseId, bearer, card_minor: data.card_minor },
    notes: bearer === 'seller' ? 'Seller pays for the card refund' : 'DropMarket pays for the card refund',
  }).catch(() => undefined)
  if (c) revalidatePath(`/admin/orders/${c.order_id}`)
  return { success: true, message: bearer === 'seller' ? 'Booked: the seller pays, the order is refunded.' : 'Booked: DropMarket pays, the seller keeps the sale.' }
}

export async function adminUnblockBuyer(userId: string, orderId: string): Promise<Result> {
  await requirePermission('disputes.resolve')
  if (!UUID.test(userId) || !UUID.test(orderId)) return { success: false, error: 'Invalid request.' }
  const { data, error } = await (createServiceRoleClient().rpc as any)('buyer_unblock', { p_user_id: userId })
  if (error) return { success: false, error: error.message }
  await logAdminActivity({
    action: ADMIN_ACTIONS.USER_UNSUSPENDED,
    actionCategory: 'user',
    resourceType: 'user',
    resourceId: userId,
    resourceName: 'Buyer unblocked',
    newState: { buyer_blocked: false, from_order: orderId },
  }).catch(() => undefined)
  revalidatePath(`/admin/orders/${orderId}`)
  return data ? { success: true, message: 'The buyer can check out again.' } : { success: false, error: 'This buyer was not blocked.' }
}

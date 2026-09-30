'use server'

/**
 * Refund to the original payment method (refund policy, 2026-09-30).
 *
 * Store credit is the default and instant. A buyer whose refund sits as
 * store credit can ask for it to go back to the payment method they used;
 * an admin approves (each provider refund costs us a fee); the money leaves
 * through the provider refund outbox. Every money move is ONE RPC:
 *   refund_to_source_request / _approve / _reject (SQL), the drain in
 *   lib/payments/cancel-outbox.ts, and refund_to_source_fail on a terminal
 *   provider failure (the credit comes back, admins are alerted once).
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/actions/admin-permissions'
import { logAudit } from '@/lib/audit'
import { revalidatePath } from 'next/cache'

export type RefundToSourceStatus = 'pending' | 'approved' | 'sent' | 'failed' | 'rejected'

export interface RefundToSourceRequest {
  id: string
  order_id: string
  buyer_id: string
  amount_minor: number
  currency: string
  provider: string
  provider_charge_id: string
  status: RefundToSourceStatus
  admin_notes: string | null
  failure_reason: string | null
  provider_refund_id: string | null
  created_at: string
  decided_at: string | null
  sent_at: string | null
}

const REFUSAL_COPY: Record<string, string> = {
  not_owner: 'This order is not yours.',
  exists: 'A refund request already exists for this order.',
  not_refunded: 'This order has no store-credit refund to send back.',
  no_provider_charge: 'This order was paid with store credit, so there is no payment method to refund to.',
  not_refundable: 'The payment method used on this order cannot receive refunds. Your store credit stays in your Store Balance.',
  credit_spent: 'Part of this refund has already been spent, so it can no longer be sent back to your payment method.',
}

/** Buyer: ask for the store-credit refund of this order to go back to the original method. */
export async function requestRefundToSource(orderId: string): Promise<{ success: boolean; error?: string; status?: RefundToSourceStatus }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }
    const { data, error } = await (createServiceRoleClient().rpc as any)('refund_to_source_request', {
      p_order_id: orderId,
      p_buyer_id: user.id,
    })
    if (error) throw new Error(error.message)
    if (!data?.ok) {
      return { success: false, error: REFUSAL_COPY[String(data?.reason)] ?? 'This refund cannot be sent back to your payment method right now.' }
    }
    await logAudit({ action: 'order_refund_to_source_requested', table_name: 'orders', record_id: orderId, new_data: { request_id: data.request_id, amount_minor: Number(data.amount_minor) } })
    revalidatePath(`/account/orders/${orderId}`)
    return { success: true, status: 'pending' }
  } catch (e: any) {
    return { success: false, error: String(e?.message ?? e) }
  }
}

/** Buyer / admin: the request on this order, if any, plus whether one can be made. */
export async function getMyRefundToSourceRequest(orderId: string): Promise<RefundToSourceRequest | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await createServiceRoleClient()
    .from('refund_to_source_requests')
    .select('id, order_id, buyer_id, amount_minor, currency, provider, provider_charge_id, status, admin_notes, failure_reason, provider_refund_id, created_at, decided_at, sent_at')
    .eq('order_id', orderId)
    .eq('buyer_id', user.id)
    .maybeSingle()
  return (data as RefundToSourceRequest | null) ?? null
}

/** Admin: pending and recently decided requests, newest first. */
export async function listRefundToSourceRequests(): Promise<{ data?: Array<RefundToSourceRequest & { order?: any; buyer?: any }>; error?: { message: string } }> {
  try {
    await requireAdmin()
    const { data, error } = await createServiceRoleClient()
      .from('refund_to_source_requests')
      .select('*, order:orders(id, order_number, total_amount, status), buyer:profiles!refund_to_source_requests_buyer_id_fkey(id, username, email)')
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) throw new Error(error.message)
    return { data: (data ?? []) as any }
  } catch (e: any) {
    return { error: { message: String(e?.message ?? e) } }
  }
}

/** Admin: approve — the credit leaves the wallet and the provider refund is queued, in one RPC; then drained inline. */
export async function approveRefundToSource(requestId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await requireAdmin()
    const { data, error } = await (createServiceRoleClient().rpc as any)('refund_to_source_approve', {
      p_request_id: requestId,
      p_admin_id: admin.userId,
    })
    if (error) throw new Error(error.message)
    if (!data?.approved) {
      const reason = String(data?.reason ?? 'refused')
      return {
        success: false,
        error:
          reason === 'credit_spent'
            ? 'The buyer spent the store credit before approval; the request was closed.'
            : reason === 'not_pending'
              ? `This request is already ${data?.status}.`
              : 'The request could not be approved.',
      }
    }
    const orderId = String(data.order_id)
    await logAudit({ action: 'order_refund_to_source_approved', table_name: 'orders', record_id: orderId, new_data: { request_id: requestId, admin_id: admin.userId } })
    // Send it now (best effort); the reconcile cron retries with backoff.
    const { drainCancelOutboxForOrder } = await import('@/lib/payments/cancel-outbox')
    await drainCancelOutboxForOrder(orderId)
    revalidatePath(`/account/orders/${orderId}`)
    return { success: true }
  } catch (e: any) {
    return { success: false, error: String(e?.message ?? e) }
  }
}

/** Admin: decline — the store credit stays with the buyer. */
export async function rejectRefundToSource(requestId: string, notes?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await requireAdmin()
    const { data, error } = await (createServiceRoleClient().rpc as any)('refund_to_source_reject', {
      p_request_id: requestId,
      p_admin_id: admin.userId,
      p_notes: notes?.trim() || null,
    })
    if (error) throw new Error(error.message)
    if (!data?.rejected) return { success: false, error: `This request is already ${data?.status ?? 'decided'}.` }
    return { success: true }
  } catch (e: any) {
    return { success: false, error: String(e?.message ?? e) }
  }
}

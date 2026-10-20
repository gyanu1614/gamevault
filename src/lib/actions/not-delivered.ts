'use server'

/**
 * Cancel – Not Delivered (owner 2026-10-16/19). The buyer reports an overdue
 * order; the seller has the grace window (60 min) to reply in the order chat
 * or start delivery; with no response the order cancels and refunds itself
 * as a seller fault. Every state change is ONE service-role RPC
 * (order_not_delivered_open / _withdraw / _finalize); these actions only
 * check the session, compute the due time the order page shows, and send
 * the comms.
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { notDeliveredEligibility } from '@/lib/orders/not-delivered'
import { finalizeNotDelivered } from '@/lib/orders/not-delivered-finalize'

export type NotDeliveredClaimStatus =
  | 'open'
  | 'withdrawn'
  | 'seller_responded'
  | 'delivered'
  | 'disputed'
  | 'cancelled'
  | 'auto_cancelled'

export interface NotDeliveredClaim {
  status: NotDeliveredClaimStatus
  graceEndsAt: string
}

async function sessionUserId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

/** Service role: the shared order columns + the listing's delivery time. */
async function orderFor(orderId: string) {
  const { data } = await (createServiceRoleClient() as any)
    .from('orders')
    .select('id, buyer_id, seller_id, status, delivered_at, paid_at, created_at, order_number, listing:listings!orders_listing_id_fkey(delivery_time)')
    .eq('id', orderId)
    .maybeSingle()
  return data as {
    id: string
    buyer_id: string
    seller_id: string
    status: string
    delivered_at: string | null
    paid_at: string | null
    created_at: string
    order_number: string | null
    listing: { delivery_time: string | null } | null
  } | null
}

/** Buyer: report an overdue order. The seller is told to respond within the grace window. */
export async function openNotDeliveredClaim(orderId: string): Promise<{ success: boolean; error?: string; graceEndsAt?: string }> {
  try {
    const userId = await sessionUserId()
    if (!userId) return { success: false, error: 'Not authenticated' }
    const limit = await checkRateLimit('orderReport', `user:${userId}`)
    if (limit.limited) return { success: false, error: 'Too many attempts. Please try again in a minute.' }
    const o = await orderFor(orderId)
    if (!o || o.buyer_id !== userId) return { success: false, error: 'Order not found' }
    const elig = notDeliveredEligibility({
      status: o.status,
      delivered_at: o.delivered_at,
      paid_at: o.paid_at,
      created_at: o.created_at,
      deliveryTime: o.listing?.delivery_time,
    })
    if (!elig.eligible) {
      return {
        success: false,
        error: elig.reason === 'not_overdue' ? 'The delivery time has not passed yet.' : 'This order can no longer be cancelled this way.',
      }
    }
    const svc = createServiceRoleClient() as any
    const { data, error } = await svc.rpc('order_not_delivered_open', { p_order_id: orderId, p_buyer_id: userId, p_due_at: elig.dueAt })
    if (error) throw new Error(error.message)
    if (!data?.ok) {
      return {
        success: false,
        error: data?.reason === 'closed' ? 'The seller already responded. If the order still has not arrived, open a dispute.' : 'Could not report this order. Please try again.',
      }
    }
    if (!data.already) {
      // Seller email; the in-app notifications were written by the RPC.
      try {
        const { data: seller } = await svc.from('profiles').select('email, username, full_name').eq('id', o.seller_id).single()
        if (seller?.email) {
          const [{ sendNotDeliveredSellerEmail }, { EMAIL_TOKENS }] = await Promise.all([
            import('@/lib/email/not-delivered'),
            import('@/lib/email/shell'),
          ])
          await sendNotDeliveredSellerEmail({
            to: seller.email,
            name: seller.full_name || seller.username || 'Seller',
            orderNumber: o.order_number || orderId.slice(0, 8).toUpperCase(),
            orderUrl: `${EMAIL_TOKENS.APP_URL}/account/orders/${orderId}`,
            graceMinutes: Number(data.grace_minutes ?? 60),
          })
        }
      } catch (e) {
        console.error('[NotDelivered] seller email failed:', e)
      }
    }
    return { success: true, graceEndsAt: data.grace_ends_at }
  } catch (e: any) {
    console.error('[NotDelivered] open failed:', e)
    return { success: false, error: 'Could not report this order. Please try again.' }
  }
}

/** Buyer: withdraw the report and keep waiting. */
export async function withdrawNotDeliveredClaim(orderId: string): Promise<{ success: boolean }> {
  const userId = await sessionUserId()
  if (!userId) return { success: false }
  const { data } = await (createServiceRoleClient() as any).rpc('order_not_delivered_withdraw', { p_order_id: orderId, p_buyer_id: userId })
  return { success: !!data?.ok }
}

/** Buyer or seller of the order, when the countdown ends on their screen. The SQL re-checks the clock. */
export async function finalizeNotDeliveredClaim(orderId: string): Promise<{ outcome: string | null }> {
  const userId = await sessionUserId()
  if (!userId) return { outcome: null }
  const o = await orderFor(orderId)
  if (!o || (o.buyer_id !== userId && o.seller_id !== userId)) return { outcome: null }
  try {
    const r = await finalizeNotDelivered(orderId)
    return { outcome: r.outcome }
  } catch (e) {
    console.error('[NotDelivered] finalize failed:', e)
    return { outcome: null }
  }
}

/** The order's report, for its buyer or seller (the table is service-role only). */
export async function getNotDeliveredClaim(orderId: string): Promise<NotDeliveredClaim | null> {
  const userId = await sessionUserId()
  if (!userId) return null
  const { data } = await (createServiceRoleClient() as any)
    .from('order_not_delivered_claims')
    .select('status, grace_ends_at, buyer_id, seller_id')
    .eq('order_id', orderId)
    .maybeSingle()
  if (!data || (data.buyer_id !== userId && data.seller_id !== userId)) return null
  return { status: data.status, graceEndsAt: data.grace_ends_at }
}

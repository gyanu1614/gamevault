'use server'

/**
 * Cancel – Not Delivered (owner 2026-10-16/19/20). The buyer reports an
 * overdue order; the seller has a response window = the listing's delivery
 * time (15 min .. 24 h) to reply in the order chat or start delivery. With
 * no response nothing cancels automatically: the buyer can request
 * cancellation, which lands in Admin → Orders → Cancellation Requests (with
 * an alert) for an admin to approve or reject. Every state change is ONE
 * service-role RPC (order_not_delivered_open / _withdraw / _sync /
 * _request_cancel), none of which moves money; these actions only check the
 * session, compute the due time + window the order page shows, and send the
 * seller's email.
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { notDeliveredEligibility, responseWindowMinutes } from '@/lib/orders/not-delivered'
import { syncNotDelivered } from '@/lib/orders/not-delivered-sync'

export type NotDeliveredClaimStatus =
  | 'open'
  | 'withdrawn'
  | 'seller_responded'
  | 'expired'
  | 'cancel_requested'
  | 'delivered'
  | 'disputed'
  | 'cancelled'

export interface NotDeliveredClaim {
  status: NotDeliveredClaimStatus
  graceEndsAt: string
  windowMinutes: number
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

/** Buyer: report an overdue order. The seller is told to respond within the window. */
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
        error: elig.reason === 'not_overdue' ? 'The delivery time has not passed yet.' : 'This order can no longer be reported this way.',
      }
    }
    const svc = createServiceRoleClient() as any
    const { data, error } = await svc.rpc('order_not_delivered_open', {
      p_order_id: orderId,
      p_buyer_id: userId,
      p_due_at: elig.dueAt,
      p_window_minutes: responseWindowMinutes(o.listing?.delivery_time),
    })
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
            windowMinutes: Number(data.window_minutes ?? 60),
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
export async function syncNotDeliveredClaim(orderId: string): Promise<{ outcome: string | null }> {
  const userId = await sessionUserId()
  if (!userId) return { outcome: null }
  const o = await orderFor(orderId)
  if (!o || (o.buyer_id !== userId && o.seller_id !== userId)) return { outcome: null }
  try {
    const r = await syncNotDelivered(orderId)
    return { outcome: r.outcome }
  } catch (e) {
    console.error('[NotDelivered] sync failed:', e)
    return { outcome: null }
  }
}

const REQUEST_REFUSALS: Record<string, string> = {
  not_owner: 'Order not found',
  no_claim: 'Report the order as not delivered first.',
  not_expired: 'The seller still has time to respond.',
  exists: 'A cancellation request is already waiting for review.',
  closed: 'This order can no longer be cancelled this way.',
}

/** Buyer: the seller's window ran out — ask DropMarket to cancel. An admin reviews it. */
export async function requestNotDeliveredCancel(orderId: string, note?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await sessionUserId()
    if (!userId) return { success: false, error: 'Not authenticated' }
    const limit = await checkRateLimit('orderReport', `user:${userId}`)
    if (limit.limited) return { success: false, error: 'Too many attempts. Please try again in a minute.' }
    const { data, error } = await (createServiceRoleClient() as any).rpc('order_not_delivered_request_cancel', {
      p_order_id: orderId,
      p_buyer_id: userId,
      p_note: note?.trim() ? note.trim().slice(0, 500) : null,
    })
    if (error) throw new Error(error.message)
    if (!data?.ok) return { success: false, error: REQUEST_REFUSALS[String(data?.reason)] ?? 'Could not send the request. Please try again.' }
    revalidatePath(`/account/orders/${orderId}`)
    revalidatePath('/admin/orders')
    return { success: true }
  } catch (e: any) {
    console.error('[NotDelivered] request cancel failed:', e)
    return { success: false, error: 'Could not send the request. Please try again.' }
  }
}

/**
 * The order's report, for its buyer or seller (the table is service-role
 * only). A live report is synced first, so the page shows an expiry, a
 * seller response or a delivery without waiting for the sweep.
 */
export async function getNotDeliveredClaim(orderId: string): Promise<NotDeliveredClaim | null> {
  const userId = await sessionUserId()
  if (!userId) return null
  const svc = createServiceRoleClient() as any
  const read = async () =>
    (await svc
      .from('order_not_delivered_claims')
      .select('status, grace_ends_at, window_minutes, buyer_id, seller_id')
      .eq('order_id', orderId)
      .maybeSingle()).data as any
  let row = await read()
  if (!row || (row.buyer_id !== userId && row.seller_id !== userId)) return null
  if (['open', 'expired', 'cancel_requested'].includes(row.status)) {
    const synced = await syncNotDelivered(orderId).catch(() => ({ outcome: null }))
    if (synced.outcome) row = await read()
  }
  return { status: row.status, graceEndsAt: row.grace_ends_at, windowMinutes: Number(row.window_minutes) }
}

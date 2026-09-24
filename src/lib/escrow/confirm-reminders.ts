/**
 * Halfway "please confirm you received your order" reminder (PR 7, Part 1).
 *
 * order_confirm_reminders_claim() selects delivered, unconfirmed orders past
 * the midpoint of their SafeDrop Protection window and stamps
 * confirm_reminder_sent_at in the same statement (FOR UPDATE SKIP LOCKED), so
 * each order is claimed exactly once even when two runs overlap. Comms are
 * best-effort after the claim: a failed email is logged, never re-claimed —
 * "at most once" is the contract, the auto-complete itself is the safety net.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface ReminderSummary {
  claimed: number
  emailed: number
  notified: number
  failed: number
}

export const REMINDER_PAGE = 100

export async function sendConfirmReminders(service: SupabaseClient): Promise<ReminderSummary> {
  const summary: ReminderSummary = { claimed: 0, emailed: 0, notified: 0, failed: 0 }

  const { data, error } = await (service.rpc as any)('order_confirm_reminders_claim', { p_limit: REMINDER_PAGE })
  if (error) {
    console.error('[ConfirmReminders] claim failed:', error)
    summary.failed += 1
    return summary
  }
  const orders: any[] = data ?? []
  summary.claimed = orders.length
  if (orders.length === 0) return summary

  const buyerIds = Array.from(new Set(orders.map((o) => o.buyer_id).filter(Boolean)))
  const listingIds = Array.from(new Set(orders.map((o) => o.listing_id).filter(Boolean)))
  const [{ data: buyers }, { data: listings }] = await Promise.all([
    service.from('profiles').select('id, email, username, full_name').in('id', buyerIds) as any,
    service.from('listings').select('id, title, game:game_id ( slug )').in('id', listingIds) as any,
  ])
  const buyer = (id: string) => (buyers ?? []).find((b: any) => b.id === id)
  const listing = (id: string) => (listings ?? []).find((l: any) => l.id === id)
  const { sendOrderConfirmReminderEmail } = await import('@/lib/email')

  for (const order of orders) {
    const ref = order.order_number || String(order.id).slice(0, 8).toUpperCase()
    const b = buyer(order.buyer_id)
    const l = listing(order.listing_id)
    try {
      const { data: inserted } = await (service.rpc as any)('notify_once', {
        p_user_id: order.buyer_id,
        p_type: 'order_confirm_reminder',
        p_title: 'Please Confirm Your Order',
        p_message: `#${ref} — confirm you received it, or open a dispute if something is wrong.`,
        p_link: `/account/orders/${order.id}`,
        p_dedupe_key: `order:${order.id}:confirm_reminder`,
      })
      if (inserted) summary.notified += 1
      if (b?.email) {
        await sendOrderConfirmReminderEmail({
          to: b.email,
          name: b.full_name || b.username || 'Gamer',
          orderId: order.id,
          orderNumber: ref,
          listingTitle: l?.title || 'your item',
          gameSlug: l?.game?.slug ?? null,
          autoCompleteAt: order.auto_release_at,
        })
        summary.emailed += 1
      }
    } catch (e) {
      summary.failed += 1
      console.error(`[ConfirmReminders] comms failed for order ${order.id} (claimed, not retried):`, e)
    }
  }
  return summary
}

/**
 * Cancel – Not Delivered: run the finalize seam for one order and, on an
 * auto-cancel, send the buyer's refund email and the chat notice. Shared by
 * the order page (finalize on view when the countdown ends) and the
 * 15-minute sweep. The money moves in SQL (order_not_delivered_finalize);
 * comms are best-effort and never throw.
 */
import { createServiceRoleClient } from '@/lib/supabase/service'

export type NotDeliveredOutcome = 'auto_cancelled' | 'seller_responded' | 'delivered' | 'disputed' | 'cancelled'

export async function finalizeNotDelivered(orderId: string): Promise<{ outcome: NotDeliveredOutcome | null; reason?: string }> {
  const svc = createServiceRoleClient() as any
  const { data, error } = await svc.rpc('order_not_delivered_finalize', { p_order_id: orderId })
  if (error) throw new Error(`order_not_delivered_finalize: ${error.message}`)
  if (!data?.finalized) return { outcome: null, reason: data?.reason }
  const outcome = data.outcome as NotDeliveredOutcome
  if (outcome !== 'auto_cancelled') return { outcome }

  try {
    const { postOrderSystemNotice } = await import('@/lib/chat/post-system-notice')
    await postOrderSystemNotice(orderId, { type: 'order_cancelled', by: 'system', reason: 'Not Delivered In Time' })
    const { data: order } = await svc
      .from('orders')
      .select('order_number, buyer_id, total_amount, listing:listings!orders_listing_id_fkey(title, game:game_id(slug))')
      .eq('id', orderId)
      .single()
    const { data: buyer } = await svc.from('profiles').select('email, username, full_name').eq('id', order?.buyer_id).single()
    if (buyer?.email) {
      const { sendOrderRefundedEmail } = await import('@/lib/email')
      await sendOrderRefundedEmail({
        to: buyer.email,
        name: buyer.full_name || buyer.username || 'Gamer',
        orderNumber: order?.order_number || orderId.slice(0, 8).toUpperCase(),
        listingTitle: order?.listing?.title ?? 'your order',
        gameSlug: order?.listing?.game?.slug ?? null,
        amount: Number(data.credited_minor) / 100,
        destination: 'your Store Balance',
        fullAmount: Number(order?.total_amount ?? Number(data.total_minor) / 100),
      })
    }
  } catch (e) {
    console.error('[NotDelivered] comms failed (refund already done):', e)
  }
  return { outcome }
}

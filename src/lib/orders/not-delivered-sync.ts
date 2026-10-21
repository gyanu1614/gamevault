/**
 * Cancel – Not Delivered: bring one order's report in line with the order
 * (order_not_delivered_sync). Shared by the order page (on view / when the
 * countdown ends), the admin cancellation list and the 15-minute sweep.
 * Never moves money: it closes a report the order has moved past, records a
 * seller response made inside the window, or marks the report expired (the
 * buyer + seller notices are sent in SQL). Cancelling is an admin decision.
 */
import { createServiceRoleClient } from '@/lib/supabase/service'

export type NotDeliveredSyncOutcome = 'expired' | 'seller_responded' | 'delivered' | 'disputed' | 'cancelled'

export async function syncNotDelivered(orderId: string): Promise<{ outcome: NotDeliveredSyncOutcome | null; reason?: string }> {
  const { data, error } = await (createServiceRoleClient() as any).rpc('order_not_delivered_sync', { p_order_id: orderId })
  if (error) throw new Error(`order_not_delivered_sync: ${error.message}`)
  if (!data?.synced) return { outcome: null, reason: data?.reason }
  return { outcome: data.outcome as NotDeliveredSyncOutcome }
}

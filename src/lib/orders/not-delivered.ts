/**
 * Can the BUYER press "Cancel – Not Delivered"? Only while the seller still
 * owes the delivery (paid / delivering, not marked delivered) and only once
 * the listing's delivery time — counted from payment, exactly as the order
 * page's progress bar counts it — has run out. The seller then has
 * platform_fee_settings.not_delivered_grace_minutes (60) to reply in the
 * order chat or start delivery, or the order cancels (order_not_delivered_*).
 */
import { parseDeliveryMinutes } from '@/lib/utils/delivery-time'

export type NotDeliveredEligibility =
  | { eligible: true; dueAt: string }
  | { eligible: false; reason: 'status' | 'not_overdue'; dueAt?: string }

export function notDeliveredEligibility(o: {
  status: string
  delivered_at?: string | null
  paid_at?: string | null
  created_at: string
  deliveryTime?: string | null
  now?: number
}): NotDeliveredEligibility {
  if (!['paid', 'delivering'].includes(o.status) || o.delivered_at) return { eligible: false, reason: 'status' }
  const start = Date.parse(o.paid_at ?? o.created_at)
  const dueAt = new Date(start + parseDeliveryMinutes(o.deliveryTime) * 60_000).toISOString()
  if ((o.now ?? Date.now()) < Date.parse(dueAt)) return { eligible: false, reason: 'not_overdue', dueAt }
  return { eligible: true, dueAt }
}

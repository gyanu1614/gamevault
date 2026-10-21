/**
 * Can the BUYER press "Cancel – Not Delivered"? Only while the seller still
 * owes the delivery (paid / delivering, not marked delivered) and only once
 * the listing's delivery time — counted from payment, exactly as the order
 * page's progress bar counts it — has run out. The seller then has a
 * response window = the same delivery time, clamped to 15 minutes .. 24
 * hours, to reply in the order chat or start delivery. With no response the
 * buyer may request cancellation, which an admin reviews
 * (order_not_delivered_*); nothing cancels automatically.
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

export const RESPONSE_WINDOW_MIN_MINUTES = 15
export const RESPONSE_WINDOW_MAX_MINUTES = 24 * 60

/** The seller's response window: the listing's delivery time, 15 min .. 24 h. */
export function responseWindowMinutes(deliveryTime?: string | null): number {
  return Math.min(RESPONSE_WINDOW_MAX_MINUTES, Math.max(RESPONSE_WINDOW_MIN_MINUTES, parseDeliveryMinutes(deliveryTime)))
}

/** "20 minutes", "1 hour", "24 hours" — the same wording the SQL notices use. */
export function windowSpan(minutes: number): string {
  return minutes % 60 === 0 ? `${minutes / 60} hour${minutes === 60 ? '' : 's'}` : `${minutes} minutes`
}

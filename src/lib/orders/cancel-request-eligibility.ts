/**
 * Can the BUYER ask DropMarket to cancel this order? (Request Cancellation:
 * an admin approves it and the buyer is refunded to their wallet.)
 *
 *  - only while the seller still owes the delivery: paid or delivering, not
 *    yet marked delivered (after that it is Confirm or a dispute);
 *  - only for long deliveries (listing delivery time of 6 hours or more;
 *    short ones use the overdue dispute instead);
 *  - only once an hour has passed since PAYMENT, giving the seller a start.
 */
import { parseDeliveryMinutes } from '@/lib/utils/delivery-time'

export const CANCEL_REQUEST_MIN_DELIVERY_HOURS = 6
export const CANCEL_REQUEST_WAIT_MS = 60 * 60 * 1000

export type CancelRequestEligibility =
  | { eligible: true }
  | { eligible: false; reason: 'status' | 'short_delivery' | 'too_soon'; opensAt?: string }

export function cancelRequestEligibility(o: {
  status: string
  delivered_at?: string | null
  paid_at?: string | null
  created_at: string
  deliveryTime?: string | null
  now?: number
}): CancelRequestEligibility {
  if (!['paid', 'delivering'].includes(o.status) || o.delivered_at) return { eligible: false, reason: 'status' }
  const hours = parseDeliveryMinutes(o.deliveryTime, 0) / 60
  if (hours < CANCEL_REQUEST_MIN_DELIVERY_HOURS) return { eligible: false, reason: 'short_delivery' }
  const start = Date.parse(o.paid_at ?? o.created_at)
  const opens = start + CANCEL_REQUEST_WAIT_MS
  if ((o.now ?? Date.now()) < opens) {
    return { eligible: false, reason: 'too_soon', opensAt: new Date(opens).toISOString() }
  }
  return { eligible: true }
}

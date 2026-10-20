'use server'

/**
 * revealMyOrderItem — "Show My Item" on the Order Paid page for listings
 * with automatic (instant) delivery (owner 2026-10-19).
 *
 * A thin seam over deliverCodeToBuyer, which claims ONE code atomically
 * (inventory_claim_for_order, DB-016) and returns the same code on every
 * retry. That action takes the buyer id as an argument; this wrapper never
 * lets the browser supply it — the buyer is the signed-in session user, so a
 * crafted call can only ever reveal the caller's own order.
 */

import { createClient } from '@/lib/supabase/server'
import { deliverCodeToBuyer, type DeliveryType } from '@/lib/actions/instant-delivery'
import { isUuid } from '@/lib/ids'

export interface RevealResult {
  success: boolean
  code?: string
  deliveryType?: DeliveryType
  error?: string
}

const NO_STOCK = 'Your seller is preparing your item. It will arrive in your order chat shortly.'

export async function revealMyOrderItem(orderId: string): Promise<RevealResult> {
  if (!isUuid(orderId)) return { success: false, error: 'Order not found.' }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Please sign in again to see your item.' }

  const r = await deliverCodeToBuyer(orderId, user.id)
  if (r.success) return { success: true, code: r.code, deliveryType: r.deliveryType }
  if (r.error && /no codes available/i.test(r.error)) return { success: false, error: NO_STOCK }
  return { success: false, error: 'We could not load your item just now. Please try again in a moment.' }
}

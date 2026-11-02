/**
 * Delivery proof for card disputes (2026-10-29): when, and from which IP and
 * device, the buyer paid (`checkout`) and opened the delivered order (`view`).
 * Written through order_access_record (service role): the buyer's own visits
 * only, views only after delivery, one row per device with a hit count.
 *
 * Never throws — a missed log must not break checkout or the order page.
 * Outside a request (scripts, tests) there is nothing to log, so it skips.
 */
import 'server-only'

import { headers } from 'next/headers'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { clientIp } from '@/lib/security/rate-limit'

type HeaderLike = { get(name: string): string | null }

export async function recordOrderAccess(
  orderId: string,
  userId: string,
  event: 'checkout' | 'view',
  requestHeaders?: HeaderLike,
): Promise<void> {
  let h: HeaderLike
  try {
    h = requestHeaders ?? headers()
  } catch {
    return
  }
  try {
    const ip = clientIp(h)
    const { error } = await (createServiceRoleClient().rpc as any)('order_access_record', {
      p_order_id: orderId,
      p_user_id: userId,
      p_event: event,
      p_ip: ip === 'unknown' ? null : ip,
      p_user_agent: h.get('user-agent'),
    })
    if (error) console.error(`[OrderAccess] ${event} not logged for ${orderId}:`, error.message)
  } catch (e) {
    console.error(`[OrderAccess] ${event} not logged for ${orderId}:`, (e as Error)?.message ?? e)
  }
}

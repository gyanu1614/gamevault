'use server'

/**
 * The buyer is looking at their delivered order (2026-10-29): called by the
 * order page when it opens in a visible tab or the buyer comes back to it —
 * never on a live refresh. Card-dispute delivery proof; the SQL keeps only
 * the buyer's own views of a delivered order.
 */

import { createClient } from '@/lib/supabase/server'
import { isUuid } from '@/lib/ids'
import { recordOrderAccess } from '@/lib/orders/access-log'

export async function logDeliveredOrderView(orderId: string): Promise<void> {
  if (!isUuid(orderId)) return
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  await recordOrderAccess(orderId, user.id, 'view')
}

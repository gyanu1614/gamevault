import 'server-only'

/**
 * Post a DropMarket notice (dispute opened / resolved card) into an order's
 * chat. Service role, sender_id NULL — the only way a notice can be written
 * (migration 20260927184110). Best-effort: a missing conversation or a
 * failed insert is logged, never thrown; the money step it follows has
 * already committed.
 */

import { createServiceRoleClient } from '@/lib/supabase/service'
import type { SystemNotice } from './system-notice'

export async function postOrderSystemNotice(orderId: string, notice: SystemNotice): Promise<void> {
  try {
    const svc = createServiceRoleClient()
    const { data: convo } = await svc
      .from('conversations')
      .select('id')
      .eq('order_id', orderId)
      .maybeSingle() as any
    if (!convo?.id) return
    const { error } = await (svc.from('messages').insert as any)({
      conversation_id: convo.id,
      sender_id: null,
      content: JSON.stringify(notice),
      // Notices never count as unread; unread counts only look at the
      // other party's messages.
      is_read: true,
    })
    if (error) console.error(`[chat] system notice ${notice.type} for ${orderId} failed:`, error)
  } catch (err) {
    console.error(`[chat] system notice ${notice.type} for ${orderId} failed:`, err)
  }
}

'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

/**
 * notifySellerFirstReply — the ONE bell notification chat creates: the
 * seller's first message to the buyer on an order ("Seller Replied On Your
 * Order"), so the buyer notices the seller has engaged. Every other message
 * lives under the Messages badge.
 *
 * Chat EMAILS are not sent from here any more: every message is batched in
 * the database and emailed once per quiet burst (migration
 * 20261102161137_chat_email_digest, /api/cron/chat-email-digest).
 *
 * The chat calls this only when the sender is the seller and the thread has
 * no earlier message from them, so it runs about once per order, not once
 * per message; the checks below are the real gate.
 *
 * Fire-safe: never throws to the client — the message is already in the chat.
 */
export async function notifySellerFirstReply(conversationId: string): Promise<void> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    // RLS lets participants read their own conversations: null = not yours.
    const { data: conversation } = await supabase
      .from('conversations')
      .select('id, order_id, buyer_id, seller_id')
      .eq('id', conversationId)
      .maybeSingle()
    const convo = conversation as { order_id: string | null; buyer_id: string; seller_id: string } | null
    if (!convo?.order_id || convo.seller_id !== user.id) return

    // Service client: the order and the buyer's notifications are cross-user.
    const service = createServiceRoleClient()
    const { count } = await service
      .from('messages')
      .select('id', { count: 'exact' })
      .eq('conversation_id', conversationId)
      .eq('sender_id', user.id)
      .limit(1)
    // The triggering message is already inserted: 1 = the seller's first.
    if ((count ?? 0) !== 1) return

    const [senderRes, orderRes] = await Promise.all([
      service.from('profiles').select('username, full_name').eq('id', user.id).single(),
      service.from('orders').select('order_number').eq('id', convo.order_id).single(),
    ])
    const sender = senderRes.data as { username?: string; full_name?: string } | null
    const senderName = sender?.username || sender?.full_name || 'Your seller'
    const orderRef =
      (orderRes.data as { order_number?: string } | null)?.order_number ||
      String(convo.order_id).slice(0, 8).toUpperCase()

    await (service.from('notifications').insert as any)({
      user_id: convo.buyer_id,
      type: 'order_message',
      title: 'Seller Replied On Your Order',
      message: `${senderName} · #${orderRef}`,
      link: `/account/orders/${convo.order_id}`,
      is_read: false,
    })
  } catch (err) {
    console.error('[notifySellerFirstReply] failed:', err)
  }
}

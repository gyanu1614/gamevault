'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

/**
 * notifyNewMessage — chat message comms (in-app notification + email)
 * for the OTHER participant of a conversation.
 *
 * First-unread-only: comms fire only for the FIRST unread message in a
 * batch. If the sender already has other unread messages in this
 * conversation, the recipient was notified for this batch and we return
 * silently — never spam one email per keystroke-burst.
 *
 * Fire-safe: the entire body is wrapped in try/catch and the function
 * never throws to the client — the message is already in the chat, so
 * a comms failure must never surface as a send failure.
 */
export async function notifyNewMessage(conversationId: string): Promise<void> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    // Conversation row via the cookie client — RLS lets participants
    // read their own conversations, so a null here means "not yours".
    const { data: conversation } = await supabase
      .from('conversations')
      .select('id, order_id, buyer_id, seller_id')
      .eq('id', conversationId)
      .maybeSingle()

    if (!conversation) return
    const convo = conversation as any

    // Caller must be a participant; recipient is the other party.
    if (convo.buyer_id !== user.id && convo.seller_id !== user.id) return
    const recipientId = convo.buyer_id === user.id ? convo.seller_id : convo.buyer_id

    // Service client from here on: the recipient's profile and the
    // unread-count check are cross-user reads that the sender's cookie
    // session would get silently nulled on by RLS.
    const service = createServiceRoleClient()

    // DEDUPE — count this sender's unread messages in the conversation.
    // The message that triggered this call is already inserted, so a
    // count > 1 means older unread messages exist and the recipient was
    // already notified for this batch.
    const { count } = await service
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .eq('sender_id', user.id)
      .eq('is_read', false)

    if ((count ?? 0) > 1) return

    const [recipientRes, senderRes, orderRes, latestRes] = await Promise.all([
      service
        .from('profiles')
        .select('email, username, full_name')
        .eq('id', recipientId)
        .single(),
      service
        .from('profiles')
        .select('username, full_name')
        .eq('id', user.id)
        .single(),
      service
        .from('orders')
        .select('order_number')
        .eq('id', convo.order_id)
        .single(),
      service
        .from('messages')
        .select('content')
        .eq('conversation_id', conversationId)
        .eq('sender_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    const recipient = recipientRes.data as any
    if (!recipient) return

    const sender = senderRes.data as any
    const senderName = sender?.username || sender?.full_name || 'Someone'
    const orderRef =
      (orderRes.data as any)?.order_number ||
      String(convo.order_id).slice(0, 8).toUpperCase()
    const preview = (latestRes.data as any)?.content || ''

    // NOTIFICATION TAXONOMY (Workstream E) — ordinary chat messages do NOT
    // create a bell notification; they live under the Messages badge (the
    // navbar unread-messages count). The ONE exception is the seller's FIRST
    // message to the buyer on an order: that becomes a single bell
    // notification ("Seller Replied On Your Order") so the buyer notices the
    // seller has engaged. Every other message → no notifications row.
    const isSeller = user.id === convo.seller_id
    if (isSeller) {
      const { count: sellerMsgCount } = await service
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', conversationId)
        .eq('sender_id', user.id)
      // The triggering message is already inserted, so count === 1 means this
      // is the seller's first-ever message in the conversation.
      if ((sellerMsgCount ?? 0) === 1) {
        await (service.from('notifications').insert as any)({
          user_id: recipientId,
          type: 'order_message',
          title: 'Seller Replied On Your Order',
          message: `${senderName} sent you a message about order #${orderRef}`,
          link: `/account/orders/${convo.order_id}`,
          is_read: false,
        })
      }
    }

    if (recipient.email) {
      const { sendNewMessageEmail } = await import('@/lib/email')
      await sendNewMessageEmail({
        to: recipient.email,
        name: recipient.full_name || recipient.username || 'Gamer',
        senderName,
        orderNumber: orderRef,
        orderId: convo.order_id,
        preview,
      })
    }
  } catch (err) {
    // Never throw to the client — comms only, message already landed.
    console.error('[notifyNewMessage] comms failed:', err)
  }
}

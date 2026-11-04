/**
 * Conversations and messages for the account inbox.
 *
 * Part of the browser seller API, split out of lib/api/seller-compatible.ts
 * (2026-10-20, files under ~400 lines). Import from '@/lib/api/seller-compatible'.
 *
 * The inbox page is ONE call (my_inbox, migration 20261102161043): the
 * conversations with the other party, order summary, last message and
 * unread count, 30 at a time. It used to be one query for the list, one PER
 * conversation for its last message and one more for the unread counts,
 * re-run on every message, send and read (incident 2026-11-02).
 *
 * Chat messages themselves are written through lib/chat/send-message (the
 * thread hook); conversations are created by the order page. Neither the
 * last_message_at bump nor any other conversation UPDATE happens from the
 * browser: the on_message_created trigger keeps last_message_at, and signed-in
 * users can no longer update a conversation at all.
 */
import { supabase } from './client'
import type { Message, Conversation } from './types'

/** Conversations per inbox page (the RPC caps at 100). */
export const INBOX_PAGE_SIZE = 30

/** Keyset cursor: the last row of the previous page. */
export interface InboxCursor {
  before: string
  beforeId: string
}

export interface InboxPage {
  conversations: Conversation[]
  /** Null when this page was the last one. */
  next: InboxCursor | null
}

export function nextInboxCursor(rows: Conversation[], pageSize: number): InboxCursor | null {
  if (rows.length < pageSize) return null
  const last = rows[rows.length - 1]
  return { before: last.last_message_at, beforeId: last.id }
}

export const messagesApi = {
  /** One page of the signed-in user's conversations, newest first. */
  async getConversations(cursor: InboxCursor | null = null, pageSize = INBOX_PAGE_SIZE): Promise<InboxPage> {
    const { data, error } = await (supabase.rpc as any)('my_inbox', {
      p_limit: pageSize,
      p_before: cursor?.before ?? null,
      p_before_id: cursor?.beforeId ?? null,
    })
    if (error) throw error
    const conversations = (Array.isArray(data) ? data : []) as Conversation[]
    return { conversations, next: nextInboxCursor(conversations, pageSize) }
  },

  /**
   * Post an automatic line for an order action (the dispute modal's
   * "I've opened a dispute for this order.") as the signed-in user.
   */
  async sendSmartActionMessage(
    conversationId: string,
    action: 'delivered' | 'received' | 'disputed' | 'cancelled',
    customMessage?: string,
  ): Promise<Message> {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) throw new Error('Not authenticated')

    const messageTemplates = {
      delivered: customMessage || "I've marked your order as delivered! Please check and confirm receipt when you receive it.",
      received: customMessage || 'Order received! Thank you for a smooth transaction.',
      disputed: customMessage || "I've opened a dispute for this order. Please see the details.",
      cancelled: customMessage || 'This order has been cancelled.',
    }

    const { data, error } = await (supabase.from('messages').insert as any)({
      conversation_id: conversationId,
      sender_id: user.id,
      content: messageTemplates[action],
      is_read: false,
    })
      .select()
      .single()

    if (error) throw error
    return data
  },
}

/**
 * The /account/messages inbox cache, kept current from events instead of
 * refetches.
 *
 * The inbox is a React Query infinite list of my_inbox pages. A new message
 * (the user's live channel, user:<id>) moves its conversation to the top,
 * sets its last message and bumps its unread count; marking a thread read
 * clears the count. Only a message for a conversation the cache has never
 * seen needs a refetch. Before (incident 2026-11-02) every message, send and
 * read refetched the whole inbox, one query per conversation.
 *
 * Pure apart from markInboxRead (a thin setQueriesData), so the
 * transitions are unit-tested: inbox-cache.test.ts.
 */

import type { InfiniteData, QueryClient } from '@tanstack/react-query'
import type { Conversation } from '@/lib/api/seller/types'
import type { InboxCursor, InboxPage } from '@/lib/api/seller/messages'

/** Prefix shared by every user's inbox key (invalidate / setQueriesData). */
export const INBOX_QUERY_PREFIX = ['seller', 'messages', 'conversations'] as const
export const inboxQueryKey = (userId: string | null | undefined) => [...INBOX_QUERY_PREFIX, userId] as const

export type InboxData = InfiniteData<InboxPage, InboxCursor | null>

/** The message fields the live channel carries (user_channel_on_message). */
export interface InboxMessageEvent {
  id: string
  conversation_id: string
  sender_id: string | null
  content: string
  created_at: string
}

export function parseInboxMessageEvent(payload: Record<string, unknown>): InboxMessageEvent | null {
  const { id, conversation_id, sender_id, content, created_at } = payload
  if (typeof id !== 'string' || typeof conversation_id !== 'string') return null
  if (typeof content !== 'string' || typeof created_at !== 'string') return null
  if (sender_id !== null && typeof sender_id !== 'string') return null
  return { id, conversation_id, sender_id, content, created_at }
}

/**
 * Apply a new message. Returns the next cache, the SAME object when the
 * message changes nothing (already applied), or null when the conversation
 * is not in the cache (the caller refetches).
 */
export function applyInboxMessage(
  data: InboxData,
  msg: InboxMessageEvent,
  { viewerId, openConversationId }: { viewerId: string; openConversationId?: string | null },
): InboxData | null {
  let found: Conversation | null = null
  for (const page of data.pages) {
    found = page.conversations.find((c) => c.id === msg.conversation_id) ?? null
    if (found) break
  }
  if (!found) return null
  // An older event (or one already applied): the row is already newer.
  if (found.last_message_at && found.last_message_at >= msg.created_at) return data

  const fromOther = !!msg.sender_id && msg.sender_id !== viewerId
  const isOpen = openConversationId === msg.conversation_id
  const updated: Conversation = {
    ...found,
    last_message_at: msg.created_at,
    last_message: { content: msg.content, sender_id: msg.sender_id as string },
    unread_count: (found.unread_count ?? 0) + (fromOther && !isOpen ? 1 : 0),
  }

  const pages = data.pages.map((page, i) => {
    const rest = page.conversations.filter((c) => c.id !== msg.conversation_id)
    return {
      ...page,
      conversations: i === 0 ? [updated, ...rest] : rest,
    }
  })
  return { ...data, pages }
}

/** Clear one conversation's unread count. SAME object when already clear. */
export function markConversationRead(data: InboxData, conversationId: string): InboxData {
  let changed = false
  const pages = data.pages.map((page) => {
    if (!page.conversations.some((c) => c.id === conversationId && (c.unread_count ?? 0) > 0)) return page
    changed = true
    return {
      ...page,
      conversations: page.conversations.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c)),
    }
  })
  return changed ? { ...data, pages } : data
}

/** After the thread marks messages read: clear the row in every cached inbox. */
export function markInboxRead(queryClient: QueryClient, conversationId: string): void {
  queryClient.setQueriesData<InboxData>({ queryKey: INBOX_QUERY_PREFIX }, (data) =>
    data?.pages ? markConversationRead(data, conversationId) : data,
  )
}

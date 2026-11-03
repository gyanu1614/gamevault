/**
 * The /account/messages inbox: the conversation list and the open thread.
 *
 * The list is ONE call per page (my_inbox, 30 conversations, newest first;
 * more load as the list scrolls) and is then kept current from the user's
 * live channel (user:<id>): a new message moves its conversation up and
 * bumps the unread count in the cache (lib/chat/inbox-cache). No polling;
 * a focus refetch and a channel re-join catch anything missed.
 */

import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import { messagesApi, type Conversation } from '@/lib/api/seller-compatible'
import type { InboxCursor } from '@/lib/api/seller/messages'
import { useAuth } from '@/hooks/use-auth'
import { isSystemMessage, systemNoticePreview } from '@/lib/chat/system-notice'
import { useChatThread } from '@/hooks/use-chat-thread'
import { useUserChannelEvent, useUserChannelRejoined } from '@/hooks/use-user-channel'
import { applyInboxMessage, inboxQueryKey, parseInboxMessageEvent, type InboxData } from '@/lib/chat/inbox-cache'

export function useSellerMessages({ openConversationId = null }: { openConversationId?: string | null } = {}) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const userId = user?.id ?? null
  const queryKey = inboxQueryKey(userId)

  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => messagesApi.getConversations(pageParam),
    initialPageParam: null as InboxCursor | null,
    getNextPageParam: (last) => last.next,
    enabled: !!userId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })

  const conversations = useMemo<Conversation[]>(
    () => query.data?.pages.flatMap((p) => p.conversations) ?? [],
    [query.data],
  )

  // Read in the channel handler without re-subscribing on every change.
  const conversationsRef = useRef(conversations)
  conversationsRef.current = conversations
  const openRef = useRef(openConversationId)
  openRef.current = openConversationId

  useUserChannelEvent(userId, 'message', (payload) => {
    const msg = parseInboxMessageEvent(payload)
    if (!msg || !userId) return

    let unknown = false
    queryClient.setQueryData<InboxData>(queryKey, (data) => {
      if (!data) return data
      const next = applyInboxMessage(data, msg, { viewerId: userId, openConversationId: openRef.current })
      if (next === null) unknown = true
      return next ?? data
    })
    // A conversation this list has never seen (a new order chat): re-read.
    if (unknown) void queryClient.invalidateQueries({ queryKey }, { cancelRefetch: false })

    // Toast someone else's message unless its thread is the one open.
    if (msg.sender_id === userId || openRef.current === msg.conversation_id) return
    if (isSystemMessage(msg.sender_id)) {
      toast.message('DropMarket update', { description: systemNoticePreview(msg.content), duration: 5000 })
      return
    }
    const conversation = conversationsRef.current.find((c) => c.id === msg.conversation_id)
    const sender = conversation?.buyer_id === msg.sender_id ? conversation?.buyer : conversation?.seller
    toast.message(`New message from ${sender?.username || 'User'}`, {
      description: msg.content.length > 100 ? `${msg.content.slice(0, 100)}...` : msg.content,
      duration: 5000,
    })
  })

  // The socket dropped and came back: something may have been missed.
  useUserChannelRejoined(userId, () => void queryClient.invalidateQueries({ queryKey }, { cancelRefetch: false }))

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  return {
    conversations,
    isLoadingConversations: query.isLoading,
    conversationsError: query.error,
    hasMoreConversations: !!hasNextPage,
    loadMoreConversations: loadMore,
  }
}

/**
 * One conversation's thread for /account/messages: the same instant-send
 * hook as the order chat (optimistic bubble, Sending → Sent → Read,
 * "Not sent · Retry", realtime merge, read-when-seen). Sending never blocks
 * the input. Same insert path and RLS as before: a `messages` row written
 * by the session client as the signed-in user.
 */
export function useConversationMessages(
  conversationId: string | null,
  { attachOrderId }: { attachOrderId: string | null },
) {
  const { user } = useAuth()
  const thread = useChatThread({
    conversationId,
    currentUserId: user?.id ?? '',
    // The inbox lists only conversations the viewer is a party to.
    canMarkRead: !!user?.id,
    attachOrderId,
  })

  return {
    messages: thread.messages,
    isLoading: thread.isLoading,
    error: thread.error,
    sendMessage: thread.send,
    retryMessage: thread.retry,
    setAtBottom: thread.setAtBottom,
    reactions: thread.reactions,
    react: thread.react,
    replyToId: thread.replyToId,
    setReplyTo: thread.setReplyTo,
  }
}

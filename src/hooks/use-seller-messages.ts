/**
 * Seller Messages Hook
 * Manages conversations and messages for sellers
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { messagesApi, Conversation, Message } from '@/lib/api/seller-compatible'
import { toast } from 'sonner'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'

export function useSellerMessages() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const supabase = createClient()

  // Fetch all conversations
  const {
    data: conversations,
    isLoading: isLoadingConversations,
    error: conversationsError,
  } = useQuery<Conversation[]>({
    queryKey: ['seller', 'messages', 'conversations'],
    queryFn: () => messagesApi.getConversations(),
    refetchInterval: 30000, // Refetch every 30 seconds for new messages
    refetchOnMount: 'always', // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window regains focus
    staleTime: 0, // Consider data stale immediately to ensure fresh data
  })

  // Realtime subscription for new messages
  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel('new-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMessage = payload.new as Message

          // Don't show notification for own messages
          if (newMessage.sender_id === user.id) {
            return
          }

          // Get the conversation to show sender info
          const conversation = conversations?.find(
            (c) => c.id === newMessage.conversation_id
          )

          if (conversation) {
            const sender =
              conversation.buyer_id === newMessage.sender_id
                ? conversation.buyer
                : conversation.seller

            // Show toast notification
            toast.message(`New message from ${sender?.username || 'User'}`, {
              description: newMessage.content.slice(0, 100) + (newMessage.content.length > 100 ? '...' : ''),
              duration: 5000,
            })
          }

          // Invalidate queries to refresh the UI
          queryClient.invalidateQueries({ queryKey: ['seller', 'messages', 'conversations'] })
          queryClient.invalidateQueries({ queryKey: ['seller', 'messages', newMessage.conversation_id] })
          queryClient.invalidateQueries({ queryKey: ['unread-messages'] })
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [user?.id, conversations, queryClient, supabase])

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: ({ conversationId, content, attachments }: {
      conversationId: string
      content: string
      attachments?: string[]
    }) => messagesApi.sendMessage(conversationId, content, attachments),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['seller', 'messages', 'conversations'] })
      queryClient.invalidateQueries({ queryKey: ['seller', 'messages', variables.conversationId] })
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to send message')
    },
  })

  // Mark as read mutation
  const markAsRead = useMutation({
    mutationFn: (conversationId: string) => messagesApi.markAsRead(conversationId),
    onMutate: async (conversationId) => {
      // Optimistically update the UI immediately
      await queryClient.cancelQueries({ queryKey: ['seller', 'messages', 'conversations'] })

      const previousConversations = queryClient.getQueryData(['seller', 'messages', 'conversations'])

      // Update the conversations cache to set unread_count to 0
      queryClient.setQueryData(['seller', 'messages', 'conversations'], (old: Conversation[] | undefined) => {
        if (!old) return old
        return old.map(conv =>
          conv.id === conversationId
            ? { ...conv, unread_count: 0 }
            : conv
        )
      })

      // Immediately invalidate navbar's unread count for instant update
      queryClient.invalidateQueries({ queryKey: ['unread-messages'] })

      return { previousConversations }
    },
    onError: (err, conversationId, context) => {
      // Rollback on error
      if (context?.previousConversations) {
        queryClient.setQueryData(['seller', 'messages', 'conversations'], context.previousConversations)
      }
    },
    onSettled: (_, __, conversationId) => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['seller', 'messages', 'conversations'] })
      queryClient.invalidateQueries({ queryKey: ['seller', 'messages', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['unread-messages'] })
    },
  })

  return {
    conversations: conversations || [],
    isLoadingConversations,
    conversationsError,
    sendMessage: sendMessage.mutateAsync,
    isSending: sendMessage.isPending,
    markAsRead: markAsRead.mutateAsync,
  }
}

/**
 * Hook for specific conversation messages
 */
export function useConversationMessages(conversationId: string | null) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const supabase = createClient()

  const {
    data: messages,
    isLoading,
    error,
  } = useQuery<Message[]>({
    queryKey: ['seller', 'messages', conversationId],
    queryFn: () => conversationId ? messagesApi.getMessages(conversationId) : Promise.resolve([]),
    enabled: !!conversationId,
    refetchInterval: 5000, // Refetch every 5 seconds for real-time feel
  })

  // Realtime subscription for messages in the current conversation
  useEffect(() => {
    if (!conversationId || !user?.id) return

    const channel = supabase
      .channel(`conversation-messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          // Immediately refetch messages for this conversation
          queryClient.invalidateQueries({ queryKey: ['seller', 'messages', conversationId] })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          // Refetch on message updates (e.g., read status)
          queryClient.invalidateQueries({ queryKey: ['seller', 'messages', conversationId] })
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [conversationId, user?.id, queryClient, supabase])

  return {
    messages: messages || [],
    isLoading,
    error,
  }
}

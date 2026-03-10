/**
 * useOrderConversation Hook
 * Fetches or creates a conversation for an order
 */

import { useQuery } from '@tanstack/react-query'
import { messagesApi } from '@/lib/api/seller-compatible'

interface Conversation {
  id: string
  order_id: string | null
  buyer_id: string
  seller_id: string
  listing_id: string | null
  last_message_at: string
  created_at: string
  buyer: {
    id: string
    username: string
    avatar_url?: string
  }
  seller: {
    id: string
    username: string
    avatar_url?: string
  }
  order?: {
    id: string
    order_number?: string
    status: string
    total_amount: number
    listing?: {
      id: string
      title: string
      images?: string[]
    }
  }
}

interface UseOrderConversationOptions {
  orderId: string
  enabled?: boolean
  autoCreate?: boolean
}

export function useOrderConversation({
  orderId,
  enabled = true,
  autoCreate = true,
}: UseOrderConversationOptions) {
  const {
    data: conversation,
    isLoading,
    error,
    refetch,
  } = useQuery<Conversation | null>({
    queryKey: ['order-conversation', orderId],
    queryFn: async () => {
      if (!orderId) return null

      if (autoCreate) {
        // Get or create conversation
        return await messagesApi.getOrCreateConversationByOrder(orderId)
      } else {
        // Only get existing conversation
        return await messagesApi.getConversationByOrder(orderId)
      }
    },
    enabled: enabled && !!orderId,
    staleTime: 30000, // Consider data fresh for 30 seconds
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  return {
    conversation,
    conversationId: conversation?.id,
    isLoading,
    error,
    refetch,
    hasConversation: !!conversation,
  }
}

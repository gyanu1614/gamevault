'use client'

import { useQuery } from '@tanstack/react-query'
import { POLL_MS, foregroundPoll } from '@/lib/polling/intervals'

/**
 * Unread chat messages for the signed-in user — the Messages badge in the
 * navbar AND the account sidebar. One query key, so both badges on the same
 * page share one request.
 *
 * Kept fresh by invalidation first: the order chat (use-chat-thread) and the
 * /account/messages realtime channel (use-seller-messages) invalidate
 * ['unread-messages'] on every incoming message and on mark-as-read. The
 * minute poll (visible tab only) and the focus refetch catch the rest.
 */
export const unreadMessagesQueryKey = (userId: string | null | undefined) => ['unread-messages', userId] as const

export function useUnreadMessagesCount(userId: string | null | undefined): number {
  const { data } = useQuery({
    queryKey: unreadMessagesQueryKey(userId),
    queryFn: async () => {
      if (!userId) return 0
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      // Conversations I'm in, then unread messages in them I did not send.
      const { data: conversations } = (await supabase
        .from('conversations')
        .select('id')
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)) as any

      if (!conversations || conversations.length === 0) return 0

      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact' })
        .in('conversation_id', conversations.map((c: any) => c.id))
        .neq('sender_id', userId)
        .eq('is_read', false)
        .limit(1)

      return count || 0
    },
    enabled: !!userId,
    // Short enough that a focus after a minute away re-reads the badge.
    staleTime: 30_000,
    ...foregroundPoll(POLL_MS.unreadMessages),
  })
  return data || 0
}

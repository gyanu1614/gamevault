'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { POLL_MS, foregroundPoll } from '@/lib/polling/intervals'
import { useUserChannelEvent, useUserChannelRejoined } from '@/hooks/use-user-channel'

/**
 * Unread chat messages for the signed-in user — the Messages badge in the
 * navbar AND the account sidebar. One query key, so both badges on the same
 * page share one request, and ONE indexed RPC (my_unread_message_count) per
 * read (was two queries; migration 20261102161043).
 *
 * Kept fresh by events, not polling: a new message from the other party
 * arrives on the user's live channel (user:<id>), and the chat thread
 * refreshes it after marking messages read. The slow visible-tab poll and
 * the focus refetch only catch a dropped socket.
 */
export const unreadMessagesQueryKey = (userId: string | null | undefined) => ['unread-messages', userId] as const

export function useUnreadMessagesCount(userId: string | null | undefined): number {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: unreadMessagesQueryKey(userId),
    queryFn: async () => {
      if (!userId) return 0
      const { createClient } = await import('@/lib/supabase/client')
      const { data: count, error } = await (createClient().rpc as any)('my_unread_message_count')
      if (error) throw error
      return typeof count === 'number' ? count : 0
    },
    enabled: !!userId,
    // Short enough that a focus after a minute away re-reads the badge.
    staleTime: 30_000,
    ...foregroundPoll(POLL_MS.unreadMessages),
  })

  // Navbar + sidebar both mount this: cancelRefetch false joins a read that
  // is already in flight instead of firing a second one.
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: unreadMessagesQueryKey(userId) }, { cancelRefetch: false })
  // Someone else's message: one more unread. My own lines never change my badge.
  useUserChannelEvent(userId, 'message', (payload) => {
    if (payload.sender_id && payload.sender_id !== userId) refresh()
  })
  useUserChannelRejoined(userId, refresh)

  return data || 0
}

'use client'

/**
 * useChatReactions — the emoji reactions in one open conversation.
 *
 * Part of useChatThread (which owns the live channel and the thread read):
 *  - `replace` takes the reactions that came back with a thread read;
 *  - `apply` takes a reaction broadcast from chat:<conversation id>;
 *  - `react` is optimistic: the chip changes on tap, the write follows, and
 *    a refused write puts the viewer's previous reaction back.
 *
 * One reaction per person per message (lib/chat/reactions): tap a new emoji
 * to change it, the same one to take it off. RLS on message_reactions is the
 * gate; the insert sends only message_id + emoji (user_id defaults to the
 * session, conversation_id is copied from the message by a trigger).
 */

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import { toast } from 'sonner'
import type { createClient } from '@/lib/supabase/client'
import type { ChatBroadcast } from '@/lib/chat/broadcast'
import { reactionIntent, removeReaction, upsertReaction, type ReactionRow } from '@/lib/chat/reactions'

const DUPLICATE_KEY = '23505'

export interface ChatReactions {
  rows: ReactionRow[]
  react: (messageId: string, emoji: string) => void
  replace: (conversationId: string, rows: ReactionRow[]) => void
  apply: (conversationId: string, event: ChatBroadcast) => void
}

export function useChatReactions({
  conversationId,
  conversationRef,
  currentUserId,
  supabase,
}: {
  conversationId: string | null
  /** The conversation on screen (useChatThread's ref), for async work. */
  conversationRef: MutableRefObject<string | null>
  currentUserId: string
  supabase: ReturnType<typeof createClient>
}): ChatReactions {
  const [rows, setRows] = useState<ReactionRow[]>([])
  const rowsRef = useRef(rows)
  rowsRef.current = rows

  // A different conversation starts empty until its thread read lands.
  useEffect(() => {
    setRows([])
  }, [conversationId])

  const replace = useCallback(
    (convId: string, next: ReactionRow[]) => {
      if (conversationRef.current === convId) setRows(next)
    },
    [conversationRef],
  )

  const apply = useCallback(
    (convId: string, event: ChatBroadcast) => {
      if (conversationRef.current !== convId) return
      if (event.kind === 'reaction') setRows((prev) => upsertReaction(prev, event.row))
      else if (event.kind === 'reaction-removed') setRows((prev) => removeReaction(prev, event.messageId, event.userId))
    },
    [conversationRef],
  )

  const react = useCallback(
    (messageId: string, emoji: string) => {
      const convId = conversationRef.current
      if (!convId || !currentUserId) return
      const before = rowsRef.current.find((r) => r.message_id === messageId && r.user_id === currentUserId) ?? null
      const intent = reactionIntent(before?.emoji ?? null, emoji)

      setRows((prev) =>
        intent === 'remove'
          ? removeReaction(prev, messageId, currentUserId)
          : upsertReaction(prev, {
              message_id: messageId,
              user_id: currentUserId,
              conversation_id: convId,
              emoji,
              created_at: before?.created_at ?? new Date().toISOString(),
            }),
      )

      const table = () => supabase.from('message_reactions') as any
      const mine = (q: any) => q.eq('message_id', messageId).eq('user_id', currentUserId)
      void (async () => {
        let error: { code?: string } | null = null
        if (intent === 'add') {
          ;({ error } = await table().insert({ message_id: messageId, emoji }))
          // Another tab already reacted: change that one instead.
          if (error?.code === DUPLICATE_KEY) ({ error } = await mine(table().update({ emoji })))
        } else if (intent === 'change') {
          ;({ error } = await mine(table().update({ emoji })))
        } else {
          ;({ error } = await mine(table().delete()))
        }
        if (!error) return
        console.error('Reaction failed:', error)
        if (conversationRef.current !== convId) return
        setRows((prev) => (before ? upsertReaction(prev, before) : removeReaction(prev, messageId, currentUserId)))
        toast.error('Could not save your reaction. Please try again.')
      })()
    },
    [conversationRef, currentUserId, supabase],
  )

  return { rows, react, replace, apply }
}

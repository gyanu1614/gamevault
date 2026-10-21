'use client'

/**
 * useChatThread — one conversation's messages with instant send.
 *
 * The ONE copy of the chat thread machinery, used by the order chat
 * (components/chat/ChatInterface) and /account/messages
 * (useConversationMessages):
 *  - the message is on screen the moment it is sent (optimistic bubble,
 *    client-minted id shared with the insert, the insert response and the
 *    realtime echo — the bubble settles in place, never re-mounts);
 *  - Sending… → Sent → Read; a failure stays as "Not sent · Retry";
 *  - live: the private broadcast topic chat:<conversation id> (a DB trigger
 *    sends every new message, read receipt and reaction; only the two
 *    parties and admins may join), merged by id, plus a quiet re-sync on
 *    (re)subscribe, tab focus and a 60 s poll;
 *  - replies (reply_to_id) and one emoji reaction per person per message
 *    (useChatReactions);
 *  - the other party's messages are stamped read only once seen (tab
 *    visible AND the newest message in view).
 *
 * State transitions are the pure functions in lib/chat/message-state; the
 * insert is lib/chat/send-message (both unit-tested). Surface-specific
 * side effects (toasts, order notifications) come in through callbacks.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { attachmentOnlyLabel, uploadChatAttachment } from '@/lib/chat/attachments'
import { storeMessage } from '@/lib/chat/send-message'
import { chatTopic, parseChatBroadcast } from '@/lib/chat/broadcast'
import { THREAD_SELECT, splitThreadRows } from '@/lib/chat/thread-read'
import type { ReactionRow } from '@/lib/chat/reactions'
import { useChatReactions } from '@/hooks/use-chat-reactions'
import {
  addOptimistic,
  markLocalStatus,
  markReadLocally,
  mergeServer,
  optimisticMessage,
  patchMessage,
  unreadFromOthers,
  upsertRow,
  type ChatMessage,
  type ChatRow,
  type LocalFile,
} from '@/lib/chat/message-state'
import { POLL_MS } from '@/lib/polling/intervals'

/** Triggers closer together than this share one thread read. */
const RESYNC_MIN_GAP_MS = 2_000

export const ATTACH_NOT_ALLOWED = 'Files can only be sent in an active order chat.'

export interface UseChatThreadOptions {
  conversationId: string | null
  currentUserId: string
  /** The viewer is a participant (not an admin looking in): the other
   *  party's messages are stamped read once seen. */
  canMarkRead: boolean
  /** Order whose private folder takes attachments; null when files cannot
   *  be sent here (not an order chat, not a party to it, chat expired). */
  attachOrderId: string | null
  /** A realtime INSERT from the other party or a DropMarket notice.
   *  `seen` = tab visible and the newest message in view. */
  onIncoming?: (row: ChatRow, seen: boolean) => void
  /** After one of my messages is stored on the server. */
  onDelivered?: (row: ChatRow) => void
}

export interface ChatThread {
  messages: ChatMessage[]
  isLoading: boolean
  error: string | null
  /** For MessageInput `onSend` with `optimistic`: resolves once the bubble
   *  is queued; rejects only when the input is refused (file not allowed). */
  send: (text: string, file?: File | null) => Promise<void>
  /** For MessageList `onRetry`. */
  retry: (id: string) => void
  /** For MessageList `onAtBottomChange` (drives mark-as-read). */
  setAtBottom: (atBottom: boolean) => void
  /** Every reaction in this conversation (MessageList groups them). */
  reactions: ReactionRow[]
  /** Tap an emoji on a message: add, change or take off the viewer's reaction. */
  react: (messageId: string, emoji: string) => void
  /** The message the next send replies to (cleared by the send). */
  replyToId: string | null
  setReplyTo: (messageId: string | null) => void
}

interface PendingSend {
  conversationId: string
  content: string
  file: File | null
  /** Set once uploaded, so a retry never uploads twice. */
  attachmentPath: string | null
  /** Order folder the file was accepted for at send time. */
  attachOrderId: string | null
  replyToId: string | null
  /** The bubble, so it survives switching conversations and back. */
  bubble: ChatMessage
  inFlight: boolean
}

export function useChatThread({
  conversationId,
  currentUserId,
  canMarkRead,
  attachOrderId,
  onIncoming,
  onDelivered,
}: UseChatThreadOptions): ChatThread {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()
  // Browser client is a singleton; memo keeps effect deps stable anyway.
  const supabase = useMemo(() => createClient(), [])

  // The conversation on screen. Async work (a send, a re-sync) started for
  // another conversation must not write into this one's list.
  const conversationRef = useRef(conversationId)
  conversationRef.current = conversationId

  // Callbacks and attach permission are read through refs so the realtime
  // channel and `deliver` never depend on objects the parent rebuilds every
  // render (re-joining the same topic could leave the chat deaf).
  const onIncomingRef = useRef(onIncoming)
  onIncomingRef.current = onIncoming
  const onDeliveredRef = useRef(onDelivered)
  onDeliveredRef.current = onDelivered
  const attachOrderIdRef = useRef(attachOrderId)
  attachOrderIdRef.current = attachOrderId

  // Declared before the thread read below so a conversation switch clears
  // its reactions before the new read lands.
  const reactions = useChatReactions({ conversationId, conversationRef, currentUserId, supabase })
  const { replace: replaceReactions, apply: applyReaction } = reactions

  // The message being replied to; a different conversation starts fresh.
  const [replyToId, setReplyToId] = useState<string | null>(null)
  const replyToRef = useRef(replyToId)
  replyToRef.current = replyToId
  useEffect(() => setReplyToId(null), [conversationId])

  // Tab visibility + "is the newest message on screen" (from MessageList):
  // together they decide when messages count as read and whether a new
  // message deserves a toast. Refs mirror them for the realtime callback.
  const [isVisible, setIsVisible] = useState(true)
  const [atBottom, setAtBottom] = useState(true)
  const seenRef = useRef({ visible: true, atBottom: true })
  seenRef.current = { visible: isVisible, atBottom }
  useEffect(() => {
    const onChange = () => setIsVisible(document.visibilityState === 'visible')
    onChange()
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])

  // Sends in flight or failed, by message id.
  const pendingRef = useRef(new Map<string, PendingSend>())
  const objectUrlsRef = useRef<string[]>([])
  useEffect(() => {
    const urls = objectUrlsRef.current
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [])

  /** setMessages, but only while `convId` is still the open conversation. */
  const applyFor = useCallback((convId: string, update: (prev: ChatMessage[]) => ChatMessage[]) => {
    if (conversationRef.current === convId) setMessages(update)
  }, [])

  // One read for the thread AND its reactions (lib/chat/thread-read).
  const fetchThread = useCallback(
    async (convId: string): Promise<{ rows: ChatRow[]; reactions: ReactionRow[] }> => {
      const { data, error: fetchError } = await supabase
        .from('messages')
        .select(THREAD_SELECT)
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true })
      if (fetchError) throw fetchError
      return splitThreadRows(data)
    },
    [supabase],
  )

  // Initial fetch. Unsent messages of this conversation (still sending, or
  // failed) come back with it, so switching away and back loses nothing.
  useEffect(() => {
    if (!conversationId) {
      setMessages([])
      setIsLoading(false)
      return
    }
    let alive = true
    const local = Array.from(pendingRef.current.entries())
      .filter(([, p]) => p.conversationId === conversationId)
      .map(([, p]) => ({ ...p.bubble, local_status: p.inFlight ? ('sending' as const) : ('failed' as const) }))
    setMessages(local)
    setIsLoading(true)
    setError(null)
    fetchThread(conversationId)
      .then(({ rows, reactions: found }) => {
        if (!alive) return
        setMessages((prev) => mergeServer(prev, rows))
        replaceReactions(conversationId, found)
      })
      .catch((err) => {
        console.error('Error fetching messages:', err)
        if (alive) setError('Failed to load messages')
      })
      .finally(() => {
        if (alive) setIsLoading(false)
      })
    return () => {
      alive = false
    }
  }, [conversationId, fetchThread, replaceReactions])

  // Quiet re-sync with the server. mergeServer keeps pending/failed sends
  // and returns the same array when nothing changed, so it never flickers.
  // One read per burst of triggers: returning to the tab fires
  // visibilitychange AND focus (and sometimes online) together.
  const lastResyncRef = useRef(0)
  const resync = useCallback(async () => {
    const convId = conversationRef.current
    if (!convId || document.visibilityState !== 'visible') return
    const now = Date.now()
    if (now - lastResyncRef.current < RESYNC_MIN_GAP_MS) return
    lastResyncRef.current = now
    try {
      const { rows, reactions: found } = await fetchThread(convId)
      applyFor(convId, (prev) => mergeServer(prev, rows))
      replaceReactions(convId, found)
    } catch {
      // A failed background re-sync is retried by the next trigger.
    }
  }, [fetchThread, applyFor, replaceReactions])
  const resyncRef = useRef(resync)
  resyncRef.current = resync

  // Safety net for the live channel: re-sync whenever this tab comes back
  // into view (the other party may have written while it was in the
  // background) and once a minute while it is visible (was every 20 s, each
  // a full-thread read; 2026-10-20 usage audit). Realtime delivers new
  // messages; this only covers a silently deaf channel.
  useEffect(() => {
    if (!conversationId) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') void resyncRef.current()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    window.addEventListener('online', onVisible)
    const poll = setInterval(() => void resyncRef.current(), POLL_MS.chatResync)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.removeEventListener('online', onVisible)
      clearInterval(poll)
    }
  }, [conversationId])

  const invalidateUnread = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['unread-messages', currentUserId] })
    queryClient.invalidateQueries({ queryKey: ['unread-messages'] })
    queryClient.invalidateQueries({ queryKey: ['seller', 'messages', 'conversations'] })
  }, [queryClient, currentUserId])
  const invalidateUnreadRef = useRef(invalidateUnread)
  invalidateUnreadRef.current = invalidateUnread

  // Live channel: the private topic chat:<conversation id>. A DB trigger
  // broadcasts each messages INSERT/UPDATE and message_reactions change
  // (migration 20261021222022); only the two parties and admins may join
  // (RLS on realtime.messages, checked at join). Rows are merged straight
  // from the payload instead of refetching the thread.
  useEffect(() => {
    if (!conversationId || !currentUserId) return
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    // Join only once the socket carries the signed-in session: a private
    // channel joined with the anonymous key is refused.
    const join = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (cancelled) return
      if (session?.access_token) supabase.realtime.setAuth(session.access_token)

      channel = supabase
        .channel(chatTopic(conversationId), { config: { private: true } })
        .on('broadcast', { event: 'message' }, (msg) => {
          const event = parseChatBroadcast(msg)
          if (event?.kind !== 'message' || event.row.conversation_id !== conversationId) return
          const row = event.row
          // Dedupe by id: the echo of my own send settles its optimistic
          // bubble; anything else slots in by time. An UPDATE is a read
          // receipt (the other side stamped is_read / read_at).
          applyFor(conversationId, (prev) => upsertRow(prev, row))
          if (event.op !== 'INSERT' || row.sender_id === currentUserId) return
          const { visible, atBottom: seesNewest } = seenRef.current
          onIncomingRef.current?.(row, visible && seesNewest)
          if (row.sender_id) invalidateUnreadRef.current()
        })
        .on('broadcast', { event: 'reaction' }, (msg) => {
          const event = parseChatBroadcast(msg)
          if (event) applyReaction(conversationId, event)
        })
        .subscribe((status) => {
          // Joined or re-joined after a drop: pick up whatever was written
          // while the socket was away.
          if (status === 'SUBSCRIBED') void resyncRef.current()
        })
    }
    void join()

    return () => {
      cancelled = true
      // removeChannel (not just unsubscribe) so a later mount of the same
      // topic gets a fresh channel instead of the one still leaving.
      if (channel) void supabase.removeChannel(channel)
    }
  }, [conversationId, currentUserId, supabase, applyFor, applyReaction])

  // Mark the other party's messages read once they are actually seen: tab
  // visible AND the newest message in view (not while scrolled up with the
  // "New messages" pill showing). Only the ids on screen are stamped.
  const unreadKey = canMarkRead ? unreadFromOthers(messages, currentUserId).join(',') : ''
  useEffect(() => {
    if (!conversationId || !unreadKey || !isVisible || !atBottom || isLoading) return
    const ids = unreadKey.split(',')
    const readAt = new Date().toISOString()
    let cancelled = false
    void (async () => {
      const { error: readError } = await (supabase.from('messages').update as any)({
        is_read: true,
        read_at: readAt,
      })
        .eq('conversation_id', conversationId)
        .in('id', ids)
        .neq('sender_id', currentUserId)
        .is('read_at', null)
      if (cancelled || readError) return
      setMessages((prev) => markReadLocally(prev, ids, readAt))
      invalidateUnread()
    })()
    return () => {
      cancelled = true
    }
  }, [unreadKey, isVisible, atBottom, isLoading, conversationId, currentUserId, supabase, invalidateUnread])

  /** Store one queued message. Idempotent: the row id is minted on the
   *  client, so a retry after a lost response cannot create a second row. */
  const deliver = useCallback(
    async (id: string) => {
      const pending = pendingRef.current.get(id)
      if (!pending || pending.inFlight) return
      const convId = pending.conversationId
      pending.inFlight = true
      applyFor(convId, (prev) => markLocalStatus(prev, id, 'sending'))
      let uploading = false
      try {
        if (pending.file && !pending.attachmentPath) {
          // Re-checked at send time while this conversation is open (the
          // chat may have expired since); RLS + storage policy still gate.
          const orderId =
            conversationRef.current === convId ? attachOrderIdRef.current : pending.attachOrderId
          if (!orderId) throw new Error(ATTACH_NOT_ALLOWED)
          uploading = true
          pending.attachmentPath = await uploadChatAttachment(supabase.storage as any, orderId, pending.file)
          uploading = false
          const path = pending.attachmentPath
          pending.bubble = { ...pending.bubble, attachments: [path] }
          applyFor(convId, (prev) => patchMessage(prev, id, { attachments: [path] }))
        }

        const stored = await storeMessage(supabase, {
          id,
          conversationId: convId,
          senderId: currentUserId,
          content: pending.content,
          attachmentPath: pending.attachmentPath,
          replyToId: pending.replyToId,
        })

        pendingRef.current.delete(id)
        applyFor(convId, (prev) => upsertRow(prev, stored))
        invalidateUnread()
        onDeliveredRef.current?.(stored)
      } catch (err) {
        console.error('Error sending message:', err)
        pending.inFlight = false
        // The bubble stays, marked "Not sent · Retry". An upload problem
        // also says why (size / type / storage), which Retry alone can't.
        applyFor(convId, (prev) => markLocalStatus(prev, id, 'failed'))
        if (uploading) {
          toast.error(err instanceof Error ? err.message : 'Could not upload the file. Please try again.')
        }
      }
    },
    [currentUserId, supabase, invalidateUnread, applyFor],
  )

  const retry = useCallback((id: string) => void deliver(id), [deliver])

  // Queue a message: the bubble is on screen in the same frame, in its final
  // colours (pending = lower opacity + clock), then `deliver` stores it.
  const send = useCallback(
    async (text: string, file?: File | null) => {
      const convId = conversationRef.current
      if (!convId) throw new Error('no conversation open')
      if (file && !attachOrderIdRef.current) {
        toast.error(ATTACH_NOT_ALLOWED)
        throw new Error('attachments not allowed here')
      }
      // messages.content can't be empty; a file-only message gets a label.
      const content = text || (file ? attachmentOnlyLabel(file.type) : text)
      const id = crypto.randomUUID()
      const replyTo = replyToRef.current
      setReplyToId(null)

      let localFiles: LocalFile[] | undefined
      if (file) {
        if (file.type.startsWith('image/')) {
          const url = URL.createObjectURL(file)
          objectUrlsRef.current.push(url)
          localFiles = [{ kind: 'image', url }]
        } else {
          localFiles = [{ kind: 'pdf' }]
        }
      }

      const bubble = optimisticMessage({
        id,
        conversationId: convId,
        senderId: currentUserId,
        content,
        localFiles,
        replyToId: replyTo,
      })
      pendingRef.current.set(id, {
        conversationId: convId,
        content,
        file: file ?? null,
        attachmentPath: null,
        attachOrderId: file ? attachOrderIdRef.current : null,
        replyToId: replyTo,
        bubble,
        inFlight: false,
      })
      setMessages((prev) => addOptimistic(prev, bubble))
      void deliver(id)
    },
    [currentUserId, deliver],
  )

  return {
    messages,
    isLoading,
    error,
    send,
    retry,
    setAtBottom,
    reactions: reactions.rows,
    react: reactions.react,
    replyToId,
    setReplyTo: setReplyToId,
  }
}

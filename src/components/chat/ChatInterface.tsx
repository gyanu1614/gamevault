'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { notifyNewMessage } from '@/lib/actions/message-notify'
import { toast } from 'sonner'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import { displayOrderRef } from '@/lib/orders/order-number'
import { getAvatarUrl } from '@/lib/utils/avatar'
import { useSellerOnline } from '@/hooks/use-seller-presence'
import { isSystemMessage, systemNoticePreview } from '@/lib/chat/system-notice'
import { attachmentOnlyLabel, uploadChatAttachment } from '@/lib/chat/attachments'
import { AlertCircle } from 'lucide-react'
import {
  addOptimistic,
  markLocalStatus,
  markReadLocally,
  mergeServer,
  patchMessage,
  unreadFromOthers,
  upsertRow,
  type ChatMessage,
  type ChatRow,
  type LocalFile,
} from '@/lib/chat/message-state'

interface ChatInterfaceProps {
  conversationId: string
  currentUserId: string
  /** Used to render the OWN-side bubble avatar. Pass the auth user's
   *  avatar (DiceBear fallback if unset) — same source as everywhere. */
  currentUserAvatar?: string
  otherUser?: {
    id: string
    username: string
    avatar_url?: string
  }
  order?: {
    id: string
    order_number?: string
    listing: {
      title: string
      images?: string[]
      game_id?: string
    }
    total_amount: number
    status: string
    created_at: string
    chat_active_until?: string | null
    buyer?: {
      id: string
      username: string
      avatar_url?: string
    }
    seller?: {
      id: string
      username: string
      avatar_url?: string
    }
  }
  disputeResolution?: {
    favored_party: 'buyer' | 'seller' | 'neutral'
  } | null
  onViewOrder?: () => void
  className?: string
  /** When the other person is the SELLER, their id: the header dot shows
   *  their live online state. Omit it (buyers have no presence) and no dot
   *  is drawn. */
  presenceSellerId?: string | null
}

export default function ChatInterface({
  conversationId,
  currentUserId,
  currentUserAvatar,
  otherUser,
  order,
  disputeResolution,
  onViewOrder,
  className = '',
  presenceSellerId = null,
}: ChatInterfaceProps) {
  const otherOnline = useSellerOnline(presenceSellerId)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const queryClient = useQueryClient()
  // Browser client is a singleton; memo keeps effect deps stable anyway.
  const supabase = useMemo(() => createClient(), [])

  // Check if chat is expired (7 days after order completion)
  // …except while the order is disputed: chat_active_until is stamped once at
  // completion, so a dispute opened later on an older order locked the chat
  // the parties need to settle it.
  const isChatExpired =
    order?.status !== 'disputed' && order?.chat_active_until
      ? new Date(order.chat_active_until) < new Date()
      : false

  // Only the buyer and seller mark messages read. An admin opening the
  // dispute chat used to stamp both parties' messages "Read".
  const isParticipant =
    order?.buyer && order?.seller
      ? currentUserId === order.buyer.id || currentUserId === order.seller.id
      : !!otherUser

  // Check if current user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      const { data } = await supabase
        .from('admin_roles')
        .select('id')
        .eq('user_id', currentUserId)
        .eq('is_active', true)
        .maybeSingle()

      setIsAdmin(!!data)
    }
    checkAdmin()
  }, [currentUserId, supabase])

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

  const fetchThread = useCallback(async (): Promise<ChatRow[]> => {
    const { data, error: fetchError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
    if (fetchError) throw fetchError
    return (data ?? []) as unknown as ChatRow[]
  }, [conversationId, supabase])

  // Initial fetch of messages
  useEffect(() => {
    if (!conversationId) return
    let alive = true
    setMessages([])
    setIsLoading(true)
    setError(null)
    fetchThread()
      .then((rows) => {
        if (alive) setMessages((prev) => mergeServer(prev, rows))
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
  }, [conversationId, fetchThread])

  // Quiet re-sync with the server. mergeServer keeps pending/failed sends
  // and returns the same array when nothing changed, so it never flickers.
  const resync = useCallback(async () => {
    if (document.visibilityState !== 'visible') return
    try {
      const rows = await fetchThread()
      setMessages((prev) => mergeServer(prev, rows))
    } catch {
      // A failed background re-sync is retried by the next trigger.
    }
  }, [fetchThread])
  const resyncRef = useRef(resync)
  resyncRef.current = resync

  // Sender names for toasts, read through a ref so the realtime channel does
  // not depend on the `order` / `otherUser` objects: the parent rebuilds
  // them on every render (router.refresh, a modal opening), and tearing the
  // channel down and re-joining the same topic could leave the chat deaf to
  // new messages.
  const namesRef = useRef<Record<string, string>>({})
  namesRef.current = {
    ...(order?.buyer ? { [order.buyer.id]: order.buyer.username } : {}),
    ...(order?.seller ? { [order.seller.id]: order.seller.username } : {}),
    ...(otherUser ? { [otherUser.id]: otherUser.username } : {}),
  }

  // Safety net for the live channel: re-sync whenever this tab comes back
  // into view (the other party may have written while it was in the
  // background) and every 20 s while it is visible. A silently deaf
  // channel then costs seconds, not a manual refresh.
  useEffect(() => {
    if (!conversationId) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') void resyncRef.current()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    window.addEventListener('online', onVisible)
    const poll = setInterval(() => void resyncRef.current(), 20_000)
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

  // Real-time subscription: one channel per conversation. Rows are merged
  // straight from the payload (REPLICA IDENTITY FULL carries the whole row)
  // instead of refetching the thread on every insert and read receipt.
  useEffect(() => {
    if (!conversationId || !currentUserId) return
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    // Join only once the socket carries the signed-in session: a channel
    // joined with the anonymous key is filtered by RLS and never receives
    // the other party's messages (they only showed after a refresh).
    const join = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (cancelled) return
      if (session?.access_token) supabase.realtime.setAuth(session.access_token)

      channel = supabase
        .channel(`order-chat:${conversationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const row = payload.new as ChatRow
            // Dedupe by id: the echo of my own send settles its optimistic
            // bubble; anything else slots in by time.
            setMessages((prev) => upsertRow(prev, row))

            // A DropMarket notice (dispute card): a plain-words toast, and it
            // is not the other person's message to mark read.
            if (isSystemMessage(row.sender_id)) {
              toast.message('DropMarket update', {
                description: systemNoticePreview(row.content),
                duration: 3000,
              })
            } else if (row.sender_id !== currentUserId) {
              // Watching the thread arrive (tab visible, newest in view):
              // no toast. Otherwise tell them who wrote.
              const { visible, atBottom: seesNewest } = seenRef.current
              if (!(visible && seesNewest)) {
                const senderName = (row.sender_id && namesRef.current[row.sender_id]) || 'Someone'
                toast.message(`New message from ${senderName}`, {
                  description: row.content.slice(0, 100),
                  duration: 3000,
                })
              }
              invalidateUnreadRef.current()
            }
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          // Read receipts: the other side stamped is_read / read_at.
          (payload) => setMessages((prev) => upsertRow(prev, payload.new as ChatRow)),
        )
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
  }, [conversationId, currentUserId, supabase])

  // Mark the other party's messages read once they are actually seen: tab
  // visible AND the newest message in view (not while scrolled up with the
  // "New messages" pill showing). Only the ids on screen are stamped.
  const unreadKey = isParticipant ? unreadFromOthers(messages, currentUserId).join(',') : ''
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

  // Only the order's buyer and seller can attach files: the storage
  // policy on the order folder accepts uploads from those two only.
  const canAttach =
    !!order?.id &&
    (order.buyer?.id === currentUserId || order.seller?.id === currentUserId) &&
    !isChatExpired

  // Sends in flight or failed, by message id: what a Retry needs (the file
  // and, once uploaded, its path so a retry never uploads twice).
  const pendingRef = useRef(
    new Map<string, { content: string; file: File | null; attachmentPath: string | null }>(),
  )
  const objectUrlsRef = useRef<string[]>([])
  useEffect(() => {
    const urls = objectUrlsRef.current
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [])

  // Latest order context for the async send (status may change mid-send).
  const orderRef = useRef(order)
  orderRef.current = order
  const canAttachRef = useRef(canAttach)
  canAttachRef.current = canAttach

  /** Store one queued message. Idempotent: the row id is minted on the
   *  client, so a retry after a lost response cannot create a second row. */
  const deliver = useCallback(
    async (id: string) => {
      const pending = pendingRef.current.get(id)
      if (!pending) return
      setMessages((prev) => markLocalStatus(prev, id, 'sending'))
      const ord = orderRef.current
      let uploading = false
      try {
        if (pending.file && !pending.attachmentPath) {
          if (!canAttachRef.current || !ord?.id) throw new Error('Files can only be sent in an active order chat.')
          uploading = true
          pending.attachmentPath = await uploadChatAttachment(supabase.storage as any, ord.id, pending.file)
          uploading = false
          const path = pending.attachmentPath
          setMessages((prev) => patchMessage(prev, id, { attachments: [path] }))
        }

        const { data, error: sendError } = await (supabase.from('messages').insert as any)({
          id,
          conversation_id: conversationId,
          sender_id: currentUserId,
          content: pending.content,
          is_read: false,
          ...(pending.attachmentPath ? { attachments: [pending.attachmentPath] } : {}),
        })
          .select('*')
          .single()

        let stored = data as ChatRow | null
        if (sendError) {
          // 23505 = this id is already stored: an earlier attempt landed
          // but its response was lost. Read it back instead of duplicating.
          if (sendError.code !== '23505') throw sendError
          const { data: existing } = await supabase.from('messages').select('*').eq('id', id).maybeSingle()
          if (!existing) throw sendError
          stored = existing as unknown as ChatRow
        }

        pendingRef.current.delete(id)
        if (stored) setMessages((prev) => upsertRow(prev, stored as ChatRow))

        // Comms (first-unread-only): notify + email the other participant.
        // The server action never throws and does all awaiting server-side;
        // client-side we deliberately don't block the chat on it.
        notifyNewMessage(conversationId).catch(() => {})
        invalidateUnread()

        // V21/P4.e — If this message is the seller speaking on a 'paid'
        // order, flip status to 'delivering' atomically server-side. The
        // server action is guarded so it's a no-op for buyers or for
        // orders already past 'paid'. Fire-and-forget — failure here
        // never blocks the chat.
        if (ord && ord.status === 'paid' && ord.seller?.id === currentUserId) {
          const { notifySellerActivity } = await import('@/lib/actions/orders')
          void notifySellerActivity(ord.id)
        }
      } catch (err) {
        console.error('Error sending message:', err)
        // The bubble stays, marked "Not sent · Retry". An upload problem
        // also says why (size / type / storage), which Retry alone can't.
        setMessages((prev) => markLocalStatus(prev, id, 'failed'))
        if (uploading) {
          toast.error(err instanceof Error ? err.message : 'Could not upload the file. Please try again.')
        }
      }
    },
    [conversationId, currentUserId, supabase, invalidateUnread],
  )

  const handleRetry = useCallback((id: string) => void deliver(id), [deliver])

  // Queue a message: the bubble is on screen in the same frame, in its final
  // colours (pending = lower opacity + clock), then `deliver` stores it.
  const handleSend = async (text: string, file?: File | null) => {
    if (file && !canAttach) {
      toast.error('Files can only be sent in an active order chat.')
      throw new Error('attachments not allowed here')
    }
    // messages.content can't be empty; a file-only message gets a label.
    const content = text || (file ? attachmentOnlyLabel(file.type) : text)
    const id = crypto.randomUUID()

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

    pendingRef.current.set(id, { content, file: file ?? null, attachmentPath: null })
    setMessages((prev) =>
      addOptimistic(prev, {
        id,
        conversation_id: conversationId,
        sender_id: currentUserId,
        content,
        attachments: [],
        is_read: false,
        read_at: null,
        created_at: new Date().toISOString(),
        local_status: 'sending',
        local_files: localFiles,
      }),
    )
    void deliver(id)
  }

  if (error) {
    return (
      <div className={`flex h-full items-center justify-center ${className}`}>
        <div className="text-center">
          <AlertCircle className="mx-auto mb-3 h-12 w-12 text-error" />
          <h3 className="mb-2 text-lg font-semibold text-white">Failed to load chat</h3>
          <p className="text-sm text-text-secondary">{error}</p>
          <button
            onClick={() => {
              setError(null)
              setIsLoading(true)
              // Retry loading instead of full page reload
              window.location.reload()
            }}
            className="mt-4 rounded-lg bg-lime px-4 py-2 text-sm font-semibold text-text-inverse hover:bg-lime"
          >
            Reload
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex h-full flex-col bg-bg-raised ${className}`}>
      {/* Admin View: Party Indicators */}
      {isAdmin && order?.buyer && order?.seller && (
        <div className="bg-gradient-to-r from-gray-500/10 via-black to-[rgba(86,184,127,0.10)] border-b border-border-subtle px-4 py-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-500/15 border border-gray-500/20">
                <svg className="w-3.5 h-3.5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <span className="font-semibold text-text-secondary">LEFT: Seller</span>
                <span className="text-text-tertiary">({order.seller.username})</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-lime-tint-bg border border-lime-tint-border">
                <svg className="w-3.5 h-3.5 text-lime-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="font-semibold text-lime-text">RIGHT: Buyer</span>
                <span className="text-lime-text">({order.buyer.username})</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat Expired Banner */}
      {isChatExpired && !isAdmin && (
        <div className="bg-warning-bg border-b border-[color-mix(in_srgb,var(--color-warning)_40%,transparent)] px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-warning flex-shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-warning">
                Chat Inactive - Order Completed Over 7 Days Ago
              </div>
              <div className="text-xs text-text-secondary">
                This conversation is now read-only. Contact support if you need assistance.
              </div>
            </div>
          </div>
        </div>
      )}


      {/* V21/P5.c — Compact party header. Avatar + name + slim
          subtitle with order id + item title. Sits above the messages
          area so the chat reads as a real conversation surface and
          not just a stream of bubbles. */}
      {otherUser && (
        <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-3">
          <div className="relative flex-shrink-0">
            {/* Same avatar source as the rest of the page: uploaded photo,
                else the DiceBear character seeded by username. */}
            <img
              src={getAvatarUrl(otherUser.avatar_url, otherUser.username ?? 'user')}
              alt=""
              className="h-9 w-9 rounded-full bg-bg-overlay object-cover ring-1 ring-white/10"
            />
            {otherOnline !== null && (
              <span
                aria-label={otherOnline ? 'Online' : 'Offline'}
                className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-bg-raised ${
                  otherOnline ? 'bg-green-400' : 'bg-text-tertiary'
                }`}
              />
            )}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="flex items-center gap-1.5 text-[13.5px] font-bold text-text-primary">
              {otherUser.username ?? 'User'}
            </div>
            {order && (
              <div className="mt-0.5 truncate text-[11.5px] text-text-secondary">
                Order #{displayOrderRef(order.order_number, order.id)}
                {order.listing?.title ? ` · ${order.listing.title}` : ''}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Messages List */}
      <MessageList
        messages={messages}
        currentUserId={currentUserId}
        currentUserAvatar={currentUserAvatar}
        otherUser={otherUser}
        order={order}
        disputeResolution={disputeResolution}
        onViewOrder={onViewOrder}
        isLoading={isLoading}
        autoScroll={true}
        onRetry={handleRetry}
        onAtBottomChange={setAtBottom}
      />

      {/* Message Input */}
      <MessageInput
        onSend={handleSend}
        placeholder={
          isChatExpired && !isAdmin
            ? 'Chat is no longer active'
            : otherUser
            ? `Message ${otherUser.username}...`
            : 'Send a message...'
        }
        disabled={isLoading || (isChatExpired && !isAdmin)}
        allowAttachments={canAttach}
        optimistic
      />
    </div>
  )
}

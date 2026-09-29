'use client'

import { useEffect, useRef, useState } from 'react'
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
import { Loader2, AlertCircle } from 'lucide-react'

interface Message {
  id: string
  conversation_id: string
  /** NULL = DropMarket system notice. */
  sender_id: string | null
  content: string
  attachments?: string[] | null
  is_read: boolean
  read_at: string | null
  created_at: string
}

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
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const queryClient = useQueryClient()
  const supabase = createClient()

  // Check if chat is expired (7 days after order completion)
  // …except while the order is disputed: chat_active_until is stamped once at
  // completion, so a dispute opened later on an older order locked the chat
  // the parties need to settle it.
  const isChatExpired =
    order?.status !== 'disputed' && order?.chat_active_until
      ? new Date(order.chat_active_until) < new Date()
      : false

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

  // Initial fetch of messages
  useEffect(() => {
    const loadMessages = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const { data, error: fetchError } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true })

        if (fetchError) throw fetchError

        setMessages(data || [])
      } catch (err) {
        console.error('Error fetching messages:', err)
        setError('Failed to load messages')
      } finally {
        setIsLoading(false)
      }
    }

    if (conversationId) {
      loadMessages()
    }
  }, [conversationId, supabase])

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

  // Safety net for the live channel: reload the thread whenever this tab
  // comes back into view (the other party may have written while it was in
  // the background) and every 20 s while it is visible. A silently deaf
  // channel then costs seconds, not a manual refresh.
  useEffect(() => {
    if (!conversationId) return
    let alive = true
    const reload = async () => {
      if (document.visibilityState !== 'visible') return
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
      if (alive && data) setMessages(data)
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void reload()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    const poll = setInterval(() => void reload(), 20_000)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      clearInterval(poll)
    }
  }, [conversationId, supabase])

  // Real-time subscription: one channel per conversation.
  useEffect(() => {
    if (!conversationId || !currentUserId) return
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    // Join only once the socket carries the signed-in session: a channel
    // joined with the anonymous key is filtered by RLS and never receives
    // the other party's messages (they only showed after a refresh).
    const join = async () => {
      const { data: { session } } = await supabase.auth.getSession()
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
        async (payload) => {
          const newMessage = payload.new as Message

          // Immediately refetch messages (exact pattern from working code)
          const { data } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true })

          if (data) {
            setMessages(data)
          }

          // A DropMarket notice (dispute card): a plain-words toast, and it
          // is not the other person's message to mark read.
          if (isSystemMessage(newMessage.sender_id)) {
            toast.message('DropMarket update', {
              description: systemNoticePreview(newMessage.content),
              duration: 3000,
            })
          } else if (newMessage.sender_id !== currentUserId) {
            const senderName = (newMessage.sender_id && namesRef.current[newMessage.sender_id]) || 'Someone'

            toast.message(`New message from ${senderName}`, {
              description: newMessage.content.slice(0, 100),
              duration: 3000,
            })

            // Mark as read
            await (supabase
              .from('messages')
              .update as any)({
                is_read: true,
                read_at: new Date().toISOString(),
              })
              .eq('conversation_id', conversationId)
              .eq('sender_id', newMessage.sender_id)
              .is('read_at', null)

            // Update unread counts - exact pattern from working code
            queryClient.invalidateQueries({ queryKey: ['unread-messages', currentUserId] })
            queryClient.invalidateQueries({ queryKey: ['unread-messages'] })
            queryClient.invalidateQueries({ queryKey: ['seller', 'messages', 'conversations'] })
          }
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
        async () => {
          // Refetch messages (exact pattern from working code)
          const { data } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true })

          if (data) {
            setMessages(data)
          }
        }
      )
      .subscribe()
    }
    void join()

    return () => {
      cancelled = true
      // removeChannel (not just unsubscribe) so a later mount of the same
      // topic gets a fresh channel instead of the one still leaving.
      if (channel) void supabase.removeChannel(channel)
    }
  }, [conversationId, currentUserId, supabase, queryClient])

  // Mark messages as read when viewing
  useEffect(() => {
    const markAsRead = async () => {
      if (!conversationId || messages.length === 0) return

      // Mark all messages not sent by current user as read
      const unreadMessages = messages.filter(
        (m) => m.sender_id !== currentUserId && !m.is_read
      )

      if (unreadMessages.length === 0) return

      await (supabase
        .from('messages')
        .update as any)({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('conversation_id', conversationId)
        .neq('sender_id', currentUserId)
        .is('read_at', null)

      // Update local state
      setMessages((prev) =>
        prev.map((m) =>
          m.sender_id !== currentUserId && !m.is_read
            ? { ...m, is_read: true, read_at: new Date().toISOString() }
            : m
        )
      )

      // Update unread counts
      queryClient.invalidateQueries({ queryKey: ['unread-messages', currentUserId] })
      queryClient.invalidateQueries({ queryKey: ['unread-messages'] })
      queryClient.invalidateQueries({ queryKey: ['seller', 'messages', 'conversations'] })
    }

    markAsRead()
  }, [messages.length, conversationId, currentUserId, supabase, queryClient])

  // Only the order's buyer and seller can attach files: the storage
  // policy on the order folder accepts uploads from those two only.
  const canAttach =
    !!order?.id &&
    (order.buyer?.id === currentUserId || order.seller?.id === currentUserId) &&
    !isChatExpired

  // Send message (optionally with one file)
  const handleSend = async (text: string, file?: File | null) => {
    // Upload first: the message row only ever points at a file that exists.
    let attachmentPath: string | null = null
    if (file) {
      try {
        if (!canAttach) throw new Error('Files can only be sent in an active order chat.')
        attachmentPath = await uploadChatAttachment(supabase.storage as any, order!.id, file)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not upload the file. Please try again.')
        throw e
      }
    }
    // messages.content can't be empty; a file-only message gets a label.
    const content = text || (file ? attachmentOnlyLabel(file.type) : text)

    // Optimistic update - add message immediately
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: conversationId,
      sender_id: currentUserId,
      content,
      attachments: attachmentPath ? [attachmentPath] : [],
      is_read: false,
      read_at: null,
      created_at: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, optimisticMessage])

    try {
      const { error: sendError } = await (supabase.from('messages').insert as any)({
        conversation_id: conversationId,
        sender_id: currentUserId,
        content,
        is_read: false,
        ...(attachmentPath ? { attachments: [attachmentPath] } : {}),
      })

      if (sendError) throw sendError

      // Update conversation last_message_at
      await (supabase
        .from('conversations')
        .update as any)({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId)

      // Comms (first-unread-only): notify + email the other participant.
      // The server action never throws and does all awaiting server-side;
      // client-side we deliberately don't block the optimistic UI on it.
      notifyNewMessage(conversationId).catch(() => {})

      // Refetch to replace optimistic message with real one
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (data) {
        setMessages(data)
      }

      // Update conversation lists - exact pattern from working code
      queryClient.invalidateQueries({ queryKey: ['unread-messages', currentUserId] })
      queryClient.invalidateQueries({ queryKey: ['unread-messages'] })
      queryClient.invalidateQueries({ queryKey: ['seller', 'messages', 'conversations'] })

      // V21/P4.e — If this message is the seller speaking on a 'paid'
      // order, flip status to 'delivering' atomically server-side. The
      // server action is guarded so it's a no-op for buyers or for
      // orders already past 'paid'. Fire-and-forget — failure here
      // never blocks the chat.
      if (order && order.status === 'paid' && order.seller?.id === currentUserId) {
        const { notifySellerActivity } = await import('@/lib/actions/orders')
        void notifySellerActivity(order.id)
      }
    } catch (err) {
      console.error('Error sending message:', err)
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id))
      toast.error('Failed to send message. Please try again.')
      throw err
    }
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
        <div className="bg-warning-bg border-b border-warning/40 px-4 py-3">
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
      />
    </div>
  )
}

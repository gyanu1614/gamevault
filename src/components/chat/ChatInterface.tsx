'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import DeliveryEvidenceUpload from '@/components/orders/DeliveryEvidenceUpload'
import { Loader2, AlertCircle, Upload, ChevronDown, ChevronUp } from 'lucide-react'

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
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
  /** Pass to enable the "Upload Proof" panel inside chat (seller only, orders ≥ $100) */
  evidenceProps?: {
    orderId: string
    existingEvidence: string[]
    disabled?: boolean
  }
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
  evidenceProps,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showEvidencePanel, setShowEvidencePanel] = useState(false)
  const queryClient = useQueryClient()
  const supabase = createClient()

  // Check if chat is expired (7 days after order completion)
  const isChatExpired = order?.chat_active_until
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

  // Real-time subscription - exact pattern from working code
  useEffect(() => {
    if (!conversationId || !currentUserId) return

    const channel = supabase
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

          // Show toast for messages from other user
          if (newMessage.sender_id !== currentUserId) {
            // Determine sender name
            let senderName = 'Someone'
            if (otherUser && newMessage.sender_id === otherUser.id) {
              senderName = otherUser.username
            } else if (order?.buyer && newMessage.sender_id === order.buyer.id) {
              senderName = order.buyer.username
            } else if (order?.seller && newMessage.sender_id === order.seller.id) {
              senderName = order.seller.username
            }

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

    return () => {
      channel.unsubscribe()
    }
  }, [conversationId, currentUserId, otherUser?.username, otherUser?.id, order, supabase, queryClient])

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

  // Send message
  const handleSend = async (content: string) => {
    // Optimistic update - add message immediately
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: conversationId,
      sender_id: currentUserId,
      content,
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
      })

      if (sendError) throw sendError

      // Update conversation last_message_at
      await (supabase
        .from('conversations')
        .update as any)({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId)

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
        <div className="bg-gradient-to-r from-gray-500/10 via-black to-lime/10 border-b border-border-subtle px-4 py-2">
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
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-lime/15 border border-lime-tint-border">
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
            {otherUser.avatar_url ? (
              <img
                src={otherUser.avatar_url}
                alt=""
                className="h-9 w-9 rounded-full object-cover ring-1 ring-white/10"
              />
            ) : (
              <span className="grid h-9 w-9 place-items-center rounded-full bg-bg-overlay text-[12px] font-bold text-text-secondary ring-1 ring-white/10">
                {otherUser.username?.charAt(0).toUpperCase()}
              </span>
            )}
            <span
              aria-hidden
              className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-400 ring-2 ring-bg-raised"
            />
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="flex items-center gap-1.5 text-[13.5px] font-bold text-text-primary">
              {otherUser.username ?? 'User'}
            </div>
            {order && (
              <div className="mt-0.5 truncate text-[11.5px] text-text-secondary">
                Order #{(order.order_number ?? '').replace(/^GV-/, 'DM-') || order.id.slice(0, 8).toUpperCase()}
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

      {/* Delivery Evidence Upload Panel (seller only, orders ≥ $100) */}
      {evidenceProps && !isChatExpired && (
        <div className="border-t border-border-subtle">
          <button
            onClick={() => setShowEvidencePanel(p => !p)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-text-tertiary hover:text-text-secondary hover:bg-bg-overlay transition-colors"
          >
            <div className="flex items-center gap-2">
              <Upload className="h-3.5 w-3.5 text-lime-text" />
              <span className="font-medium text-lime-text/80">Upload Delivery Proof</span>
              {evidenceProps.existingEvidence.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-lime/20 text-lime-text text-[10px] font-semibold">
                  {evidenceProps.existingEvidence.length}
                </span>
              )}
            </div>
            {showEvidencePanel ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" />
            )}
          </button>
          {showEvidencePanel && (
            <div className="px-4 pb-4 border-t border-border-subtle">
              <DeliveryEvidenceUpload
                orderId={evidenceProps.orderId}
                existingEvidence={evidenceProps.existingEvidence}
                disabled={evidenceProps.disabled}
              />
            </div>
          )}
        </div>
      )}

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
      />
    </div>
  )
}

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
            await supabase
              .from('messages')
              .update({
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

      await supabase
        .from('messages')
        .update({
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
      const { error: sendError } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: currentUserId,
        content,
        is_read: false,
      })

      if (sendError) throw sendError

      // Update conversation last_message_at
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
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
          <AlertCircle className="mx-auto mb-3 h-12 w-12 text-red-500" />
          <h3 className="mb-2 text-lg font-semibold text-white">Failed to load chat</h3>
          <p className="text-sm text-gray-400">{error}</p>
          <button
            onClick={() => {
              setError(null)
              setIsLoading(true)
              // Retry loading instead of full page reload
              window.location.reload()
            }}
            className="mt-4 rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-600"
          >
            Reload
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex h-full flex-col bg-black ${className}`}>
      {/* Admin View: Party Indicators */}
      {isAdmin && order?.buyer && order?.seller && (
        <div className="bg-gradient-to-r from-gray-500/10 via-black to-violet-500/10 border-b border-white/[0.05] px-4 py-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-500/15 border border-gray-500/20">
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <span className="font-semibold text-gray-300">LEFT: Seller</span>
                <span className="text-gray-500">({order.seller.username})</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-violet-500/15 border border-violet-500/20">
                <svg className="w-3.5 h-3.5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="font-semibold text-violet-300">RIGHT: Buyer</span>
                <span className="text-violet-500">({order.buyer.username})</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat Expired Banner */}
      {isChatExpired && !isAdmin && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-yellow-400">
                Chat Inactive - Order Completed Over 7 Days Ago
              </div>
              <div className="text-xs text-gray-400">
                This conversation is now read-only. Contact support if you need assistance.
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Messages List */}
      <MessageList
        messages={messages}
        currentUserId={currentUserId}
        otherUser={otherUser}
        order={order}
        disputeResolution={disputeResolution}
        onViewOrder={onViewOrder}
        isLoading={isLoading}
        autoScroll={true}
      />

      {/* Delivery Evidence Upload Panel (seller only, orders ≥ $100) */}
      {evidenceProps && !isChatExpired && (
        <div className="border-t border-white/[0.05]">
          <button
            onClick={() => setShowEvidencePanel(p => !p)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-gray-500 hover:text-gray-300 hover:bg-white/[0.03] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Upload className="h-3.5 w-3.5 text-violet-400" />
              <span className="font-medium text-violet-400/80">Upload Delivery Proof</span>
              {evidenceProps.existingEvidence.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400 text-[10px] font-semibold">
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
            <div className="px-4 pb-4 border-t border-white/[0.04]">
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

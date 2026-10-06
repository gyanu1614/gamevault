'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { notifyNewMessage } from '@/lib/actions/message-notify'
import { toast } from 'sonner'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import { displayOrderRef } from '@/lib/orders/order-number'
import { getAvatarUrl } from '@/lib/utils/avatar'
import { useSellerOnline } from '@/hooks/use-seller-presence'
import { useChatThread } from '@/hooks/use-chat-thread'
import { isSystemMessage, systemNoticePreview } from '@/lib/chat/system-notice'
import { AlertCircle } from 'lucide-react'
import type { ChatRow } from '@/lib/chat/message-state'

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
  const [isAdmin, setIsAdmin] = useState(false)
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

  // Only the order's buyer and seller can attach files: the storage
  // policy on the order folder accepts uploads from those two only.
  const canAttach =
    !!order?.id &&
    (order.buyer?.id === currentUserId || order.seller?.id === currentUserId) &&
    !isChatExpired

  // Sender names for toasts, read through a ref so the hook's realtime
  // channel never depends on the `order` / `otherUser` objects the parent
  // rebuilds on every render.
  const namesRef = useRef<Record<string, string>>({})
  namesRef.current = {
    ...(order?.buyer ? { [order.buyer.id]: order.buyer.username } : {}),
    ...(order?.seller ? { [order.seller.id]: order.seller.username } : {}),
    ...(otherUser ? { [otherUser.id]: otherUser.username } : {}),
  }
  // Latest order context for the async send (status may change mid-send).
  const orderRef = useRef(order)
  orderRef.current = order

  const handleIncoming = useCallback((row: ChatRow, seen: boolean) => {
    // A DropMarket notice (dispute card): a plain-words toast, and it is
    // not the other person's message to mark read.
    if (isSystemMessage(row.sender_id)) {
      toast.message('DropMarket update', {
        description: systemNoticePreview(row.content),
        duration: 3000,
      })
      return
    }
    // Watching the thread arrive (tab visible, newest in view): no toast.
    // Otherwise tell them who wrote.
    if (seen) return
    const senderName = (row.sender_id && namesRef.current[row.sender_id]) || 'Someone'
    toast.message(`New message from ${senderName}`, {
      description: row.content.slice(0, 100),
      duration: 3000,
    })
  }, [])

  const handleDelivered = useCallback(async () => {
    // Comms (first-unread-only): notify + email the other participant.
    // The server action never throws and does all awaiting server-side;
    // client-side we deliberately don't block the chat on it.
    notifyNewMessage(conversationId).catch(() => {})

    // V21/P4.e — If this message is the seller speaking on a 'paid'
    // order, flip status to 'delivering' atomically server-side. The
    // server action is guarded so it's a no-op for buyers or for
    // orders already past 'paid'. Fire-and-forget — failure here
    // never blocks the chat.
    const ord = orderRef.current
    if (ord && ord.status === 'paid' && ord.seller?.id === currentUserId) {
      const { notifySellerActivity } = await import('@/lib/actions/orders')
      void notifySellerActivity(ord.id)
    }
  }, [conversationId, currentUserId])

  // Thread state, realtime, read receipts and instant send: the shared hook
  // (/account/messages runs on the same one).
  const {
    messages,
    isLoading,
    error,
    send: handleSend,
    retry: handleRetry,
    setAtBottom,
  } = useChatThread({
    conversationId,
    currentUserId,
    canMarkRead: isParticipant,
    attachOrderId: canAttach && order?.id ? order.id : null,
    onIncoming: handleIncoming,
    onDelivered: () => void handleDelivered(),
  })

  if (error) {
    return (
      <div className={`flex h-full items-center justify-center ${className}`}>
        <div className="text-center">
          <AlertCircle className="mx-auto mb-3 h-12 w-12 text-error" />
          <h3 className="mb-2 text-lg font-semibold text-white">Failed to load chat</h3>
          <p className="text-sm text-text-secondary">{error}</p>
          <button
            onClick={() => window.location.reload()}
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

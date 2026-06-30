'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import MessageBubble from './MessageBubble'
import OrderMessageCard from './OrderMessageCard'
import DisputeSystemCard from './DisputeSystemCard'
import DisputeResolvedCard from './DisputeResolvedCard'
import { createClient } from '@/lib/supabase/client'

interface Message {
  id: string
  content: string
  sender_id: string
  is_read: boolean
  created_at: string
}

interface MessageListProps {
  messages: Message[]
  currentUserId: string
  /** Own user's avatar — rendered on right-side bubbles. */
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
  isLoading?: boolean
  autoScroll?: boolean
}

export default function MessageList({
  messages,
  currentUserId,
  currentUserAvatar,
  otherUser,
  order,
  disputeResolution,
  onViewOrder,
  isLoading = false,
  autoScroll = true,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const prevMessageCountRef = useRef(messages.length)
  const [adminUsers, setAdminUsers] = useState<Record<string, { username: string; avatar_url?: string }>>({})
  const supabase = createClient()

  // V21/P5.n — Admin view = viewer isn't the buyer OR the seller.
  // Previous heuristic just checked "both parties present" which was
  // true on EVERY order page, so the seller's own messages got
  // routed through the admin branch (buyer = right, seller = left)
  // and ended up on the wrong side. Now we only flip to admin layout
  // when the viewer truly is a third party.
  const isAdminView =
    !!(order?.buyer && order?.seller) &&
    currentUserId !== order.buyer.id &&
    currentUserId !== order.seller.id

  // Fetch admin info for messages sent by admins
  useEffect(() => {
    const fetchAdminUsers = async () => {
      // Get unique sender IDs from messages
      const senderIds = Array.from(new Set(messages.map(m => m.sender_id)))

      // Check which senders are admins
      const { data: admins } = await supabase
        .from('admin_roles')
        .select('user_id')
        .in('user_id', senderIds)
        .eq('is_active', true) as any

      if (!admins || admins.length === 0) return

      const adminUserIds = admins.map((a: any) => a.user_id)

      // Fetch profile info for admins
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', adminUserIds) as any

      if (profiles) {
        const adminMap: Record<string, { username: string; avatar_url?: string }> = {}
        profiles.forEach((p: any) => {
          adminMap[p.id] = {
            username: p.username,
            avatar_url: p.avatar_url || undefined
          }
        })
        setAdminUsers(adminMap)
      }
    }

    if (messages.length > 0) {
      fetchAdminUsers()
    }
  }, [messages, supabase])

  // Auto-scroll to bottom on new messages (not on initial load)
  useEffect(() => {
    if (!autoScroll) return

    // Only scroll if messages were ADDED (not on initial load from 0 to N)
    const isNewMessage = messages.length > prevMessageCountRef.current && prevMessageCountRef.current > 0
    prevMessageCountRef.current = messages.length

    if (isNewMessage && containerRef.current) {
      // Scroll the container to bottom (not the entire page)
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
  }, [messages, autoScroll])

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = new Date(message.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(message)
    return groups
  }, {} as Record<string, Message[]>)

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-lime-text" />
          <p className="text-sm text-text-secondary">Loading messages...</p>
        </div>
      </div>
    )
  }

  if (messages.length === 0 && !order) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center">
          <div className="mb-3 text-4xl">💬</div>
          <h3 className="mb-2 text-lg font-semibold text-white">No messages yet</h3>
          <p className="text-sm text-text-secondary">
            Start the conversation by sending a message below
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-4 py-6 space-y-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20"
    >
      {/* V21/P5.c — Welcome banner shown only on empty state (no user
          messages yet). Once a real message lands, the banner is gone
          for good. Order context (id / item) lives in the chat header
          above + the right rail; no need to repeat the heavy order card
          inside the message stream. */}
      {order && messages.filter(m => m.sender_id !== '00000000-0000-0000-0000-000000000000').length === 0 && (
        <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
          <span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-lime/[0.12] text-lime-text">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z"/>
            </svg>
          </span>
          <p className="max-w-md text-[14.5px] font-bold leading-snug text-text-primary">
            Thanks for choosing DropMarket
            {order.listing?.title ? <> for <span className="text-lime-text">{order.listing.title}</span></> : ''}.
          </p>
          <p className="mt-1.5 max-w-md text-[12.5px] leading-relaxed text-text-secondary">
            Chat below with your {otherUser?.username ? <span className="font-semibold text-text-primary">{otherUser.username}</span> : 'partner'} to begin the trade.
          </p>
        </div>
      )}

      {/* Messages grouped by date */}
      {Object.entries(groupedMessages).map(([date, dateMessages]) => (
        <div key={date}>
          {/* Date Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-bg-raised px-3 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                {date}
              </span>
            </div>
          </div>

          {/* Messages for this date */}
          <AnimatePresence mode="popLayout">
            {dateMessages.map((message, index) => {
              // Check if this is a system message
              const isSystemMessage = message.sender_id === '00000000-0000-0000-0000-000000000000'

              if (isSystemMessage) {
                // Parse system message content
                try {
                  const systemData = JSON.parse(message.content)
                  if (systemData.type === 'dispute_opened') {
                    return (
                      <DisputeSystemCard
                        key={message.id}
                        category={systemData.category}
                        reason={systemData.reason}
                      />
                    )
                  }
                  if (systemData.type === 'dispute_resolved') {
                    return (
                      <DisputeResolvedCard
                        key={message.id}
                        resolution={systemData.resolution}
                        notes={systemData.notes}
                        refundAmount={systemData.refundAmount}
                      />
                    )
                  }
                } catch (e) {
                  // If parsing fails, skip this message
                  return null
                }
              }

              const isOwn = message.sender_id === currentUserId
              const isAdminMessage = adminUsers[message.sender_id] !== undefined

              // V21/P5.e — Resolve sender info for BOTH sides. The "own"
              // user isn't in otherUser; we fall through to:
              //  (1) match against order.buyer/seller if we have them
              //  (2) fall back to the currentUserAvatar prop
              // so right-side bubbles render the seller's/buyer's own
              // avatar on first-of-sequence — same pattern every modern
              // chat uses.
              let senderInfo:
                | { id?: string; username?: string; avatar_url?: string }
                | undefined = otherUser
              let isBuyerMessage = false
              let isSellerMessage = false

              if (order?.buyer && order?.seller) {
                if (message.sender_id === order.buyer.id) {
                  senderInfo = order.buyer
                  isBuyerMessage = true
                } else if (message.sender_id === order.seller.id) {
                  senderInfo = order.seller
                  isSellerMessage = true
                }
              }

              // If this is our OWN message and we still couldn't resolve
              // a senderInfo (no order context), synthesize one from the
              // currentUserAvatar prop.
              if (isOwn && (!senderInfo || senderInfo.id !== currentUserId)) {
                senderInfo = {
                  id: currentUserId,
                  avatar_url: currentUserAvatar,
                }
              }

              // V21/P5.e — Show avatar on the FIRST message of any
              // sender's sequence — own side included. Standard chat
              // pattern (iMessage, WhatsApp, Discord).
              const showAvatar =
                !isAdminMessage &&
                (index === 0 || dateMessages[index - 1]?.sender_id !== message.sender_id)

              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isOwn={isOwn}
                  showAvatar={showAvatar}
                  senderAvatar={senderInfo?.avatar_url}
                  senderName={senderInfo?.username}
                  isAdminMessage={isAdminMessage}
                  adminInfo={isAdminMessage ? adminUsers[message.sender_id] : undefined}
                  isBuyerMessage={isBuyerMessage}
                  isSellerMessage={isSellerMessage}
                  isAdminView={isAdminView}
                />
              )
            })}
          </AnimatePresence>
        </div>
      ))}

      {/* Scroll anchor */}
      <div ref={messagesEndRef} />
    </div>
  )
}

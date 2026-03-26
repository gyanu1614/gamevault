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

  // Check if this is admin view (both buyer and seller are present)
  const isAdminView = !!(order?.buyer && order?.seller)

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
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          <p className="text-sm text-gray-400">Loading messages...</p>
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
          <p className="text-sm text-gray-400">
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
      {/* Order Card (if this is an order conversation) */}
      {order && (
        <OrderMessageCard order={order} onViewOrder={onViewOrder} disputeResolution={disputeResolution} />
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
              <span className="bg-black px-3 text-xs font-medium text-gray-500">
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

              // Determine sender info and party flags
              let senderInfo = otherUser
              let isBuyerMessage = false
              let isSellerMessage = false

              if (order?.buyer && order?.seller) {
                // Admin view or multi-party view - determine sender by ID
                if (message.sender_id === order.buyer.id) {
                  senderInfo = order.buyer
                  isBuyerMessage = true
                } else if (message.sender_id === order.seller.id) {
                  senderInfo = order.seller
                  isSellerMessage = true
                }
              }

              const showAvatar = !isOwn && !isAdminMessage && (
                index === 0 ||
                dateMessages[index - 1]?.sender_id !== message.sender_id
              )

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

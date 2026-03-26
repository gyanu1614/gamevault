'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useSellerMessages, useConversationMessages } from '@/hooks/use-seller-messages'
import { useQueryClient } from '@tanstack/react-query'
import {
  Send,
  Search,
  Loader2,
  MessageSquare,
  User,
  Paperclip,
  Check,
  CheckCheck,
  BadgeCheck,
  Package,
  ExternalLink,
  ShoppingBag,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { getAvatarUrl } from '@/lib/utils/avatar'
import Link from 'next/link'
import MessageList from '@/components/chat/MessageList'

export default function MessagesPage() {
  const { user, loading: authLoading } = useAuth()
  const {
    conversations,
    isLoadingConversations,
    sendMessage,
    isSending,
    markAsRead,
  } = useSellerMessages()

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [messageText, setMessageText] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isOrderInfoCollapsed, setIsOrderInfoCollapsed] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const prevMessagesLengthRef = useRef<number>(0)

  const { messages, isLoading: isLoadingMessages } = useConversationMessages(selectedConversationId)

  // Reset order info collapse state when switching conversations
  useEffect(() => {
    setIsOrderInfoCollapsed(true)
  }, [selectedConversationId])
  const queryClient = useQueryClient()

  const selectedConversation = conversations.find(c => c.id === selectedConversationId)

  // Auto-select first conversation
  useEffect(() => {
    if (conversations.length > 0 && !selectedConversationId) {
      setSelectedConversationId(conversations[0].id)
    }
  }, [conversations, selectedConversationId])

  // Scroll to bottom only when NEW messages are added (not on navigation/refresh)
  useEffect(() => {
    if (messages.length > 0 && messages.length > prevMessagesLengthRef.current) {
      // Only scroll if new messages were added
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
      }
    }
    prevMessagesLengthRef.current = messages.length
  }, [messages])

  // Mark conversation as read when selected
  useEffect(() => {
    if (selectedConversationId && selectedConversation?.unread_count && selectedConversation.unread_count > 0) {
      markAsRead(selectedConversationId)
    }
  }, [selectedConversationId, selectedConversation, markAsRead])

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedConversationId) return

    try {
      await sendMessage({
        conversationId: selectedConversationId,
        content: messageText.trim(),
      })
      setMessageText('')
    } catch (error) {
      // Error handled by hook
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true
    const otherUser = conv.buyer_id === user?.id ? conv.seller : conv.buyer
    return otherUser?.username?.toLowerCase().includes(searchQuery.toLowerCase())
  })

  if (authLoading || isLoadingConversations) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-gray-400">Loading messages...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black pb-20">
      <div className="mx-auto w-full max-w-full px-4 sm:px-6 md:max-w-7xl lg:px-8">
        {/* Header */}
        <div className="mb-5">
        <h1 className="text-2xl sm:text-3xl font-semibold text-white">Messages</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Communicate with buyers and sellers
        </p>
      </div>

      {/* Messages Container */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 h-[calc(100vh-152px)]">
        {/* Conversations List */}
        <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-md overflow-hidden flex flex-col">
          {/* Search */}
          <div className="p-4 border-b border-white/10">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search conversations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-sm text-white placeholder:text-gray-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
          </div>

          {/* Conversations */}
          <div className="flex-1 overflow-y-auto">
                {filteredConversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center">
                    <MessageSquare className="h-12 w-12 text-gray-600 mb-3" />
                    <p className="text-gray-400 text-sm">No conversations yet</p>
                  </div>
                ) : (
                  <div className="space-y-1 p-2">
                    {filteredConversations.map((conversation) => {
                      const otherUser = conversation.buyer_id === user?.id ? conversation.seller : conversation.buyer
                      const isSeller = conversation.buyer_id === user?.id
                      const isActive = conversation.id === selectedConversationId

                      return (
                        <button
                          key={conversation.id}
                          onClick={() => setSelectedConversationId(conversation.id)}
                          className={cn(
                            'w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all',
                            isActive
                              ? 'bg-white/10 border border-white/20'
                              : 'hover:bg-white/5 border border-transparent'
                          )}
                        >
                          {/* Avatar */}
                          <div className="relative flex-shrink-0">
                            <img
                              src={getAvatarUrl(otherUser?.avatar_url, otherUser?.username || 'user')}
                              alt={otherUser?.username || 'User'}
                              className="h-10 w-10 rounded-full object-cover ring-2 ring-white/10"
                            />
                            {(conversation.unread_count || 0) > 0 && (
                              <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-white">
                                {conversation.unread_count}
                              </div>
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                <span className={cn(
                                  'text-sm font-medium truncate',
                                  isActive ? 'text-white' : 'text-gray-300'
                                )}>
                                  {isSeller
                                    ? (conversation.order?.listing?.title || otherUser?.username || 'Unknown')
                                    : (otherUser?.username || 'Unknown Seller')
                                  }
                                </span>
                                {isSeller && (
                                  <BadgeCheck className="h-4 w-4 text-violet-400 flex-shrink-0" />
                                )}
                              </div>
                              <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                                {new Date(conversation.last_message_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </span>
                            </div>

                            {/* Show game → category for buyers, or last message for sellers */}
                            {!isSeller && (conversation.order?.listing as any)?.game?.name ? (
                              <p className="text-xs text-gray-500 truncate">
                                {(conversation.order?.listing as any).game.name}
                                {(conversation.order?.listing as any).category?.name && ` → ${(conversation.order?.listing as any).category.name}`}
                              </p>
                            ) : conversation.last_message ? (
                              <p className={cn(
                                'text-xs truncate',
                                conversation.unread_count && conversation.unread_count > 0 ? 'text-white font-medium' : 'text-gray-500'
                              )}>
                                {conversation.last_message.sender_id === user?.id && 'You: '}
                                {conversation.last_message.content}
                              </p>
                            ) : null}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-md overflow-hidden flex flex-col">
              {selectedConversation ? (
                <>
                  {/* Chat Header */}
                  <div className="p-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <img
                        src={getAvatarUrl(
                          selectedConversation.buyer_id === user?.id ? selectedConversation.seller?.avatar_url : selectedConversation.buyer?.avatar_url,
                          (selectedConversation.buyer_id === user?.id ? selectedConversation.seller?.username : selectedConversation.buyer?.username) || 'user'
                        )}
                        alt={(selectedConversation.buyer_id === user?.id ? selectedConversation.seller?.username : selectedConversation.buyer?.username) || 'user'}
                        className="h-10 w-10 rounded-full object-cover ring-2 ring-white/10"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-semibold text-white">
                            {selectedConversation.buyer_id === user?.id ? selectedConversation.seller?.username : selectedConversation.buyer?.username}
                          </h3>
                          {selectedConversation.buyer_id === user?.id && (
                            <BadgeCheck className="h-4 w-4 text-violet-400" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          {selectedConversation.buyer_id === user?.id ? 'Seller' : 'Buyer'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Order Banner */}
                  {selectedConversation.order && (
                    <div className="mx-4 mt-4 rounded-lg border border-white/10 bg-gradient-to-br from-primary/10 to-primary/5 overflow-hidden">
                      {/* Collapsible Header */}
                      <button
                        onClick={() => setIsOrderInfoCollapsed(!isOrderInfoCollapsed)}
                        className="w-full flex items-center justify-between p-3 hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <ShoppingBag className="h-4 w-4 text-primary flex-shrink-0" />
                          <span className="text-xs font-medium text-primary">
                            Order #{selectedConversation.order.order_number || selectedConversation.order.id.slice(0, 8)}
                          </span>
                        </div>
                        {isOrderInfoCollapsed ? (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronUp className="h-4 w-4 text-gray-400" />
                        )}
                      </button>

                      {/* Collapsible Content */}
                      {!isOrderInfoCollapsed && (
                        <div className="px-4 pb-4">
                          <div className="flex items-start gap-3">
                            {/* Order Image */}
                            {selectedConversation.order.listing?.images?.[0] && (
                              <img
                                src={selectedConversation.order.listing.images[0]}
                                alt={selectedConversation.order.listing.title}
                                className="h-16 w-16 rounded-lg object-cover border border-white/10"
                              />
                            )}

                            {/* Order Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-sm font-semibold text-white mb-1 truncate">
                                    {selectedConversation.order.listing?.title || 'Order Item'}
                                  </h4>
                              <div className="flex items-center gap-3 text-xs text-gray-400">
                                <span className="font-semibold text-white">
                                  ${selectedConversation.order.total_amount.toFixed(2)}
                                </span>
                                <span className="text-xs">•</span>
                                <span className={cn(
                                  "px-2 py-0.5 rounded-full text-xs font-medium",
                                  selectedConversation.order.status === 'completed' && "bg-green-500/20 text-green-400",
                                  selectedConversation.order.status === 'paid' && "bg-blue-500/20 text-blue-400",
                                  selectedConversation.order.status === 'processing' && "bg-yellow-500/20 text-yellow-400",
                                  selectedConversation.order.status === 'disputed' && "bg-red-500/20 text-red-400"
                                )}>
                                  {selectedConversation.order.status.charAt(0).toUpperCase() + selectedConversation.order.status.slice(1)}
                                </span>
                                  </div>
                                </div>

                                {/* View Order Button */}
                                <Link
                                  href={
                                    selectedConversation.buyer_id === user?.id
                                      ? `/account/orders/${selectedConversation.order.id}`
                                      : `/account/orders/${selectedConversation.order.id}`
                                  }
                                  className="flex-shrink-0"
                                >
                                  <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition-all hover:bg-white/90 active:scale-95">
                                    <Package className="h-4 w-4" />
                                    Open Order
                                    <ExternalLink className="h-4 w-4" />
                                  </button>
                                </Link>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto">
                    <MessageList
                      messages={messages}
                      currentUserId={user?.id || ''}
                      otherUser={selectedConversation.buyer_id === user?.id ? selectedConversation.seller : selectedConversation.buyer}
                      order={selectedConversation.order as any}
                      isLoading={isLoadingMessages}
                      autoScroll={false}
                    />
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input */}
                  <div className="p-4 border-t border-white/10">
                    <div className="flex items-end gap-2">
                      <div className="flex-1 relative">
                        <textarea
                          value={messageText}
                          onChange={(e) => setMessageText(e.target.value)}
                          onKeyPress={handleKeyPress}
                          placeholder="Type a message..."
                          rows={1}
                          className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 px-4 pr-10 text-sm text-white placeholder:text-gray-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                          style={{ minHeight: '42px', maxHeight: '120px' }}
                        />
                      </div>
                      <button
                        onClick={handleSendMessage}
                        disabled={!messageText.trim() || isSending}
                        className="flex items-center justify-center h-[42px] w-[42px] rounded-xl bg-white text-black transition-all hover:bg-white/90 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                      >
                        {isSending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <MessageSquare className="h-16 w-16 text-gray-600 mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">Select a conversation</h3>
                  <p className="text-gray-400 text-sm">Choose a conversation from the list to start messaging</p>
                </div>
              )}
        </div>
      </div>
    </div>
    </div>
  )
}

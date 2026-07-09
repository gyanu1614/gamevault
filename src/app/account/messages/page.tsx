'use client'

/**
 * /account/messages — conversations + chat thread.
 *
 * V6 reskin: GV tokens, primitives where they fit, cleaner mobile
 * collapse, lime accents, MessageList reused as-is. Behavior preserved
 * end to end (auto-select first convo, auto-mark-as-read, scroll on new
 * messages).
 */

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Send, Search, Loader2, MessageSquare, BadgeCheck, Package,
  ExternalLink, ShoppingBag, ChevronDown, ChevronUp,
} from 'lucide-react'

import { useAuth } from '@/hooks/use-auth'
import AccountPageHeader from '@/components/account/AccountPageHeader'
import { useSellerMessages, useConversationMessages } from '@/hooks/use-seller-messages'
import { getAvatarUrl } from '@/lib/utils/avatar'
import { classifyOfferType } from '@/lib/utils/offer-type'
import MessageList from '@/components/chat/MessageList'
import { cn } from '@/lib/utils'

type ChatTab = 'all' | 'unread' | 'currency' | 'items' | 'accounts' | 'top-up' | 'dm'

const CHAT_TABS: { value: ChatTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'currency', label: 'Currencies' },
  { value: 'items', label: 'Items' },
  { value: 'accounts', label: 'Accounts' },
  { value: 'top-up', label: 'Top Ups' },
  { value: 'dm', label: 'Direct Messages' },
]

/** Compact reference-style timestamps: now / 34m / 6h / 3d / 2w / 4mo. */
function fmtShortRel(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const h = Math.round(mins / 60)
  if (h < 24) return `${h}h`
  const d = Math.round(h / 24)
  if (d < 7) return `${d}d`
  const w = Math.round(d / 7)
  if (w < 5) return `${w}w`
  return `${Math.round(d / 30)}mo`
}

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
  const [tab, setTab] = useState<ChatTab>('all')
  const [isOrderInfoCollapsed, setIsOrderInfoCollapsed] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const prevMessagesLengthRef = useRef<number>(0)

  const { messages, isLoading: isLoadingMessages } =
    useConversationMessages(selectedConversationId)

  useEffect(() => setIsOrderInfoCollapsed(true), [selectedConversationId])

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId)

  useEffect(() => {
    if (conversations.length > 0 && !selectedConversationId) {
      setSelectedConversationId(conversations[0].id)
    }
  }, [conversations, selectedConversationId])

  useEffect(() => {
    if (messages.length > 0 && messages.length > prevMessagesLengthRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
    prevMessagesLengthRef.current = messages.length
  }, [messages])

  useEffect(() => {
    if (selectedConversationId && (selectedConversation?.unread_count ?? 0) > 0) {
      markAsRead(selectedConversationId)
    }
  }, [selectedConversationId, selectedConversation, markAsRead])

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedConversationId) return
    try {
      await sendMessage({ conversationId: selectedConversationId, content: messageText.trim() })
      setMessageText('')
    } catch {
      // Hook surfaces errors via toast already.
    }
  }
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const filteredConversations = conversations.filter((conv) => {
    if (tab === 'unread' && !((conv.unread_count ?? 0) > 0)) return false
    if (tab === 'dm' && conv.order) return false
    if (tab !== 'all' && tab !== 'unread' && tab !== 'dm') {
      const cat = conv.order?.listing?.category
      if (!conv.order || classifyOfferType(cat?.metadata?.type ?? undefined, cat?.slug) !== tab) return false
    }
    if (!searchQuery) return true
    const otherUser = conv.buyer_id === user?.id ? conv.seller : conv.buyer
    const hay = `${otherUser?.username ?? ''} ${conv.order?.order_number ?? ''} ${conv.order?.listing?.title ?? ''}`.toLowerCase()
    return hay.includes(searchQuery.toLowerCase())
  })

  if (authLoading || isLoadingConversations) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-lime-text" />
          <p className="text-sm text-text-tertiary">Loading messages…</p>
        </div>
      </div>
    )
  }

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 pb-16 pt-2 sm:px-6 lg:px-10 xl:px-14">
      {/* Standard account title block (V33 style — same as Offers/Orders). */}
      <AccountPageHeader
        title="Messages"
        subtitle="Talk to buyers and sellers — directly tied to your orders."
        className="mb-4"
      />

      {/* Chat tabs — segmented control (reference shape, our material). */}
      <div className="mb-4 flex w-fit max-w-full flex-wrap items-center gap-1 overflow-x-auto rounded-md border border-white/[0.08] bg-[rgba(20,20,27,0.56)] p-1 backdrop-blur-md">
        {CHAT_TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={cn(
              'h-8 whitespace-nowrap rounded-[5px] px-3 text-[13px] font-semibold transition-colors',
              tab === t.value ? 'bg-white/[0.09] text-text-primary' : 'text-text-secondary hover:text-text-primary',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid h-[calc(100vh-252px)] grid-cols-1 gap-3 lg:grid-cols-[380px_1fr]">
        {/* ── Conversations list ────────────────────────────────────── */}
        <aside className="relative flex flex-col overflow-hidden rounded-lg border border-border-default bg-[rgba(20,20,27,0.56)] backdrop-blur-md">
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-10 h-14 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.04),transparent)]" />
          <div className="border-b border-border-subtle p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
              <input
                type="text"
                placeholder="Search conversations…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 w-full rounded-md border border-border-default bg-bg-overlay pl-9 pr-3 text-sm text-text-primary placeholder:text-text-tertiary transition-colors focus:border-border-strong focus:outline-none focus-visible:shadow-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
                <MessageSquare className="h-10 w-10 text-text-tertiary" />
                <p className="text-sm text-text-secondary">No conversations yet</p>
              </div>
            ) : (
              <ul className="divide-y divide-white/[0.05]">
                {filteredConversations.map((conversation) => {
                  const otherUser = conversation.buyer_id === user?.id ? conversation.seller : conversation.buyer
                  const isActive = conversation.id === selectedConversationId
                  const order = conversation.order
                  const gameLogo = order?.listing?.game?.image_url
                  const rowTitle = order
                    ? `#${order.order_number || order.id.slice(0, 6)} · x${order.quantity ?? 1} · ${order.listing?.title ?? 'Order'}`
                    : otherUser?.username || 'Direct message'
                  return (
                    <li key={conversation.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedConversationId(conversation.id)}
                        className={cn(
                          'flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors',
                          isActive ? 'bg-white/[0.05]' : 'hover:bg-white/[0.03]',
                        )}
                      >
                        <div className="relative shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={gameLogo || getAvatarUrl(otherUser?.avatar_url, otherUser?.username || 'user')}
                            alt=""
                            className="h-11 w-11 rounded-full object-cover ring-1 ring-white/10"
                          />
                          {(conversation.unread_count || 0) > 0 && (
                            <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-text-primary">
                              {conversation.unread_count}
                            </span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-[13.5px] font-bold text-text-primary">{rowTitle}</span>
                            <span className="shrink-0 text-[11.5px] text-text-tertiary">
                              {fmtShortRel(conversation.last_message_at)}
                            </span>
                          </div>
                          {conversation.last_message && (
                            <p
                              className={cn(
                                'mt-0.5 truncate text-[12.5px]',
                                (conversation.unread_count ?? 0) > 0
                                  ? 'font-semibold text-text-primary'
                                  : 'text-text-tertiary',
                              )}
                            >
                              {conversation.last_message.sender_id === user?.id && 'You: '}
                              {conversation.last_message.content}
                            </p>
                          )}
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* ── Chat area ─────────────────────────────────────────────── */}
        <section className="relative flex flex-col overflow-hidden rounded-lg border border-border-default bg-[rgba(20,20,27,0.56)] backdrop-blur-md">
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-10 h-14 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.04),transparent)]" />
          {selectedConversation ? (
            <>
              {/* Header */}
              <div className="border-b border-border-subtle p-3 sm:p-4">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getAvatarUrl(
                      selectedConversation.buyer_id === user?.id
                        ? selectedConversation.seller?.avatar_url
                        : selectedConversation.buyer?.avatar_url,
                      (selectedConversation.buyer_id === user?.id
                        ? selectedConversation.seller?.username
                        : selectedConversation.buyer?.username) || 'user',
                    )}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover ring-2 ring-border-subtle"
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-semibold text-text-primary">
                        {selectedConversation.buyer_id === user?.id
                          ? selectedConversation.seller?.username
                          : selectedConversation.buyer?.username}
                      </h3>
                      {selectedConversation.buyer_id === user?.id && (
                        <BadgeCheck className="h-3.5 w-3.5 text-lime-text" />
                      )}
                    </div>
                    <p className="text-[11px] text-text-tertiary">
                      {selectedConversation.buyer_id === user?.id ? 'Seller' : 'Buyer'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Order banner */}
              {selectedConversation.order && (
                <div className="mx-3 mt-3 overflow-hidden rounded-lg border border-border-default bg-white/[0.03] sm:mx-4 sm:mt-4">
                  <button
                    type="button"
                    onClick={() => setIsOrderInfoCollapsed(!isOrderInfoCollapsed)}
                    className="flex w-full items-center justify-between p-3 transition-colors hover:bg-white/[0.05]"
                  >
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                      <span className="text-[12.5px] font-semibold text-text-primary">
                        Order #
                        {selectedConversation.order.order_number ||
                          selectedConversation.order.id.slice(0, 8)}
                      </span>
                    </div>
                    {isOrderInfoCollapsed ? (
                      <ChevronDown className="h-4 w-4 text-text-tertiary" />
                    ) : (
                      <ChevronUp className="h-4 w-4 text-text-tertiary" />
                    )}
                  </button>

                  {!isOrderInfoCollapsed && (
                    <div className="px-3 pb-3 sm:px-4 sm:pb-4">
                      <div className="flex items-start gap-3">
                        {selectedConversation.order.listing?.images?.[0] && (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={selectedConversation.order.listing.images[0]}
                            alt={selectedConversation.order.listing.title}
                            className="h-14 w-14 rounded-lg border border-border-subtle object-cover"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <h4 className="mb-1 truncate text-sm font-semibold text-text-primary">
                                {selectedConversation.order.listing?.title || 'Order item'}
                              </h4>
                              <div className="flex items-center gap-2 text-xs text-text-tertiary">
                                <span className="font-mono font-semibold text-text-primary">
                                  ${selectedConversation.order.total_amount.toFixed(2)}
                                </span>
                                <span>·</span>
                                <span
                                  className={cn(
                                    'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                                    selectedConversation.order.status === 'completed' && 'bg-success-bg text-success border border-success/30',
                                    selectedConversation.order.status === 'paid' && 'bg-info-bg text-info border border-info/30',
                                    selectedConversation.order.status === 'processing' && 'bg-warning-bg text-warning border border-warning/30',
                                    selectedConversation.order.status === 'disputed' && 'bg-error-bg text-error border border-error/30',
                                  )}
                                >
                                  {selectedConversation.order.status.charAt(0).toUpperCase() +
                                    selectedConversation.order.status.slice(1)}
                                </span>
                              </div>
                            </div>
                            <Link
                              href={`/account/orders/${selectedConversation.order.id}`}
                              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-lime px-3 text-xs font-semibold text-text-inverse transition-colors hover:bg-lime-hover"
                            >
                              <Package className="h-3.5 w-3.5" />
                              Open order
                              <ExternalLink className="h-3 w-3" />
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
                  otherUser={
                    selectedConversation.buyer_id === user?.id
                      ? selectedConversation.seller
                      : selectedConversation.buyer
                  }
                  order={selectedConversation.order as any}
                  isLoading={isLoadingMessages}
                  autoScroll={false}
                />
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-border-subtle p-3 sm:p-4">
                <div className="flex items-end gap-2">
                  <textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type a message…"
                    rows={1}
                    className="min-h-[42px] max-h-32 flex-1 resize-none rounded-md border border-border-default bg-bg-overlay px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary transition-colors focus:border-border-strong focus:outline-none focus-visible:shadow-none"
                  />
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={!messageText.trim() || isSending}
                    className={cn(
                      'flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-md transition-colors',
                      messageText.trim() && !isSending
                        ? 'bg-lime text-text-inverse hover:bg-lime-hover'
                        : 'cursor-not-allowed bg-bg-raised text-text-disabled',
                    )}
                    aria-label="Send message"
                  >
                    {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border-default bg-bg-overlay">
                <MessageSquare className="h-5 w-5 text-text-tertiary" />
              </div>
              <h3 className="text-base font-semibold text-text-primary">Select a conversation</h3>
              <p className="text-sm text-text-secondary">
                Choose one from the list to start messaging.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

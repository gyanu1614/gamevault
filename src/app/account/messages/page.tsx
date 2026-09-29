'use client'

/**
 * /account/messages — conversations + chat thread.
 *
 * V6 reskin: GV tokens, primitives where they fit, cleaner mobile
 * collapse, lime accents, MessageList reused as-is. Behavior preserved
 * end to end (auto-select first convo, auto-mark-as-read, scroll on new
 * messages).
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Search, MessageSquare, BadgeCheck, Package,
  ExternalLink, ShoppingBag, ChevronDown, ChevronUp, ChevronLeft,
} from 'lucide-react'

import { useAuth } from '@/hooks/use-auth'
import { useSellerMessages, useConversationMessages } from '@/hooks/use-seller-messages'
import { getAvatarUrl } from '@/lib/utils/avatar'
import { classifyOfferType } from '@/lib/utils/offer-type'
import MessageList from '@/components/chat/MessageList'
import MessageInput from '@/components/chat/MessageInput'
import { createClient } from '@/lib/supabase/client'
import { attachmentOnlyLabel, uploadChatAttachment } from '@/lib/chat/attachments'
import { MessagesSkeleton } from './_MessagesSkeleton'
import { cn } from '@/lib/utils'
import { normalizeOrderNumber } from '@/lib/orders/order-number'
import { inboxOrderLabel } from '@/lib/chat/inbox-row'
import { isSystemMessage, systemNoticePreview } from '@/lib/chat/system-notice'
import { useCurrencyMeta } from '@/hooks/use-currency-meta'

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

  // Currency name + icon for every game with a currency order in the list
  // (phone rows: "Order For Robux" beside the Robux icon).
  const currencyMeta = useCurrencyMeta(
    (conversations ?? [])
      .filter((c) => c.order?.listing?.category?.type === 'currency')
      .map((c) => c.order?.listing?.game?.id ?? ''),
  )

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [tab, setTab] = useState<ChatTab>('all')
  const [isOrderInfoCollapsed, setIsOrderInfoCollapsed] = useState(true)

  const { messages, isLoading: isLoadingMessages } =
    useConversationMessages(selectedConversationId)

  useEffect(() => setIsOrderInfoCollapsed(true), [selectedConversationId])

  // Route-scoped scroll lock: this page IS the viewport. Without it the
  // global min-h-screen shell leaves an iOS dvh/vh mismatch strip under the
  // panes and the document scrolls by exactly that amount.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId)

  useEffect(() => {
    // Desktop auto-opens the first conversation. Mobile stays on the LIST —
    // auto-opening would slide the chat pane over it before the user chose.
    if (typeof window !== 'undefined' && !window.matchMedia('(min-width: 1024px)').matches) return
    if (conversations.length > 0 && !selectedConversationId) {
      setSelectedConversationId(conversations[0].id)
    }
  }, [conversations, selectedConversationId])

  // Scrolling lives in MessageList (use-stick-to-bottom): opens at the
  // newest message and follows new ones while the reader is at the bottom.

  useEffect(() => {
    if (selectedConversationId && (selectedConversation?.unread_count ?? 0) > 0) {
      markAsRead(selectedConversationId)
    }
  }, [selectedConversationId, selectedConversation, markAsRead])

  // Files ride only in an order chat, and only for its buyer and seller:
  // the storage policy on the order's folder accepts those two.
  const canAttach =
    !!selectedConversation?.order?.id &&
    (selectedConversation.buyer_id === user?.id || selectedConversation.seller_id === user?.id)

  const handleSend = async (text: string, file?: File | null) => {
    if (!selectedConversationId) return
    let attachments: string[] | undefined
    if (file) {
      try {
        if (!canAttach || !selectedConversation?.order?.id) {
          throw new Error('Files can only be sent in an order chat.')
        }
        attachments = [await uploadChatAttachment(createClient().storage as any, selectedConversation.order.id, file)]
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not upload the file. Please try again.')
        throw e
      }
    }
    await sendMessage({
      conversationId: selectedConversationId,
      content: text || (file ? attachmentOnlyLabel(file.type) : text),
      attachments,
    })
  }

  const filteredConversations = conversations.filter((conv) => {
    if (tab === 'unread' && !((conv.unread_count ?? 0) > 0)) return false
    if (tab === 'dm' && conv.order) return false
    if (tab !== 'all' && tab !== 'unread' && tab !== 'dm') {
      const cat = conv.order?.listing?.category
      if (!conv.order || classifyOfferType(cat?.type ?? undefined, cat?.slug) !== tab) return false
    }
    if (!searchQuery) return true
    const otherUser = conv.buyer_id === user?.id ? conv.seller : conv.buyer
    const hay = `${otherUser?.username ?? ''} ${conv.order?.listing?.title ?? ''}`.toLowerCase()
    if (hay.includes(searchQuery.toLowerCase())) return true
    // Order numbers match dash/space/case-insensitively (GV- and DM- alike).
    const orderKey = normalizeOrderNumber(searchQuery)
    return orderKey.length > 0 && normalizeOrderNumber(conv.order?.order_number).includes(orderKey)
  })

  // One loading state: the same skeleton the route fallback shows. Only a
  // user-less auth check blocks (a cached signed-in user renders at once).
  if ((authLoading && !user) || isLoadingConversations) {
    return <MessagesSkeleton />
  }

  return (
    // FIXED shell pinned to the navbar's own bottom edge (--navbar-bottom)
    // and the true viewport bottom — no guessed heights, so there is no gap
    // under the navbar and the last row always clears iOS Safari's bar.
    <main className="fixed inset-x-0 bottom-0 top-[var(--navbar-bottom)] z-[1] flex flex-col overflow-hidden px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-7 sm:px-6 lg:left-72 lg:px-10 lg:pb-4 xl:px-14">
      <div className="mx-auto flex h-full w-full max-w-[1400px] min-h-0 flex-col">
      {/* Compact chat chrome (reference: GameBoost). The PAGE never scrolls —
          only the conversation list and the message thread do. */}
      <h1 className="shrink-0 px-1 text-[22px] font-bold text-text-primary">Chat</h1>

      {/* Tabs — one horizontally scrollable row on phones, never wrapping. */}
      <div className="mt-3.5 flex w-fit max-w-full shrink-0 flex-nowrap items-center gap-1 overflow-x-auto rounded-md border border-white/[0.08] bg-[#1D1E23] p-1 backdrop-blur-md [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

      <div className="mt-3 grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[320px_1fr] xl:grid-cols-[380px_1fr]">
        {/* ── Conversations list — on phones this IS the page until a chat
            is opened (the chat pane replaces it, with a back button). ── */}
        <aside
          className={cn(
            'relative flex-col overflow-hidden rounded-lg border border-border-subtle bg-[#1D1E23] backdrop-blur-md',
            selectedConversationId ? 'hidden lg:flex' : 'flex',
          )}
        >
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-10 h-14 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.04),transparent)]" />
          <div className="border-b border-border-subtle p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
              <input
                type="text"
                placeholder="Search conversations…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 w-full rounded-md border border-border-default bg-bg-overlay pl-9 pr-3 text-[16px] text-text-primary placeholder:text-text-tertiary transition-colors focus:border-border-strong focus:outline-none focus-visible:shadow-none sm:text-sm"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain">
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
                  // Phone row (marketplace-inbox pattern): who you're talking
                  // to, then what the order is for ("Order For Robux"), then
                  // the last message.
                  const phoneName = otherUser?.username || 'Direct message'
                  const listing = order?.listing
                  const currency = listing?.game?.id ? currencyMeta[listing.game.id] : undefined
                  const phoneItem = order
                    ? inboxOrderLabel({
                        categoryType: listing?.category?.type,
                        categoryName: listing?.category?.name,
                        currencyName: currency?.name,
                      })
                    : null
                  // Phone: the other person's photo (the "Order For …" line
                  // says what the order is). sm+ keeps the game logo.
                  const avatarFallback = getAvatarUrl(otherUser?.avatar_url, otherUser?.username || 'user')
                  const phoneIcon = avatarFallback
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
                          {/* Phone shows the other person's photo; sm+ keeps
                              the game logo. */}
                          <picture>
                            <source media="(max-width: 639px)" srcSet={phoneIcon} />
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={gameLogo || avatarFallback}
                              alt=""
                              className="h-11 w-11 rounded-full object-cover ring-1 ring-white/10 max-sm:h-12 max-sm:w-12 max-sm:rounded-[10px] max-sm:bg-bg-overlay"
                            />
                          </picture>
                          {(conversation.unread_count || 0) > 0 && (
                            <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-text-primary">
                              {conversation.unread_count}
                            </span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-[13.5px] font-bold text-text-primary max-sm:hidden">{rowTitle}</span>
                            <span className="truncate text-[14px] font-bold text-text-primary sm:hidden">{phoneName}</span>
                            <span className="shrink-0 text-[11.5px] text-text-tertiary">
                              {fmtShortRel(conversation.last_message_at)}
                            </span>
                          </div>
                          {phoneItem && (
                            <p className="mt-0.5 truncate text-[12px] font-medium text-text-secondary sm:hidden">
                              {phoneItem}
                            </p>
                          )}
                          {conversation.last_message && (
                            <p
                              className={cn(
                                'mt-0.5 truncate text-[12.5px]',
                                (conversation.unread_count ?? 0) > 0
                                  ? 'font-semibold text-text-primary'
                                  : 'text-text-tertiary',
                              )}
                            >
                              {conversation.last_message.sender_id === user?.id && (
                                <span className="max-sm:hidden">You: </span>
                              )}
                              {isSystemMessage(conversation.last_message.sender_id)
                                ? systemNoticePreview(conversation.last_message.content)
                                : conversation.last_message.content}
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

        {/* ── Chat area — replaces the list on phones; slides in per
            conversation (native-chat feel, framer-motion). ── */}
        <section
          className={cn(
            'relative flex-col overflow-hidden rounded-lg border border-border-subtle bg-[#1D1E23] backdrop-blur-md',
            selectedConversationId ? 'flex' : 'hidden lg:flex',
          )}
        >
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-10 h-14 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.04),transparent)]" />
          {selectedConversation ? (
            <motion.div
              key={selectedConversation.id}
              initial={{ x: 16, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="flex min-h-0 flex-1 flex-col"
            >
              {/* Header */}
              <div className="border-b border-border-subtle p-3 sm:p-4">
                <div className="flex items-center gap-3">
                  {/* Phones: back to the conversation list. */}
                  <button
                    type="button"
                    onClick={() => setSelectedConversationId(null)}
                    aria-label="Back To Conversations"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border-default bg-white/[0.04] text-text-secondary transition-colors hover:text-text-primary lg:hidden"
                  >
                    <ChevronLeft className="h-[18px] w-[18px]" />
                  </button>
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

                  <AnimatePresence initial={false}>
                  {!isOrderInfoCollapsed && (
                    <motion.div
                      key="order-info"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className="overflow-hidden"
                    >
                    <div className="border-t border-border-subtle px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
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
                          <div className="flex items-start justify-between gap-2 max-sm:flex-col max-sm:items-stretch max-sm:gap-3">
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
                                    selectedConversation.order.status === 'completed' && 'bg-success-bg text-success border border-[color-mix(in_srgb,var(--color-success)_30%,transparent)]',
                                    selectedConversation.order.status === 'paid' && 'bg-info-bg text-info border border-[color-mix(in_srgb,var(--color-info)_30%,transparent)]',
                                    selectedConversation.order.status === 'processing' && 'bg-warning-bg text-warning border border-[color-mix(in_srgb,var(--color-warning)_30%,transparent)]',
                                    selectedConversation.order.status === 'disputed' && 'bg-error-bg text-error border border-[color-mix(in_srgb,var(--color-error)_30%,transparent)]',
                                  )}
                                >
                                  {selectedConversation.order.status.charAt(0).toUpperCase() +
                                    selectedConversation.order.status.slice(1)}
                                </span>
                              </div>
                            </div>
                            <Link
                              href={`/account/orders/${selectedConversation.order.id}`}
                              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-lime px-3 text-xs font-semibold text-text-inverse transition-colors hover:bg-lime-hover max-sm:h-10 max-sm:justify-center"
                            >
                              <Package className="h-3.5 w-3.5" />
                              Open Order
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                    </motion.div>
                  )}
                  </AnimatePresence>
                </div>
              )}

              {/* Messages — MessageList owns the scroll (flex column, so its
                  own container gets the height). */}
              <div className="flex min-h-0 flex-1 flex-col">
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
                />
              </div>

              {/* Input — the same composer as the order page (attach button
                  in order chats). */}
              <MessageInput
                onSend={handleSend}
                placeholder="Type a message…"
                disabled={isSending}
                allowAttachments={canAttach}
              />
            </motion.div>
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
      </div>
    </main>
  )
}

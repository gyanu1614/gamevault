'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { toast } from 'sonner'
import { ArrowDownIcon } from '@phosphor-icons/react/dist/csr/ArrowDown'
import { Loader2 } from 'lucide-react'
import MessageBubble from './MessageBubble'
import SystemNoticeRow from './SystemNoticeRow'
import { MessageActionSheet } from './actions/MessageActionSheet'
import type { MessageActionHandlers } from './actions/MessageHoverActions'
import { createClient } from '@/lib/supabase/client'
import { getAvatarUrl } from '@/lib/utils/avatar'
import { isSystemMessage } from '@/lib/chat/system-notice'
import { useStickToBottom } from 'use-stick-to-bottom'
import { lastOwnMessageId, statusLabel, type LocalFile, type LocalStatus } from '@/lib/chat/message-state'
import { summarizeReactions, type ReactionRow } from '@/lib/chat/reactions'
import { replySnippet, senderLabel } from '@/lib/chat/reply'
import { dayKey, dayLabel } from '@/lib/chat/day-label'

interface Message {
  id: string
  content: string
  /** NULL = a DropMarket system notice (see lib/chat/system-notice). */
  sender_id: string | null
  is_read: boolean
  read_at?: string | null
  created_at: string
  attachments?: string[] | null
  /** The message this one replies to. */
  reply_to_id?: string | null
  /** Optimistic send state (order chat); unset once the server has it. */
  local_status?: LocalStatus
  local_files?: LocalFile[]
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
  /** Re-send an own message that failed. */
  onRetry?: (id: string) => void
  /** Whether the newest message is in view (drives mark-as-read). */
  onAtBottomChange?: (atBottom: boolean) => void
  /** Every reaction in the thread (useChatThread). */
  reactions?: ReactionRow[]
  /** React / Reply are offered only when these are set (a party to an open
   *  chat, or an admin). Copy Text is always there. */
  onReact?: (messageId: string, emoji: string) => void
  onReply?: (messageId: string) => void
}

function copyText(text: string) {
  if (!navigator.clipboard) {
    toast.error('Copy is not available in this browser.')
    return
  }
  navigator.clipboard.writeText(text).then(
    () => toast.success('Copied'),
    () => toast.error('Could not copy the message.'),
  )
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
  onRetry,
  onAtBottomChange,
  reactions = [],
  onReact,
  onReply,
}: MessageListProps) {
  // Chat scroll: opens at the newest message, follows new messages while
  // the reader is at the bottom, and leaves them alone once they scroll up
  // to read history (use-stick-to-bottom, spring-animated, resize-aware).
  const { scrollRef, contentRef, scrollToBottom, isAtBottom, stopScroll } = useStickToBottom({
    initial: 'instant',
    resize: 'smooth',
  })
  const reduceMotion = useReducedMotion()
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
  // Keyed on the SET of senders, not on `messages`: an optimistic send, its
  // ack and every read receipt change the array, and each change used to
  // re-run these two queries.
  const senderKey = Array.from(new Set(messages.map((m) => m.sender_id).filter((id): id is string => !!id)))
    .sort()
    .join(',')
  useEffect(() => {
    const fetchAdminUsers = async () => {
      const senderIds = senderKey.split(',')

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

    if (senderKey) {
      fetchAdminUsers()
    }
  }, [senderKey, supabase])

  // Sending your own message always brings you back down to it, even if
  // you had scrolled up. Other people's messages only follow when you're
  // already at the bottom (the hook handles that on its own).
  const lastMessage = messages[messages.length - 1]
  const lastId = lastMessage?.id
  const lastIsOwn = lastMessage?.sender_id === currentUserId
  const prevLastIdRef = useRef(lastId)
  // Messages from the other side that landed while the reader was scrolled
  // up: counted for the "New messages" pill instead of yanking the view.
  const [unseen, setUnseen] = useState(0)
  useEffect(() => {
    if (lastId && lastId !== prevLastIdRef.current && prevLastIdRef.current !== undefined) {
      if (lastIsOwn) {
        if (autoScroll) void scrollToBottom('smooth')
      } else if (!isAtBottom) {
        setUnseen((n) => n + 1)
      }
    }
    prevLastIdRef.current = lastId
  }, [lastId, lastIsOwn, autoScroll, scrollToBottom, isAtBottom])

  useEffect(() => {
    if (isAtBottom) setUnseen(0)
    onAtBottomChange?.(isAtBottom)
  }, [isAtBottom, onAtBottomChange])

  // Status words sit under the newest own message only ("Sent",
  // "Read 2m ago"); older own messages keep just the tick. "Read Xm ago"
  // is relative, so it re-renders once a minute while it is showing.
  const lastOwnId = lastOwnMessageId(messages, currentUserId)
  const lastOwn = lastOwnId ? messages.find((m) => m.id === lastOwnId) : undefined
  const [now, setNow] = useState(() => new Date())
  const lastOwnReadAt = lastOwn?.read_at ?? null
  useEffect(() => {
    if (!lastOwnReadAt) return
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [lastOwnReadAt])
  const lastOwnStatus = lastOwn ? statusLabel(lastOwn, now) : null

  // Replies + reactions: lookups for the quote above a reply, the chips
  // under a bubble, and the names a quote shows.
  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages])
  const names = useMemo(() => {
    const out: Record<string, string> = {}
    for (const [id, a] of Object.entries(adminUsers)) out[id] = a.username
    if (otherUser) out[otherUser.id] = otherUser.username
    if (order?.buyer) out[order.buyer.id] = order.buyer.username
    if (order?.seller) out[order.seller.id] = order.seller.username
    return out
  }, [adminUsers, otherUser, order?.buyer, order?.seller])
  const reactionsFor = useCallback(
    (messageId: string) => summarizeReactions(reactions, messageId, currentUserId),
    [reactions, currentUserId],
  )
  const myReaction = (messageId: string) =>
    reactions.find((r) => r.message_id === messageId && r.user_id === currentUserId)?.emoji ?? null

  // Tapping a quote: centre the original in the thread and flash it. The
  // thread's own scroller only (scrollIntoView would also move the page).
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const jumpTo = useCallback(
    (id: string) => {
      const scroller = scrollRef.current
      const el = scroller?.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(id)}"]`)
      if (!scroller || !el) return
      stopScroll()
      const offset = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top
      const top = scroller.scrollTop + offset - (scroller.clientHeight - el.offsetHeight) / 2
      scroller.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'auto' : 'smooth' })
      setHighlightId(id)
    },
    [scrollRef, stopScroll, reduceMotion],
  )
  useEffect(() => {
    if (!highlightId) return
    const t = setTimeout(() => setHighlightId(null), 1400)
    return () => clearTimeout(t)
  }, [highlightId])

  /** React / Reply / Copy for one message; null when it has no actions yet. */
  const actionsFor = (message: Message): MessageActionHandlers | null => {
    if (message.local_status !== undefined) return null // not stored yet
    const hasText = !((message.attachments?.length ?? 0) > 0 && /^Sent a (photo|PDF)$/.test(message.content))
    return {
      myReaction: myReaction(message.id),
      onReact: onReact ? (emoji) => onReact(message.id, emoji) : null,
      onReply: onReply ? () => onReply(message.id) : null,
      onCopy: hasText ? () => copyText(message.content) : null,
    }
  }

  /** The quoted line above a reply (the original is in the loaded thread). */
  const quoteFor = (message: Message) => {
    if (!message.reply_to_id) return null
    const original = byId.get(message.reply_to_id)
    if (!original) return { name: 'Message', snippet: 'Earlier message', onJump: null }
    return {
      name: senderLabel(original.sender_id, currentUserId, names),
      snippet: replySnippet(original),
      onJump: () => jumpTo(original.id),
    }
  }

  // Phone: one action sheet for the thread, opened by a long-press.
  const [sheet, setSheet] = useState<{ id: string; open: boolean } | null>(null)
  const sheetMessage = sheet ? byId.get(sheet.id) : undefined
  const sheetActions = sheetMessage?.sender_id ? actionsFor(sheetMessage) : null

  // Group messages by the viewer's local day ("Today", "Yesterday", "Oct 3").
  const groupedMessages = messages.reduce((groups, message) => {
    const key = dayKey(message.created_at)
    if (!groups[key]) groups[key] = []
    groups[key].push(message)
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
    <div className="relative flex min-h-0 flex-1 flex-col">
    <div
      ref={scrollRef}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20"
    >
    <div ref={contentRef} className="space-y-2 px-3 pb-5 pt-3 sm:px-4">
      {/* V21/P5.c — Welcome banner shown only on empty state (no user
          messages yet). Once a real message lands, the banner is gone
          for good. Order context (id / item) lives in the chat header
          above + the right rail; no need to repeat the heavy order card
          inside the message stream. */}
      {order && messages.filter(m => !isSystemMessage(m.sender_id)).length === 0 && (
        <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
          <span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-lime-tint-bg text-lime-text">
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
      {Object.entries(groupedMessages).map(([key, dateMessages]) => (
        <div key={key}>
          {/* Day pill: sticks to the top of the thread while that day's
              messages scroll under it. */}
          <div className="pointer-events-none sticky top-2 z-[2] my-3 flex justify-center">
            <span className="rounded-full bg-[#2B2C33]/90 px-3 py-1 text-[11.5px] font-semibold text-text-secondary shadow-[0_2px_8px_rgba(0,0,0,0.25)] backdrop-blur-sm">
              {dayLabel(dateMessages[0].created_at, now)}
            </span>
          </div>

          {/* Messages for this date */}
          {/* initial={false}: the thread opens settled; only messages
              that arrive later animate in. Keys are the row ids, which an
              optimistic message already has, so a send never re-mounts. */}
          <AnimatePresence initial={false}>
            {dateMessages.map((message, index) => {
              // DropMarket notices (no sender): dispute cards. Anything
              // unrecognised from the system sender is not shown.
              if (isSystemMessage(message.sender_id)) {
                return <SystemNoticeRow key={message.id} content={message.content} />
              }
              // Past the notice branch every message has a real author.
              const senderId = message.sender_id as string
              const userMessage = { ...message, sender_id: senderId }

              const isOwn = senderId === currentUserId
              const isAdminMessage = adminUsers[senderId] !== undefined

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
                if (senderId === order.buyer.id) {
                  senderInfo = order.buyer
                  isBuyerMessage = true
                } else if (senderId === order.seller.id) {
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
                (index === 0 || dateMessages[index - 1]?.sender_id !== senderId)

              return (
                <MessageBubble
                  key={message.id}
                  message={userMessage}
                  isOwn={isOwn}
                  showAvatar={showAvatar}
                  senderAvatar={
                    // Uploaded photo, else the DiceBear character seeded by
                    // username (same fallback as the order page header).
                    senderInfo?.avatar_url ||
                    (senderInfo?.username ? getAvatarUrl(null, senderInfo.username) : undefined)
                  }
                  senderName={senderInfo?.username}
                  isAdminMessage={isAdminMessage}
                  adminInfo={isAdminMessage ? adminUsers[senderId] : undefined}
                  isBuyerMessage={isBuyerMessage}
                  isSellerMessage={isSellerMessage}
                  isAdminView={isAdminView}
                  statusText={message.id === lastOwnId && message.local_status === undefined ? lastOwnStatus : null}
                  onRetry={onRetry}
                  quote={quoteFor(message)}
                  reactions={reactionsFor(message.id)}
                  actions={actionsFor(message)}
                  onLongPress={message.local_status === undefined ? () => setSheet({ id: message.id, open: true }) : null}
                  highlighted={highlightId === message.id}
                />
              )
            })}
          </AnimatePresence>
        </div>
      ))}

    </div>
    </div>

    <MessageActionSheet
      open={!!sheet?.open && !!sheetActions}
      onOpenChange={(open) => setSheet((cur) => (cur ? { ...cur, open } : cur))}
      preview={sheetMessage ? { name: senderLabel(sheetMessage.sender_id, currentUserId, names), snippet: replySnippet(sheetMessage) } : null}
      myReaction={sheetActions?.myReaction ?? null}
      onReact={sheetActions?.onReact ?? null}
      onReply={sheetActions?.onReply ?? null}
      onCopy={sheetActions?.onCopy ?? null}
    />

    {/* New messages arrived while scrolled up: a pill, not a jump. */}
    {/* Centred by a static wrapper: framer owns the button's transform. */}
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center">
    <AnimatePresence>
      {unseen > 0 && !isAtBottom && (
        <motion.button
          key="new-messages"
          type="button"
          onClick={() => void scrollToBottom('smooth')}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
          transition={reduceMotion ? { duration: 0.15 } : { type: 'spring', bounce: 0, duration: 0.3 }}
          className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-[#24252B] px-3.5 py-2 text-[12.5px] font-semibold text-text-primary shadow-[0_6px_20px_rgba(0,0,0,0.45)] hover:bg-[#2B2C33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <ArrowDownIcon className="h-3.5 w-3.5" weight="bold" aria-hidden />
          {unseen === 1 ? '1 New Message' : `${unseen} New Messages`}
        </motion.button>
      )}
    </AnimatePresence>
    </div>
    </div>
  )
}

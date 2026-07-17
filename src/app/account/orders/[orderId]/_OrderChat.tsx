'use client'

/**
 * OrderChat — V21/P5
 *
 * Hero chat card for the order detail page. Wraps the existing
 * <ChatInterface> in our canonical OrderCard shell with the lime glow
 * variant. ChatInterface already handles realtime, optimistic sends,
 * system events, and avatars — we just give it the right surface.
 *
 * Empty state: when no messages yet, the inner ChatInterface renders
 * its own empty-state CTA. We do not double-up.
 */

import dynamic from 'next/dynamic'
import { OrderCard } from './_OrderCard'

// ChatInterface is heavy (Supabase realtime + React Query) — defer load.
const ChatInterface = dynamic(() => import('@/components/chat/ChatInterface'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] items-center justify-center text-[12px] text-text-secondary">
      Loading conversation…
    </div>
  ),
})

interface OrderChatProps {
  conversationId: string
  currentUserId: string
  currentUserAvatar?: string
  /** Full order shape that ChatInterface expects for header + state. */
  order: {
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
    buyer?: { id: string; username: string; avatar_url?: string }
    seller?: { id: string; username: string; avatar_url?: string }
  }
  /** Other party for the header avatar / name. */
  otherUser?: {
    id: string
    username: string
    avatar_url?: string
  }
  disputeResolution?: { favored_party: 'buyer' | 'seller' | 'neutral' } | null
}

export function OrderChat({
  conversationId,
  currentUserId,
  currentUserAvatar,
  order,
  otherUser,
  disputeResolution,
}: OrderChatProps) {
  return (
    // V21/P7.af — Fixed chat height; the message list scrolls inside so
    // the card never grows per message. On mobile the 720px target is
    // capped to the visual viewport (dvh) so the thread + composer always
    // fit on screen — including when the soft keyboard shrinks the
    // viewport — and the internal MessageList scroll does the work.
    <OrderCard
      className="flex h-[clamp(360px,100dvh_-_180px,720px)] flex-col overflow-hidden p-0 lg:h-[580px]"
      padded={false}
    >
      <ChatInterface
        conversationId={conversationId}
        currentUserId={currentUserId}
        currentUserAvatar={currentUserAvatar}
        otherUser={otherUser}
        order={order}
        disputeResolution={disputeResolution ?? null}
        className="flex-1 min-h-0"
      />
    </OrderCard>
  )
}

'use client'

import { motion } from 'framer-motion'
import { Check, CheckCheck, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import Image from 'next/image'

// Simple markdown renderer for bold text
function renderMarkdown(text: string) {
  // Convert **text** to <strong>text</strong>
  const parts = text.split(/(\*\*.*?\*\*)/g)

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const content = part.slice(2, -2)
      return <strong key={index} className="font-semibold">{content}</strong>
    }
    return <span key={index}>{part}</span>
  })
}

interface MessageBubbleProps {
  message: {
    id: string
    content: string
    sender_id: string
    is_read: boolean
    created_at: string
    attachments?: string[]
  }
  isOwn: boolean
  showAvatar?: boolean
  senderAvatar?: string
  senderName?: string
  isAdminMessage?: boolean
  adminInfo?: {
    username: string
    avatar_url?: string
  }
  // For admin view: specify if this is buyer or seller message
  isBuyerMessage?: boolean
  isSellerMessage?: boolean
  isAdminView?: boolean
}

export default function MessageBubble({
  message,
  isOwn,
  showAvatar = false,
  senderAvatar,
  senderName,
  isAdminMessage = false,
  adminInfo,
  isBuyerMessage = false,
  isSellerMessage = false,
  isAdminView = false,
}: MessageBubbleProps) {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
    if (hours > 0) {
      return `${hours}h ago`
    }
    if (minutes > 0) {
      return `${minutes}m ago`
    }
    return 'Just now'
  }

  // Admin messages are centered (like Discord/WhatsApp system messages)
  if (isAdminMessage) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex justify-center mb-4"
      >
        <div className="flex flex-col items-center max-w-md">
          {/* Compact Admin Header */}
          <div className="flex items-center gap-2 mb-2">
            {/* Avatar with Shield */}
            <div className="relative">
              {adminInfo?.avatar_url ? (
                <img
                  src={adminInfo.avatar_url}
                  alt="Support"
                  className="h-6 w-6 rounded-full ring-1 ring-blue-400/40"
                />
              ) : (
                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                  <Shield className="h-3.5 w-3.5 text-white" />
                </div>
              )}
              {/* Small verified badge overlay */}
              <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-blue-500 border border-black flex items-center justify-center">
                <Shield className="h-1.5 w-1.5 text-white" />
              </div>
            </div>

            {/* Name & Badge - Inline */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-blue-400">
                {adminInfo?.username || 'Support'}
              </span>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/25">
                <Shield className="h-2.5 w-2.5 text-blue-400" />
                <span className="text-[9px] font-bold text-blue-400 uppercase tracking-wider">
                  Support
                </span>
              </div>
            </div>
          </div>

          {/* Message Content - Centered */}
          <div className="w-full rounded-lg px-3 py-2 bg-blue-500/10 border border-blue-500/20 backdrop-blur-sm">
            <p className="text-xs leading-relaxed whitespace-pre-wrap text-center text-gray-200">
              {renderMarkdown(message.content)}
            </p>
          </div>

          {/* Timestamp - Centered */}
          <div className="mt-1.5">
            <span className="text-[10px] text-text-tertiary">
              {formatTime(message.created_at)}
            </span>
          </div>
        </div>
      </motion.div>
    )
  }

  // For admin view, determine alignment based on buyer/seller
  // Buyer messages go RIGHT, Seller messages go LEFT
  const alignRight = isAdminView ? isBuyerMessage : isOwn
  const alignLeft = isAdminView ? isSellerMessage : !isOwn
  // V21/P5.e — Avatars render on BOTH sides for the first message in
  // a sender's sequence. Falls back to a spacer when missing so the
  // bubble column stays aligned within the conversation.
  const showLeftAvatar = alignLeft && showAvatar && senderAvatar
  const showLeftSpacer = alignLeft && !showLeftAvatar
  const showRightAvatar = alignRight && showAvatar && senderAvatar
  const showRightSpacer = alignRight && !showRightAvatar

  // Regular user messages (buyer/seller)
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'flex gap-2 mb-3',
        alignRight ? 'justify-end' : 'justify-start'
      )}
    >
      {/* Left-side avatar (theirs) or spacer */}
      {alignLeft && (
        <div className="flex-shrink-0">
          {showLeftAvatar ? (
            <img
              src={senderAvatar}
              alt={senderName || 'User'}
              className="h-8 w-8 rounded-full ring-1 ring-white/10"
            />
          ) : (
            <div className="w-8" />
          )}
        </div>
      )}

      {/* Message Content */}
      <div className={cn('flex flex-col max-w-[70%]', alignRight ? 'items-end' : 'items-start')}>
        {/* Sender Name (for left-aligned messages or admin view) */}
        {(alignLeft || isAdminView) && senderName && (
          <span className="mb-1 px-3 text-xs font-medium text-text-secondary">
            {senderName}
          </span>
        )}

        {/* V21/P5.c — Canonical bubble: lime-tinted for own messages,
            neutral raised for theirs. rounded with the same tail shape
            the handoff specified — 14/5/14/14 mirrored per side. */}
        <div
          className={cn(
            'px-3.5 py-2 break-words border',
            alignRight
              ? 'rounded-[14px] rounded-tr-[5px] bg-lime/[0.13] border-lime/[0.22] text-text-primary'
              : 'rounded-[14px] rounded-tl-[5px] bg-bg-overlay border-border-subtle text-text-primary'
          )}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{renderMarkdown(message.content)}</p>
          {/* Image attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className={cn('mt-2 grid gap-1.5', message.attachments.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
              {message.attachments.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block">
                  <div className="relative rounded-lg overflow-hidden aspect-video bg-black/20">
                    <Image
                      src={url}
                      alt={`Delivery proof ${i + 1}`}
                      fill
                      className="object-cover hover:scale-105 transition-transform duration-200"
                      unoptimized
                    />
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Timestamp & Read Receipt */}
        <div className="mt-1 flex items-center gap-1.5 px-3">
          <span className="text-xs text-text-tertiary">
            {formatTime(message.created_at)}
          </span>
          {alignRight && (
            <div className="text-text-tertiary">
              {message.is_read ? (
                <CheckCheck className="h-3.5 w-3.5 text-lime-text" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* V21/P5.e — Right-side own-avatar or spacer */}
      {alignRight &&
        (showRightAvatar ? (
          <div className="flex-shrink-0">
            <img
              src={senderAvatar}
              alt={senderName || 'You'}
              className="h-8 w-8 rounded-full ring-1 ring-white/10"
            />
          </div>
        ) : (
          <div className="w-8 flex-shrink-0" />
        ))}
    </motion.div>
  )
}

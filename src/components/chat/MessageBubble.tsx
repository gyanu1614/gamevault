'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { Camera, Shield } from 'lucide-react'
import { CheckIcon } from '@phosphor-icons/react/dist/csr/Check'
import { ChecksIcon } from '@phosphor-icons/react/dist/csr/Checks'
import { ClockIcon } from '@phosphor-icons/react/dist/csr/Clock'
import { WarningCircleIcon } from '@phosphor-icons/react/dist/csr/WarningCircle'
import { FileTextIcon } from '@phosphor-icons/react/dist/csr/FileText'
import { cn } from '@/lib/utils'
import { linkifySegments } from '@/lib/chat/linkify'
import { DELIVERY_EVIDENCE_LABEL } from '@/lib/chat/system-notice'
import { deliveryState, type LocalFile, type LocalStatus } from '@/lib/chat/message-state'
import ChatAttachment from './ChatAttachment'

/** Critically damped settle (no overshoot): a message arriving is not a
 *  gesture with momentum, so it must not bounce. */
const SETTLE = { type: 'spring', bounce: 0, duration: 0.32 } as const

/** Clock time under a bubble ("10:42 AM"); the day is on the divider. */
function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/** The label a file-only message stores (attachmentOnlyLabel). */
function isAttachmentPlaceholder(content: string): boolean {
  return content === 'Sent a photo' || content === 'Sent a PDF'
}

/** Plain text with http(s) URLs rendered as tappable links (new tab). */
function renderLinks(text: string, keyPrefix: string) {
  return linkifySegments(text).map((seg, i) =>
    seg.type === 'link' ? (
      <a
        key={`${keyPrefix}-${i}`}
        href={seg.href}
        target="_blank"
        rel="noopener noreferrer nofollow ugc"
        className="break-all font-medium text-lime-text underline underline-offset-2 hover:opacity-90"
      >
        {seg.value}
      </a>
    ) : (
      <span key={`${keyPrefix}-${i}`}>{seg.value}</span>
    ),
  )
}

// Simple markdown renderer for bold text
function renderMarkdown(text: string) {
  // Convert **text** to <strong>text</strong>
  const parts = text.split(/(\*\*.*?\*\*)/g)

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const content = part.slice(2, -2)
      return <strong key={index} className="font-semibold">{renderLinks(content, `b${index}`)}</strong>
    }
    return <span key={index}>{renderLinks(part, `t${index}`)}</span>
  })
}

interface MessageBubbleProps {
  message: {
    id: string
    content: string
    sender_id: string
    is_read: boolean
    read_at?: string | null
    created_at: string
    attachments?: string[] | null
    /** Optimistic send state ('sending' | 'failed'); unset once stored. */
    local_status?: LocalStatus
    /** This device's copy of the attachment (shown instead of re-loading). */
    local_files?: LocalFile[]
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
  /** Status words under the newest own message ("Sent", "Read 2m ago"). */
  statusText?: string | null
  /** Re-send a message that failed ("Not sent · Retry"). */
  onRetry?: (id: string) => void
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
  statusText = null,
  onRetry,
}: MessageBubbleProps) {
  const reduceMotion = useReducedMotion()
  const hasFiles =
    (!!message.attachments && message.attachments.length > 0) ||
    (!!message.local_files && message.local_files.length > 0)
  const formatTime = clockTime

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
  const showRightAvatar = alignRight && showAvatar && senderAvatar

  const state = deliveryState(message)
  const isPending = state === 'sending'
  const isFailed = state === 'failed'
  const hidePlaceholder = hasFiles && isAttachmentPlaceholder(message.content)

  // Regular user messages (buyer/seller).
  // The optimistic bubble is drawn in its FINAL colours from the first
  // frame; while it is sending only its opacity is lower, and on the
  // server ack it settles to full opacity in place (same key, same box —
  // no colour jump, no re-mount, no layout shift).
  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0.15 } : SETTLE}
      className={cn('mb-3 flex gap-2', alignRight ? 'justify-end' : 'justify-start')}
    >
      {/* Left-side avatar (theirs) or spacer */}
      {alignLeft && (
        <div className="flex-shrink-0">
          {showLeftAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar URL (DiceBear / storage)
            <img
              src={senderAvatar}
              alt={senderName || 'User'}
              className="h-8 w-8 rounded-full bg-bg-overlay object-cover ring-1 ring-white/10"
            />
          ) : (
            <div className="w-8" />
          )}
        </div>
      )}

      {/* Message Content */}
      <div className={cn('flex min-w-0 max-w-[70%] flex-col', alignRight ? 'items-end' : 'items-start')}>
        {/* Sender Name (for left-aligned messages or admin view) */}
        {(alignLeft || isAdminView) && senderName && (
          <span className="mb-1 px-1 text-xs font-medium text-text-secondary">{senderName}</span>
        )}

        {/* Rectangular bubble, 10px radius with a tighter 4px corner on
            the tail side. Own = transparent success green, theirs =
            neutral; fill only, no outline. */}
        <div
          className={cn(
            'min-w-0 max-w-full px-3.5 py-2 text-text-primary [overflow-wrap:anywhere] transition-opacity duration-200 ease-out',
            alignRight
              ? 'rounded-[10px] rounded-tr-[4px] bg-[rgba(63,217,134,0.12)]'
              : 'rounded-[10px] rounded-tl-[4px] bg-white/[0.06]',
            isPending && 'opacity-60',
          )}
        >
          {/* An image/PDF-only message stores a placeholder ("Sent a photo")
              for the inbox preview; inside the bubble the file speaks for
              itself. The seller's proof photo gets a small label. */}
          {message.content.startsWith(DELIVERY_EVIDENCE_LABEL) ? (
            <p className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-text-secondary">
              <Camera className="h-3.5 w-3.5" aria-hidden />
              {message.content}
            </p>
          ) : hidePlaceholder ? null : (
            <p className="whitespace-pre-wrap text-[14px] leading-[1.5]">{renderMarkdown(message.content)}</p>
          )}
          {/* Attachments. This device's own copy while sending (and after,
              so the picture never reloads); otherwise the stored files
              (private, signed on render) and legacy image URLs. */}
          {hasFiles && (
            <div
              className={cn(
                'grid gap-1.5',
                (message.local_files?.length ?? message.attachments?.length ?? 0) > 1 ? 'grid-cols-2' : 'grid-cols-1',
                !hidePlaceholder && 'mt-2',
              )}
            >
              {message.local_files && message.local_files.length > 0
                ? message.local_files.map((f, i) =>
                    f.kind === 'image' && f.url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- local object URL
                      <img
                        key={`local-${i}`}
                        src={f.url}
                        alt=""
                        className="max-h-60 w-[220px] max-w-full rounded-lg object-cover"
                      />
                    ) : (
                      <span
                        key={`local-${i}`}
                        className="inline-flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2 text-[12.5px] font-semibold text-text-primary"
                      >
                        <FileTextIcon className="h-4 w-4 text-lime-text" aria-hidden />
                        PDF
                      </span>
                    ),
                  )
                : (message.attachments ?? []).map((value, i) => (
                    <ChatAttachment key={`${value}-${i}`} value={value} />
                  ))}
            </div>
          )}
        </div>

        {/* Time + delivery status, muted, below the bubble. */}
        <div
          className={cn(
            'mt-1 flex min-h-[16px] items-center gap-1 px-1 text-[11px] leading-4 text-text-tertiary',
            alignRight && 'flex-row-reverse',
          )}
        >
          {isFailed && isOwn ? (
            <span className="inline-flex items-center gap-1 text-error" role="status">
              <WarningCircleIcon className="h-3.5 w-3.5" weight="bold" aria-hidden />
              Not sent
              {onRetry && (
                <>
                  <span aria-hidden>·</span>
                  <button
                    type="button"
                    onClick={() => onRetry(message.id)}
                    className="rounded px-0.5 font-semibold text-text-primary underline underline-offset-2 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    Retry
                  </button>
                </>
              )}
            </span>
          ) : (
            <>
              {alignRight && isOwn && (
                <span
                  className={cn('inline-flex items-center gap-1', state === 'read' && 'text-lime-text')}
                  aria-label={statusText ?? (isPending ? 'Sending' : state === 'read' ? 'Read' : 'Sent')}
                >
                  {isPending ? (
                    <ClockIcon className="h-3.5 w-3.5" aria-hidden />
                  ) : state === 'read' ? (
                    <ChecksIcon className="h-3.5 w-3.5" weight="bold" aria-hidden />
                  ) : (
                    <CheckIcon className="h-3.5 w-3.5" weight="bold" aria-hidden />
                  )}
                  {statusText && <span aria-live="polite">{statusText}</span>}
                </span>
              )}
              {alignRight && isOwn && <span aria-hidden>·</span>}
              <time dateTime={message.created_at}>{formatTime(message.created_at)}</time>
            </>
          )}
        </div>
      </div>

      {/* V21/P5.e — Right-side own-avatar or spacer */}
      {alignRight &&
        (showRightAvatar ? (
          <div className="flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- avatar URL (DiceBear / storage) */}
            <img
              src={senderAvatar}
              alt={senderName || 'You'}
              className="h-8 w-8 rounded-full bg-bg-overlay object-cover ring-1 ring-white/10"
            />
          </div>
        ) : (
          <div className="w-8 flex-shrink-0" />
        ))}
    </motion.div>
  )
}

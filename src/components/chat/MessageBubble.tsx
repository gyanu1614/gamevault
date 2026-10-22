'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { Camera } from 'lucide-react'
import { CheckIcon } from '@phosphor-icons/react/dist/csr/Check'
import { ChecksIcon } from '@phosphor-icons/react/dist/csr/Checks'
import { ClockIcon } from '@phosphor-icons/react/dist/csr/Clock'
import { WarningCircleIcon } from '@phosphor-icons/react/dist/csr/WarningCircle'
import { FileTextIcon } from '@phosphor-icons/react/dist/csr/FileText'
import { cn } from '@/lib/utils'
import { DELIVERY_EVIDENCE_LABEL } from '@/lib/chat/system-notice'
import { deliveryState, type LocalFile, type LocalStatus } from '@/lib/chat/message-state'
import type { ReactionSummary } from '@/lib/chat/reactions'
import ChatAttachment from './ChatAttachment'
import AdminMessageBubble from './AdminMessageBubble'
import { ReactionChips } from './ReactionChips'
import { ReplyQuote } from './ReplyQuote'
import { clockTime, renderMarkdown } from './message-text'
import { MessageHoverActions, type MessageActionHandlers } from './actions/MessageHoverActions'
import { useLongPress } from './actions/use-long-press'

/** Critically damped settle (no overshoot): a message arriving is not a
 *  gesture with momentum, so it must not bounce. */
const SETTLE = { type: 'spring', bounce: 0, duration: 0.32 } as const

/** The label a file-only message stores (attachmentOnlyLabel). */
function isAttachmentPlaceholder(content: string): boolean {
  return content === 'Sent a photo' || content === 'Sent a PDF'
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
  /** For a reply: the message it answers. */
  quote?: { name: string; snippet: string; onJump: (() => void) | null } | null
  reactions?: ReactionSummary[]
  /** React / Reply / Copy (desktop toolbar); null = none for this message. */
  actions?: MessageActionHandlers | null
  /** Touch long-press: open the action sheet for this message. */
  onLongPress?: (() => void) | null
  /** Briefly marked after jumping to it from a reply's quote. */
  highlighted?: boolean
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
  quote = null,
  reactions = [],
  actions = null,
  onLongPress = null,
  highlighted = false,
}: MessageBubbleProps) {
  const reduceMotion = useReducedMotion()
  const longPress = useLongPress(() => onLongPress?.(), !!onLongPress)
  const hasFiles =
    (!!message.attachments && message.attachments.length > 0) ||
    (!!message.local_files && message.local_files.length > 0)

  // Admin messages are centered (like Discord/WhatsApp system messages)
  if (isAdminMessage) return <AdminMessageBubble message={message} adminInfo={adminInfo} />

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
  const greenBubble = alignRight

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
      data-message-id={message.id}
      className={cn(
        'group/msg flex gap-2 rounded-lg transition-colors duration-500',
        showAvatar ? 'mt-3' : 'mt-1',
        alignRight ? 'justify-end' : 'justify-start',
        highlighted && 'bg-white/[0.05]',
      )}
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
      <div className={cn('flex min-w-0 max-w-[78%] flex-col sm:max-w-[70%]', alignRight ? 'items-end' : 'items-start')}>
        {/* Sender name on the first message of their run. */}
        {(alignLeft || isAdminView) && senderName && showAvatar && (
          <span className="mb-1 px-1 text-xs font-medium text-text-secondary">{senderName}</span>
        )}

        <div className="relative max-w-full">
          {/* Rectangular bubble, 10px radius with a tighter 4px corner on
              the tail side. Own = success green, theirs = neutral grey;
              fill only, no outline. Solid fills (not thin tints) so the
              thread reads clearly on the card. */}
          <div
            {...longPress}
            className={cn(
              'min-w-0 max-w-full px-3.5 py-2 text-text-primary [overflow-wrap:anywhere] transition-opacity duration-200 ease-out',
              greenBubble ? 'rounded-[10px] rounded-tr-[4px] bg-[#1F3B2E]' : 'rounded-[10px] rounded-tl-[4px] bg-[#2B2C33]',
              isPending && 'opacity-60',
              onLongPress && '[@media(pointer:coarse)]:select-none [@media(pointer:coarse)]:[-webkit-touch-callout:none]',
            )}
          >
            {quote && <ReplyQuote name={quote.name} snippet={quote.snippet} own={greenBubble} onJump={quote.onJump} />}
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

          {actions && <MessageHoverActions side={alignRight ? 'left' : 'right'} {...actions} />}
        </div>

        <ReactionChips
          summary={reactions}
          align={alignRight ? 'right' : 'left'}
          onToggle={actions?.onReact ?? null}
        />

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
              <time dateTime={message.created_at}>{clockTime(message.created_at)}</time>
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

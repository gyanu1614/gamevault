'use client'

/**
 * MessageInput — V21/P5.e
 *
 * Composes a chat message. Rewritten on shadcn <Textarea> + <Button>
 * so the surface matches the rest of the design system: solid
 * `bg-bg-overlay` field, `rounded-lg` (canonical card radius), lime
 * focus ring via shadcn's built-in focus state, and a square send
 * button with the same shape.
 *
 *  - Auto-growing textarea (1–5 lines, scrollbar after)
 *  - Enter sends, Shift+Enter inserts newline
 *  - Disabled state during send + when parent disabled
 *  - Character counter only when within 100 chars of the cap
 *  - Inline keyboard hint moved to a faint helper below the input
 */

import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from 'react'
import { Send, Loader2, Paperclip, X, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { CHAT_ATTACHMENT_ACCEPT, validateChatAttachment } from '@/lib/chat/attachments'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface MessageInputProps {
  /** `file` is set when the user attached one (only if allowAttachments). */
  onSend: (message: string, file?: File | null) => Promise<void>
  placeholder?: string
  disabled?: boolean
  maxLength?: number
  /** Show the paperclip (order chats, for the buyer and seller only). */
  allowAttachments?: boolean
}

export default function MessageInput({
  onSend,
  placeholder = 'Type a message…',
  disabled = false,
  maxLength = 2000,
  allowAttachments = false,
}: MessageInputProps) {
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Local thumbnail for a picked image; freed when it changes or unmounts.
  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const canSend = (message.trim().length > 0 || !!file) && !isSending && !disabled

  const handlePick = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null
    e.target.value = '' // picking the same file again still fires onChange
    if (!picked) return
    const problem = validateChatAttachment(picked)
    if (problem) {
      toast.error(problem)
      return
    }
    setFile(picked)
  }

  const handleSend = async () => {
    if (!canSend) return
    setIsSending(true)
    try {
      await onSend(message.trim(), file)
      setMessage('')
      setFile(null)
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    } catch (e) {
      console.error('Failed to send message:', e)
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)
    // Auto-grow up to ~5 lines (~120px).
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`
  }

  const remaining = maxLength - message.length
  const showCounter = remaining < 100

  return (
    <div className="border-t border-border-subtle bg-bg-raised px-4 py-3">
      {/* Picked file, waiting to be sent with the next message. */}
      {file && (
        <div className="mb-2 flex items-center gap-2.5 rounded-lg border border-border-subtle bg-bg-overlay p-2">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL
            <img src={previewUrl} alt="" className="h-10 w-10 flex-shrink-0 rounded-md object-cover" />
          ) : (
            <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-md bg-white/[0.04] text-lime-text">
              <FileText className="h-4 w-4" aria-hidden />
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-text-primary">{file.name}</span>
          <button
            type="button"
            onClick={() => setFile(null)}
            disabled={isSending}
            className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-white/[0.06] hover:text-text-primary sm:h-8 sm:w-8"
            aria-label="Remove attachment"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        {allowAttachments && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept={CHAT_ATTACHMENT_ACCEPT}
              onChange={handlePick}
              className="hidden"
              tabIndex={-1}
            />
            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isSending}
              size="icon"
              className="h-11 w-11 flex-shrink-0 rounded-lg bg-bg-overlay text-text-secondary hover:bg-bg-overlay hover:text-lime-text sm:h-10 sm:w-10"
              aria-label="Attach a photo or PDF"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
          </>
        )}
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isSending}
          maxLength={maxLength}
          rows={1}
          className={cn(
            // Touch screens get 16px: iOS zooms the page into any field under
            // 16px on focus. Mouse/trackpad keeps the 13.5px design size.
            'min-h-[44px] max-h-[120px] flex-1 resize-none rounded-lg border-border-default bg-bg-overlay px-3.5 py-2.5 text-[13.5px] leading-[1.45] text-text-primary placeholder:text-text-tertiary sm:min-h-[40px] [@media(pointer:coarse)]:text-[16px]',
            'focus-visible:border-focus-border focus-visible:ring-2 focus-visible:ring-focus-soft focus-visible:ring-offset-0',
          )}
        />
        <Button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          size="icon"
          className={cn(
            'h-11 w-11 flex-shrink-0 rounded-lg sm:h-10 sm:w-10',
            canSend
              ? 'bg-lime text-text-inverse hover:bg-lime-hover'
              : 'bg-bg-overlay text-text-tertiary hover:bg-bg-overlay',
          )}
          aria-label="Send message"
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Helper row — the physical-keyboard hint is meaningless on touch
          keyboards, so it (and the whole row, unless the counter is
          showing) hides below sm. */}
      <div
        className={cn(
          'mt-2 hidden items-center justify-between text-[11px] text-text-tertiary sm:flex',
          showCounter && 'flex',
        )}
      >
        <span className="hidden sm:inline">
          <kbd className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-text-secondary">Enter</kbd>{' '}
          to send ·{' '}
          <kbd className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-text-secondary">Shift+Enter</kbd>{' '}
          for new line
        </span>
        {showCounter && (
          <span className={cn('ml-auto', remaining < 50 ? 'text-error' : 'text-text-tertiary')}>
            {remaining} left
          </span>
        )}
      </div>
    </div>
  )
}

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

import { useState, useRef, KeyboardEvent, ChangeEvent } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface MessageInputProps {
  onSend: (message: string) => Promise<void>
  placeholder?: string
  disabled?: boolean
  maxLength?: number
}

export default function MessageInput({
  onSend,
  placeholder = 'Type a message…',
  disabled = false,
  maxLength = 2000,
}: MessageInputProps) {
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const canSend = message.trim().length > 0 && !isSending && !disabled

  const handleSend = async () => {
    if (!canSend) return
    setIsSending(true)
    try {
      await onSend(message.trim())
      setMessage('')
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
      <div className="flex items-end gap-2">
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
            'min-h-[44px] max-h-[120px] flex-1 resize-none rounded-lg border-border-default bg-bg-overlay px-3.5 py-2.5 text-[13.5px] leading-[1.45] text-text-primary placeholder:text-text-tertiary sm:min-h-[40px]',
            'focus-visible:border-lime focus-visible:ring-2 focus-visible:ring-lime/30 focus-visible:ring-offset-0',
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

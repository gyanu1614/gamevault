'use client'

import { useState, useRef, KeyboardEvent } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MessageInputProps {
  onSend: (message: string) => Promise<void>
  placeholder?: string
  disabled?: boolean
  maxLength?: number
}

export default function MessageInput({
  onSend,
  placeholder = 'Type a message...',
  disabled = false,
  maxLength = 2000,
}: MessageInputProps) {
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = async () => {
    if (!message.trim() || isSending) return

    setIsSending(true)
    try {
      await onSend(message.trim())
      setMessage('')
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)

    // Auto-grow textarea
    const textarea = e.target
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`
  }

  const remainingChars = maxLength - message.length
  const isNearLimit = remainingChars < 100

  return (
    <div className="border-t border-white/10 bg-black/50 p-4">
      <div className="relative">
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isSending}
          maxLength={maxLength}
          rows={1}
          className={cn(
            'w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-14 text-sm text-white placeholder:text-text-tertiary',
            'focus:border-lime focus:outline-none focus:ring-2 focus:ring-violet-500/20',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'transition-all duration-200'
          )}
          style={{ minHeight: '44px', maxHeight: '150px' }}
        />

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={!message.trim() || isSending || disabled}
          className={cn(
            'absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-lg transition-all',
            message.trim() && !isSending && !disabled
              ? 'bg-gradient-to-br from-lime to-purple-600 text-white hover:scale-105 hover:shadow-lg hover:shadow-violet-500/50'
              : 'bg-white/5 text-text-tertiary cursor-not-allowed'
          )}
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Character Counter */}
      {isNearLimit && (
        <div className={cn(
          'mt-1.5 text-right text-xs',
          remainingChars < 50 ? 'text-error' : 'text-text-tertiary'
        )}>
          {remainingChars} characters remaining
        </div>
      )}

      {/* Hint */}
      <div className="mt-2 text-xs text-text-tertiary">
        Press <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono">Enter</kbd> to send,
        <kbd className="ml-1 rounded bg-white/10 px-1.5 py-0.5 font-mono">Shift+Enter</kbd> for new line
      </div>
    </div>
  )
}

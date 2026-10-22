'use client'

import { cn } from '@/lib/utils'

/** The message a reply answers, quoted at the top of the reply bubble.
 *  Tapping it scrolls the thread to the original and flashes it. */
export function ReplyQuote({
  name,
  snippet,
  own,
  onJump,
}: {
  name: string
  snippet: string
  /** Inside my own (green) bubble. */
  own: boolean
  onJump: (() => void) | null
}) {
  const body = (
    <>
      <span className={cn('block text-[11.5px] font-semibold leading-4', own ? 'text-lime-text' : 'text-text-primary')}>{name}</span>
      <span className="line-clamp-2 text-[12.5px] leading-[1.35] text-text-secondary">{snippet}</span>
    </>
  )
  const cls = cn(
    'mb-1.5 block w-full min-w-0 rounded-md border-l-2 px-2.5 py-1.5 text-left',
    own ? 'border-[color-mix(in_srgb,var(--color-accent-default)_70%,transparent)] bg-black/20' : 'border-white/30 bg-black/20',
  )
  return onJump ? (
    <button
      type="button"
      onClick={onJump}
      className={cn(cls, 'transition-colors hover:bg-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring')}
      aria-label={`Replying to ${name}: ${snippet}. Show message`}
    >
      {body}
    </button>
  ) : (
    <span className={cls}>{body}</span>
  )
}

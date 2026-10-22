'use client'

import { CHAT_REACTIONS, reactionLabel } from '@/lib/chat/reactions'
import { cn } from '@/lib/utils'

/** The six reaction emoji in a row. The viewer's current one is marked;
 *  tapping it again takes it off (the caller decides, see reactionIntent). */
export function ReactionPicker({
  current,
  onPick,
  size = 'md',
  className,
}: {
  current: string | null
  onPick: (emoji: string) => void
  size?: 'md' | 'lg'
  className?: string
}) {
  return (
    <div role="group" aria-label="React to message" className={cn('flex items-center gap-0.5', className)}>
      {CHAT_REACTIONS.map((emoji) => {
        const active = current === emoji
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => onPick(emoji)}
            aria-pressed={active}
            aria-label={active ? `Remove ${reactionLabel(emoji)}` : reactionLabel(emoji)}
            className={cn(
              'grid place-items-center rounded-full leading-none transition-[transform,background-color] duration-150 ease-out',
              'hover:scale-[1.12] active:scale-95 motion-reduce:transform-none',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
              size === 'lg' ? 'h-12 w-12 text-[26px]' : 'h-9 w-9 text-[20px]',
              active ? 'bg-white/[0.14]' : 'hover:bg-white/[0.07]',
            )}
          >
            <span aria-hidden>{emoji}</span>
          </button>
        )
      })}
    </div>
  )
}

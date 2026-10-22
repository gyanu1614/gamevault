'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { reactionLabel, type ReactionSummary } from '@/lib/chat/reactions'
import { cn } from '@/lib/utils'

/** Reactions under a bubble, tucked onto its bottom edge. A chip the viewer
 *  can use toggles their reaction; otherwise it is just a count. */
export function ReactionChips({
  summary,
  align,
  onToggle,
}: {
  summary: ReactionSummary[]
  align: 'left' | 'right'
  onToggle: ((emoji: string) => void) | null
}) {
  const reduceMotion = useReducedMotion()
  if (summary.length === 0) return null
  return (
    <div className={cn('relative z-[1] -mt-2 flex flex-wrap gap-1', align === 'right' ? 'justify-end pr-2' : 'pl-2')}>
      <AnimatePresence initial={false}>
        {summary.map((s) => {
          const label = `${reactionLabel(s.emoji)}${s.count > 1 ? ` ${s.count}` : ''}${s.mine ? ', including you' : ''}`
          const chip = (
            <>
              <span aria-hidden className="text-[13px] leading-none">{s.emoji}</span>
              {s.count > 1 && <span className="text-[11.5px] font-semibold tabular-nums text-text-secondary">{s.count}</span>}
            </>
          )
          const cls = cn(
            'inline-flex h-6 items-center gap-1 rounded-full px-1.5 ring-2 ring-[var(--chat-canvas,#1D1E23)]',
            s.mine ? 'bg-[#244334]' : 'bg-[#2B2C33]',
          )
          return (
            <motion.span
              key={s.emoji}
              layout={!reduceMotion}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
              transition={{ type: 'spring', bounce: 0.3, duration: 0.3 }}
              className="inline-flex"
            >
              {onToggle ? (
                <button
                  type="button"
                  onClick={() => onToggle(s.emoji)}
                  aria-pressed={s.mine}
                  aria-label={label}
                  className={cn(cls, 'transition-transform hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-focus-ring')}
                >
                  {chip}
                </button>
              ) : (
                <span className={cls} aria-label={label} role="img">
                  {chip}
                </span>
              )}
            </motion.span>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

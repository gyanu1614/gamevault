'use client'

/**
 * SaveButton — a card's primary action with honest feedback: the label swaps
 * to "Saving…" while the request runs and to "Saved" with a check for a
 * moment after it lands, so the person sees their change stick without
 * hunting for a toast. Reduced motion: the label swaps without sliding.
 */

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, Loader2 } from 'lucide-react'
import { accountBtn } from '@/components/account/AccountSurface'
import { cn } from '@/lib/utils'

interface SaveButtonProps {
  saving: boolean
  saved: boolean
  disabled?: boolean
  onClick: () => void
  label?: string
  savingLabel?: string
  variant?: keyof typeof accountBtn
  className?: string
}

export function SaveButton({
  saving,
  saved,
  disabled,
  onClick,
  label = 'Save',
  savingLabel = 'Saving…',
  variant = 'primary',
  className,
}: SaveButtonProps) {
  const reduce = useReducedMotion()
  const state = saving ? 'saving' : saved ? 'saved' : 'idle'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || saving}
      aria-live="polite"
      className={cn(accountBtn[variant], 'min-w-[96px] overflow-hidden', className)}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={state}
          className="inline-flex items-center gap-1.5"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
          transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
        >
          {state === 'saving' && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          {state === 'saved' && <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />}
          {state === 'saving' ? savingLabel : state === 'saved' ? 'Saved' : label}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}

'use client'

/**
 * OrderModal: the one shell every order-page popup uses (Confirm Delivery,
 * Mark As Delivered, Dispute, Review, Cancel, How To Receive).
 *
 * Same look as the listing filter panels: a flat dark surface, a header band
 * with a faint tint and a hairline divider holding a small bold title, then
 * a short description and the content, then compact actions. The base
 * Dialog already turns it into a bottom sheet on phones.
 */

import type { LucideIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

type Tone = 'lime' | 'warning' | 'red' | 'neutral'

const TILE: Record<Tone, string> = {
  lime: 'bg-lime-tint-bg text-lime-text',
  warning: 'bg-warning-bg text-warning',
  red: 'bg-red-400/[0.12] text-red-400',
  neutral: 'bg-white/[0.06] text-text-secondary',
}

export function OrderModal({
  open,
  onOpenChange,
  icon: Icon,
  tone = 'lime',
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  icon?: LucideIcon
  tone?: Tone
  title: string
  description?: React.ReactNode
  children?: React.ReactNode
  footer?: React.ReactNode
  className?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          // No outline (owner, 2026-09-28): the fill and shadow are the edge.
          'max-w-[440px] gap-0 border-0 bg-[#1B2028] p-0 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.7)]',
          className,
        )}
      >
        {/* pr-12 keeps the title clear of the dialog's close button. */}
        <div className="flex items-center gap-2.5 border-b border-white/[0.08] bg-white/[0.03] py-3 pl-5 pr-12">
          {Icon && (
            <span className={cn('grid h-7 w-7 flex-shrink-0 place-items-center rounded-[7px]', TILE[tone])}>
              <Icon className="h-4 w-4" aria-hidden />
            </span>
          )}
          <DialogTitle className="text-body-sm font-bold leading-tight text-text-primary">{title}</DialogTitle>
        </div>
        <div className="px-5 py-4">
          {description && (
            <DialogDescription className="text-[13px] leading-[1.5] text-text-secondary">{description}</DialogDescription>
          )}
          {children}
        </div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-5 py-3 max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Footer / body buttons sized for the compact shell. */
export function modalButton(variant: 'primary' | 'ghost' | 'warning' | 'danger') {
  return cn(
    'inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-[9px] px-4 text-[13.5px] transition-colors disabled:pointer-events-none disabled:opacity-50',
    'max-sm:h-11 max-sm:flex-1',
    variant === 'primary' && 'bg-lime font-bold text-text-inverse hover:bg-lime-hover',
    variant === 'ghost' && 'font-semibold text-text-secondary hover:bg-white/[0.04] hover:text-text-primary',
    variant === 'warning' &&
      'border border-[rgba(255,178,62,0.32)] bg-warning-bg font-bold text-warning hover:bg-[rgba(255,178,62,0.2)]',
    variant === 'danger' && 'bg-red-500 font-bold text-white hover:bg-red-500/90',
  )
}

/** Plain text fields inside the shell: neutral focus (never green). */
export const modalField =
  'w-full rounded-[9px] border border-white/10 bg-bg-base px-3 py-2.5 text-[14px] leading-[1.5] text-text-primary placeholder:text-text-tertiary transition-colors focus:border-white/30 focus:outline-none focus-visible:shadow-none max-sm:text-[16px]'

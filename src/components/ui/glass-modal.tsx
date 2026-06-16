'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect } from 'react'
import { scaleIn, overlayVariants } from '@/lib/animations/variants'
import { cn } from '@/lib/utils'

interface GlassModalProps {
  /** Whether the modal is open */
  open: boolean
  /** Called when the user closes the modal */
  onClose: () => void
  /** Modal title shown in the header */
  title?: string
  /** Subtitle/description under the title */
  description?: string
  /** Modal width — default 'md' */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  /** Whether to show the close button (default: true) */
  showClose?: boolean
  /** Whether clicking the backdrop closes the modal (default: true) */
  closeOnBackdrop?: boolean
  /** Glass intensity (default: 'medium') */
  intensity?: 'light' | 'medium' | 'heavy'
  children: React.ReactNode
  className?: string
  /** Slot for action buttons in the footer */
  footer?: React.ReactNode
}

/**
 * GlassModal — accessible glass morphism dialog with backdrop blur.
 * Uses Framer Motion for enter/exit animations.
 *
 * @example
 * <GlassModal
 *   open={isOpen}
 *   onClose={() => setOpen(false)}
 *   title="Confirm Delivery"
 *   footer={<Button onClick={confirm}>Confirm</Button>}
 * >
 *   <p>Are you sure you want to confirm delivery?</p>
 * </GlassModal>
 */
export function GlassModal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  showClose = true,
  closeOnBackdrop = true,
  intensity = 'medium',
  children,
  className,
  footer,
}: GlassModalProps) {
  // Lock body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  const sizeClasses: Record<NonNullable<GlassModalProps['size']>, string> = {
    sm:   'max-w-sm',
    md:   'max-w-md',
    lg:   'max-w-lg',
    xl:   'max-w-2xl',
    full: 'max-w-[95vw] h-[90vh]',
  }

  const intensityClasses: Record<NonNullable<GlassModalProps['intensity']>, string> = {
    light:  'bg-[#111118]/80 backdrop-blur-xl  border border-border-subtle',
    medium: 'bg-[#111118]/90 backdrop-blur-2xl border border-white/[0.12]',
    heavy:  'bg-[#0a0a0f]/95 backdrop-blur-3xl border border-white/[0.14]',
  }

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          {/* Backdrop */}
          <motion.div
            variants={overlayVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeOnBackdrop ? onClose : undefined}
          />

          {/* Modal panel */}
          <motion.div
            variants={scaleIn}
            initial="initial"
            animate="animate"
            exit="exit"
            className={cn(
              'relative w-full z-10',
              'rounded-2xl shadow-modal',
              intensityClasses[intensity],
              sizeClasses[size],
              size === 'full' && 'flex flex-col',
              className
            )}
          >
            {/* Header */}
            {(title || showClose) && (
              <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-border-subtle">
                <div className="flex-1 min-w-0 pr-4">
                  {title && (
                    <h2 className="text-lg font-display font-semibold text-foreground leading-tight">
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                  )}
                </div>
                {showClose && (
                  <button
                    onClick={onClose}
                    aria-label="Close dialog"
                    className={cn(
                      'shrink-0 rounded-lg p-1.5 -mr-1 -mt-1',
                      'text-muted-foreground hover:text-foreground',
                      'hover:bg-white/[0.07]',
                      'transition-colors duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500'
                    )}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {/* Body */}
            <div className={cn('px-6 py-5', size === 'full' && 'flex-1 overflow-y-auto')}>
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border-subtle">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export default GlassModal

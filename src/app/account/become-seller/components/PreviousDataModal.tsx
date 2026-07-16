/**
 * Previous Data Modal Component
 *
 * Displays when a user with a withdrawn application starts a new registration.
 * Allows users to choose whether to pre-populate their new application with
 * data from their previous withdrawn application.
 *
 * Features:
 * - Shows withdrawal date and count
 * - Clear call-to-action buttons
 * - Prevents auto-fill for spam (5+ withdrawals)
 * - Professional, accessible UI
 */

'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { FileText, RefreshCcw, Sparkles, AlertCircle } from 'lucide-react'

interface PreviousDataModalProps {
  isOpen: boolean
  withdrawnAt: string
  withdrawalCount: number
  onUseData: () => void
  onStartFresh: () => void
}

export default function PreviousDataModal({
  isOpen,
  withdrawnAt,
  withdrawalCount,
  onUseData,
  onStartFresh,
}: PreviousDataModalProps) {
  const formattedDate = new Date(withdrawnAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="relative w-full max-w-md rounded-2xl border border-white/10 bg-black/95 backdrop-blur-xl p-6 shadow-2xl"
            >
              {/* Icon */}
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-lime/15 border border-lime-tint-border">
                <FileText className="h-7 w-7 text-lime-text" />
              </div>

              {/* Title */}
              <h2 className="mb-2 text-center text-xl font-bold text-white">
                Welcome Back!
              </h2>

              {/* Description */}
              <p className="mb-6 text-center text-sm text-text-secondary leading-relaxed">
                We found your previous application that was withdrawn on{' '}
                <span className="font-medium text-white">{formattedDate}</span>.
                Would you like to use your previous information to save time?
              </p>

              {/* Withdrawal count warning (if multiple withdrawals) */}
              {withdrawalCount >= 3 && (
                <div className="mb-4 rounded-lg bg-warning-bg border border-yellow-500/20 p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-yellow-300">
                      You have withdrawn {withdrawalCount} applications. Please ensure your
                      next submission is complete to avoid delays.
                    </p>
                  </div>
                </div>
              )}

              {/* What will be pre-filled */}
              <div className="mb-6 rounded-lg bg-bg-overlay border border-border-subtle p-4">
                <p className="mb-2 text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                  What will be pre-filled:
                </p>
                <ul className="space-y-1.5 text-sm text-text-secondary">
                  <li className="flex items-center gap-2">
                    <div className="h-1 w-1 rounded-full bg-lime" />
                    Basic information (name, email, phone)
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-1 w-1 rounded-full bg-lime" />
                    Business details (if applicable)
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-1 w-1 rounded-full bg-lime" />
                    Profile, policies, and payment info
                  </li>
                </ul>
                <p className="mt-3 text-xs text-text-tertiary">
                  Documents and profile pictures must be re-uploaded for security.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5">
                {/* Use Previous Data Button */}
                <button
                  onClick={onUseData}
                  className="w-full flex items-center justify-center gap-2 rounded-md bg-lime px-4 py-3 text-sm font-semibold text-text-inverse hover:bg-lime-hover transition-colors"
                >
                  <Sparkles className="h-4 w-4" />
                  Use Previous Data
                </button>

                {/* Start Fresh Button */}
                <button
                  onClick={onStartFresh}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-bg-overlay px-4 py-3 text-sm font-medium text-text-secondary hover:bg-bg-overlay transition-colors"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Start Fresh
                </button>
              </div>

              {/* Helper text */}
              <p className="mt-4 text-center text-xs text-text-tertiary">
                You can edit any information after selecting
              </p>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

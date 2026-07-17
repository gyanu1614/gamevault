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
 *
 * Styled for the "Forest Ledger" light world of the redesigned wizard:
 * white paper card over a forest scrim, PALETTE colours only, CSS-only
 * entrance animations (no framer-motion).
 */

'use client'

import { FileText, RefreshCcw, Sparkles, AlertCircle } from 'lucide-react'
import { PALETTE } from '../_redesign/theme'

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

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop — forest scrim */}
      <div
        className="animate-fade-in fixed inset-0 z-50 backdrop-blur-sm"
        style={{ backgroundColor: 'rgba(15,51,32,0.6)' }}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="animate-fade-up relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl p-6"
          style={{
            background: 'linear-gradient(180deg, #FFFFFF 0%, #FFFFFF 55%, #FCFCFA 100%)',
            border: `1px solid ${PALETTE.line}`,
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -1px 0 rgba(0,0,0,0.04), 0 10px 24px -12px rgba(0,0,0,0.5)',
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Use your previous application data"
        >
          {/* Icon */}
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ backgroundColor: 'rgba(20,67,42,0.06)', border: `1px solid ${PALETTE.line}` }}
          >
            <FileText className="h-7 w-7" style={{ color: PALETTE.forest }} />
          </div>

          {/* Title */}
          <h2 className="mb-2 text-center text-xl font-bold" style={{ color: PALETTE.forest }}>
            Welcome Back!
          </h2>

          {/* Description */}
          <p
            className="mb-6 text-center text-sm leading-relaxed"
            style={{ color: PALETTE.ink2 }}
          >
            We found your previous application that was withdrawn on{' '}
            <span className="font-medium" style={{ color: PALETTE.forest }}>
              {formattedDate}
            </span>
            . Would you like to use your previous information to save time?
          </p>

          {/* Withdrawal count warning (if multiple withdrawals) */}
          {withdrawalCount >= 3 && (
            <div
              className="mb-4 rounded-lg p-3"
              style={{
                backgroundColor: 'rgba(180,131,24,0.08)',
                border: '1px solid rgba(180,131,24,0.25)',
              }}
            >
              <div className="flex items-start gap-2">
                <AlertCircle
                  className="mt-0.5 h-4 w-4 flex-shrink-0"
                  style={{ color: '#8A6511' }}
                />
                <p className="text-xs leading-relaxed" style={{ color: '#8A6511' }}>
                  You have withdrawn {withdrawalCount} applications. Please ensure your
                  next submission is complete to avoid delays.
                </p>
              </div>
            </div>
          )}

          {/* What will be pre-filled */}
          <div
            className="mb-6 rounded-lg p-4"
            style={{ backgroundColor: PALETTE.ivory, border: `1px solid ${PALETTE.line}` }}
          >
            <p
              className="mb-2 text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: PALETTE.forest2 }}
            >
              What Will Be Pre-Filled:
            </p>
            <ul className="space-y-1.5 text-sm" style={{ color: PALETTE.ink2 }}>
              <li className="flex items-center gap-2">
                <div
                  className="h-1 w-1 rounded-full"
                  style={{ backgroundColor: PALETTE.forest }}
                />
                Basic information (name, email, phone)
              </li>
              <li className="flex items-center gap-2">
                <div
                  className="h-1 w-1 rounded-full"
                  style={{ backgroundColor: PALETTE.forest }}
                />
                Business details (if applicable)
              </li>
              <li className="flex items-center gap-2">
                <div
                  className="h-1 w-1 rounded-full"
                  style={{ backgroundColor: PALETTE.forest }}
                />
                Profile, policies, and payment info
              </li>
            </ul>
            <p className="mt-3 text-xs" style={{ color: PALETTE.ink2 }}>
              Documents and profile pictures must be re-uploaded for security.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5">
            {/* Use Previous Data Button */}
            <button
              onClick={onUseData}
              className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-[filter] hover:brightness-110"
              style={{
                background:
                  'linear-gradient(180deg, #1B5E3A 0%, #14432A 55%, #103A22 100%)',
                boxShadow:
                  'inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -2px 0 rgba(0,0,0,0.25), 0 6px 14px -6px rgba(20,67,42,0.5)',
              }}
            >
              <Sparkles className="h-4 w-4" style={{ color: PALETTE.lime }} />
              Use Previous Data
            </button>

            {/* Start Fresh Button */}
            <button
              onClick={onStartFresh}
              className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors hover:bg-black/[0.03]"
              style={{
                border: `1px solid ${PALETTE.line}`,
                backgroundColor: PALETTE.paper,
                color: PALETTE.forest,
              }}
            >
              <RefreshCcw className="h-4 w-4" />
              Start Fresh
            </button>
          </div>

          {/* Helper text */}
          <p className="mt-4 text-center text-xs" style={{ color: PALETTE.ink2 }}>
            You can edit any information after selecting
          </p>
        </div>
      </div>
    </>
  )
}

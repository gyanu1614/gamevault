/**
 * SubmissionLoader — full-screen loader shown while the application record is
 * submitted. Documents are already uploaded at pick time, so there are only two
 * stages: submitting → complete.
 *
 * Styled for the Forest Ledger light world (white card on a forest scrim) and
 * animated with CSS ONLY — framer-motion's rAF can stall in throttled contexts
 * and freeze the overlay mid-fade, which on a blocking full-screen loader would
 * strand the user.
 */

'use client'

import { Loader2, CheckCircle2 } from 'lucide-react'
import { PALETTE } from '../_redesign/theme'

interface SubmissionLoaderProps {
  stage: 'submitting' | 'complete'
  message?: string
}

export default function SubmissionLoader({ stage, message }: SubmissionLoaderProps) {
  const text =
    message ??
    (stage === 'complete'
      ? 'All set — taking you to your application status.'
      : 'Sending your application for review…')

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Forest scrim */}
      <div
        className="animate-fade-in absolute inset-0"
        style={{ backgroundColor: 'rgba(15,51,32,0.55)', backdropFilter: 'blur(6px)' }}
      />

      {/* Card */}
      <div
        className="animate-fade-up relative z-10 w-full max-w-sm overflow-hidden rounded-2xl shadow-2xl"
        style={{ backgroundColor: PALETTE.paper }}
      >
        <div className="p-7 sm:p-8">
          {/* Icon */}
          <div className="mb-5 flex justify-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: stage === 'complete' ? PALETTE.lime : PALETTE.forest }}
            >
              {stage === 'submitting' ? (
                <Loader2 className="h-7 w-7 animate-spin text-white" />
              ) : (
                <CheckCircle2 className="h-7 w-7" style={{ color: PALETTE.forest3 }} />
              )}
            </div>
          </div>

          {/* Title */}
          <h2
            className="mb-2 text-center text-lg font-bold sm:text-xl"
            style={{ color: PALETTE.forest }}
          >
            {stage === 'submitting' ? 'Submitting Application' : 'Application Received'}
          </h2>

          {/* Message */}
          <p className="mb-5 text-center text-sm" style={{ color: PALETTE.ink2 }}>
            {text}
          </p>

          {/* Loading dots — CSS pulse with staggered delays */}
          <div className="flex items-center justify-center gap-2">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 animate-pulse rounded-full"
                style={{ backgroundColor: PALETTE.forest2, animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

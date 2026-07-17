/**
 * SubmissionLoader — blocking overlay while the application record submits.
 * Clean/professional: white card, brand row, headline, a thin indeterminate
 * forest progress bar, and an encryption note. No spin-circles or dot rows.
 * The success state lives on the STATUS PAGE (?submitted=1 banner), not here —
 * this overlay only ever shows the in-flight state.
 *
 * CSS-only animation (scoped keyframes below) — framer-motion's rAF can stall
 * in throttled contexts, which on a blocking overlay would strand the user.
 */

'use client'

import Image from 'next/image'
import { ShieldCheck } from 'lucide-react'
import { PALETTE } from '../_redesign/theme'

interface SubmissionLoaderProps {
  /** Kept for call-site compatibility; only 'submitting' renders distinct UI. */
  stage?: 'submitting' | 'complete'
  message?: string
}

export default function SubmissionLoader({ message }: SubmissionLoaderProps) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <style>{`
        @keyframes dm-progress {
          0%   { transform: translateX(-100%); }
          60%  { transform: translateX(160%); }
          100% { transform: translateX(160%); }
        }
      `}</style>

      {/* Forest scrim */}
      <div
        className="animate-fade-in absolute inset-0"
        style={{ backgroundColor: 'rgba(15,51,32,0.6)', backdropFilter: 'blur(6px)' }}
      />

      {/* Card */}
      <div
        className="animate-fade-up relative z-10 w-full max-w-md overflow-hidden rounded-2xl shadow-2xl"
        style={{ backgroundColor: PALETTE.paper }}
      >
        {/* Indeterminate progress bar — the card's top edge */}
        <div className="relative h-1 w-full overflow-hidden" style={{ backgroundColor: PALETTE.line }}>
          <span
            className="absolute inset-y-0 left-0 w-2/3 rounded-full"
            style={{
              background: `linear-gradient(90deg, transparent, ${PALETTE.forest2}, ${PALETTE.lime})`,
              animation: 'dm-progress 1.4s cubic-bezier(0.4, 0, 0.2, 1) infinite',
            }}
          />
        </div>

        <div className="px-7 py-6">
          {/* Brand row */}
          <div className="flex items-center gap-2">
            <Image
              src="/brand/logo-mark-ink.png"
              alt=""
              width={22}
              height={22}
              className="h-[22px] w-[22px] object-contain"
            />
            <span className="text-sm font-bold tracking-tight" style={{ color: PALETTE.forest }}>
              Drop<span style={{ color: PALETTE.ink2 }}>Market</span>
            </span>
          </div>

          <h2 className="mt-4 text-lg font-semibold" style={{ color: PALETTE.forest }}>
            Submitting Your Application
          </h2>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: PALETTE.ink2 }}>
            {message ?? 'Sending your details to our review team. This only takes a moment — please keep this page open.'}
          </p>

          <div
            className="mt-5 flex items-center gap-2 border-t pt-4 text-xs"
            style={{ borderColor: PALETTE.line, color: PALETTE.ink2 }}
          >
            <ShieldCheck className="h-3.5 w-3.5" style={{ color: PALETTE.forest2 }} />
            Everything you entered is encrypted in transit and at rest.
          </div>
        </div>
      </div>
    </div>
  )
}

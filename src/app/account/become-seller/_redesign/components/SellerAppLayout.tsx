/**
 * SellerAppLayout — the full-screen split-screen shell for the redesigned
 * seller application. Owns its OWN layout: no site navbar or footer. Left ~37%
 * fixed rail (photo + scrim + stepper + trust), right ~63% ivory scrolling pane.
 * On mobile the rail is replaced by a thin top progress bar (MobileProgress).
 *
 * This is a presentational shell — it takes the current step + the step body as
 * children. The screen orchestrator owns navigation state and drops each step's
 * content (wrapped in <AnimatePresence> + <StepTransition>) into `children`.
 *
 * The palette is applied as CSS variables on the root so step components can use
 * var(--sa-forest) etc.; the whole shell is light even under a dark OS theme.
 */

'use client'

import type { ReactNode } from 'react'
import { PlayCircle } from 'lucide-react'
import { PALETTE, PALETTE_VARS } from '../theme'
import LeftRail from './LeftRail'
import MobileProgress from './MobileProgress'

interface SellerAppLayoutProps {
  currentStep: number
  /** Completed-step jump handler for the stepper (optional). */
  onStepClick?: (step: number) => void
  /** Opens the "watch how it works" video modal — stays reachable inside the shell. */
  onWatchVideo?: () => void
  children: ReactNode
}

export default function SellerAppLayout({
  currentStep,
  onStepClick,
  onWatchVideo,
  children,
}: SellerAppLayoutProps) {
  return (
    <div
      style={{ ...PALETTE_VARS, backgroundColor: PALETTE.ivory }}
      className="min-h-screen w-full lg:grid lg:h-screen lg:grid-cols-[37%_63%] lg:overflow-hidden"
    >
      {/* Left rail — fixed, does not scroll (desktop only). */}
      <div className="lg:h-screen">
        <LeftRail currentStep={currentStep} onStepClick={onStepClick} />
      </div>

      {/* Right pane — ivory, scrolls. */}
      <div
        data-seller-scroll
        className="relative flex min-h-screen flex-col lg:h-screen lg:min-h-0 lg:overflow-y-auto"
      >
        <MobileProgress currentStep={currentStep} />

        {/* Watch-how-it-works trigger, reachable from inside the stepper. */}
        {onWatchVideo && (
          <div className="flex justify-end px-6 pt-5 sm:px-10 lg:px-14">
            <button
              type="button"
              onClick={onWatchVideo}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
              style={{ borderColor: PALETTE.line, color: PALETTE.forest }}
            >
              <PlayCircle className="h-3.5 w-3.5" />
              Watch How It Works
            </button>
          </div>
        )}

        <div className="mx-auto w-full max-w-xl flex-1 px-6 py-8 sm:px-10 sm:py-12 lg:px-14">
          {children}
        </div>
      </div>
    </div>
  )
}

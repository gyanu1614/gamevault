/**
 * StepNav — the Back / Continue footer shared by the redesign's step screens.
 * Primary CTA is forest with a lime lift on hover; Back is a quiet outline.
 * The Continue button is a plain submit so each step's form validates before
 * advancing (react-hook-form handles the trigger via the form's onSubmit).
 */

'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PALETTE } from '../../theme'

interface StepNavProps {
  onBack?: () => void
  /** Label for the primary action (default "Continue"). */
  continueLabel?: string
  /** When true, disables the primary button (e.g. submitting). */
  submitting?: boolean
}

export default function StepNav({ onBack, continueLabel = 'Continue', submitting }: StepNavProps) {
  const [hover, setHover] = React.useState(false)

  return (
    <div className="flex items-center justify-between pt-2">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors"
          style={{ borderColor: PALETTE.line, color: PALETTE.ink2 }}
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
      ) : (
        <span />
      )}

      <button
        type="submit"
        disabled={submitting}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className="inline-flex items-center gap-1.5 rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-60"
        style={{
          backgroundColor: PALETTE.forest,
          boxShadow: hover ? `0 0 0 2px ${PALETTE.lime}` : 'none',
        }}
      >
        {continueLabel}
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

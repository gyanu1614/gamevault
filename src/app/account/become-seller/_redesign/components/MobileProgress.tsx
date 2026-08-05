/**
 * MobileProgress — on small screens the left rail collapses to this: a thin
 * lime progress bar + "Step X of Y" + the active step's label. Sticks to the
 * top of the right pane. Light world (forest text on ivory), lime fill only.
 */

'use client'

import { PALETTE, REDESIGN_STEPS } from '../theme'

interface MobileProgressProps {
  currentStep: number
  /** Optional step-list override (defaults to the seller app's 5 steps). */
  steps?: ReadonlyArray<{ id: number; label: string }>
}

export default function MobileProgress({
  currentStep,
  steps = REDESIGN_STEPS,
}: MobileProgressProps) {
  const active = steps.find((s) => s.id === currentStep)
  const pct = (currentStep / steps.length) * 100

  return (
    <div
      className="sticky top-0 z-20 border-b px-5 py-3 lg:hidden"
      style={{ backgroundColor: PALETTE.ivory, borderColor: PALETTE.line }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold" style={{ color: PALETTE.forest }}>
          {active?.label}
        </span>
        <span className="text-xs font-medium" style={{ color: PALETTE.ink2 }}>
          Step {currentStep} of {steps.length}
        </span>
      </div>
      <div
        className="h-1 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: PALETTE.line }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%`, backgroundColor: PALETTE.lime }}
        />
      </div>
    </div>
  )
}

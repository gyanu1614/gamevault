/**
 * Stepper — the vertical progress rail shown in the left panel (desktop). Five
 * nodes, NO subtext under labels. Completed = lime check, active = lime ring,
 * upcoming = muted. Colors come from the PALETTE (this shell is light-only).
 */

'use client'

import { Check } from 'lucide-react'
import { PALETTE, REDESIGN_STEPS } from '../theme'

interface StepperProps {
  /** 1-based index of the active step. */
  currentStep: number
  /**
   * Optional jump handler. When provided, completed steps become clickable so
   * the seller can go back and edit. Upcoming steps are never clickable.
   */
  onStepClick?: (step: number) => void
}

export default function Stepper({ currentStep, onStepClick }: StepperProps) {
  return (
    <ol className="flex flex-col gap-1" aria-label="Application progress">
      {REDESIGN_STEPS.map((step, i) => {
        const isCompleted = step.id < currentStep
        const isActive = step.id === currentStep
        const isLast = i === REDESIGN_STEPS.length - 1
        const clickable = isCompleted && !!onStepClick

        return (
          <li key={step.id} className="relative flex items-start gap-3">
            {/* Node + connector column */}
            <div className="flex flex-col items-center">
              <span
                aria-hidden
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors"
                style={
                  isCompleted
                    ? { backgroundColor: PALETTE.lime, color: PALETTE.forest3 }
                    : isActive
                      ? {
                          backgroundColor: 'transparent',
                          color: '#FFFFFF',
                          boxShadow: `0 0 0 2px ${PALETTE.lime}`,
                        }
                      : {
                          backgroundColor: 'rgba(255,255,255,0.08)',
                          color: 'rgba(255,255,255,0.45)',
                          boxShadow: '0 0 0 1px rgba(255,255,255,0.15)',
                        }
                }
              >
                {isCompleted ? <Check className="h-4 w-4" strokeWidth={3} /> : step.id}
              </span>
              {!isLast && (
                <span
                  aria-hidden
                  className="my-1 w-px flex-1 self-stretch"
                  style={{
                    minHeight: 22,
                    backgroundColor: isCompleted
                      ? PALETTE.lime
                      : 'rgba(255,255,255,0.15)',
                  }}
                />
              )}
            </div>

            {/* Label — no subtext */}
            <div className="pb-4 pt-1">
              {clickable ? (
                <button
                  type="button"
                  onClick={() => onStepClick?.(step.id)}
                  className="text-left text-sm font-medium transition-opacity hover:opacity-80"
                  style={{ color: 'rgba(255,255,255,0.85)' }}
                >
                  {step.label}
                </button>
              ) : (
                <span
                  className="text-sm font-medium"
                  style={{
                    color: isActive
                      ? '#FFFFFF'
                      : isCompleted
                        ? 'rgba(255,255,255,0.85)'
                        : 'rgba(255,255,255,0.45)',
                  }}
                  aria-current={isActive ? 'step' : undefined}
                >
                  {step.label}
                </span>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

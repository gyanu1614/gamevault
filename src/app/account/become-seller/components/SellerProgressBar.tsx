/**
 * SellerProgressBar Component
 *
 * Displays the 6-step progress indicator for the seller registration process.
 * Shows current step, completed steps, and upcoming steps with icons.
 *
 * Features:
 * - Visual step indicators with icons
 * - Current step highlighting
 * - Completed step markers
 * - Connecting lines between steps
 * - Responsive design
 */

'use client'

import { CheckCircle2 } from 'lucide-react'
import { STEPS } from '../constants'

interface SellerProgressBarProps {
  currentStep: number
}

export default function SellerProgressBar({ currentStep }: SellerProgressBarProps) {
  return (
    <div className="border-b border-white/5 bg-black/20 backdrop-blur-xl" data-progress-bar>
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between px-5 sm:px-6 md:px-8 lg:ml-1">
          {STEPS.map((step, index) => {
            const Icon = step.icon
            const isActive = currentStep === step.id
            const isCompleted = currentStep > step.id

            return (
              <div key={step.id} className="flex flex-1 items-center">
                <div className="flex flex-col items-center">
                  {/* Step Circle */}
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all sm:h-10 sm:w-10 md:h-11 md:w-11 ${
                      isCompleted
                        ? 'border-primary bg-primary/20'
                        : isActive
                        ? 'border-primary bg-black'
                        : 'border-white/10 bg-black/40'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary sm:h-4 sm:w-4 md:h-5 md:w-5" />
                    ) : (
                      <Icon
                        className={`h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 ${
                          isActive ? 'text-primary' : 'text-gray-500'
                        }`}
                      />
                    )}
                  </div>
                  {/* Step Name */}
                  <span
                    className={`mt-1 text-[9px] font-medium sm:mt-1.5 sm:text-[10px] md:text-xs ${
                      isActive
                        ? 'text-white'
                        : isCompleted
                        ? 'text-gray-400'
                        : 'text-gray-600'
                    }`}
                  >
                    {step.name}
                  </span>
                </div>

                {/* Connector Line */}
                {index < STEPS.length - 1 && (
                  <div
                    className={`mx-0.5 h-0.5 flex-1 sm:mx-1 md:mx-1.5 ${
                      currentStep > step.id ? 'bg-primary/40' : 'bg-white/5'
                    }`}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

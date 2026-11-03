'use client'

/** GameWizard footer: Back, Save and Continue / Continue, and Save Game on the last step. */

import type { Dispatch, SetStateAction } from 'react'
import { ArrowLeft, ArrowRight, CircleNotch, FloppyDisk } from '@phosphor-icons/react'
import { adminBtn } from '../../components/kit'

export function WizardFooter({
  step,
  setStep,
  setCompleted,
  isSaving,
  pending,
  canGoNext,
  handleSaveIdentity,
  handleFinalSave,
}: {
  step: number
  setStep: Dispatch<SetStateAction<number>>
  setCompleted: Dispatch<SetStateAction<Set<number>>>
  isSaving: boolean
  pending: boolean
  canGoNext: boolean
  handleSaveIdentity: (advance: boolean) => Promise<boolean>
  handleFinalSave: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] px-4 py-3 sm:px-6 sm:py-4">
      <button
        type="button"
        onClick={() => setStep((s) => Math.max(1, s - 1))}
        disabled={step === 1 || isSaving}
        className={adminBtn.secondary}
      >
        <ArrowLeft aria-hidden weight="bold" className="h-4 w-4" />
        Back
      </button>

      <div className="flex items-center gap-2">
        {step < 4 && (
          <button
            type="button"
            onClick={async () => {
              if (step === 1) {
                const ok = await handleSaveIdentity(true)
                if (!ok) return
              } else {
                setCompleted((p) => new Set(Array.from(p).concat(step)))
                setStep((s) => Math.min(4, s + 1))
              }
            }}
            disabled={!canGoNext || isSaving}
            className={adminBtn.primary}
          >
            {isSaving
              ? <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
              : <ArrowRight aria-hidden weight="bold" className="h-4 w-4" />}
            {step === 1 ? 'Save and Continue' : 'Continue'}
          </button>
        )}
        {step === 4 && (
          <button
            type="button"
            onClick={handleFinalSave}
            disabled={isSaving || pending}
            className={adminBtn.primary}
          >
            {isSaving || pending
              ? <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
              : <FloppyDisk aria-hidden weight="bold" className="h-4 w-4" />}
            Save Game
          </button>
        )}
      </div>
    </div>
  )
}

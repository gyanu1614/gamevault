import { ArrowRight, ChevronLeft, FileSpreadsheet, Loader2 } from 'lucide-react'

import Link from '@/components/navigation/AppLink'
import { cn } from '@/lib/utils'

import type { WizardStep } from './hooks/use-wizard-steps'
import { BTN_PRIMARY, BTN_PRIMARY_DISABLED, BTN_SECONDARY } from './styles'

/**
 * The action row at the end of the page, in flow (a fixed bar floated over
 * the content and stole height on phones). Left: Back, or Bulk upload on
 * step 1. Right: Continue, or the one primary action on step 3.
 */
export function WizardFooter({
  step,
  canContinue,
  canPublish,
  submitting,
  isEditMode,
  onBack,
  onContinue,
  onPublish,
}: {
  step: WizardStep
  canContinue: boolean
  canPublish: boolean
  submitting: boolean
  isEditMode: boolean
  onBack: () => void
  onContinue: () => void
  onPublish: () => void
}) {
  const publishEnabled = canPublish && !submitting
  return (
    <div className="mt-8 border-t border-border-subtle pt-5">
      <div className="flex w-full items-center justify-between gap-2">
        {step > 1 ? (
          <button type="button" onClick={onBack} disabled={submitting} className={cn(BTN_SECONDARY, 'disabled:opacity-40')}>
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
        ) : (
          <Link href="/sell/bulk" className={BTN_SECONDARY}>
            <FileSpreadsheet className="h-4 w-4" />
            Bulk Upload
          </Link>
        )}

        {step < 3 ? (
          <button type="button" onClick={onContinue} disabled={!canContinue} className={canContinue ? BTN_PRIMARY : BTN_PRIMARY_DISABLED}>
            Continue
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onPublish}
            disabled={!publishEnabled}
            // A min width stops the button shrinking to the spinner.
            className={cn(publishEnabled ? BTN_PRIMARY : BTN_PRIMARY_DISABLED, 'min-w-[136px]')}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : isEditMode ? 'Save Changes' : 'Create Offer'}
          </button>
        )}
      </div>
    </div>
  )
}

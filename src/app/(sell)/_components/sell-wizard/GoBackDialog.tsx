import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

import type { WizardStep } from './hooks/use-wizard-steps'
import { BTN_DANGER, BTN_SECONDARY } from './styles'

/** Unsaved-work guard: going back from Details re-picks the category or game, which clears the answers. */
export function GoBackDialog({
  target,
  onCancel,
  onConfirm,
}: {
  target: WizardStep | null
  onCancel: () => void
  onConfirm: (target: WizardStep) => void
}) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Go Back?</DialogTitle>
          <DialogDescription>
            Changing your {target === 1 ? 'category' : 'game'} clears the offer details you have filled in. This cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <button type="button" onClick={onCancel} className={BTN_SECONDARY}>
            Keep Editing
          </button>
          <button type="button" onClick={() => target && onConfirm(target)} className={BTN_DANGER}>
            Discard Details
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

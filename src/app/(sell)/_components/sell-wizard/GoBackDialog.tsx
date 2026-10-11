import WarningRounded from '@mui/icons-material/WarningRounded'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

import type { WizardStep } from './hooks/use-wizard-steps'
import { BTN_DANGER, BTN_SECONDARY } from './styles'

/**
 * Unsaved-work guard: going back from Details re-picks the category or game,
 * which clears the answers. A lifted card with no outline, an icon tile and
 * two full-width actions (the wizard's popup style).
 */
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
      <DialogContent className="gap-0 border-0 bg-[linear-gradient(180deg,#23242A,#1C1D22)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_30px_80px_-20px_rgba(0,0,0,0.9)] rounded-t-[20px] sm:max-w-[420px] sm:rounded-[20px]">
        <span aria-hidden className="grid h-11 w-11 place-items-center rounded-xl bg-[rgba(229,160,60,0.14)] text-[#E5A03C]">
          <WarningRounded style={{ fontSize: 22 }} />
        </span>
        <DialogHeader className="mt-4 space-y-1.5 text-left">
          <DialogTitle className="text-[18px] font-semibold">Go Back?</DialogTitle>
          <DialogDescription className="text-[14px] leading-relaxed text-text-secondary">
            Changing your {target === 1 ? 'category' : 'game'} clears the offer details you have filled in. This cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-6 flex-row gap-2.5 sm:gap-2.5 sm:space-x-0">
          <button type="button" onClick={onCancel} className={`${BTN_SECONDARY} flex-1`}>
            Keep Editing
          </button>
          <button type="button" onClick={() => target && onConfirm(target)} className={`${BTN_DANGER} flex-1`}>
            Discard Details
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { escalateDispute } from '@/lib/actions/admin-disputes'
import { CircleNotch, WarningOctagon } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { accountInputCls } from '@/components/account/AccountSurface'
import { adminBtn } from '@/app/(admin)/admin/components/kit'

interface EscalateDisputeModalProps {
  isOpen: boolean
  onClose: () => void
  dispute: {
    id: string
    title: string
    buyer_username: string
    seller_username: string
  }
}

export default function EscalateDisputeModal({
  isOpen,
  onClose,
  dispute,
}: EscalateDisputeModalProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    // Validation
    if (!reason.trim()) {
      toast.error('Please provide an escalation reason')
      return
    }

    setIsSubmitting(true)

    try {
      const result = await escalateDispute(dispute.id, reason.trim())

      if (!result.success) {
        throw new Error(result.error || 'Failed to escalate dispute')
      }

      toast.success('Dispute escalated to senior moderator')

      // Invalidate dispute query to refresh UI and show escalation banner
      await queryClient.invalidateQueries({ queryKey: ['dispute', dispute.id] })

      handleClose()
      router.refresh()
    } catch (error) {
      console.error('Error escalating dispute:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to escalate dispute')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      setReason('')
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-[480px] border-0 p-5 sm:p-6">
        <div className="pr-8">
          <DialogTitle className="text-[18px] font-bold">Escalate to Senior Moderator</DialogTitle>
          <DialogDescription className="mt-1.5 leading-relaxed">
            Flags the dispute as urgent and assigns it to a senior moderator.
          </DialogDescription>
        </div>

        <div className="space-y-4">
          <div className="rounded-md bg-bg-overlay px-4 py-3">
            <p className="text-[14px] font-medium text-text-primary">{dispute.title}</p>
            <p className="mt-0.5 text-[12.5px] text-text-tertiary">
              {dispute.buyer_username} vs {dispute.seller_username}
            </p>
          </div>

          <div className="rounded-md bg-warning-bg px-4 py-3">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-warning">
              <WarningOctagon aria-hidden weight="bold" className="h-4 w-4" /> What Escalating Does
            </p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[12.5px] text-text-secondary">
              <li>Priority becomes <span className="font-semibold text-text-primary">Urgent</span></li>
              <li>Status becomes <span className="font-semibold text-text-primary">Escalated</span></li>
              <li>Assigned to the senior moderator team</li>
              <li>Both parties are notified</li>
            </ul>
          </div>

          <div>
            <label htmlFor="reason" className="mb-1.5 block text-[13px] font-medium text-text-secondary">
              Escalation Reason <span className="text-error">*</span>
            </label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why does this need senior attention? Complexity, policy concerns, special circumstances…"
              rows={4}
              className={cn(accountInputCls, 'resize-none')}
              required
            />
            <p className="mt-1.5 text-[12.5px] text-text-tertiary">Visible to senior moderators and kept in internal logs.</p>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={handleClose} disabled={isSubmitting} className={adminBtn.secondary}>
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={isSubmitting || !reason.trim()} className={adminBtn.danger}>
            {isSubmitting ? (
              <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
            ) : (
              <WarningOctagon aria-hidden weight="bold" className="h-4 w-4" />
            )}
            {isSubmitting ? 'Escalating…' : 'Escalate Dispute'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { escalateDispute } from '@/lib/actions/admin-disputes'
import { AlertOctagon, Loader2 } from 'lucide-react'

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
      <DialogContent className="sm:max-w-[500px] rounded-xl border-border-default bg-bg-raised">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-text-primary flex items-center gap-2">
            <AlertOctagon className="h-5 w-5 text-red-400" />
            Escalate to Senior Moderator
          </DialogTitle>
          <DialogDescription className="text-text-secondary">
            This dispute will be flagged as urgent and assigned to a senior moderator for review.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Dispute Info */}
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <div className="text-xs text-red-400 font-semibold mb-1">Dispute</div>
            <div className="text-sm font-medium text-text-primary mb-2">
              {dispute.title}
            </div>
            <div className="text-xs text-text-secondary">
              {dispute.buyer_username} vs {dispute.seller_username}
            </div>
          </div>

          {/* Escalation Warning */}
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertOctagon className="h-5 w-5 text-yellow-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-yellow-400 mb-1">
                  Escalation Impact
                </p>
                <ul className="text-xs text-text-secondary space-y-1">
                  <li>• Priority changed to <span className="text-red-400 font-semibold">URGENT</span></li>
                  <li>• Status changed to <span className="text-red-400 font-semibold">ESCALATED</span></li>
                  <li>• Assigned to senior moderator team</li>
                  <li>• Both parties will be notified</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Escalation Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason" className="text-sm font-semibold text-text-primary">
              Escalation Reason <span className="text-red-400">*</span>
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this dispute requires senior moderator attention. Include any complexity, policy concerns, or special circumstances."
              className="min-h-[120px] rounded-lg bg-bg-base border-border-default text-text-primary placeholder:text-text-tertiary focus:border-lime focus:outline-none"
              required
            />
            <p className="text-xs text-text-tertiary">
              This note will be visible to senior moderators and included in internal logs.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
            className="border-border-default bg-bg-overlay text-text-secondary hover:bg-bg-raised-hover hover:text-text-primary"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !reason.trim()}
            className="bg-red-500 hover:bg-red-600 text-white font-bold"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Escalating...
              </>
            ) : (
              <>
                <AlertOctagon className="mr-2 h-4 w-4" />
                Escalate Dispute
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

'use client'

/**
 * DisputeModal — V21/P7.a
 *
 * Controlled dispute modal used by every "Open Dispute" CTA on the
 * order page (status strip, SafeDrop CTA, action panel). Lifts the
 * dispute UI out of the legacy `OpenDisputeButton` which bundled
 * its own visible trigger — here the parent owns the open state so
 * multiple CTAs can share a single modal instance.
 *
 * Submission path is identical to OpenDisputeButton: openDispute
 * server action + chat system message + router.refresh.
 */

import { useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { openDispute } from '@/lib/actions/orders'
import { messagesApi } from '@/lib/api/seller-compatible'

const DISPUTE_CATEGORIES = [
  'Item Not As Described',
  'Did Not Receive Order',
  'Wrong Item Received',
  'Account Credentials Invalid',
  'Other',
] as const

interface DisputeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  conversationId?: string | null
}

export function DisputeModal({ open, onOpenChange, orderId, conversationId }: DisputeModalProps) {
  const [submitting, setSubmitting] = useState(false)
  const [category, setCategory] = useState<string>('')
  const [reason, setReason] = useState('')
  const router = useRouter()

  const canSubmit = !!category && reason.trim().length >= 10 && !submitting

  function reset() {
    setCategory('')
    setReason('')
    setSubmitting(false)
  }

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const res = await openDispute(orderId, category, reason.trim())
      if (!res.success) {
        toast.error(res.error || 'Failed to open dispute')
        setSubmitting(false)
        return
      }
      // Notify the seller in chat — non-fatal if it fails.
      if (conversationId) {
        try {
          await messagesApi.sendSmartActionMessage(
            conversationId,
            'disputed',
            `I've opened a dispute for this order.`,
          )
        } catch (err) {
          console.warn('[DisputeModal] chat notify failed', err)
        }
      }
      toast.success('Dispute opened. Support reviews within 24 hours.')
      router.refresh()
      setTimeout(() => {
        onOpenChange(false)
        reset()
      }, 400)
    } catch (e: any) {
      console.error('[DisputeModal] submit failed', e)
      toast.error(e?.message ?? 'An error occurred. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (submitting) return
        onOpenChange(o)
        if (!o) reset()
      }}
    >
      {/* Mirror MarkReceivedModal exactly — same DialogContent class
          string, same DialogHeader gap, same title scale, same body
          rhythm. The only thing that differs is body content + the
          tone color (red instead of lime). */}
      <DialogContent className="max-w-[640px] gap-5 border-border-default bg-bg-raised p-7 sm:p-8">
        <DialogHeader className="gap-2">
          <DialogTitle className="text-[26px] font-bold tracking-tight">
            Open A Dispute
          </DialogTitle>
          <DialogDescription className="text-[15px] leading-[1.5] text-text-secondary">
            A DropMarket admin reviews disputes within 24 hours. Funds stay held until the case resolves.
          </DialogDescription>
        </DialogHeader>

        <div>
          <Label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-text-secondary">
            What&rsquo;s The Issue?
          </Label>
          <div className="flex flex-wrap gap-2">
            {DISPUTE_CATEGORIES.map((c) => {
              const active = category === c
              return (
                <Button
                  key={c}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCategory(c)}
                  className={cn(
                    'border-border-default bg-bg-overlay text-[13px] font-semibold text-text-secondary',
                    'hover:border-white/[0.18] hover:bg-bg-overlay hover:text-text-primary',
                    active &&
                      'border-red-500/40 bg-red-500/[0.10] text-red-400 hover:border-red-500/40 hover:bg-red-500/[0.10] hover:text-red-400',
                  )}
                >
                  {c}
                </Button>
              )
            })}
          </div>
        </div>

        <div>
          <Label
            htmlFor="dispute-reason"
            className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-text-secondary"
          >
            Describe What Happened
          </Label>
          <Textarea
            id="dispute-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="A short note helps support resolve faster — what was expected, what arrived, any timestamps."
            className="resize-none text-[14.5px] leading-[1.55]"
          />
          <div className="mt-1.5 text-[12px] text-text-tertiary">
            {reason.trim().length < 10
              ? `${10 - reason.trim().length} more character${10 - reason.trim().length === 1 ? '' : 's'} required`
              : 'Looks good.'}
          </div>
        </div>

        <div className="mt-1 flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="h-12 px-5 text-[15px] font-semibold"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            variant="destructive"
            className="h-12 px-6 text-[15px] font-bold shadow-[0_6px_18px_rgba(239,68,68,0.22)]"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-[18px] w-[18px] animate-spin" />
                Opening…
              </>
            ) : (
              <>
                <AlertCircle className="mr-2 h-[18px] w-[18px]" />
                Open Dispute
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

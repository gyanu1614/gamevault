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
import { Loader2, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { OrderModal, modalButton, modalField } from './_OrderModal'
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
      toast.success('Dispute opened. Support reviews within 24 to 48 hours.')
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
    <OrderModal
      open={open}
      onOpenChange={(o) => {
        if (submitting) return
        onOpenChange(o)
        if (!o) reset()
      }}
      icon={ShieldAlert}
      tone="warning"
      title="Open A Dispute"
      description="A DropMarket admin reviews disputes within 24 to 48 hours. Your order stays open until then."
      footer={
        <>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className={modalButton('ghost')}
          >
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={!canSubmit} className={modalButton('warning')}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Opening
              </>
            ) : (
              <>
                <ShieldAlert className="h-4 w-4" aria-hidden />
                Open Dispute
              </>
            )}
          </button>
        </>
      }
    >
      <div className="mt-3.5">
        <p className="mb-1.5 text-[12.5px] font-semibold text-text-secondary">What&rsquo;s The Issue?</p>
        <div className="flex flex-wrap gap-1.5">
          {DISPUTE_CATEGORIES.map((c) => {
            const active = category === c
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                aria-pressed={active}
                className={cn(
                  'rounded-[8px] border px-2.5 py-1 text-[12.5px] font-semibold transition-colors',
                  active
                    ? 'border-[rgba(255,178,62,0.4)] bg-warning-bg text-warning'
                    : 'border-white/10 bg-white/[0.02] text-text-secondary hover:border-white/20 hover:text-text-primary',
                )}
              >
                {c}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-3.5">
        <label htmlFor="dispute-reason" className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary">
          Describe What Happened
        </label>
        <textarea
          id="dispute-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="What you expected, what arrived, and when."
          className={cn(modalField, 'resize-none')}
        />
        <div className="mt-1 text-[12px] text-text-tertiary">
          {reason.trim().length < 10
            ? `${10 - reason.trim().length} more character${10 - reason.trim().length === 1 ? '' : 's'} needed`
            : 'Looks good.'}
        </div>
      </div>
    </OrderModal>
  )
}

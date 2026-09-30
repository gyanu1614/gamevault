'use client'

/**
 * RequestCancelModal: the buyer asks DropMarket to cancel a long-delivery
 * order (6 h+, an hour after payment). An admin decides; if approved the
 * buyer is refunded in full to their DropMarket wallet.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ban, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { createCancellationRequest } from '@/lib/actions/order-cancellation'
import { OrderModal, modalButton, modalField } from './_OrderModal'

export function RequestCancelModal({
  open,
  onOpenChange,
  orderId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
}) {
  const router = useRouter()
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const short = reason.trim().length < 10

  function close(o: boolean) {
    if (submitting) return
    onOpenChange(o)
    if (!o) setReason('')
  }

  async function submit() {
    if (short || submitting) return
    setSubmitting(true)
    const res = await createCancellationRequest(orderId, reason.trim())
    setSubmitting(false)
    if (res.error) {
      toast.error(res.error.message)
      return
    }
    toast.success('Cancellation requested. DropMarket will review it.')
    close(false)
    router.refresh()
  }

  return (
    <OrderModal
      open={open}
      onOpenChange={close}
      icon={Ban}
      tone="warning"
      title="Request Cancellation"
      description="Tell us why. DropMarket reviews it; if approved, your refund goes to your Store Balance as store credit. The service fee is only refunded when the seller is at fault."
      footer={
        <>
          <button type="button" onClick={() => close(false)} disabled={submitting} className={modalButton('ghost')}>
            Keep Order
          </button>
          <button type="button" onClick={submit} disabled={short || submitting} className={modalButton('warning')}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Sending
              </>
            ) : (
              'Request Cancellation'
            )}
          </button>
        </>
      }
    >
      <div className="mt-3.5">
        <label htmlFor="cancel-reason" className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary">
          Reason
        </label>
        <textarea
          id="cancel-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="For example: the seller hasn't started and I no longer need it"
          className={cn(modalField, 'resize-none')}
        />
        <div className="mt-1 text-[12px] text-text-tertiary">
          {short
            ? `${10 - reason.trim().length} more character${10 - reason.trim().length === 1 ? '' : 's'} needed`
            : 'Looks good.'}
        </div>
      </div>
    </OrderModal>
  )
}

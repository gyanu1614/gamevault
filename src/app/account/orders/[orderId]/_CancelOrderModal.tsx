'use client'

/**
 * CancelOrderModal: the seller cancels an order they can't fulfil. Pick a
 * reason (note required for Other), confirm; the buyer is refunded in full
 * to their DropMarket wallet and the chat shows why.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { sellerCancelOrder } from '@/lib/actions/orders'
import { SELLER_CANCEL_REASONS, validateSellerCancel } from '@/lib/orders/seller-cancel-reasons'
import { OrderModal, modalButton, modalField } from './_OrderModal'

export function CancelOrderModal({
  open,
  onOpenChange,
  orderId,
  amount,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  /** What the buyer paid (refunded to their wallet). */
  amount: number
}) {
  const router = useRouter()
  const [reason, setReason] = useState<string>('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const problem = validateSellerCancel(reason, note)

  function close(o: boolean) {
    if (submitting) return
    onOpenChange(o)
    if (!o) {
      setReason('')
      setNote('')
    }
  }

  async function submit() {
    if (problem || submitting) return
    setSubmitting(true)
    const res = await sellerCancelOrder(orderId, reason, note.trim() || undefined)
    setSubmitting(false)
    if (!res.success) {
      toast.error(res.error ?? 'Could not cancel the order')
      return
    }
    toast.success('Order cancelled. The buyer was refunded to their wallet.')
    close(false)
    router.refresh()
  }

  return (
    <OrderModal
      open={open}
      onOpenChange={close}
      icon={XCircle}
      tone="red"
      title="Cancel Order"
      description={`Can't fulfil this order? The buyer gets $${amount.toFixed(2)} back in their DropMarket wallet right away.`}
      footer={
        <>
          <button type="button" onClick={() => close(false)} disabled={submitting} className={modalButton('ghost')}>
            Keep Order
          </button>
          <button type="button" onClick={submit} disabled={!!problem || submitting} className={modalButton('danger')}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Cancelling
              </>
            ) : (
              'Cancel Order'
            )}
          </button>
        </>
      }
    >
      <div className="mt-3.5">
        <p className="mb-1.5 text-[12.5px] font-semibold text-text-secondary">Reason</p>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Reason">
          {SELLER_CANCEL_REASONS.map((r) => {
            const active = reason === r.id
            return (
              <button
                key={r.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setReason(r.id)}
                className={cn(
                  'rounded-[8px] border px-2.5 py-1 text-[12.5px] font-semibold transition-colors',
                  active
                    ? 'border-red-400/40 bg-red-400/[0.10] text-red-400'
                    : 'border-white/10 bg-white/[0.02] text-text-secondary hover:border-white/20 hover:text-text-primary',
                )}
              >
                {r.label}
              </button>
            )
          })}
        </div>
      </div>
      <div className="mt-3.5">
        <label htmlFor="cancel-note" className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary">
          Note To The Buyer {reason === 'other' ? '' : '(Optional)'}
        </label>
        <textarea
          id="cancel-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="A short note, shown in the chat"
          className={cn(modalField, 'resize-none')}
        />
      </div>
    </OrderModal>
  )
}

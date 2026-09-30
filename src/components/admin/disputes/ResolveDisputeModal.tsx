'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { resolveDispute } from '@/lib/actions/admin-disputes'
import {
  ArrowsSplit,
  CheckCircle,
  CircleNotch,
  CurrencyDollar,
  XCircle,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { accountInputCls } from '@/components/account/AccountSurface'
import { adminBtn } from '@/app/(admin)/admin/components/kit'

interface ResolveDisputeModalProps {
  isOpen: boolean
  onClose: () => void
  dispute: {
    id: string
    title: string
    disputed_amount: number
    currency: string
    buyer_username: string
    seller_username: string
  }
}

type ResolutionDecision = 'buyer_favor' | 'seller_favor' | 'partial' | 'dismiss'

export default function ResolveDisputeModal({
  isOpen,
  onClose,
  dispute,
}: ResolveDisputeModalProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [decision, setDecision] = useState<ResolutionDecision>('buyer_favor')
  const [partialAmount, setPartialAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    // Validation
    if (!notes.trim()) {
      toast.error('Please provide resolution notes')
      return
    }

    if (decision === 'partial') {
      const amount = parseFloat(partialAmount)
      if (!amount || amount <= 0 || amount > dispute.disputed_amount) {
        toast.error(`Partial refund must be between $0.01 and $${dispute.disputed_amount.toFixed(2)}`)
        return
      }
    }

    setIsSubmitting(true)

    try {
      // Map decision to resolution parameters
      let status: 'resolved_buyer_favor' | 'resolved_seller_favor' | 'resolved_partial'
      let resolutionType: 'refund_full' | 'refund_partial' | 'no_refund' | 'replacement' | 'other'
      let resolvedAmount: number | undefined

      switch (decision) {
        case 'buyer_favor':
          status = 'resolved_buyer_favor'
          resolutionType = 'refund_full'
          resolvedAmount = dispute.disputed_amount
          break
        case 'seller_favor':
          status = 'resolved_seller_favor'
          resolutionType = 'no_refund'
          resolvedAmount = 0
          break
        case 'partial':
          status = 'resolved_partial'
          resolutionType = 'refund_partial'
          resolvedAmount = parseFloat(partialAmount)
          break
        case 'dismiss':
          status = 'resolved_seller_favor' // Dismiss = no action, seller keeps money
          resolutionType = 'other'
          resolvedAmount = 0
          break
      }

      const result = await resolveDispute(dispute.id, {
        status,
        resolutionType,
        resolvedAmount,
        notes: notes.trim(),
      })

      if (!result.success) {
        throw new Error(result.error || 'Failed to resolve dispute')
      }

      toast.success('Dispute resolved successfully')

      // Invalidate dispute query to refresh UI
      await queryClient.invalidateQueries({ queryKey: ['dispute', dispute.id] })

      onClose()
      router.refresh()
    } catch (error) {
      console.error('Error resolving dispute:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to resolve dispute')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      setDecision('buyer_favor')
      setPartialAmount('')
      setNotes('')
      onClose()
    }
  }

  const options: { value: ResolutionDecision; title: string; sub: string; icon: PhosphorIcon }[] = [
    { value: 'buyer_favor', title: 'Favor Buyer', sub: 'Full refund · seller $0', icon: CurrencyDollar },
    { value: 'seller_favor', title: 'Favor Seller', sub: 'Seller paid out · no refund', icon: CheckCircle },
    { value: 'partial', title: 'Partial Refund', sub: 'Split the amount', icon: ArrowsSplit },
    { value: 'dismiss', title: 'Dismiss', sub: 'Close without action', icon: XCircle },
  ]

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-[480px] border-0 p-5 sm:p-6">
        <div className="pr-8">
          <DialogTitle className="text-[18px] font-bold">Resolve Dispute</DialogTitle>
          <DialogDescription className="mt-1.5">
            ${dispute.disputed_amount.toFixed(2)} · {dispute.buyer_username} vs {dispute.seller_username}
          </DialogDescription>
        </div>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-[13px] font-medium text-text-secondary">Resolution Decision</p>
            <RadioGroup value={decision} onValueChange={(value) => setDecision(value as ResolutionDecision)} className="gap-2">
              {options.map((o) => {
                const selected = decision === o.value
                const Icon = o.icon
                return (
                  <div
                    key={o.value}
                    className={cn(
                      'rounded-md transition-colors',
                      selected ? 'bg-white/[0.09] ring-1 ring-inset ring-white/[0.12]' : 'bg-bg-overlay hover:bg-bg-overlay-2',
                    )}
                  >
                    <label htmlFor={o.value} className="flex cursor-pointer items-center gap-3 p-3">
                      <RadioGroupItem value={o.value} id={o.value} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-medium text-text-primary">{o.title}</span>
                        <span className="block text-[12.5px] text-text-tertiary">{o.sub}</span>
                      </span>
                      <Icon aria-hidden weight="bold" className="h-4 w-4 shrink-0 text-text-tertiary" />
                    </label>

                    {o.value === 'partial' && selected && (
                      <div className="border-t border-white/[0.06] px-3 pb-3 pt-3">
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-text-tertiary">$</span>
                          <input
                            id="partialAmount"
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0.01"
                            max={dispute.disputed_amount}
                            value={partialAmount}
                            onChange={(e) => setPartialAmount(e.target.value)}
                            placeholder="0.00"
                            aria-label="Partial refund amount"
                            className={cn(accountInputCls, 'pl-7')}
                          />
                        </div>
                        {partialAmount && parseFloat(partialAmount) > 0 && (
                          <p className="mt-1.5 text-[12.5px] text-text-tertiary">
                            Seller gets ${(dispute.disputed_amount - parseFloat(partialAmount || '0')).toFixed(2)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </RadioGroup>
          </div>

          <div>
            <label htmlFor="notes" className="mb-1.5 block text-[13px] font-medium text-text-secondary">
              Resolution Notes <span className="text-error">*</span>
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Explain your decision. Both parties will see this."
              rows={3}
              className={cn(accountInputCls, 'resize-none')}
              required
            />
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={handleClose} disabled={isSubmitting} className={adminBtn.secondary}>
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={isSubmitting || !notes.trim()} className={adminBtn.primary}>
            {isSubmitting && <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />}
            {isSubmitting ? 'Resolving…' : 'Resolve Dispute'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

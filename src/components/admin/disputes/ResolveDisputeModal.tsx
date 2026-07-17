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
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { resolveDispute } from '@/lib/actions/admin-disputes'
import { CheckCircle, DollarSign, XCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

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

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px] max-h-[85dvh] rounded-xl border-border-default bg-bg-raised">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-text-primary">
            Resolve Dispute
          </DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            ${dispute.disputed_amount.toFixed(2)} · {dispute.buyer_username} vs {dispute.seller_username}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">

          {/* Resolution Decision */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-text-secondary">Resolution Decision</Label>
            <RadioGroup value={decision} onValueChange={(value) => setDecision(value as ResolutionDecision)}>
              {/* Favor Buyer */}
              <div
                className={cn(
                  'flex items-center gap-3 border rounded-lg p-3 cursor-pointer transition-all',
                  decision === 'buyer_favor'
                    ? 'bg-green-500/10 border-green-500/30 shadow-sm'
                    : 'bg-bg-overlay border-border-subtle hover:border-border-default'
                )}
                onClick={() => setDecision('buyer_favor')}
              >
                <RadioGroupItem value="buyer_favor" id="buyer_favor" />
                <div className="flex-1 min-w-0">
                  <Label htmlFor="buyer_favor" className="text-sm font-medium text-text-primary cursor-pointer">
                    Favor Buyer
                  </Label>
                  <p className="text-xs text-text-tertiary mt-0.5">
                    Full refund · Seller $0
                  </p>
                </div>
                <DollarSign className="h-4 w-4 text-green-400 flex-shrink-0" />
              </div>

              {/* Favor Seller */}
              <div
                className={cn(
                  'flex items-center gap-3 border rounded-lg p-3 cursor-pointer transition-all',
                  decision === 'seller_favor'
                    ? 'bg-lime-tint-bg border-lime-tint-border shadow-sm'
                    : 'bg-bg-overlay border-border-subtle hover:border-border-default'
                )}
                onClick={() => setDecision('seller_favor')}
              >
                <RadioGroupItem value="seller_favor" id="seller_favor" />
                <div className="flex-1 min-w-0">
                  <Label htmlFor="seller_favor" className="text-sm font-medium text-text-primary cursor-pointer">
                    Favor Seller
                  </Label>
                  <p className="text-xs text-text-tertiary mt-0.5">
                    Seller paid out · No refund
                  </p>
                </div>
                <CheckCircle className="h-4 w-4 text-lime-text flex-shrink-0" />
              </div>

              {/* Partial Refund */}
              <div
                className={cn(
                  'border rounded-lg cursor-pointer transition-all',
                  decision === 'partial'
                    ? 'bg-blue-500/10 border-blue-500/30 shadow-sm'
                    : 'bg-bg-overlay border-border-subtle hover:border-border-default'
                )}
                onClick={() => setDecision('partial')}
              >
                <div className="flex items-center gap-3 p-3">
                  <RadioGroupItem value="partial" id="partial" />
                  <div className="flex-1 min-w-0">
                    <Label htmlFor="partial" className="text-sm font-medium text-text-primary cursor-pointer">
                      Partial Refund
                    </Label>
                    <p className="text-xs text-text-tertiary mt-0.5">
                      Split amount
                    </p>
                  </div>
                  <DollarSign className="h-4 w-4 text-blue-400 flex-shrink-0" />
                </div>

                {/* Partial Amount Input */}
                {decision === 'partial' && (
                  <div className="px-3 pb-3 pt-1 border-t border-border-subtle">
                    <div className="relative mt-2">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-text-tertiary">$</span>
                      <Input
                        id="partialAmount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={dispute.disputed_amount}
                        value={partialAmount}
                        onChange={(e) => setPartialAmount(e.target.value)}
                        placeholder="0.00"
                        className="pl-6 h-8 text-sm rounded-lg bg-bg-base border-border-default text-text-primary focus:border-lime focus:outline-none"
                      />
                    </div>
                    {partialAmount && parseFloat(partialAmount) > 0 && (
                      <p className="text-xs text-text-tertiary mt-1.5">
                        Seller gets ${(dispute.disputed_amount - parseFloat(partialAmount || '0')).toFixed(2)}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Dismiss */}
              <div
                className={cn(
                  'flex items-center gap-3 border rounded-lg p-3 cursor-pointer transition-all',
                  decision === 'dismiss'
                    ? 'bg-bg-overlay-2 border-border-strong shadow-sm'
                    : 'bg-bg-overlay border-border-subtle hover:border-border-default'
                )}
                onClick={() => setDecision('dismiss')}
              >
                <RadioGroupItem value="dismiss" id="dismiss" />
                <div className="flex-1 min-w-0">
                  <Label htmlFor="dismiss" className="text-sm font-medium text-text-primary cursor-pointer">
                    Dismiss
                  </Label>
                  <p className="text-xs text-text-tertiary mt-0.5">
                    Close without action
                  </p>
                </div>
                <XCircle className="h-4 w-4 text-text-secondary flex-shrink-0" />
              </div>
            </RadioGroup>
          </div>

          {/* Resolution Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs font-medium text-text-secondary">
              Resolution Notes <span className="text-red-400">*</span>
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Explain your decision. Both parties will see this."
              className="min-h-[80px] text-sm rounded-lg bg-bg-base border-border-default text-text-primary placeholder:text-text-tertiary focus:border-lime focus:outline-none"
              required
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
            className="h-9 border-border-default bg-bg-overlay text-text-secondary hover:bg-bg-raised-hover hover:text-text-primary text-sm"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !notes.trim()}
            className="h-9 bg-lime-pressed hover:bg-lime text-text-inverse font-bold text-sm"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Resolving...
              </>
            ) : (
              'Resolve Dispute'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

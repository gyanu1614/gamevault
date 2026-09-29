'use client'

/**
 * MarkReceivedModal: the buyer's Confirm Delivery (or Mark As Received,
 * which also closes their dispute) and the standalone Leave A Review form,
 * in the shared OrderModal shell. Confirm: one warning line + the amount
 * covered. Review: Recommend / Don't Recommend, quick chips, a note.
 */

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Shield, Loader2, ThumbsUp, ThumbsDown, CheckCircle2, PackageCheck, MessageSquareHeart } from 'lucide-react'
import { OrderModal, modalButton, modalField } from './_OrderModal'
import { confirmOrderReceipt } from '@/lib/actions/orders'
import { createReview } from '@/lib/api/reviews'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface MarkReceivedModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  amount: number
  onConfirmed?: () => void
  /** 'confirm' = full Confirm Receipt + Review flow.
   *  'review'  = standalone Review form for an already-completed order. */
  mode?: 'confirm' | 'review'
  /** The order is disputed: confirming also closes the buyer's dispute
   *  (same action; only the copy changes). */
  closesDispute?: boolean
}

const POSITIVE_CHIPS = [
  'Fast delivery',
  'Exactly as described',
  'Great communication',
  'Would buy again',
]

const NEGATIVE_CHIPS = [
  'Slow delivery',
  'Items missing',
  'Wrong item',
  'Hard to reach',
]

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`
}

export function MarkReceivedModal({
  open,
  onOpenChange,
  orderId,
  amount,
  onConfirmed,
  mode = 'confirm',
  closesDispute = false,
}: MarkReceivedModalProps) {
  const [rating, setRating] = useState<'positive' | 'negative' | null>(null)
  const [comment, setComment] = useState('')
  const [pickedChips, setPickedChips] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  // V21/P5.p — Confirm flow no longer requires a review (it lives
  // on the post-completion strip via Leave Review). Confirm is
  // always submittable; review-only mode still needs rating + comment.
  const canSubmit =
    mode === 'review'
      ? rating !== null && comment.trim().length >= 10 && !submitting
      : !submitting

  function toggleChip(chip: string) {
    setPickedChips((picked) => {
      const next = picked.includes(chip)
        ? picked.filter((c) => c !== chip)
        : [...picked, chip]
      // Sync comment with selected chips (only append; user can edit).
      const chipText = next.join(' · ')
      const userTail = comment.replace(/^([A-Za-z ·]+)?(\s-\s)?/, '')
      setComment(chipText ? `${chipText}${userTail ? ' - ' + userTail : ''}` : userTail)
      return next
    })
  }

  function reset() {
    setRating(null)
    setComment('')
    setPickedChips([])
    setSubmitting(false)
  }

  async function handleConfirm() {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      // V21/P5.m — Review-only mode skips confirmOrderReceipt (the
      // order is already completed). Just submits the review.
      if (mode === 'review') {
        const { data, error } = await createReview({
          orderId,
          rating: rating === 'positive' ? 5 : 1,
          recommendsSeller: rating === 'positive',
          comment: comment.trim(),
        } as any)
        if (error || !data) {
          toast.error((error as any)?.message ?? 'Could not submit review')
          setSubmitting(false)
          return
        }
        toast.success('Review submitted')
        onConfirmed?.()
        setTimeout(() => {
          onOpenChange(false)
          reset()
        }, 500)
        return
      }

      // V21/P5.p — Confirm flow is just the receipt confirmation now.
      // Review is its own step on the completed-state strip ("Leave
      // Review" CTA → opens this same modal in review mode).
      const res = await confirmOrderReceipt(orderId)
      if (!res.success) {
        toast.error(res.error ?? 'Could not confirm delivery')
        setSubmitting(false)
        return
      }

      toast.success('Delivery confirmed. Your order is complete.')
      onConfirmed?.()
      setTimeout(() => {
        onOpenChange(false)
        reset()
      }, 500)
    } catch (e: any) {
      console.error('confirmOrderReceipt failed', e)
      toast.error(e?.message ?? 'Could not confirm delivery')
      setSubmitting(false)
    }
  }

  const chips = rating === 'negative' ? NEGATIVE_CHIPS : POSITIVE_CHIPS
  const title =
    mode === 'review' ? 'Leave A Review' : closesDispute ? 'Mark As Received' : 'Confirm Delivery'

  return (
    <OrderModal
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) reset()
      }}
      icon={mode === 'review' ? MessageSquareHeart : PackageCheck}
      title={title}
      description={
        mode === 'review'
          ? 'Share your experience to help other buyers.'
          : closesDispute
            ? 'Confirm you received your order. This closes your dispute and completes the order.'
            : 'Confirm you received your order and it is complete.'
      }
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
          <button type="button" onClick={handleConfirm} disabled={!canSubmit} className={modalButton('primary')}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {mode === 'review' ? 'Submitting' : 'Confirming'}
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                {mode === 'review' ? 'Submit Review' : 'Confirm'}
              </>
            )}
          </button>
        </>
      }
    >
      {/* Confirming: one warning line + the amount, nothing else. */}
      {mode === 'confirm' && (
        <div className="mt-3.5 space-y-2.5">
          <div className="flex items-start gap-2 rounded-[9px] border border-[rgba(255,178,62,0.25)] bg-warning-bg px-3 py-2.5 text-[13px] leading-[1.45] text-text-primary">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" aria-hidden />
            <span>
              <span className="font-bold text-warning">Only confirm</span> if you received your order in full.
            </span>
          </div>
          <div className="flex items-center justify-between rounded-[9px] border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
            <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-text-secondary">
              <Shield className="h-4 w-4 text-lime-text" aria-hidden />
              Amount Covered
            </span>
            <span className="text-[16px] font-extrabold tabular-nums text-text-primary">{fmtUsd(amount)}</span>
          </div>
        </div>
      )}

      {mode === 'review' && (
        <div className="mt-3.5">
          <div className="flex items-center gap-2">
            <RatingButton
              active={rating === 'positive'}
              tone="positive"
              onClick={() => setRating('positive')}
              label="Recommend"
            />
            <RatingButton
              active={rating === 'negative'}
              tone="negative"
              onClick={() => setRating('negative')}
              label="Don't Recommend"
            />
          </div>

          <AnimatePresence initial={false}>
            {rating && (
              <motion.div
                key="review-expand"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="pt-3">
                  <div className="flex flex-wrap gap-1.5">
                    {chips.map((chip) => {
                      const picked = pickedChips.includes(chip)
                      return (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => toggleChip(chip)}
                          className={cn(
                            'rounded-[8px] border px-2.5 py-1 text-[12.5px] font-semibold transition-colors',
                            picked
                              ? rating === 'positive'
                                ? 'border-green-400/40 bg-green-400/[0.10] text-green-400'
                                : 'border-red-400/40 bg-red-400/[0.10] text-red-400'
                              : 'border-white/10 bg-white/[0.02] text-text-secondary hover:border-white/20 hover:text-text-primary',
                          )}
                        >
                          {chip}
                        </button>
                      )
                    })}
                  </div>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    placeholder="Share a quick note about your experience"
                    className={cn(modalField, 'mt-2.5 resize-none')}
                  />
                  <div className="mt-1 text-[12px] text-text-tertiary">
                    {comment.trim().length < 10
                      ? `${10 - comment.trim().length} more character${10 - comment.trim().length === 1 ? '' : 's'} needed`
                      : 'Looks good.'}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </OrderModal>
  )
}

function RatingButton({
  active,
  tone,
  onClick,
  label,
}: {
  active: boolean
  tone: 'positive' | 'negative'
  onClick: () => void
  label: string
}) {
  const Icon = tone === 'positive' ? ThumbsUp : ThumbsDown
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group inline-flex flex-1 items-center justify-center gap-2 rounded-[9px] border px-3 py-2.5 transition-colors',
        active
          ? tone === 'positive'
            ? 'border-green-400/40 bg-green-400/[0.10] text-green-400'
            : 'border-red-400/40 bg-red-400/[0.10] text-red-400'
          : 'border-white/10 bg-white/[0.02] text-text-secondary hover:border-white/20 hover:text-text-primary',
      )}
    >
      <Icon className={cn('h-4 w-4', active && tone === 'positive' && 'fill-green-400')} aria-hidden />
      <span className="text-[13px] font-bold">{label}</span>
    </button>
  )
}

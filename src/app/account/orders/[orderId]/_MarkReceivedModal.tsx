'use client'

/**
 * MarkReceivedModal — V21/P5.f
 *
 * Buyer's "Confirm Delivery" flow. Centered shadcn Dialog. Layout:
 *   1. Amber warning banner — "Only confirm if you received your
 *      order in full."
 *   2. Centered SafeDrop payout block — title + amount stacked.
 *   3. Mandatory review block — thumbs up/down + quick chips that
 *      pre-fill the comment + a textarea. Must be filled before
 *      Confirm activates.
 *   4. Footer — Cancel + Confirm. Confirm uses the muted lime-tint
 *      surface (not full lime) so it doesn't punch you in the eyes.
 *
 * On submit: writes the review (createReview) then calls
 * confirmOrderReceipt. The order page realtime subscription picks
 * up the status flip and re-renders.
 */

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Shield, Loader2, ThumbsUp, ThumbsDown, CheckCircle2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
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
      const userTail = comment.replace(/^([A-Za-z ·]+)?(\s—\s)?/, '')
      setComment(chipText ? `${chipText}${userTail ? ' — ' + userTail : ''}` : userTail)
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

      toast.success(`Delivery confirmed — ${fmtUsd(amount)} paid out to the seller`)
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

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) reset()
      }}
    >
      <DialogContent className="max-w-[640px] gap-5 border-border-default bg-bg-raised p-7 sm:p-8">
        <DialogHeader className="gap-2">
          <DialogTitle className="text-[26px] font-bold tracking-tight">
            {mode === 'review' ? 'Leave A Review' : 'Confirm Delivery'}
          </DialogTitle>
          <DialogDescription className="text-[15px] leading-[1.5] text-text-secondary">
            {mode === 'review'
              ? 'Share your experience to help other buyers.'
              : 'Once you confirm, the seller is paid out for this order.'}
          </DialogDescription>
        </DialogHeader>

        {/* Warning + amount rows shown only when actually confirming. */}
        {mode === 'confirm' && (
          <>
            <div className="mt-1 px-1 text-center">
              <div className="mb-2.5 inline-flex items-center justify-center gap-2">
                <AlertTriangle className="h-[20px] w-[20px] text-amber" />
                <span className="text-[14px] font-bold uppercase tracking-[0.14em] text-amber">
                  Important
                </span>
              </div>
              <p className="text-[15.5px] leading-[1.55] text-text-primary">
                <span className="font-bold text-amber">Only confirm delivery</span> if you received your order in full.
              </p>
            </div>

            <div className="mt-3 flex items-center justify-between px-1">
              <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-text-secondary">
                <Shield className="h-[18px] w-[18px] text-lime-text" />
                Seller Payout
              </span>
              <span className="text-[22px] font-extrabold tabular-nums text-lime-text">
                {fmtUsd(amount)}
              </span>
            </div>
          </>
        )}

        {/* Review block — only in review-only mode. The confirm flow
            no longer asks for a review; that's a separate step via the
            completed-state "Leave Review" CTA on the strip. */}
        {mode === 'review' && (
          <div className="mt-2">
            <div className="mb-2.5 text-[12.5px] font-bold uppercase tracking-[0.14em] text-text-secondary">
              Leave A Review For Seller
            </div>
            <div className="flex items-center justify-center gap-2.5">
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
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="pt-3">
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {chips.map((chip) => {
                        const picked = pickedChips.includes(chip)
                        return (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => toggleChip(chip)}
                            className={cn(
                              'rounded-lg border px-3 py-1.5 text-[13px] font-semibold transition-all',
                              picked
                                ? rating === 'positive'
                                  ? 'border-green-400/40 bg-green-400/[0.10] text-green-400'
                                  : 'border-red-400/40 bg-red-400/[0.10] text-red-400'
                                : 'border-border-default bg-bg-overlay text-text-secondary hover:border-white/[0.18] hover:text-text-primary',
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
                      placeholder="Share a quick note about your experience…"
                      className="mt-3 w-full resize-none rounded-lg border border-border-default bg-bg-overlay px-3.5 py-2.5 text-[14px] leading-[1.5] text-text-primary placeholder:text-text-tertiary focus:border-lime/40 focus:outline-none focus:ring-2 focus:ring-lime/20"
                    />
                    <div className="mt-1.5 text-[12px] text-text-tertiary">
                      {comment.trim().length < 10
                        ? `${10 - comment.trim().length} more character${10 - comment.trim().length === 1 ? '' : 's'} required`
                        : 'Looks good.'}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <div className="mt-4 flex items-center justify-end gap-3">
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
            onClick={handleConfirm}
            disabled={!canSubmit}
            className={cn(
              'h-12 bg-lime px-6 text-[15px] font-bold text-text-inverse hover:bg-lime-hover',
              'shadow-[0_6px_18px_rgba(198,255,61,0.22)] disabled:opacity-50',
            )}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-[18px] w-[18px] animate-spin" />
                {mode === 'review' ? 'Submitting…' : 'Confirming…'}
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-[18px] w-[18px]" />
                {mode === 'review' ? 'Submit Review' : 'Confirm'}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
        'group inline-flex flex-1 items-center justify-center gap-2.5 rounded-lg border-2 px-4 py-3 transition-all',
        active
          ? tone === 'positive'
            ? 'border-green-400/40 bg-green-400/[0.10] text-green-400'
            : 'border-red-400/40 bg-red-400/[0.10] text-red-400'
          : 'border-border-default bg-bg-overlay text-text-secondary hover:border-white/[0.18] hover:text-text-primary',
      )}
    >
      <Icon className={cn('h-[18px] w-[18px]', active && tone === 'positive' && 'fill-green-400')} />
      <span className="text-[14px] font-bold">{label}</span>
    </button>
  )
}

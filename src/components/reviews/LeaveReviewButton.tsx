/**
 * Leave Review Button Component
 *
 * Shows "Leave a Review" button for completed orders
 * Opens ReviewForm modal when clicked
 * Displays existing review if already submitted
 */

'use client'

import React, { useState, useEffect } from 'react'
import { Star, Pencil, ThumbsUp, ThumbsDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import ReviewForm from './ReviewForm'
import { getOrderReview, checkReviewEligibility } from '@/lib/api/reviews'
import type { ReviewWithRelations } from '@/types/database'

interface LeaveReviewButtonProps {
  orderId: string
  orderNumber?: string
  sellerName?: string
  onReviewSubmitted?: () => void
  className?: string
  compact?: boolean // Show only thumbs icon instead of full review card
}

export default function LeaveReviewButton({
  orderId,
  orderNumber,
  sellerName,
  onReviewSubmitted,
  className,
  compact = false
}: LeaveReviewButtonProps) {
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [existingReview, setExistingReview] = useState<ReviewWithRelations | null>(null)
  const [canReview, setCanReview] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkEligibility()
  }, [orderId])

  const checkEligibility = async () => {
    setIsLoading(true)
    try {
      // Check if review already exists
      const { data: review } = await getOrderReview(orderId)
      if (review) {
        setExistingReview(review as any)
        setCanReview(false)
      } else {
        // Check if user can review this order
        const { data: eligibility } = await checkReviewEligibility(orderId)
        setCanReview(eligibility?.canReview || false)
      }
    } catch (error) {
      console.error('Error checking review eligibility:', error)
      setCanReview(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleReviewSuccess = () => {
    checkEligibility() // Refresh to show submitted review
    if (onReviewSubmitted) {
      onReviewSubmitted()
    }
  }

  // Loading state
  if (isLoading) {
    return null
  }

  // Already reviewed - show existing review badge
  if (existingReview) {
    const isPositive = existingReview.rating >= 4
    const ThumbIcon = isPositive ? ThumbsUp : ThumbsDown
    const iconColor = isPositive ? 'text-green-400' : 'text-red-400'

    // Compact mode - just show icon
    if (compact) {
      return (
        <div
          className={cn('inline-flex items-center gap-1.5 rounded-lg px-2 py-1', className)}
          title={`${isPositive ? 'Positive' : 'Negative'} Review: ${existingReview.comment}`}
        >
          <ThumbIcon className={cn('w-4 h-4', iconColor, 'fill-current')} />
          <span className={cn('text-xs font-medium', iconColor)}>
            {isPositive ? 'Positive' : 'Negative'}
          </span>
        </div>
      )
    }

    // Full mode - compact inline review row
    return (
      <>
        <div className={cn(
          'flex items-center gap-2.5 rounded-xl border px-3 py-2.5',
          isPositive ? 'border-green-500/15 bg-green-500/[0.05]' : 'border-red-500/15 bg-red-500/[0.05]',
          className
        )}>
          {/* Small thumbs icon */}
          <div className={cn(
            'flex-shrink-0 h-6 w-6 rounded-lg flex items-center justify-center',
            isPositive ? 'bg-green-500/15' : 'bg-red-500/15'
          )}>
            <ThumbIcon className={cn('w-3 h-3 fill-current', iconColor)} />
          </div>

          {/* Review text */}
          <div className="flex-1 min-w-0">
            <div className={cn('text-[10px] font-bold uppercase tracking-[0.08em] mb-0.5', iconColor)}>
              {isPositive ? 'Positive Review' : 'Negative Review'}
            </div>
            <p className="text-xs text-gray-500 truncate leading-tight">
              {existingReview.comment || existingReview.title || '—'}
            </p>
          </div>

          {/* Edit button */}
          <button
            onClick={() => setShowReviewForm(true)}
            className="flex-shrink-0 h-6 w-6 rounded-lg border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition-colors"
            title="Edit review"
          >
            <Pencil className="h-3 w-3 text-gray-500" />
          </button>
        </div>

        <ReviewForm
          orderId={orderId}
          orderNumber={orderNumber}
          sellerName={sellerName}
          isOpen={showReviewForm}
          onClose={() => setShowReviewForm(false)}
          onSuccess={handleReviewSuccess}
          existingReview={existingReview}
        />
      </>
    )
  }

  // Can review - show review button
  if (canReview) {
    return (
      <>
        <button
          onClick={() => setShowReviewForm(true)}
          className={cn(
            'w-full py-2 border border-yellow-500/20 bg-yellow-500/[0.06] hover:bg-yellow-500/[0.11] text-yellow-400/90 hover:text-yellow-400 text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2',
            className
          )}
        >
          <Star className="w-3.5 h-3.5" />
          Leave a Review
        </button>

        <ReviewForm
          orderId={orderId}
          orderNumber={orderNumber}
          sellerName={sellerName}
          isOpen={showReviewForm}
          onClose={() => setShowReviewForm(false)}
          onSuccess={handleReviewSuccess}
          existingReview={null}
        />
      </>
    )
  }

  // Cannot review (order not completed, or other reasons)
  return null
}

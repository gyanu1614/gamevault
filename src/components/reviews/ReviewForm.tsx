/**
 * Review Form Component - Apple Style with Thumbs Up/Down
 *
 * Beautiful, minimalist review interface with smooth animations
 * Features thumbs up/down rating system with auto-filled feedback
 */

'use client'

import React, { useState, useEffect } from 'react'
import { ThumbsUp, ThumbsDown, X, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { createReview, updateReview } from '@/lib/api/reviews'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { createPortal } from 'react-dom'
import type { ReviewWithRelations } from '@/types/database'

interface ReviewFormProps {
  orderId: string
  orderNumber?: string
  sellerName?: string
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  existingReview?: ReviewWithRelations | null
}

type ReviewType = 'positive' | 'negative' | null

const DEFAULT_POSITIVE_REVIEW = "Great transaction! Order received as described."
const DEFAULT_NEGATIVE_REVIEW = "Order did not meet expectations."

const POSITIVE_PRESETS = [
  "Quick & Fast",
  "Funny & Genuine",
  "Fast Delivery"
]

const NEGATIVE_PRESETS = [
  "Slow Delivery",
  "Not as Described",
  "Poor Communication"
]

export default function ReviewForm({
  orderId,
  orderNumber,
  sellerName,
  isOpen,
  onClose,
  onSuccess,
  existingReview
}: ReviewFormProps) {
  const [reviewType, setReviewType] = useState<ReviewType>(null)
  const [feedback, setFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mounted, setMounted] = useState(false)

  const isEditMode = !!existingReview

  useEffect(() => {
    setMounted(true)
  }, [])

  // Pre-fill form when editing existing review
  useEffect(() => {
    if (existingReview && isOpen) {
      setReviewType(existingReview.rating >= 4 ? 'positive' : 'negative')
      setFeedback(existingReview.comment || '')
    } else if (!isOpen) {
      // Reset form when modal closes
      setReviewType(null)
      setFeedback('')
    }
  }, [existingReview, isOpen])

  const handleReviewTypeSelect = (type: ReviewType) => {
    setReviewType(type)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!reviewType) {
      toast.error('Please select thumbs up or thumbs down')
      return
    }

    setIsSubmitting(true)

    try {
      // Use custom feedback or default message
      const reviewComment = feedback.trim() ||
        (reviewType === 'positive' ? DEFAULT_POSITIVE_REVIEW : DEFAULT_NEGATIVE_REVIEW)

      // Convert thumbs to star rating
      const rating = reviewType === 'positive' ? 5 : 1

      if (isEditMode && existingReview) {
        // Update existing review
        const { data, error } = await updateReview(existingReview.id, {
          rating,
          comment: reviewComment
        })

        if (error || !data) {
          throw new Error(error?.message || 'Failed to update review')
        }

        toast.success('Review updated successfully!')
      } else {
        // Create new review
        const { data, error } = await createReview({
          orderId,
          rating,
          comment: reviewComment
        })

        if (error || !data) {
          throw new Error(error?.message || 'Failed to submit review')
        }

        toast.success('Review submitted successfully!')
      }

      // Reset form
      setReviewType(null)
      setFeedback('')

      // Call success callback
      if (onSuccess) {
        onSuccess()
      }

      // Close modal
      onClose()
    } catch (error: any) {
      console.error('Error submitting review:', error)
      toast.error(error.message || 'Failed to submit review')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      onClose()
    }
  }

  if (!isOpen || !mounted) return null

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.1] rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative p-4 pb-3 border-b border-white/[0.05]">
              <button
                onClick={handleClose}
                disabled={isSubmitting}
                className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-white/[0.05] text-gray-400 hover:text-white transition-all disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="text-center pr-6">
                <h2 className="text-lg font-semibold text-white mb-0.5">
                  {isEditMode ? 'Edit Your Review' : 'How was your experience?'}
                </h2>
                {sellerName && (
                  <p className="text-xs text-gray-500">
                    {sellerName}
                    {orderNumber && ` • #${orderNumber}`}
                  </p>
                )}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Thumbs Up/Down Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-400 text-center">
                  Rate your experience
                </label>
                <div className="flex items-center justify-center gap-4">
                  {/* Thumbs Up */}
                  <motion.button
                    type="button"
                    onClick={() => handleReviewTypeSelect('positive')}
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                      "relative p-4 rounded-xl border-2 transition-all duration-200",
                      reviewType === 'positive'
                        ? "bg-green-500/15 border-green-500/40"
                        : "bg-white/[0.03] border-white/[0.08] hover:border-white/[0.12]"
                    )}
                  >
                    <ThumbsUp
                      className={cn(
                        "w-8 h-8 transition-colors duration-200",
                        reviewType === 'positive' ? "text-green-400 fill-green-400" : "text-gray-500"
                      )}
                    />
                    {reviewType === 'positive' && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center"
                      >
                        <span className="text-white text-[10px] font-bold">✓</span>
                      </motion.div>
                    )}
                  </motion.button>

                  {/* Thumbs Down */}
                  <motion.button
                    type="button"
                    onClick={() => handleReviewTypeSelect('negative')}
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                      "relative p-4 rounded-xl border-2 transition-all duration-200",
                      reviewType === 'negative'
                        ? "bg-red-500/15 border-red-500/40"
                        : "bg-white/[0.03] border-white/[0.08] hover:border-white/[0.12]"
                    )}
                  >
                    <ThumbsDown
                      className={cn(
                        "w-8 h-8 transition-colors duration-200",
                        reviewType === 'negative' ? "text-red-400 fill-red-400" : "text-gray-500"
                      )}
                    />
                    {reviewType === 'negative' && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                      >
                        <span className="text-white text-[10px] font-bold">✓</span>
                      </motion.div>
                    )}
                  </motion.button>
                </div>

                {/* Selection Feedback */}
                <AnimatePresence mode="wait">
                  {reviewType && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className={cn(
                        "text-center text-xs font-medium",
                        reviewType === 'positive' ? "text-green-400" : "text-red-400"
                      )}
                    >
                      {reviewType === 'positive' ? '👍 Positive' : '👎 Negative'}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Quick Review Presets */}
              <AnimatePresence>
                {reviewType && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2"
                  >
                    <label className="block text-xs font-medium text-gray-400">
                      Quick options
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {(reviewType === 'positive' ? POSITIVE_PRESETS : NEGATIVE_PRESETS).map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setFeedback(preset)}
                          disabled={isSubmitting}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-medium transition-all",
                            feedback === preset
                              ? reviewType === 'positive'
                                ? "bg-green-500/20 border-green-500/40 text-green-400 border"
                                : "bg-red-500/20 border-red-500/40 text-red-400 border"
                              : "bg-white/[0.03] border border-white/[0.08] text-gray-400 hover:bg-white/[0.05] hover:text-white"
                          )}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Optional Feedback */}
              <AnimatePresence>
                {reviewType && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2"
                  >
                    <label htmlFor="review-feedback" className="block text-xs font-medium text-gray-400">
                      Or write your own <span className="text-gray-500">(optional)</span>
                    </label>
                    <textarea
                      id="review-feedback"
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      rows={2}
                      maxLength={2000}
                      placeholder={
                        reviewType === 'positive'
                          ? "What made it great..."
                          : "What went wrong..."
                      }
                      className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-500/40 focus:border-transparent transition-all resize-none"
                      disabled={isSubmitting}
                    />
                    <div className="flex items-center justify-end text-[10px] text-gray-600">
                      {feedback.length}/2000
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit Button */}
              <motion.button
                type="submit"
                disabled={isSubmitting || !reviewType}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "w-full py-2.5 rounded-lg font-semibold text-sm transition-all",
                  reviewType === 'positive' && !isSubmitting && "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white",
                  reviewType === 'negative' && !isSubmitting && "bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white",
                  (!reviewType || isSubmitting) && "bg-white/[0.05] text-gray-500 cursor-not-allowed"
                )}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {isEditMode ? 'Updating...' : 'Submitting...'}
                  </span>
                ) : (
                  isEditMode ? 'Update Review' : 'Submit Review'
                )}
              </motion.button>

              {/* Cancel Button */}
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="w-full py-2 text-gray-400 hover:text-white transition-colors text-xs font-medium disabled:opacity-50"
              >
                Cancel
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return createPortal(modalContent, document.body)
}

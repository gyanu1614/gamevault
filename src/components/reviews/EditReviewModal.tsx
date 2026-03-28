/**
 * Edit Review Modal Component
 *
 * Modal for editing existing reviews with:
 * - Pre-filled current rating and comment
 * - Thumbs up/down toggle
 * - Optional title field
 * - Character counter
 * - Warning about "Edited" badge
 * - Smooth animations
 */

'use client'

import React, { useState, useEffect } from 'react'
import { ThumbsUp, ThumbsDown, X, Loader2, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { updateReview } from '@/lib/api/reviews'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { createPortal } from 'react-dom'

interface EditReviewModalProps {
  reviewId: string
  currentRating: number
  currentTitle?: string
  currentComment: string
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

type ReviewType = 'positive' | 'negative'

export default function EditReviewModal({
  reviewId,
  currentRating,
  currentTitle,
  currentComment,
  isOpen,
  onClose,
  onSuccess
}: EditReviewModalProps) {
  const [reviewType, setReviewType] = useState<ReviewType>(currentRating >= 4 ? 'positive' : 'negative')
  const [title, setTitle] = useState(currentTitle || '')
  const [comment, setComment] = useState(currentComment)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      setReviewType(currentRating >= 4 ? 'positive' : 'negative')
      setTitle(currentTitle || '')
      setComment(currentComment)
      setHasChanges(false)
    }
  }, [isOpen, currentRating, currentTitle, currentComment])

  // Track changes
  useEffect(() => {
    const ratingChanged = (reviewType === 'positive' && currentRating < 4) || (reviewType === 'negative' && currentRating >= 4)
    const titleChanged = title !== (currentTitle || '')
    const commentChanged = comment !== currentComment
    setHasChanges(ratingChanged || titleChanged || commentChanged)
  }, [reviewType, title, comment, currentRating, currentTitle, currentComment])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!hasChanges) {
      toast.info('No changes detected')
      return
    }

    if (comment.trim().length < 10) {
      toast.error('Comment must be at least 10 characters')
      return
    }

    setIsSubmitting(true)

    try {
      // Convert thumbs to star rating
      const newRating = reviewType === 'positive' ? 5 : 1

      const { data, error } = await updateReview(reviewId, {
        rating: newRating,
        title: title.trim() || undefined,
        comment: comment.trim()
      })

      if (error || !data) {
        throw new Error(error?.message || 'Failed to update review')
      }

      toast.success('Review updated successfully!')

      // Call success callback
      if (onSuccess) {
        onSuccess()
      }

      // Close modal
      onClose()
    } catch (error: any) {
      console.error('Error updating review:', error)

      // Check for specific error messages
      if (error.message?.includes('24 hours')) {
        toast.error('You can only edit once per 24 hours')
      } else if (error.message?.includes('30 days')) {
        toast.error('Edit window expired (30 days)')
      } else {
        toast.error(error.message || 'Failed to update review')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (isSubmitting) return

    if (hasChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose()
      }
    } else {
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
            className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.1] rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative p-6 pb-4 border-b border-white/[0.05]">
              <button
                onClick={handleClose}
                disabled={isSubmitting}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/[0.05] text-gray-400 hover:text-white transition-all disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-white mb-1">
                  Edit Your Review
                </h2>
                <p className="text-sm text-gray-400">
                  Make changes to your review
                </p>
              </div>
            </div>

            {/* Warning Banner */}
            <div className="mx-6 mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-200">
                Edited reviews will display an "Edited" badge. You can edit once per 24 hours.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Thumbs Up/Down Selector */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300 text-center">
                  Rate your experience
                </label>
                <div className="flex items-center justify-center gap-6">
                  {/* Thumbs Up */}
                  <motion.button
                    type="button"
                    onClick={() => {
                      setReviewType('positive')
                      setComment('') // Clear text when switching
                    }}
                    whileTap={{ scale: 0.9 }}
                    className={cn(
                      "relative p-6 rounded-2xl border-2 transition-all duration-300",
                      reviewType === 'positive'
                        ? "bg-green-500/20 border-green-500/50 shadow-lg shadow-green-500/20"
                        : "bg-white/[0.03] border-white/[0.1] hover:bg-white/[0.05] hover:border-white/[0.15]"
                    )}
                  >
                    <motion.div
                      animate={{
                        scale: reviewType === 'positive' ? 1.1 : 1,
                        rotate: reviewType === 'positive' ? [0, -10, 10, 0] : 0
                      }}
                      transition={{ type: "spring", stiffness: 300, damping: 15 }}
                    >
                      <ThumbsUp
                        className={cn(
                          "w-12 h-12 transition-colors duration-300",
                          reviewType === 'positive' ? "text-green-400 fill-green-400" : "text-gray-500"
                        )}
                      />
                    </motion.div>
                    {reviewType === 'positive' && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center"
                      >
                        <span className="text-white text-xs font-bold">✓</span>
                      </motion.div>
                    )}
                  </motion.button>

                  {/* Thumbs Down */}
                  <motion.button
                    type="button"
                    onClick={() => {
                      setReviewType('negative')
                      setComment('') // Clear text when switching
                    }}
                    whileTap={{ scale: 0.9 }}
                    className={cn(
                      "relative p-6 rounded-2xl border-2 transition-all duration-300",
                      reviewType === 'negative'
                        ? "bg-red-500/20 border-red-500/50 shadow-lg shadow-red-500/20"
                        : "bg-white/[0.03] border-white/[0.1] hover:bg-white/[0.05] hover:border-white/[0.15]"
                    )}
                  >
                    <motion.div
                      animate={{
                        scale: reviewType === 'negative' ? 1.1 : 1,
                        rotate: reviewType === 'negative' ? [0, -10, 10, 0] : 0
                      }}
                      transition={{ type: "spring", stiffness: 300, damping: 15 }}
                    >
                      <ThumbsDown
                        className={cn(
                          "w-12 h-12 transition-colors duration-300",
                          reviewType === 'negative' ? "text-red-400 fill-red-400" : "text-gray-500"
                        )}
                      />
                    </motion.div>
                    {reviewType === 'negative' && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center"
                      >
                        <span className="text-white text-xs font-bold">✓</span>
                      </motion.div>
                    )}
                  </motion.button>
                </div>
              </div>

              {/* Title (Optional) */}
              <div className="space-y-2">
                <label htmlFor="review-title" className="block text-sm font-medium text-gray-300">
                  Title <span className="text-gray-500">(optional)</span>
                </label>
                <input
                  id="review-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={100}
                  placeholder="Brief summary of your experience"
                  className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.1] rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent transition-all"
                  disabled={isSubmitting}
                />
                <div className="flex justify-end">
                  <span className="text-xs text-gray-500">
                    {title.length}/100
                  </span>
                </div>
              </div>

              {/* Comment */}
              <div className="space-y-2">
                <label htmlFor="review-comment" className="block text-sm font-medium text-gray-300">
                  Your review
                </label>
                <textarea
                  id="review-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                  maxLength={2000}
                  placeholder={
                    reviewType === 'positive'
                      ? "Share what made your experience great..."
                      : "Let us know what went wrong..."
                  }
                  className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.1] rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent transition-all resize-none"
                  disabled={isSubmitting}
                />
                <div className="flex items-center justify-between text-xs">
                  <span className={cn(
                    "transition-colors",
                    comment.trim().length < 10 ? "text-red-400" : "text-gray-500"
                  )}>
                    {comment.trim().length < 10 ? `${10 - comment.trim().length} more characters needed` : 'Good to go'}
                  </span>
                  <span className="text-gray-500">
                    {comment.length}/2000
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                {/* Cancel Button */}
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="flex-1 py-3 rounded-xl font-medium text-gray-400 hover:text-white hover:bg-white/[0.05] transition-all disabled:opacity-50"
                >
                  Cancel
                </button>

                {/* Save Button */}
                <motion.button
                  type="submit"
                  disabled={isSubmitting || !hasChanges || comment.trim().length < 10}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "flex-1 py-3 rounded-xl font-semibold transition-all shadow-lg flex items-center justify-center gap-2",
                    hasChanges && !isSubmitting && comment.trim().length >= 10
                      ? "bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white shadow-violet-500/20"
                      : "bg-white/[0.05] text-gray-500 cursor-not-allowed"
                  )}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return createPortal(modalContent, document.body)
}

/**
 * Review Stats Component - Minimalistic Design
 *
 * Displays seller rating statistics:
 * - Average rating score (no stars)
 * - Thumbs up/down percentages
 * - Total review count
 * - Rating distribution bar chart (simplified labels)
 */

'use client'

import React from 'react'
import { ThumbsUp, ThumbsDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ReviewStatsProps {
  avgRating: number
  totalReviews: number
  positivePercentage: number
  ratingDistribution: { [key: number]: number }
  className?: string
}

export default function ReviewStats({
  avgRating,
  totalReviews,
  positivePercentage,
  ratingDistribution,
  className
}: ReviewStatsProps) {
  // Calculate percentages for each rating
  const getRatingPercentage = (rating: number) => {
    if (totalReviews === 0) return 0
    return ((ratingDistribution[rating] || 0) / totalReviews) * 100
  }

  // Calculate negative percentage (1-3 star ratings)
  const negativeCount = (ratingDistribution[1] || 0) + (ratingDistribution[2] || 0) + (ratingDistribution[3] || 0)
  const negativePercentage = totalReviews > 0 ? Math.round((negativeCount / totalReviews) * 100) : 0

  // Calculate positive count for display
  const positiveCount = (ratingDistribution[4] || 0) + (ratingDistribution[5] || 0)

  // Rating labels - simplified without stars
  const ratingLabels: { [key: number]: string } = {
    5: 'Excellent',
    4: 'Good',
    3: 'Average',
    2: 'Poor',
    1: 'Bad'
  }

  return (
    <div className={cn('bg-bg-overlay border border-border-subtle rounded-xl p-6', className)}>
      {/* Header: Average Rating */}
      <div className="pb-6 border-b border-border-subtle">
        {/* Large Rating Number */}
        <div className="text-center mb-6">
          <div className="text-5xl font-bold text-white mb-2">
            {avgRating > 0 ? `${avgRating.toFixed(1)} / 5.0` : '—'}
          </div>
          <p className="text-sm text-text-secondary">
            {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}
          </p>
        </div>

        {/* Thumbs Up/Down Metrics */}
        <div className="grid grid-cols-2 gap-3">
          {/* Positive */}
          <div className="bg-success-bg border border-green-500/20 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <ThumbsUp className="w-4 h-4 text-success fill-current" />
              <span className="text-lg font-bold text-success">{Math.round(positivePercentage)}%</span>
            </div>
            <p className="text-xs text-success/80">
              Positive ({positiveCount})
            </p>
          </div>

          {/* Negative */}
          <div className="bg-error-bg border border-error/40 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <ThumbsDown className="w-4 h-4 text-error fill-current" />
              <span className="text-lg font-bold text-error">{negativePercentage}%</span>
            </div>
            <p className="text-xs text-error/80">
              Negative ({negativeCount})
            </p>
          </div>
        </div>
      </div>

      {/* Rating Distribution Bars */}
      <div className="pt-6 space-y-3">
        <h4 className="text-sm font-semibold text-white mb-4">Rating Breakdown</h4>
        {[5, 4, 3, 2, 1].map((rating) => {
          const count = ratingDistribution[rating] || 0
          const percentage = getRatingPercentage(rating)

          return (
            <div key={rating} className="flex items-center gap-3">
              {/* Rating Label */}
              <div className="w-20">
                <span className="text-xs text-text-secondary">{ratingLabels[rating]}</span>
                <span className="text-xs text-text-disabled ml-1">({rating})</span>
              </div>

              {/* Progress Bar */}
              <div className="flex-1 h-2 bg-bg-overlay rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    rating >= 4
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                      : rating === 3
                      ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                      : 'bg-gradient-to-r from-red-500 to-rose-500'
                  )}
                  style={{ width: `${percentage}%` }}
                />
              </div>

              {/* Count */}
              <span className="text-xs text-text-secondary w-12 text-right">
                {count}
              </span>
            </div>
          )
        })}
      </div>

      {/* Empty State */}
      {totalReviews === 0 && (
        <div className="py-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-bg-overlay flex items-center justify-center">
            <ThumbsUp className="w-8 h-8 text-text-disabled" />
          </div>
          <p className="text-sm text-text-secondary">No reviews yet</p>
          <p className="text-xs text-text-tertiary mt-1">Be the first to leave a review!</p>
        </div>
      )}
    </div>
  )
}

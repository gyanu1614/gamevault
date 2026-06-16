/**
 * Reviews List Component - Thumbs-Based Design
 *
 * Displays paginated list of reviews with:
 * - Filtering by sentiment (positive/negative)
 * - Sorting options (newest, highest rated, lowest rated)
 * - Pagination (20 per page)
 * - Empty state with thumbs icon
 */

'use client'

import React, { useState, useEffect } from 'react'
import { ThumbsUp, Filter, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import ReviewCard from './ReviewCard'
import type { ReviewWithRelations } from '@/types/database'
import { getReviews } from '@/lib/api/reviews'

interface ReviewsListProps {
  sellerId?: string
  listingId?: string
  gameId?: string
  currentUserId?: string
  allowSellerReply?: boolean
  initialReviews?: ReviewWithRelations[]
}

export default function ReviewsList({
  sellerId,
  listingId,
  gameId,
  currentUserId,
  allowSellerReply = false,
  initialReviews = []
}: ReviewsListProps) {
  const [reviews, setReviews] = useState<ReviewWithRelations[]>(initialReviews)
  const [isLoading, setIsLoading] = useState(false)
  const [filterType, setFilterType] = useState<'all' | 'positive' | 'negative'>('all')
  const [sortBy, setSortBy] = useState<'created_at' | 'rating'>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)

  const ITEMS_PER_PAGE = 20

  // Fetch reviews
  const fetchReviews = async () => {
    setIsLoading(true)
    try {
      // Determine rating range based on filter type
      let minRating: number | undefined
      let maxRating: number | undefined

      if (filterType === 'positive') {
        minRating = 4
        maxRating = 5
      } else if (filterType === 'negative') {
        minRating = 1
        maxRating = 3
      }

      const { data, error } = await getReviews({
        sellerId,
        listingId,
        gameId,
        minRating,
        maxRating,
        sortBy,
        sortOrder,
        limit: ITEMS_PER_PAGE,
        offset: (currentPage - 1) * ITEMS_PER_PAGE
      })

      if (data) {
        setReviews(data as any)
      }
    } catch (error) {
      console.error('Error fetching reviews:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Refetch when filters change
  useEffect(() => {
    if (!initialReviews.length) {
      fetchReviews()
    }
  }, [filterType, sortBy, sortOrder, currentPage])

  // Filter options - thumbs-based
  const filterOptions = [
    { label: 'All Reviews', value: 'all' as const },
    { label: 'Positive Reviews', value: 'positive' as const, description: '(4-5 ratings)' },
    { label: 'Negative Reviews', value: 'negative' as const, description: '(1-3 ratings)' }
  ]

  // Sort options
  const sortOptions = [
    { label: 'Newest First', sortBy: 'created_at', sortOrder: 'desc' },
    { label: 'Oldest First', sortBy: 'created_at', sortOrder: 'asc' },
    { label: 'Highest Rated', sortBy: 'rating', sortOrder: 'desc' },
    { label: 'Lowest Rated', sortBy: 'rating', sortOrder: 'asc' }
  ]

  const currentSort = sortOptions.find(
    opt => opt.sortBy === sortBy && opt.sortOrder === sortOrder
  )

  const displayReviews = initialReviews.length ? initialReviews : reviews

  // Empty state
  if (!isLoading && displayReviews.length === 0) {
    const emptyMessage = filterType === 'positive'
      ? 'No positive reviews found. Try a different filter.'
      : filterType === 'negative'
      ? 'No negative reviews found. Try a different filter.'
      : 'Be the first to leave a review!'

    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-bg-overlay flex items-center justify-center">
          <ThumbsUp className="w-8 h-8 text-text-disabled" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">No reviews yet</h3>
        <p className="text-sm text-text-secondary">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters & Sort Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
        {/* Filter by Type */}
        <div className="relative">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 bg-bg-overlay border border-border-subtle rounded-lg text-sm text-white hover:bg-bg-raised-hover transition-all"
          >
            <Filter className="w-4 h-4" />
            {filterType === 'positive' ? 'Positive Reviews' : filterType === 'negative' ? 'Negative Reviews' : 'All Reviews'}
            <ChevronDown className={cn(
              'w-4 h-4 transition-transform',
              showFilters && 'rotate-180'
            )} />
          </button>

          {showFilters && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowFilters(false)}
              />
              <div className="absolute top-full left-0 mt-2 w-52 bg-gray-900/95 backdrop-blur-xl border border-border-subtle rounded-lg shadow-xl z-20 overflow-hidden">
                {filterOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setFilterType(option.value)
                      setCurrentPage(1)
                      setShowFilters(false)
                    }}
                    className={cn(
                      'w-full px-4 py-2.5 text-left text-sm transition-colors',
                      filterType === option.value
                        ? 'bg-white/[0.1] text-white font-medium'
                        : 'text-text-secondary hover:bg-bg-overlay hover:text-white'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span>{option.label}</span>
                      {'description' in option && (
                        <span className="text-xs text-text-tertiary">{option.description}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-text-secondary">Sort:</span>
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [newSortBy, newSortOrder] = e.target.value.split('-') as ['created_at' | 'rating', 'asc' | 'desc']
              setSortBy(newSortBy)
              setSortOrder(newSortOrder)
              setCurrentPage(1)
            }}
            className="px-3 py-1.5 bg-bg-overlay border border-border-subtle rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white/20"
          >
            {sortOptions.map((option) => (
              <option
                key={`${option.sortBy}-${option.sortOrder}`}
                value={`${option.sortBy}-${option.sortOrder}`}
                className="bg-gray-900"
              >
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="w-8 h-8 mx-auto border-4 border-white/20 border-t-white rounded-full animate-spin" />
          <p className="text-sm text-text-secondary mt-4">Loading reviews...</p>
        </div>
      )}

      {/* Reviews List */}
      {!isLoading && (
        <div className="space-y-4">
          {displayReviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              showSellerResponse={true}
              allowSellerReply={allowSellerReply}
              currentUserId={currentUserId}
              onReplySuccess={fetchReviews}
            />
          ))}
        </div>
      )}

      {/* Pagination (if not using initialReviews) */}
      {!initialReviews.length && displayReviews.length === ITEMS_PER_PAGE && (
        <div className="flex items-center justify-center gap-2 pt-6 border-t border-border-subtle">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-lg border border-border-subtle text-white hover:bg-bg-overlay disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="px-4 py-2 text-sm text-text-secondary">
            Page {currentPage}
          </span>
          <button
            onClick={() => setCurrentPage(p => p + 1)}
            disabled={displayReviews.length < ITEMS_PER_PAGE}
            className="p-2 rounded-lg border border-border-subtle text-white hover:bg-bg-overlay disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  )
}

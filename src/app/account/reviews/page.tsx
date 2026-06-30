'use client'

import { useState, useMemo } from 'react'
import { useAuth } from '@/hooks/use-auth'
import AccountPageHeader from '@/components/account/AccountPageHeader'
import { useSellerReviews } from '@/hooks/use-seller-reviews'
import { getAvatarUrl } from '@/lib/utils/avatar'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  Star,
  MessageSquare,
  ThumbsUp,
  Search,
  X,
  Loader2,
  Award,
  Send,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'

type ViewTab = 'received' | 'given'
type FilterRating = 'all' | '5' | '4' | '3' | '2' | '1'

export default function ReviewsPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<ViewTab>('received')
  const [selectedRating, setSelectedRating] = useState<FilterRating>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [respondingToId, setRespondingToId] = useState<string | null>(null)
  const [responseText, setResponseText] = useState('')

  // Fetch seller reviews (reviews about the seller)
  const {
    reviews,
    stats,
    isLoading,
    respondToReview,
    isResponding,
  } = useSellerReviews({
    rating: selectedRating !== 'all' ? parseInt(selectedRating) : undefined,
    search: searchQuery
  })

  // Filter reviews based on active tab
  const filteredReviews = useMemo(() => {
    let filtered = reviews

    // Filter by tab (received vs given)
    if (activeTab === 'received') {
      filtered = filtered.filter(r => r.reviewed_user_id === user?.id)
    } else {
      filtered = filtered.filter(r => r.reviewer_id === user?.id)
    }

    // Filter by rating
    if (selectedRating !== 'all') {
      filtered = filtered.filter(r => r.rating === parseInt(selectedRating))
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(r =>
        r.comment?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.reviewer?.username?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [reviews, activeTab, selectedRating, searchQuery, user?.id])

  const ratingCounts = useMemo(() => ({
    all: filteredReviews.length,
    5: filteredReviews.filter(r => r.rating === 5).length,
    4: filteredReviews.filter(r => r.rating === 4).length,
    3: filteredReviews.filter(r => r.rating === 3).length,
    2: filteredReviews.filter(r => r.rating === 2).length,
    1: filteredReviews.filter(r => r.rating === 1).length,
  }), [filteredReviews])

  const handleSubmitResponse = async (reviewId: string) => {
    if (!responseText.trim()) return

    try {
      await respondToReview({ id: reviewId, response: responseText })
      setRespondingToId(null)
      setResponseText('')
    } catch (error) {
      console.error('Error submitting response:', error)
    }
  }

  const getTimeAgo = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              'h-4 w-4',
              star <= rating ? 'fill-yellow-400 text-warning' : 'text-text-disabled'
            )}
          />
        ))}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-text-secondary">Loading reviews...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="mx-auto w-full max-w-full px-4 sm:px-6 md:max-w-7xl lg:px-8">
        {/* V21/P7.al — Standard account header. */}
        <AccountPageHeader
          icon="feedback"
          title="Feedback"
          subtitle="Manage your reviews and feedback"
          className="mb-6"
        />

        {/* Stats Overview (only for received reviews) */}
        {activeTab === 'received' && user?.isApprovedSeller && (
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-white/10 bg-gradient-to-br from-primary/20 to-primary/10 p-4"
            >
              <div className="text-sm text-text-secondary">Average Rating</div>
              <div className="mt-1 flex items-baseline gap-2">
                <div className="text-2xl font-bold text-white">{stats.avgRating.toFixed(1)}</div>
                <Star className="h-5 w-5 fill-yellow-400 text-warning" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="rounded-lg border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-4"
            >
              <div className="text-sm text-text-secondary">Total Reviews</div>
              <div className="mt-1 text-2xl font-bold text-white">{stats.totalReviews}</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-lg border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-4"
            >
              <div className="text-sm text-text-secondary">Response Rate</div>
              <div className="mt-1 text-2xl font-bold text-white">{stats.responseRate}%</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="rounded-lg border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-4"
            >
              <div className="text-sm text-text-secondary">5-Star Reviews</div>
              <div className="mt-1 text-2xl font-bold text-white">
                {stats.ratingCounts[5] || 0}
              </div>
            </motion.div>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex gap-3">
          <button
            onClick={() => setActiveTab('received')}
            className={cn(
              activeTab === 'received'
                ? "flex items-center gap-2 rounded-lg border border-lime-tint-border bg-lime-tint-bg px-4 py-2.5 text-sm font-semibold text-lime-text transition-colors"
                : "flex items-center gap-2 rounded-lg border border-border-subtle card-frost px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:border-lime-tint-border hover:text-text-primary"
            )}
          >
            <TrendingDown className="w-4 h-4" />
            Received
          </button>
          <button
            onClick={() => setActiveTab('given')}
            className={cn(
              activeTab === 'given'
                ? "flex items-center gap-2 rounded-lg border border-lime-tint-border bg-lime-tint-bg px-4 py-2.5 text-sm font-semibold text-lime-text transition-colors"
                : "flex items-center gap-2 rounded-lg border border-border-subtle card-frost px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:border-lime-tint-border hover:text-text-primary"
            )}
          >
            <TrendingUp className="w-4 h-4" />
            Given
          </button>
        </div>

        {/* Rating Filter */}
        <div className="mb-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {(['all', '5', '4', '3', '2', '1'] as FilterRating[]).map((rating) => (
            <motion.button
              key={rating}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setSelectedRating(rating)}
              className={cn(
                'rounded-lg border p-3 text-left transition-all',
                selectedRating === rating
                  ? 'border-primary bg-gradient-to-br from-primary/20 to-primary/10'
                  : 'border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] hover:border-white/20'
              )}
            >
              <div className="text-sm text-text-secondary">
                {rating === 'all' ? 'All' : `${rating} Star`}
              </div>
              <div className="mt-1 text-xl font-bold text-white">
                {rating === 'all' ? ratingCounts.all : ratingCounts[rating as '1' | '2' | '3' | '4' | '5']}
              </div>
            </motion.button>
          ))}
        </div>

        {/* Search */}
        <div className="mb-6 relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            placeholder="Search reviews..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 py-3 pl-10 pr-10 text-white placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Reviews List */}
        {filteredReviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-12 backdrop-blur-md">
            <Award className="mb-4 h-16 w-16 text-lime-text" />
            <h3 className="mb-2 text-xl font-bold text-white">No reviews found</h3>
            <p className="text-text-secondary">
              {searchQuery ? 'Try adjusting your search' : `You haven't ${activeTab === 'received' ? 'received' : 'given'} any reviews yet`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredReviews.map((review, index) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="rounded-lg border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 backdrop-blur-md"
              >
                {/* Review Header */}
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={getAvatarUrl(review.reviewer?.avatar_url, review.reviewer?.username || 'user')}
                      alt={review.reviewer?.username || 'User'}
                      className="h-12 w-12 rounded-full ring-2 ring-white/10"
                    />
                    <div>
                      <div className="font-medium text-white">{review.reviewer?.username || 'Unknown User'}</div>
                      <div className="text-sm text-text-secondary">{getTimeAgo(review.created_at)}</div>
                    </div>
                  </div>
                  {renderStars(review.rating)}
                </div>

                {/* Order Info */}
                {review.order?.listing?.title && (
                  <div className="mb-3 rounded-lg border border-white/5 bg-bg-overlay p-3">
                    <div className="text-xs text-text-secondary">Order</div>
                    <div className="text-sm text-white">{review.order.listing.title}</div>
                  </div>
                )}

                {/* Review Comment */}
                {review.comment && (
                  <p className="mb-4 text-text-secondary">{review.comment}</p>
                )}

                {/* Helpful Count */}
                {review.helpful_count && review.helpful_count > 0 && (
                  <div className="mb-4 flex items-center gap-2 text-sm text-text-secondary">
                    <ThumbsUp className="h-4 w-4" />
                    {review.helpful_count} {review.helpful_count === 1 ? 'person' : 'people'} found this helpful
                  </div>
                )}

                {/* Seller Response */}
                {review.seller_response && (
                  <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm text-primary">
                      <MessageSquare className="h-4 w-4" />
                      Seller Response
                    </div>
                    <p className="text-text-secondary">{review.seller_response}</p>
                    {review.seller_responded_at && (
                      <div className="mt-2 text-xs text-text-secondary">
                        Responded {getTimeAgo(review.seller_responded_at)}
                      </div>
                    )}
                  </div>
                )}

                {/* Response Form (only for received reviews by sellers) */}
                {activeTab === 'received' && user?.isApprovedSeller && !review.seller_response && (
                  <div className="mt-4">
                    {respondingToId === review.id ? (
                      <div className="space-y-3">
                        <textarea
                          value={responseText}
                          onChange={(e) => setResponseText(e.target.value)}
                          placeholder="Write your response..."
                          rows={3}
                          className="w-full rounded-lg border border-white/10 bg-white/5 p-3 text-white placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSubmitResponse(review.id)}
                            disabled={isResponding || !responseText.trim()}
                            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-purple-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                          >
                            {isResponding ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                            Submit Response
                          </button>
                          <button
                            onClick={() => {
                              setRespondingToId(null)
                              setResponseText('')
                            }}
                            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition-all hover:bg-white/10"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setRespondingToId(review.id)}
                        className="flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        <MessageSquare className="h-4 w-4" />
                        Respond to this review
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

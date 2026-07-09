/**
 * Admin Reviews Management — client component.
 *
 * Manage and moderate platform reviews. The initial (unfiltered) review
 * list + stats are fetched by the server wrapper (../page.tsx) and
 * passed in as props, so the page arrives fully rendered — no
 * "Loading reviews…" flash. Filter changes and post-action refreshes
 * still go through loadData() client-side.
 */

'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useRouter } from 'next/navigation'
import {
  getAdminReviews,
  getReviewStats,
  toggleReviewVisibility,
  toggleReviewFlag,
  deleteReview,
  getReviewHistory,
} from '@/lib/actions/admin-reviews'
import {
  ThumbsUp,
  ThumbsDown,
  Eye,
  EyeOff,
  Trash2,
  Flag,
  FlagOff,
  User,
  Star,
  Calendar,
  Loader2,
  Search,
  History,
  AlertTriangle,
  CheckCircle,
  Shield,
  MessageSquare,
  Edit3,
  ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { PageHeader, StatCard } from '../../components/kit'

export default function ReviewsPageClient({
  initialReviews,
  initialStats,
}: {
  initialReviews: any[]
  initialStats: any
}) {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  // V54 — State is seeded from the server wrapper; the initial render
  // shows real data (isLoading starts false, no mount fetch).
  const [reviews, setReviews] = useState<any[]>(initialReviews)
  const [filteredReviews, setFilteredReviews] = useState<any[]>(initialReviews)
  const [stats, setStats] = useState<any>(initialStats)
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedReview, setSelectedReview] = useState<any>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [showHideModal, setShowHideModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [hideReason, setHideReason] = useState('')
  const [editHistory, setEditHistory] = useState<any[]>([])

  // Filters
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [ratingFilter, setRatingFilter] = useState<number[]>([])

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  // V54 — Skip the first run: the default view ([] filters) is already
  // server-seeded. Subsequent filter changes refetch as before.
  const didInitRef = useRef(false)
  useEffect(() => {
    if (!didInitRef.current) {
      didInitRef.current = true
      return
    }
    loadData()
  }, [statusFilter, ratingFilter])

  useEffect(() => {
    // Filter reviews based on search
    if (searchQuery) {
      const filtered = reviews.filter(
        (review) =>
          review.comment.toLowerCase().includes(searchQuery.toLowerCase()) ||
          review.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          review.buyer?.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
          review.seller?.username.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setFilteredReviews(filtered)
    } else {
      setFilteredReviews(reviews)
    }
  }, [searchQuery, reviews])

  const loadData = async () => {
    setIsLoading(true)
    const [reviewsResult, statsResult] = await Promise.all([
      getAdminReviews({ status: statusFilter, rating: ratingFilter }),
      getReviewStats(),
    ])

    if (reviewsResult.success) {
      setReviews(reviewsResult.reviews || [])
      setFilteredReviews(reviewsResult.reviews || [])
    }

    if (statsResult.success) {
      setStats(statsResult.stats)
    }

    setIsLoading(false)
  }

  const handleToggleVisibility = async (reviewId: string, currentVisibility: boolean) => {
    if (!currentVisibility && !hideReason.trim()) {
      toast.error('Please provide a reason for hiding the review')
      return
    }

    setActionLoading(true)
    const result = await toggleReviewVisibility(
      reviewId,
      !currentVisibility,
      currentVisibility ? undefined : hideReason
    )

    if (result.success) {
      toast.success(currentVisibility ? 'Review hidden' : 'Review made visible')
      setShowHideModal(false)
      setHideReason('')
      loadData()
    } else {
      toast.error(result.error || 'Failed to update review')
    }

    setActionLoading(false)
  }

  const handleToggleFlag = async (reviewId: string, currentFlag: boolean) => {
    setActionLoading(true)
    const result = await toggleReviewFlag(reviewId, !currentFlag)

    if (result.success) {
      toast.success(currentFlag ? 'Flag removed' : 'Review flagged')
      loadData()
    } else {
      toast.error(result.error || 'Failed to update flag')
    }

    setActionLoading(false)
  }

  const handleDelete = async (reviewId: string) => {
    setActionLoading(true)
    const result = await deleteReview(reviewId)

    if (result.success) {
      toast.success('Review deleted successfully')
      setShowDeleteModal(false)
      loadData()
    } else {
      toast.error(result.error || 'Failed to delete review')
    }

    setActionLoading(false)
  }

  const handleViewHistory = async (reviewId: string) => {
    const result = await getReviewHistory(reviewId)
    if (result.success) {
      setEditHistory(result.history)
      setShowHistoryModal(true)
    } else {
      toast.error('Failed to load edit history')
    }
  }

  const toggleStatusFilter = (status: string) => {
    setStatusFilter(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    )
  }

  const toggleRatingFilter = (rating: number) => {
    setRatingFilter(prev =>
      prev.includes(rating)
        ? prev.filter(r => r !== rating)
        : [...prev, rating]
    )
  }

  // V54 — authLoading no longer gates the render: auth is enforced by
  // the server layout, and the seeded data is valid for this admin.
  // isLoading starts false, so the initial render can never hit this
  // branch; it only shows during filter/post-action loadData() runs.
  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-lime-text" />
          <p className="text-text-secondary">Loading reviews...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <PageHeader
          title="Review Management"
          description="Moderate and manage platform reviews"
        />

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <StatCard label="Total Reviews" value={stats.total_reviews} icon={MessageSquare} tone="lime" />
            <StatCard label="Flagged Reviews" value={stats.flagged_reviews} icon={Flag} tone="warning" />
            <StatCard label="Average Rating" value={stats.avg_rating.toFixed(1)} icon={Star} tone="success" />
            <StatCard
              label="Positive Rate"
              value={`${stats.total_reviews > 0
                ? Math.round((stats.positive_reviews / stats.total_reviews) * 100)
                : 0}%`}
              icon={ThumbsUp}
              tone="info"
            />
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 bg-bg-raised border border-border-default rounded-xl p-4">
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
              <input
                type="text"
                placeholder="Search reviews..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-bg-base border border-border-default rounded-lg text-text-primary placeholder:text-text-tertiary focus:border-lime focus:outline-none"
              />
            </div>

            {/* Status Filters */}
            <div>
              <label className="text-sm font-medium text-text-secondary mb-2 block">Status</label>
              <div className="flex flex-wrap gap-2">
                {['flagged', 'hidden', 'visible'].map(status => (
                  <button
                    key={status}
                    onClick={() => toggleStatusFilter(status)}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      statusFilter.includes(status)
                        ? 'border-lime-tint-border bg-lime-tint-bg text-lime-text'
                        : 'border-border-default bg-bg-overlay text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {status === 'flagged' && <Flag className="w-4 h-4 inline mr-1" />}
                    {status === 'hidden' && <EyeOff className="w-4 h-4 inline mr-1" />}
                    {status === 'visible' && <Eye className="w-4 h-4 inline mr-1" />}
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Rating Filters */}
            <div>
              <label className="text-sm font-medium text-text-secondary mb-2 block">Rating</label>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map(rating => (
                  <button
                    key={rating}
                    onClick={() => toggleRatingFilter(rating)}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      ratingFilter.includes(rating)
                        ? 'border-lime-tint-border bg-lime-tint-bg text-lime-text'
                        : 'border-border-default bg-bg-overlay text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <Star className="w-4 h-4 inline mr-1" fill={ratingFilter.includes(rating) ? 'currentColor' : 'none'} />
                    {rating}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Reviews List */}
        {filteredReviews.length === 0 ? (
          <div className="text-center py-12 bg-bg-raised border border-border-default rounded-xl">
            <CheckCircle className="w-16 h-16 text-text-disabled mx-auto mb-4" />
            <h3 className="text-xl font-bold text-text-primary mb-2">No reviews found</h3>
            <p className="text-text-secondary">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredReviews.map((review) => {
              const isPositive = review.rating >= 4
              const ThumbIcon = isPositive ? ThumbsUp : ThumbsDown
              const thumbColor = isPositive ? 'text-green-400' : 'text-red-400'

              return (
                <div
                  key={review.id}
                  className={`bg-bg-raised border ${
                    review.flagged_for_moderation
                      ? 'border-yellow-500/40'
                      : !review.is_visible
                      ? 'border-red-500/40'
                      : 'border-border-default'
                  } rounded-xl p-6 hover:border-border-strong transition-colors`}
                >
                  <div className="flex gap-4">
                    {/* Rating Icon */}
                    <div className="flex-shrink-0">
                      <div className={`p-3 rounded-lg ${
                        isPositive ? 'bg-green-500/10' : 'bg-red-500/10'
                      }`}>
                        <ThumbIcon className={`w-6 h-6 ${thumbColor} fill-current`} />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl font-bold tabular-nums text-text-primary">{review.rating}.0</span>
                            {review.is_verified_purchase && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/10 border border-green-500/20 rounded text-green-400 text-xs font-medium">
                                <Shield className="w-3 h-3" />
                                Verified
                              </span>
                            )}
                            {review.flagged_for_moderation && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded text-yellow-400 text-xs font-medium">
                                <Flag className="w-3 h-3" />
                                Flagged
                              </span>
                            )}
                            {!review.is_visible && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs font-medium">
                                <EyeOff className="w-3 h-3" />
                                Hidden
                              </span>
                            )}
                            {review.edit_count > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-bg-overlay border border-border-default rounded text-text-secondary text-xs font-medium">
                                <Edit3 className="w-3 h-3" />
                                Edited
                              </span>
                            )}
                          </div>

                          {review.title && (
                            <h4 className="text-lg font-semibold text-text-primary mb-2">{review.title}</h4>
                          )}

                          <p className="text-text-secondary text-sm mb-3">{review.comment}</p>

                          {/* Meta Info */}
                          <div className="flex flex-wrap items-center gap-4 text-xs text-text-secondary">
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              <span className="font-medium">{review.buyer?.username}</span>
                              <span className="text-text-disabled">→</span>
                              <span className="font-medium">{review.seller?.shop_name || review.seller?.username}</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
                            </span>
                            {review.game && (
                              <span>{review.game.name}</span>
                            )}
                            {review.listing && (
                              <Link
                                href={`/listings/${review.listing.id}`}
                                className="flex items-center gap-1 hover:text-lime-text transition-colors"
                              >
                                <ExternalLink className="w-3 h-3" />
                                {review.listing.title}
                              </Link>
                            )}
                          </div>

                          {/* Seller Response */}
                          {review.seller_response && (
                            <div className="mt-3 ml-4 pl-3 border-l-2 border-border-strong text-xs">
                              <div className="flex items-center gap-1 mb-1">
                                <MessageSquare className="w-3 h-3 text-text-secondary" />
                                <span className="font-medium text-text-secondary">Seller Response</span>
                              </div>
                              <p className="text-text-tertiary">{review.seller_response}</p>
                            </div>
                          )}

                          {/* Moderation Reason */}
                          {review.moderation_reason && (
                            <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-xs">
                              <span className="font-medium text-yellow-400">Moderation Note: </span>
                              <span className="text-text-secondary">{review.moderation_reason}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2 mt-4">
                        <button
                          onClick={() => handleToggleFlag(review.id, review.flagged_for_moderation)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                            review.flagged_for_moderation
                              ? 'bg-green-500 hover:bg-green-600 text-white'
                              : 'bg-yellow-500 hover:bg-yellow-600 text-white'
                          }`}
                        >
                          {review.flagged_for_moderation ? (
                            <>
                              <FlagOff className="w-3 h-3" />
                              Unflag
                            </>
                          ) : (
                            <>
                              <Flag className="w-3 h-3" />
                              Flag
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => {
                            setSelectedReview(review)
                            if (review.is_visible) {
                              setShowHideModal(true)
                            } else {
                              handleToggleVisibility(review.id, review.is_visible)
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                            review.is_visible
                              ? 'bg-red-500 hover:bg-red-600 text-white'
                              : 'bg-green-500 hover:bg-green-600 text-white'
                          }`}
                        >
                          {review.is_visible ? (
                            <>
                              <EyeOff className="w-3 h-3" />
                              Hide
                            </>
                          ) : (
                            <>
                              <Eye className="w-3 h-3" />
                              Show
                            </>
                          )}
                        </button>

                        {review.edit_count > 0 && (
                          <button
                            onClick={() => {
                              setSelectedReview(review)
                              handleViewHistory(review.id)
                            }}
                            className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                          >
                            <History className="w-3 h-3" />
                            History ({review.edit_count})
                          </button>
                        )}

                        {review.order_id && (
                          <Link
                            href={`/orders/${review.order_id}`}
                            className="px-3 py-1.5 border border-border-default bg-bg-overlay hover:bg-bg-overlay-2 text-text-secondary rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            View Order
                          </Link>
                        )}

                        <button
                          onClick={() => {
                            setSelectedReview(review)
                            setShowDeleteModal(true)
                          }}
                          className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Hide Modal */}
        {showHideModal && selectedReview && (
          <Modal
            title="Hide Review"
            onClose={() => {
              setShowHideModal(false)
              setHideReason('')
            }}
          >
            <p className="text-text-secondary mb-4">
              Hide review by {selectedReview.buyer?.username}?
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Reason for Hiding *
              </label>
              <textarea
                value={hideReason}
                onChange={(e) => setHideReason(e.target.value)}
                placeholder="Explain why this review is being hidden..."
                className="w-full px-4 py-3 bg-bg-base border border-border-default rounded-lg text-text-primary placeholder:text-text-tertiary focus:border-lime focus:outline-none resize-none"
                rows={3}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowHideModal(false)
                  setHideReason('')
                }}
                className="flex-1 py-2 border border-border-default bg-bg-overlay hover:bg-bg-overlay-2 text-text-secondary font-medium rounded-lg transition-colors"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                onClick={() => handleToggleVisibility(selectedReview.id, selectedReview.is_visible)}
                disabled={actionLoading || !hideReason.trim()}
                className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Hiding...
                  </>
                ) : (
                  'Hide Review'
                )}
              </button>
            </div>
          </Modal>
        )}

        {/* Delete Modal */}
        {showDeleteModal && selectedReview && (
          <Modal
            title="Delete Review"
            onClose={() => setShowDeleteModal(false)}
          >
            <p className="text-text-secondary mb-4">
              Are you sure you want to delete this review? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2 border border-border-default bg-bg-overlay hover:bg-bg-overlay-2 text-text-secondary font-medium rounded-lg transition-colors"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(selectedReview.id)}
                disabled={actionLoading}
                className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete Review'
                )}
              </button>
            </div>
          </Modal>
        )}

        {/* History Modal */}
        {showHistoryModal && selectedReview && (
          <Modal
            title="Edit History"
            onClose={() => setShowHistoryModal(false)}
          >
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {editHistory.length === 0 ? (
                <p className="text-text-secondary text-center py-4">No edit history</p>
              ) : (
                editHistory.map((edit, index) => (
                  <div key={edit.id} className="p-4 bg-bg-overlay border border-border-subtle rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-text-primary">
                        Edit #{editHistory.length - index}
                      </span>
                      <span className="text-xs text-text-secondary">
                        {formatDistanceToNow(new Date(edit.edited_at), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="text-xs text-text-secondary space-y-1">
                      <div>
                        <span className="text-text-tertiary">Rating:</span> {edit.old_rating} → {edit.new_rating}
                      </div>
                      {edit.old_comment !== edit.new_comment && (
                        <div>
                          <span className="text-text-tertiary">Comment changed</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Modal>
        )}
      </div>
    </div>
  )
}

// Modal Component
function Modal({
  title,
  children,
  onClose,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-bg-raised border border-border-default rounded-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-text-primary mb-4">{title}</h3>
        {children}
      </div>
    </div>
  )
}

/**
 * Admin Reviews Management Page
 *
 * Manage and moderate platform reviews
 */

'use client'

import React, { useState, useEffect } from 'react'
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

export default function AdminReviewsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [reviews, setReviews] = useState<any[]>([])
  const [filteredReviews, setFilteredReviews] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
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

  useEffect(() => {
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

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          <p className="text-gray-400">Loading reviews...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Review Management</h1>
          <p className="text-gray-400">Moderate and manage platform reviews</p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-6">
              <div className="text-sm text-gray-400 mb-1">Total Reviews</div>
              <div className="text-3xl font-bold text-white">{stats.total_reviews}</div>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-6">
              <div className="text-sm text-gray-400 mb-1">Flagged Reviews</div>
              <div className="text-3xl font-bold text-yellow-400">{stats.flagged_reviews}</div>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-6">
              <div className="text-sm text-gray-400 mb-1">Average Rating</div>
              <div className="text-3xl font-bold text-green-400">{stats.avg_rating.toFixed(1)}</div>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-6">
              <div className="text-sm text-gray-400 mb-1">Positive Rate</div>
              <div className="text-3xl font-bold text-blue-400">
                {stats.total_reviews > 0
                  ? Math.round((stats.positive_reviews / stats.total_reviews) * 100)
                  : 0}%
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 bg-white/[0.03] border border-white/[0.05] rounded-xl p-4">
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search reviews..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white/[0.05] border border-white/[0.1] rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            {/* Status Filters */}
            <div>
              <label className="text-sm font-medium text-gray-400 mb-2 block">Status</label>
              <div className="flex flex-wrap gap-2">
                {['flagged', 'hidden', 'visible'].map(status => (
                  <button
                    key={status}
                    onClick={() => toggleStatusFilter(status)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      statusFilter.includes(status)
                        ? 'bg-violet-500 text-white'
                        : 'bg-white/[0.05] text-gray-400 hover:bg-white/[0.08]'
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
              <label className="text-sm font-medium text-gray-400 mb-2 block">Rating</label>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map(rating => (
                  <button
                    key={rating}
                    onClick={() => toggleRatingFilter(rating)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      ratingFilter.includes(rating)
                        ? 'bg-yellow-500 text-white'
                        : 'bg-white/[0.05] text-gray-400 hover:bg-white/[0.08]'
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
          <div className="text-center py-12 bg-white/[0.03] border border-white/[0.05] rounded-xl">
            <CheckCircle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">No reviews found</h3>
            <p className="text-gray-400">Try adjusting your filters</p>
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
                  className={`bg-white/[0.03] border ${
                    review.flagged_for_moderation
                      ? 'border-yellow-500/50'
                      : !review.is_visible
                      ? 'border-red-500/50'
                      : 'border-white/[0.05]'
                  } rounded-xl p-6 hover:border-violet-500/50 transition-colors`}
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
                            <span className="text-2xl font-bold text-white">{review.rating}.0</span>
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
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-500/10 border border-gray-500/20 rounded text-gray-400 text-xs font-medium">
                                <Edit3 className="w-3 h-3" />
                                Edited
                              </span>
                            )}
                          </div>

                          {review.title && (
                            <h4 className="text-lg font-semibold text-white mb-2">{review.title}</h4>
                          )}

                          <p className="text-gray-300 text-sm mb-3">{review.comment}</p>

                          {/* Meta Info */}
                          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              <span className="font-medium">{review.buyer?.username}</span>
                              <span className="text-gray-600">→</span>
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
                                className="flex items-center gap-1 hover:text-violet-400 transition-colors"
                              >
                                <ExternalLink className="w-3 h-3" />
                                {review.listing.title}
                              </Link>
                            )}
                          </div>

                          {/* Seller Response */}
                          {review.seller_response && (
                            <div className="mt-3 ml-4 pl-3 border-l-2 border-purple-500/30 text-xs">
                              <div className="flex items-center gap-1 mb-1">
                                <MessageSquare className="w-3 h-3 text-purple-400" />
                                <span className="font-medium text-purple-400">Seller Response</span>
                              </div>
                              <p className="text-gray-400">{review.seller_response}</p>
                            </div>
                          )}

                          {/* Moderation Reason */}
                          {review.moderation_reason && (
                            <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-xs">
                              <span className="font-medium text-yellow-400">Moderation Note: </span>
                              <span className="text-gray-300">{review.moderation_reason}</span>
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
                            className="px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.08] text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
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
            <p className="text-gray-400 mb-4">
              Hide review by {selectedReview.buyer?.username}?
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Reason for Hiding *
              </label>
              <textarea
                value={hideReason}
                onChange={(e) => setHideReason(e.target.value)}
                placeholder="Explain why this review is being hidden..."
                className="w-full px-4 py-3 bg-white/[0.05] border border-white/[0.1] rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                rows={3}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowHideModal(false)
                  setHideReason('')
                }}
                className="flex-1 py-2 bg-white/[0.05] hover:bg-white/[0.08] text-white font-medium rounded-lg transition-colors"
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
            <p className="text-gray-400 mb-4">
              Are you sure you want to delete this review? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2 bg-white/[0.05] hover:bg-white/[0.08] text-white font-medium rounded-lg transition-colors"
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
                <p className="text-gray-400 text-center py-4">No edit history</p>
              ) : (
                editHistory.map((edit, index) => (
                  <div key={edit.id} className="p-4 bg-white/[0.03] border border-white/[0.05] rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-white">
                        Edit #{editHistory.length - index}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDistanceToNow(new Date(edit.edited_at), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="text-xs text-gray-300 space-y-1">
                      <div>
                        <span className="text-gray-500">Rating:</span> {edit.old_rating} → {edit.new_rating}
                      </div>
                      {edit.old_comment !== edit.new_comment && (
                        <div>
                          <span className="text-gray-500">Comment changed</span>
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-black border border-white/[0.1] rounded-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-white mb-4">{title}</h3>
        {children}
      </div>
    </div>
  )
}

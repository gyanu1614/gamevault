/**
 * Admin Reviews Management — client component.
 *
 * Manage and moderate platform reviews. The initial (unfiltered) review
 * list + stats are fetched by the server wrapper (../page.tsx) and
 * passed in as props, so the page arrives fully rendered — no
 * "Loading reviews…" flash. Filter changes, paging and post-action
 * refreshes go through loadData() client-side (the list swaps to skeleton
 * rows; the header and filters stay put).
 */

'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  getAdminReviews,
  getReviewStats,
  toggleReviewVisibility,
  toggleReviewFlag,
  deleteReview,
  getReviewHistory,
} from '@/lib/actions/admin-reviews'
import {
  ArrowSquareOut,
  ChatText,
  CircleNotch,
  ClockCounterClockwise,
  Eye,
  EyeSlash,
  Flag,
  MagnifyingGlass,
  PencilSimple,
  SealCheck,
  Star,
  Trash,
  X,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { StatStrip, accountInputCls } from '@/components/account/AccountSurface'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import {
  AdminEmpty,
  AdminLoadingRows,
  AdminPagination,
  FilterChip,
  FilterRow,
  PageHeader,
  adminBtn,
  adminBtnSm,
  adminFieldCls,
} from '../../components/kit'

interface Pagination {
  total: number
  page: number
  limit: number
  totalPages: number
}

const CHIP = 'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold'

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden
          weight="fill"
          className={cn('h-3.5 w-3.5', n <= rating ? 'text-warning' : 'text-white/[0.12]')}
        />
      ))}
    </span>
  )
}

export default function ReviewsPageClient({
  initialReviews,
  initialStats,
  initialPagination = null,
}: {
  initialReviews: any[]
  initialStats: any
  initialPagination?: Pagination | null
}) {
  // V54 — State is seeded from the server wrapper; the initial render
  // shows real data (isLoading starts false, no mount fetch).
  const [reviews, setReviews] = useState<any[]>(initialReviews)
  const [filteredReviews, setFilteredReviews] = useState<any[]>(initialReviews)
  const [stats, setStats] = useState<any>(initialStats)
  const [pagination, setPagination] = useState<Pagination | null>(initialPagination)
  const [page, setPage] = useState(1)
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

  // V54 — Skip the first run: the default view ([] filters) is already
  // server-seeded. Subsequent filter changes refetch from page 1.
  const didInitRef = useRef(false)
  useEffect(() => {
    if (!didInitRef.current) {
      didInitRef.current = true
      return
    }
    setPage(1)
    loadData(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const loadData = async (nextPage = page) => {
    setIsLoading(true)
    const [reviewsResult, statsResult] = await Promise.all([
      getAdminReviews({ status: statusFilter, rating: ratingFilter, page: nextPage }),
      getReviewStats(),
    ])

    if (reviewsResult.success) {
      setReviews(reviewsResult.reviews || [])
      setFilteredReviews(reviewsResult.reviews || [])
      setPagination(reviewsResult.pagination ?? null)
    }

    if (statsResult.success) {
      setStats(statsResult.stats)
    }

    setIsLoading(false)
  }

  const goToPage = (next: number) => {
    setPage(next)
    loadData(next)
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

  const positiveRate =
    stats && stats.total_reviews > 0 ? Math.round((stats.positive_reviews / stats.total_reviews) * 100) : 0

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Reviews"
        description="Moderate buyer reviews: flag, hide, or remove."
        className="mb-0 sm:mb-0"
      />

      {stats && (
        <StatStrip
          stats={[
            { label: 'Total Reviews', value: stats.total_reviews.toLocaleString() },
            {
              label: 'Flagged',
              value: <span className={stats.flagged_reviews > 0 ? 'text-warning' : undefined}>{stats.flagged_reviews}</span>,
              hint: `${stats.hidden_reviews} hidden`,
            },
            {
              label: 'Average Rating',
              value: (
                <span className="inline-flex items-center gap-1.5">
                  {stats.avg_rating.toFixed(1)}
                  <Star aria-hidden weight="fill" className="h-4 w-4 text-warning" />
                </span>
              ),
            },
            { label: 'Positive Rate', value: `${positiveRate}%`, hint: '4 or 5 stars' },
          ]}
        />
      )}

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="relative">
          <MagnifyingGlass
            aria-hidden
            weight="bold"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary"
          />
          <input
            type="text"
            aria-label="Search reviews on this page"
            placeholder="Search comment, title, buyer or seller…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(adminFieldCls, 'pl-10 pr-9')}
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-white/[0.08] hover:text-text-primary"
            >
              <X aria-hidden weight="bold" className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:gap-6">
          <FilterRow label="Status">
            {(['flagged', 'hidden', 'visible'] as const).map((status) => (
              <FilterChip key={status} selected={statusFilter.includes(status)} onClick={() => toggleStatusFilter(status)}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </FilterChip>
            ))}
          </FilterRow>
          <FilterRow label="Rating">
            {[5, 4, 3, 2, 1].map((rating) => (
              <FilterChip key={rating} selected={ratingFilter.includes(rating)} onClick={() => toggleRatingFilter(rating)}>
                <span className="inline-flex items-center gap-1">
                  {rating}
                  <Star aria-hidden weight="fill" className="h-3 w-3 text-warning" />
                </span>
              </FilterChip>
            ))}
          </FilterRow>
        </div>
      </div>

      {/* Reviews list */}
      {isLoading ? (
        <AdminLoadingRows rows={5} />
      ) : filteredReviews.length === 0 ? (
        <AdminEmpty
          icon={ChatText}
          title="No Reviews Found"
          hint={searchQuery || statusFilter.length || ratingFilter.length ? 'Try adjusting your search or filters.' : 'Buyer reviews show up here.'}
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {filteredReviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                busy={actionLoading}
                onToggleFlag={() => handleToggleFlag(review.id, review.flagged_for_moderation)}
                onToggleVisibility={() => {
                  setSelectedReview(review)
                  if (review.is_visible) {
                    setShowHideModal(true)
                  } else {
                    handleToggleVisibility(review.id, review.is_visible)
                  }
                }}
                onHistory={() => {
                  setSelectedReview(review)
                  handleViewHistory(review.id)
                }}
                onDelete={() => {
                  setSelectedReview(review)
                  setShowDeleteModal(true)
                }}
              />
            ))}
          </div>
          {pagination && !searchQuery && (
            <AdminPagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              limit={pagination.limit}
              onPage={goToPage}
              noun="reviews"
            />
          )}
        </div>
      )}

      {/* Hide dialog */}
      <ReviewDialog
        open={showHideModal && !!selectedReview}
        onClose={() => {
          setShowHideModal(false)
          setHideReason('')
        }}
        busy={actionLoading}
        title="Hide Review"
        description={`Hide the review by ${selectedReview?.buyer?.username ?? 'this buyer'}? It stops showing on the seller's page.`}
      >
        <div>
          <label htmlFor="review-hide-reason" className="mb-1.5 block text-[13px] font-medium text-text-secondary">
            Reason for Hiding <span className="text-error">*</span>
          </label>
          <textarea
            id="review-hide-reason"
            value={hideReason}
            onChange={(e) => setHideReason(e.target.value)}
            placeholder="Explain why this review is being hidden…"
            className={cn(accountInputCls, 'resize-none')}
            rows={3}
          />
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => {
              setShowHideModal(false)
              setHideReason('')
            }}
            className={adminBtn.secondary}
            disabled={actionLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => selectedReview && handleToggleVisibility(selectedReview.id, selectedReview.is_visible)}
            disabled={actionLoading || !hideReason.trim()}
            className={adminBtn.danger}
          >
            {actionLoading ? (
              <>
                <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
                Hiding…
              </>
            ) : (
              <>
                <EyeSlash aria-hidden weight="bold" className="h-4 w-4" />
                Hide Review
              </>
            )}
          </button>
        </div>
      </ReviewDialog>

      {/* Delete dialog */}
      <ReviewDialog
        open={showDeleteModal && !!selectedReview}
        onClose={() => setShowDeleteModal(false)}
        busy={actionLoading}
        title="Delete Review"
        description="Are you sure you want to delete this review? This action cannot be undone."
      >
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setShowDeleteModal(false)}
            className={adminBtn.secondary}
            disabled={actionLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => selectedReview && handleDelete(selectedReview.id)}
            disabled={actionLoading}
            className={adminBtn.danger}
          >
            {actionLoading ? (
              <>
                <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <Trash aria-hidden weight="bold" className="h-4 w-4" />
                Delete Review
              </>
            )}
          </button>
        </div>
      </ReviewDialog>

      {/* History dialog */}
      <ReviewDialog
        open={showHistoryModal && !!selectedReview}
        onClose={() => setShowHistoryModal(false)}
        title="Edit History"
        description={`Changes the buyer made to this review${selectedReview?.buyer?.username ? ` (${selectedReview.buyer.username})` : ''}.`}
      >
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {editHistory.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-text-tertiary">No edit history</p>
          ) : (
            editHistory.map((edit, index) => (
              <div key={edit.id} className="rounded-md bg-bg-overlay px-3.5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13px] font-semibold text-text-primary">Edit #{editHistory.length - index}</span>
                  <span className="text-[12px] text-text-tertiary">
                    {formatDistanceToNow(new Date(edit.edited_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="mt-1 text-[12.5px] text-text-secondary">
                  Rating <span className="tabular-nums">{edit.old_rating} → {edit.new_rating}</span>
                  {edit.old_comment !== edit.new_comment && <span className="text-text-tertiary"> · Comment changed</span>}
                </p>
              </div>
            ))
          )}
        </div>
      </ReviewDialog>
    </div>
  )
}

// ─── Review card ─────────────────────────────────────────────────────────────

function ReviewCard({
  review,
  busy,
  onToggleFlag,
  onToggleVisibility,
  onHistory,
  onDelete,
}: {
  review: any
  busy: boolean
  onToggleFlag: () => void
  onToggleVisibility: () => void
  onHistory: () => void
  onDelete: () => void
}) {
  return (
    <article className="flex flex-col rounded-lg bg-bg-raised p-4 sm:p-5">
      {/* Rating, badges, age */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <Stars rating={review.rating} />
        <span className="text-[13px] font-semibold tabular-nums text-text-primary">{review.rating}.0</span>
        {review.is_verified_purchase && (
          <span className={cn(CHIP, 'bg-success-bg text-success')}>
            <SealCheck aria-hidden weight="fill" className="h-3 w-3" />
            Verified
          </span>
        )}
        {review.flagged_for_moderation && (
          <span className={cn(CHIP, 'bg-warning-bg text-warning')}>
            <Flag aria-hidden weight="fill" className="h-3 w-3" />
            Flagged
          </span>
        )}
        {!review.is_visible && (
          <span className={cn(CHIP, 'bg-error-bg text-error')}>
            <EyeSlash aria-hidden weight="bold" className="h-3 w-3" />
            Hidden
          </span>
        )}
        {review.edit_count > 0 && (
          <span className={cn(CHIP, 'bg-white/[0.07] text-text-secondary')}>
            <PencilSimple aria-hidden weight="bold" className="h-3 w-3" />
            Edited
          </span>
        )}
        <span className="ml-auto text-[12px] text-text-tertiary">
          {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
        </span>
      </div>

      {review.title && <h3 className="mt-3 text-[14.5px] font-semibold text-text-primary">{review.title}</h3>}
      <p className={cn('text-[13.5px] leading-relaxed text-text-secondary', review.title ? 'mt-1' : 'mt-3')}>
        {review.comment}
      </p>

      {/* Who, what */}
      <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-text-tertiary">
        <span>
          <span className="font-medium text-text-secondary">{review.buyer?.username}</span>
          <span aria-hidden> → </span>
          <span className="sr-only"> reviewed </span>
          <span className="font-medium text-text-secondary">{review.seller?.shop_name || review.seller?.username}</span>
        </span>
        {review.game && <span>{review.game.name}</span>}
        {review.listing && (
          <Link
            href={`/listings/${review.listing.id}`}
            target="_blank"
            className="inline-flex min-w-0 max-w-full items-center gap-1 text-text-secondary underline-offset-4 hover:text-text-primary hover:underline"
          >
            <span className="truncate">{review.listing.title}</span>
            <ArrowSquareOut aria-hidden weight="bold" className="h-3 w-3 shrink-0" />
          </Link>
        )}
      </div>

      {review.seller_response && (
        <div className="mt-3 rounded-md bg-bg-overlay px-3.5 py-2.5">
          <p className="text-[12px] font-medium text-text-tertiary">Seller Response</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-text-secondary">{review.seller_response}</p>
        </div>
      )}

      {review.moderation_reason && (
        <p className="mt-3 rounded-md bg-warning-bg px-3.5 py-2.5 text-[13px] leading-relaxed text-text-secondary">
          <span className="font-semibold text-warning">Moderation Note: </span>
          {review.moderation_reason}
        </p>
      )}

      {/* Actions — one row that scrolls sideways on phones */}
      <div className="mt-auto pt-4">
        <div className="-mx-4 flex gap-1.5 overflow-x-auto border-t border-white/[0.06] px-4 pt-3.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
          <button type="button" onClick={onToggleFlag} disabled={busy} className={adminBtnSm.secondary}>
            <Flag aria-hidden weight={review.flagged_for_moderation ? 'fill' : 'bold'} className="h-3.5 w-3.5" />
            {review.flagged_for_moderation ? 'Unflag' : 'Flag'}
          </button>
          <button
            type="button"
            onClick={onToggleVisibility}
            disabled={busy}
            className={review.is_visible ? adminBtnSm.danger : adminBtnSm.secondary}
          >
            {review.is_visible ? (
              <>
                <EyeSlash aria-hidden weight="bold" className="h-3.5 w-3.5" />
                Hide
              </>
            ) : (
              <>
                <Eye aria-hidden weight="bold" className="h-3.5 w-3.5" />
                Show
              </>
            )}
          </button>
          {review.edit_count > 0 && (
            <button type="button" onClick={onHistory} className={adminBtnSm.secondary}>
              <ClockCounterClockwise aria-hidden weight="bold" className="h-3.5 w-3.5" />
              History ({review.edit_count})
            </button>
          )}
          {review.order_id && (
            <Link href={`/admin/orders/${review.order_id}`} className={adminBtnSm.secondary}>
              <ArrowSquareOut aria-hidden weight="bold" className="h-3.5 w-3.5" />
              View Order
            </Link>
          )}
          <button type="button" onClick={onDelete} disabled={busy} className={cn(adminBtnSm.danger, 'sm:ml-auto')}>
            <Trash aria-hidden weight="bold" className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      </div>
    </article>
  )
}

// ─── Dialog shell ────────────────────────────────────────────────────────────

function ReviewDialog({
  open,
  onClose,
  busy,
  title,
  description,
  children,
}: {
  open: boolean
  onClose: () => void
  busy?: boolean
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-[460px] border-0 p-5 sm:p-6">
        <div className="pr-8">
          <DialogTitle className="text-[18px] font-bold leading-tight">{title}</DialogTitle>
          <DialogDescription className="mt-1.5 leading-relaxed">{description}</DialogDescription>
        </div>
        {children}
      </DialogContent>
    </Dialog>
  )
}

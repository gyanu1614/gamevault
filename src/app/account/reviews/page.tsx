'use client'

/**
 * Feedback: what buyers said about this seller, with a reply per review.
 *
 * 2026-09-29 rebuild: one fetch of the received reviews, filtered by rating
 * and search in the browser (the old page refetched on every keystroke and
 * counted stars from the already-filtered list, so picking "5 Stars" zeroed
 * every other count). The "Given" tab is gone: the reviews API only returns
 * received reviews, so it could never show anything.
 */

import { useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Loader2, Search, Star, X } from 'lucide-react'
import ReviewsRounded from '@mui/icons-material/ReviewsRounded'
import AccountPageHeader from '@/components/account/AccountPageHeader'
import { AccountCard, AccountPage, StatStrip, accountBtn, accountInputCls } from '@/components/account/AccountSurface'
import { RevealGroup, RevealItem } from '@/components/account/Reveal'
import { SegmentedTabs, TabCount } from '@/components/account/SegmentedTabs'
import { useSellerReviews } from '@/hooks/use-seller-reviews'
import type { Review } from '@/lib/api/seller-compatible'
import { getAvatarUrl } from '@/lib/utils/avatar'
import { cn } from '@/lib/utils'
import ReviewsLoading from './loading'

type RatingFilter = 'all' | '5' | '4' | '3' | '2' | '1'
const RATINGS: RatingFilter[] = ['all', '5', '4', '3', '2', '1']

function timeAgo(date: string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function Stars({ rating, size = 'h-4 w-4' }: { rating: number; size?: string }) {
  return (
    <div className="flex gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden
          className={cn(size, star <= rating ? 'fill-yellow-400 text-warning' : 'text-text-disabled')}
        />
      ))}
    </div>
  )
}

export default function ReviewsPage() {
  const [rating, setRating] = useState<RatingFilter>('all')
  const [query, setQuery] = useState('')
  const { reviews, stats, isLoading, respondToReview, isResponding } = useSellerReviews()
  const reduceMotion = useReducedMotion()

  const counts = useMemo(() => {
    const byStar: Record<string, number> = { all: reviews.length, 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    for (const r of reviews) byStar[String(r.rating)] = (byStar[String(r.rating)] ?? 0) + 1
    return byStar
  }, [reviews])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return reviews
      .filter((r) => rating === 'all' || r.rating === Number(rating))
      .filter(
        (r) =>
          !q ||
          r.comment?.toLowerCase().includes(q) ||
          r.reviewer?.username?.toLowerCase().includes(q) ||
          r.order?.listing?.title?.toLowerCase().includes(q),
      )
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [reviews, rating, query])

  if (isLoading) return <ReviewsLoading />

  return (
    <AccountPage>
      <AccountPageHeader title="Feedback" subtitle="What buyers say about your shop." />

      <RevealGroup className="mt-6 space-y-4">
        <RevealItem>
          <StatStrip
            stats={[
              {
                label: 'Average Rating',
                value: (
                  <span className="inline-flex items-center gap-1.5">
                    {stats.avgRating.toFixed(1)}
                    <Star className="h-5 w-5 fill-yellow-400 text-warning" aria-hidden />
                  </span>
                ),
              },
              { label: 'Total Reviews', value: String(stats.totalReviews) },
              { label: 'Response Rate', value: `${stats.responseRate}%`, hint: 'Reviews you replied to' },
              { label: '5-Star Reviews', value: String(stats.ratingCounts[5] || 0) },
            ]}
          />
        </RevealItem>

        <RevealItem className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SegmentedTabs
            tabs={RATINGS.map((id) => ({
              id,
              label: (
                <>
                  {id === 'all' ? 'All' : `${id} Star${id === '1' ? '' : 's'}`}
                  <TabCount n={counts[id] ?? 0} />
                </>
              ),
            }))}
            value={rating}
            onChange={setRating}
            layoutId="reviews-rating-pill"
            ariaLabel="Filter by rating"
          />
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search reviews…"
              aria-label="Search reviews"
              className={cn(accountInputCls, 'h-10 py-0 pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden')}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-text-tertiary transition-colors hover:text-text-primary"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </RevealItem>

        {visible.length === 0 ? (
          <RevealItem>
            <AccountCard className="flex flex-col items-center px-6 py-14 text-center">
              <ReviewsRounded style={{ fontSize: 36 }} className="text-text-tertiary" aria-hidden />
              <h2 className="mt-3 text-[15px] font-semibold text-text-primary">
                {reviews.length === 0 ? 'No Reviews Yet' : 'No Matching Reviews'}
              </h2>
              <p className="mt-1 max-w-sm text-[13px] text-text-secondary">
                {reviews.length === 0
                  ? 'Buyers can review you after an order is completed. Their feedback shows up here.'
                  : 'Try another rating or a different search.'}
              </p>
            </AccountCard>
          </RevealItem>
        ) : (
          <div className="space-y-3">
            {visible.map((review, i) => (
              <motion.div
                key={review.id}
                layout="position"
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                // Capped: a long list shouldn't make the 40th card wait 2 s.
                transition={{ duration: 0.28, delay: Math.min(i, 6) * 0.04, ease: [0.22, 1, 0.36, 1] }}
              >
                <ReviewCard review={review} respond={respondToReview} responding={isResponding} />
              </motion.div>
            ))}
          </div>
        )}
      </RevealGroup>
    </AccountPage>
  )
}

function ReviewCard({
  review,
  respond,
  responding,
}: {
  review: Review
  respond: (input: { id: string; response: string }) => Promise<unknown>
  responding: boolean
}) {
  const [replying, setReplying] = useState(false)
  const [text, setText] = useState('')

  const submit = async () => {
    if (!text.trim()) return
    try {
      await respond({ id: review.id, response: text.trim() })
      setReplying(false)
      setText('')
    } catch (error) {
      console.error('Error submitting response:', error)
    }
  }

  const name = review.reviewer?.username || 'Unknown User'

  return (
    <AccountCard className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- user avatar, any host */}
          <img
            src={getAvatarUrl(review.reviewer?.avatar_url, review.reviewer?.username || 'user')}
            alt=""
            width={40}
            height={40}
            loading="lazy"
            className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-white/10"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text-primary">{name}</p>
            <p className="truncate text-[12px] text-text-tertiary">
              {timeAgo(review.created_at)}
              {review.order?.listing?.title && <span>{`  ·  ${review.order.listing.title}`}</span>}
            </p>
          </div>
        </div>
        <Stars rating={review.rating} />
      </div>

      {review.comment && (
        <p className="mt-4 max-w-[70ch] text-sm leading-relaxed text-text-secondary">{review.comment}</p>
      )}

      {review.seller_response ? (
        <div className="mt-4 rounded-md bg-bg-overlay px-4 py-3">
          <p className="text-[12px] font-semibold text-text-primary">
            Your Reply
            {review.seller_responded_at && (
              <span className="font-normal text-text-tertiary">{`  ·  ${timeAgo(review.seller_responded_at)}`}</span>
            )}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">{review.seller_response}</p>
        </div>
      ) : (
        <AnimatePresence initial={false} mode="wait">
          {replying ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="mt-4 space-y-3">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={`Reply to ${name}…`}
                  aria-label="Your reply"
                  rows={3}
                  autoFocus
                  className={cn(accountInputCls, 'resize-none leading-relaxed')}
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setReplying(false)
                      setText('')
                    }}
                    className={accountBtn.secondary}
                  >
                    Cancel
                  </button>
                  <button type="button" onClick={submit} disabled={responding || !text.trim()} className={accountBtn.primary}>
                    {responding && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                    Post Reply
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div key="cta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-4">
              <button type="button" onClick={() => setReplying(true)} className={cn(accountBtn.secondary, 'h-9')}>
                Reply
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </AccountCard>
  )
}

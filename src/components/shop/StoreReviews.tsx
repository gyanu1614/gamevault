'use client'

/**
 * Storefront reviews: the rating summary (positive %, mean stars, a bar per
 * star that doubles as a filter) beside the review list with All / Positive /
 * Negative chips and Show More. Reviewer handles arrive anonymised from the
 * server; dates are absolute (UTC) so the cached HTML and the hydrated page
 * agree.
 */

import { useMemo, useState } from 'react'
import { ThumbsUpIcon } from '@phosphor-icons/react/dist/csr/ThumbsUp'
import { ThumbsDownIcon } from '@phosphor-icons/react/dist/csr/ThumbsDown'
import { ShieldCheckIcon } from '@phosphor-icons/react/dist/csr/ShieldCheck'
import { StarIcon } from '@phosphor-icons/react/dist/csr/Star'
import { cn } from '@/lib/utils'
import { MARKET_CARD } from '@/lib/ui/surfaces'
import { filterReviews, type RatingBreakdown, type ReviewFilter, type StoreReview } from '@/lib/shop/storefront-model'

const PAGE = 10

const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

export function StoreReviews({
  reviews,
  breakdown,
}: {
  reviews: StoreReview[]
  breakdown: RatingBreakdown
}) {
  const [filter, setFilter] = useState<ReviewFilter>('all')
  const [shown, setShown] = useState(PAGE)
  const list = useMemo(() => filterReviews(reviews, filter), [reviews, filter])
  const pick = (f: ReviewFilter) => {
    setFilter((cur) => (cur === f && f !== 'all' ? 'all' : f))
    setShown(PAGE)
  }

  if (breakdown.total === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg bg-bg-raised px-6 py-12 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-white/[0.05] text-text-secondary">
          <ThumbsUpIcon size={20} aria-hidden />
        </div>
        <h3 className="text-[16px] font-semibold text-text-primary">No Reviews Yet</h3>
        <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-text-secondary">
          Reviews appear here after buyers complete an order with this seller.
        </p>
      </div>
    )
  }

  const chips: { id: ReviewFilter; label: string; n: number }[] = [
    { id: 'all', label: 'All', n: breakdown.total },
    { id: 'positive', label: 'Positive', n: breakdown.positive },
    { id: 'negative', label: 'Negative', n: breakdown.negative },
  ]

  return (
    <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
      {/* Summary */}
      <aside className={cn('rounded-lg p-5', MARKET_CARD, 'lg:sticky lg:top-24')}>
        <div className="flex items-end gap-3">
          <span className="text-[34px] font-bold leading-none tabular-nums text-text-primary">
            {breakdown.positivePercent}%
          </span>
          <span className="pb-1 text-[13px] text-text-secondary">Positive</span>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[13px] text-text-secondary">
          <StarIcon size={14} weight="fill" aria-hidden className="text-warning" />
          <span className="font-semibold tabular-nums text-text-primary">{breakdown.average.toFixed(1)}</span>
          <span>from {breakdown.total.toLocaleString('en-US')} {breakdown.total === 1 ? 'Review' : 'Reviews'}</span>
        </p>

        <ul className="mt-4 space-y-1" aria-label="Filter by rating">
          {([5, 4, 3, 2, 1] as const).map((star) => {
            const n = breakdown.counts[star]
            const pct = breakdown.total > 0 ? (n / breakdown.total) * 100 : 0
            const active = filter === String(star)
            return (
              <li key={star}>
                <button
                  type="button"
                  onClick={() => pick(String(star) as ReviewFilter)}
                  disabled={n === 0}
                  aria-pressed={active}
                  className={cn(
                    'grid w-full grid-cols-[34px_1fr_36px] items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left text-[13px] transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-default disabled:opacity-50',
                    active ? 'bg-white/[0.08]' : 'enabled:hover:bg-white/[0.04]',
                  )}
                >
                  <span className="inline-flex items-center gap-1 tabular-nums text-text-secondary">
                    {star}
                    <StarIcon size={12} weight="fill" aria-hidden className="text-text-tertiary" />
                  </span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                    <span
                      className={cn('block h-full rounded-full', star >= 4 ? 'bg-success' : star === 3 ? 'bg-warning' : 'bg-error')}
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                  <span className="text-right tabular-nums text-text-tertiary">{n}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </aside>

      {/* List */}
      <div className="min-w-0">
        <div role="group" aria-label="Filter reviews" className="flex flex-wrap gap-2">
          {chips.map((c) => {
            const active = filter === c.id
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => pick(c.id)}
                aria-pressed={active}
                className={cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[13px] font-semibold transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                  active ? 'bg-white/[0.12] text-text-primary' : 'bg-white/[0.05] text-text-secondary hover:bg-white/[0.08] hover:text-text-primary',
                )}
              >
                {c.label}
                <span className="tabular-nums text-text-tertiary">{c.n}</span>
              </button>
            )
          })}
        </div>

        {list.length === 0 ? (
          <p className="mt-4 rounded-lg bg-bg-raised px-5 py-8 text-center text-[13px] text-text-secondary">
            No reviews match this filter.
          </p>
        ) : (
          <ul className={cn('mt-4 overflow-hidden rounded-lg', MARKET_CARD)}>
            {list.slice(0, shown).map((r) => (
              <ReviewRow key={r.id} review={r} />
            ))}
          </ul>
        )}

        {shown < list.length && (
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={() => setShown((s) => s + PAGE)}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-bg-raised px-5 text-[13px] font-semibold text-text-primary transition-colors hover:bg-bg-raised-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              Show More Reviews
              <span className="tabular-nums text-text-tertiary">{list.length - shown} left</span>
            </button>
          </div>
        )}
        {reviews.length < breakdown.total && shown >= list.length && (
          <p className="mt-4 text-center text-[12.5px] text-text-tertiary">
            Showing the latest {reviews.length} of {breakdown.total.toLocaleString('en-US')} reviews.
          </p>
        )}
      </div>
    </div>
  )
}

function ReviewRow({ review: r }: { review: StoreReview }) {
  const positive = r.rating >= 4
  const Thumb = positive ? ThumbsUpIcon : ThumbsDownIcon
  const context = [r.gameName, r.listingTitle].filter(Boolean).join(' · ')
  return (
    <li className="border-b border-white/[0.07] px-4 py-4 last:border-b-0 sm:px-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-[13px] font-semibold text-text-primary"
        >
          {r.buyerLabel.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[13.5px] font-semibold text-text-primary">{r.buyerLabel}</span>
            {r.verifiedPurchase && (
              <span className="inline-flex items-center gap-1 text-[12px] font-medium text-success">
                <ShieldCheckIcon size={13} weight="fill" aria-hidden />
                Verified Purchase
              </span>
            )}
            <span className="text-[12px] text-text-tertiary">{fmtDate(r.createdAt)}</span>
          </div>
          {context && <p className="mt-0.5 truncate text-[12px] text-text-tertiary">{context}</p>}
          {r.title && <p className="mt-2 text-[13.5px] font-semibold text-text-primary">{r.title}</p>}
          {r.comment && (
            <p className="mt-1.5 whitespace-pre-line break-words text-[13.5px] leading-relaxed text-text-secondary">{r.comment}</p>
          )}
          {r.sellerResponse && (
            <div className="mt-3 rounded-md bg-white/[0.04] px-3.5 py-2.5">
              <p className="text-[12px] font-semibold text-text-secondary">Seller Response</p>
              <p className="mt-1 whitespace-pre-line break-words text-[13px] leading-relaxed text-text-secondary">{r.sellerResponse}</p>
            </div>
          )}
        </div>
        <span
          aria-label={positive ? 'Positive review' : 'Negative review'}
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
            positive ? 'bg-success-bg text-success' : 'bg-error-bg text-error',
          )}
        >
          <Thumb size={15} weight="fill" aria-hidden />
        </span>
      </div>
    </li>
  )
}

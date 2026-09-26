/**
 * SellerRatingLine — the "👍 99.5% · 425,142 reviews" line under a seller.
 *
 * Replaces the bare "New Seller" caption that used to sit here. A seller with
 * no reviews yet says so, but as soon as they have one the real figure shows —
 * a single 5★ review reads "100% · 1 review", which is what
 * `sellerRatingPercent` already returns (stars/5 × 100). Nothing here invents
 * or floors a score.
 *
 * Kept as its own component because the bundle panel renders this in two
 * places (the selected-seller panel and each Other Sellers row) and they must
 * not drift apart.
 */

import { ThumbsUp, Sparkle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SellerRatingLineProps {
  /** Positive-feedback percentage 0–100, or null when there are no reviews. */
  rating: number | null
  reviews: number
  /** Type scale for the line. Defaults to the compact chip size. */
  size?: 'sm' | 'md'
  className?: string
}

export function SellerRatingLine({
  rating,
  reviews,
  size = 'sm',
  className,
}: SellerRatingLineProps) {
  const text = size === 'md' ? 'text-[12.5px]' : 'text-[11.5px]'
  const icon = size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3'

  // No reviews yet — say it plainly rather than showing a 0% that would read
  // as a bad seller instead of an unrated one.
  if (rating == null || reviews <= 0) {
    return (
      <div
        className={cn(
          'mt-0.5 flex items-center gap-1.5 text-text-tertiary',
          text,
          className,
        )}
      >
        <Sparkle className={cn(icon, 'shrink-0 text-text-tertiary')} aria-hidden />
        <span className="font-semibold text-text-secondary">New seller</span>
        <span aria-hidden>·</span>
        <span>No reviews yet</span>
      </div>
    )
  }

  // Whole numbers stay whole ("100%", not "100.0%"); anything else keeps one
  // decimal so 99.5 does not round up to a perfect-looking 100.
  const pct = Number.isInteger(rating) ? String(rating) : rating.toFixed(1)

  return (
    <div
      className={cn(
        'mt-0.5 flex items-center gap-1.5 text-text-tertiary',
        text,
        className,
      )}
    >
      <ThumbsUp
        className={cn(icon, 'shrink-0 text-emerald-400')}
        aria-hidden
      />
      <span className="font-semibold text-text-secondary">{pct}%</span>
      <span aria-hidden>·</span>
      <span>
        {reviews.toLocaleString()} review{reviews === 1 ? '' : 's'}
      </span>
    </div>
  )
}

/**
 * SellerStats — the one line every buyer-facing surface shows under a
 * seller's name (rule: src/lib/seller/stat-line.ts).
 *
 *   compact (cards, rows):  👍 100% (12) · 34 Sold · Gold
 *   full (listing page, shop, checkout, order page):
 *                           100% Positive · 12 Reviews · 34 Sold · Gold
 *   no sales yet (both):    Verified Seller
 *
 * Text size comes from `className` so it sits in each surface's scale.
 */
import { ThumbsUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sellerStatLine, sellerStatText, type SellerStatInput } from '@/lib/seller/stat-line'

const fmtCount = (v: number) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (v >= 10_000) return `${Math.round(v / 1_000)}K`
  if (v >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return v.toLocaleString('en-US')
}

interface SellerStatsProps extends SellerStatInput {
  variant?: 'compact' | 'full'
  className?: string
}

export function SellerStats({ variant = 'compact', className, ...input }: SellerStatsProps) {
  const line = sellerStatLine(input)
  const label = sellerStatText(input)

  if (line.kind === 'verified') {
    return (
      <span className={cn('inline-flex items-center whitespace-nowrap font-semibold text-text-secondary', className)}>
        Verified Seller
      </span>
    )
  }

  const Dot = () => <span aria-hidden className="text-text-tertiary">·</span>

  return (
    <span
      aria-label={label}
      className={cn('inline-flex min-w-0 items-center gap-1 whitespace-nowrap text-text-tertiary', className)}
    >
      {line.rating &&
        (variant === 'compact' ? (
          <>
            <ThumbsUp aria-hidden className="h-[1em] w-[1em] shrink-0 fill-success text-success" />
            <span aria-hidden className="font-semibold tabular-nums text-success">{line.rating.percent}%</span>
            <span aria-hidden className="tabular-nums">({fmtCount(line.rating.reviews)})</span>
            <Dot />
          </>
        ) : (
          <>
            <span aria-hidden>
              <span className="font-semibold tabular-nums text-success">{line.rating.percent}%</span> Positive
            </span>
            <Dot />
            <span aria-hidden>
              <span className="font-semibold tabular-nums text-text-secondary">{fmtCount(line.rating.reviews)}</span>{' '}
              {line.rating.reviews === 1 ? 'Review' : 'Reviews'}
            </span>
            <Dot />
          </>
        ))}
      {line.sales > 0 && (
        <>
          <span aria-hidden>
            <span className="font-semibold tabular-nums text-text-secondary">{fmtCount(line.sales)}</span> Sold
          </span>
          <Dot />
        </>
      )}
      <span aria-hidden className={cn('font-semibold', line.tierClass)}>{line.tierLabel}</span>
    </span>
  )
}

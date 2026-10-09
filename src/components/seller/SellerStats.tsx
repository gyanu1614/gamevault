/**
 * SellerStats — the one line every buyer-facing surface shows under a
 * seller's name (rule: src/lib/seller/stat-line.ts).
 *
 *   compact (cards, rows):  👍 100% · 34 Sold 🏅   (owner 2026-09-30: no review
 *                           count, and the tier is its icon, not the word;
 *                           `hideTier` when the surface shows it elsewhere)
 *   full (listing page, shop, checkout, order page):
 *                           100% Positive · 12 Reviews · 34 Sold · 🏅 Gold
 *   no sales yet (both):    Verified Seller — or New Seller when unverified
 *                           (open signup; `verified` = profiles.is_verified)
 *
 * Text size comes from `className` so it sits in each surface's scale.
 */
import { ThumbsUpIcon } from '@phosphor-icons/react/dist/ssr'
import { cn } from '@/lib/utils'
import { sellerStatLine, sellerStatText, type SellerStatInput } from '@/lib/seller/stat-line'
import { TierIcon } from '@/components/seller/tiers/TierIcon'

const fmtCount = (v: number) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (v >= 10_000) return `${Math.round(v / 1_000)}K`
  if (v >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return v.toLocaleString('en-US')
}

interface SellerStatsProps extends SellerStatInput {
  variant?: 'compact' | 'full'
  /** Compact only: leave the tier icon off (the surface shows it by the name). */
  hideTier?: boolean
  className?: string
}

export function SellerStats({ variant = 'compact', hideTier = false, className, ...input }: SellerStatsProps) {
  const line = sellerStatLine(input)
  const label = sellerStatText(input)

  if (line.kind === 'verified' || line.kind === 'new') {
    return (
      <span className={cn('inline-flex items-center whitespace-nowrap font-semibold', line.kind === 'new' ? 'text-text-tertiary' : 'text-text-secondary', className)}>
        {line.kind === 'new' ? 'New Seller' : 'Verified Seller'}
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
            <ThumbsUpIcon aria-hidden weight="fill" className="h-[1.05em] w-[1.05em] shrink-0 text-success" />
            <span aria-hidden className="font-semibold tabular-nums text-success">{line.rating.percent}%</span>
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
        <span aria-hidden>
          <span className="font-semibold tabular-nums text-text-secondary">{fmtCount(line.sales)}</span> Sold
        </span>
      )}
      {variant === 'compact' ? (
        !hideTier && (
          <span aria-hidden title={`${line.tierLabel} Seller`} className="ml-0.5 inline-flex">
            <TierIcon tier={input.tier} size={14} decorative className="h-[1.15em] w-[1.15em]" />
          </span>
        )
      ) : (
        <>
          {line.sales > 0 && <Dot />}
          <span aria-hidden className={cn('inline-flex items-center gap-1 font-semibold', line.tierClass)}>
            <TierIcon tier={input.tier} size={14} decorative className="h-[1.1em] w-[1.1em]" />
            {line.tierLabel}
          </span>
        </>
      )}
    </span>
  )
}

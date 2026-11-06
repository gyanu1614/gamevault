import { ShieldCheck } from 'lucide-react'
import { formatStatPrice } from '@/lib/seo/page-stats-format'
import { PAGE_TITLE } from './page-scale'

/**
 * The category page title (owner, 2026-11-03, "Clean Toolbar"): one bold line
 * that says what the page sells ("Adopt Me Items"), no logo tile or small game
 * line, since the sub-navbar right above already shows both. Items pages show no
 * number (owner, 2026-11-05); other categories keep theirs. The
 * price and delivery facts and the intro stay in the HTML for search engines but
 * are not shown. Shared by the listings view (ItemsPageClient) and the values
 * games' item grid, so the two never drift.
 */
export function CategoryHeader({
  gameName,
  categoryLabel,
  count,
  countNoun,
  stats,
  introLine,
}: {
  gameName: string
  categoryLabel: string
  /** How many it lists; leave out to show no number. */
  count?: number
  countNoun?: { one: string; many: string }
  stats?: { lowPrice: number | null; avgDeliveryLabel: string | null } | null
  introLine?: string | null
}) {
  const title = categoryLabel.toLowerCase().includes(gameName.toLowerCase()) ? categoryLabel : `${gameName} ${categoryLabel}`
  return (
    <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h1 className={PAGE_TITLE}>{title}</h1>
      {count != null && count > 0 && countNoun && (
        <span className="text-[14px] font-medium capitalize tabular-nums text-text-secondary">
          {count.toLocaleString('en-US')} {count === 1 ? countNoun.one : countNoun.many}
        </span>
      )}
      <div className="sr-only" style={{ fontSize: 'var(--fs-meta)' }}>
        {stats?.lowPrice != null && (
          <>
            <span>
              from <span className="font-bold tabular-nums text-text-primary">${formatStatPrice(stats.lowPrice)}</span>
            </span>
            <Dot />
          </>
        )}
        {stats?.avgDeliveryLabel && (
          <>
            <span>~{stats.avgDeliveryLabel} delivery</span>
            <Dot />
          </>
        )}
        <span className="inline-flex items-center gap-1 font-semibold text-[#7ec98f]">
          <ShieldCheck aria-hidden className="h-3.5 w-3.5" />
          SafeDrop Protected
        </span>
      </div>
      {introLine && <p className="sr-only">{introLine}</p>}
    </div>
  )
}

function Dot() {
  return (
    <span aria-hidden className="text-text-disabled">
      ·
    </span>
  )
}

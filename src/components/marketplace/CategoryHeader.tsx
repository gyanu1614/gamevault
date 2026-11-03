'use client'

import { Gamepad2, ShieldCheck } from 'lucide-react'
import { formatStatPrice } from '@/lib/seo/page-stats-format'

/**
 * The category page header (owner, 2026-09-28): logo on the left, the game
 * small on top and the category as the big line beside it. The ask to sell
 * moved out (owner, 2026-11-02: it took the room the listings should have):
 * the sub-navbar's Sell button on desktop, a row inside the grid on phones
 * and tablets (SellerPromptRow). The H1 reads "{Game} {Category}"
 * to crawlers (the game name is in it, visually hidden). The stats line and
 * intro stay in the HTML for search engines but are not shown: the owner wants
 * the header to be logo + game + category only. Shared by the listings view
 * (ItemsPageClient) and the values games' item grid, so the two never drift.
 */
export function CategoryHeader({
  gameName,
  gameImageUrl,
  categoryLabel,
  count,
  countNoun,
  stats,
  introLine,
}: {
  gameName: string
  gameImageUrl: string | null
  categoryLabel: string
  /** What the page lists (listings, or items on a values game's grid). */
  count: number
  countNoun: { one: string; many: string }
  stats?: { lowPrice: number | null; avgDeliveryLabel: string | null } | null
  introLine?: string | null
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3.5 sm:mb-6 sm:gap-5">
      {gameImageUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={gameImageUrl} alt={`${gameName} logo`} className="h-16 w-16 shrink-0 rounded-lg object-cover sm:h-[72px] sm:w-[72px]" />
      ) : (
        <span aria-hidden className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-bg-overlay text-lime-text sm:h-[72px] sm:w-[72px]">
          <Gamepad2 className="h-6 w-6" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="mb-1.5 text-[13px] font-semibold uppercase leading-none tracking-[0.08em] text-text-secondary sm:text-[14px]">{gameName}</p>
        <h1
          className="font-black tracking-tight text-text-primary"
          style={{ fontSize: 'var(--fs-page-title)', lineHeight: 1.05, fontWeight: 'var(--fw-heading)', letterSpacing: '-0.02em' }}
        >
          <span className="sr-only">{gameName} </span>
          {categoryLabel}
        </h1>
        <div className="sr-only" style={{ fontSize: 'var(--fs-meta)' }}>
          <span>
            <span className="font-bold tabular-nums text-text-primary">{count.toLocaleString('en-US')}</span> {count === 1 ? countNoun.one : countNoun.many}
          </span>
          {stats?.lowPrice != null && (
            <>
              <Dot />
              <span>
                from <span className="font-bold tabular-nums text-text-primary">${formatStatPrice(stats.lowPrice)}</span>
              </span>
            </>
          )}
          {stats?.avgDeliveryLabel && (
            <>
              <Dot />
              <span>~{stats.avgDeliveryLabel} delivery</span>
            </>
          )}
          <Dot />
          <span className="inline-flex items-center gap-1 font-semibold text-[#7ec98f]">
            <ShieldCheck aria-hidden className="h-3.5 w-3.5" />
            SafeDrop Protected
          </span>
        </div>
        {introLine && <p className="sr-only">{introLine}</p>}
      </div>
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

/**
 * V19/P23 — Items-shaped route skeleton. Picked by loading.tsx when
 * the URL category slug is "items" (the items showcase grid).
 *
 * Every wrapper className matches _ItemsPageClient.tsx so the swap
 * is geometric-free. Source-of-truth references:
 *   • Page title            → CategoryHeader.tsx
 *   • Search + filters      → FilterToolbar.tsx
 *   • Results grid          → _ItemsPageClient.tsx :: grid-cols-1/2/xl-3
 *   • Item card             → _ItemCard.tsx :: <article> landscape card
 */

import GameSubNavSkeleton from '@/components/marketplace/GameSubNavSkeleton'

/** Shared placeholder block — also used by the listing detail skeleton. */
export function Block({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  // bg-bg-inset (#30313A) — one step LIGHTER than the card surface. It used
  // to be bg-overlay-2, which is the same hex as the card's bg-overlay
  // (#24252B), so every block inside a skeleton card was invisible and the
  // cards loaded as empty boxes.
  return (
    <div className={`animate-pulse rounded-md bg-bg-inset ${className}`} style={style} />
  )
}

/* ── Item card skeleton — mirrors the current _ItemCard.tsx <article>:
      breadcrumb row → content row (2-line title min-h + delivery and
      stock chips | square image) → bottom strip (price + /Unit left |
      avatar + name + rating right). No arrow chip. */
/** Exported: the listing detail page's "Similar Listings" row uses the
    same ItemCard, so its skeleton reuses this rather than drawing another. */
export function ItemCardSkeleton() {
  return (
    <article
      className="relative flex flex-col overflow-hidden rounded-lg bg-bg-raised"
      aria-hidden
    >
      {/* MAIN BLOCK — breadcrumb + content row. Padding is the same
          --gap-card token the real card uses (16px, 12px on mobile). */}
      <div className="relative z-10 flex flex-col" style={{ padding: 'var(--gap-card)' }}>
        {/* Breadcrumb line — the real line box is 19.2px (12px caption at
            its line-height), so the block sits centred in a 19.2px row. */}
        <div className="mb-2 flex h-[19.2px] items-center">
          <Block className="h-3 w-40 max-w-[70%]" />
        </div>

        {/* Content row — left (title + delivery chip) + right (image) */}
        <div className="flex items-stretch gap-4">
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Title — reserves the same 2-line min-h as the real card */}
            <div className="min-h-[2.75rem] space-y-1.5">
              <Block className="h-[16px] w-3/4" />
              <Block className="h-[16px] w-1/2" />
            </div>
            {/* Delivery + stock chips (28px rectangles) */}
            <div className="mt-2 flex gap-1.5">
              <Block className="h-7 w-20 rounded-md" />
              <Block className="h-7 w-14 rounded-md" />
            </div>
          </div>

          {/* Square thumbnail — w-[88px] sm:w-[110px] */}
          <Block className="aspect-square h-auto w-[88px] shrink-0 self-start rounded-md sm:w-[110px]" />
        </div>
      </div>

      {/* Bottom strip — price (left) + seller block (right) */}
      <div
        className="relative z-10 flex items-center justify-between gap-3 border-t border-border-subtle"
        style={{ minHeight: '58px', padding: 'calc(var(--gap-card) * 0.6) var(--gap-card)' }}
      >
        {/* Price + / Unit */}
        <div className="flex items-baseline gap-1.5">
          <Block className="h-[22px] w-20" />
          <Block className="h-3 w-10" />
        </div>

        {/* Seller block — avatar + [name / rating] */}
        <div className="flex shrink-0 items-center gap-2.5 py-1">
          <div className="flex flex-col items-end space-y-1.5">
            <Block className="h-3 w-24" />
            <Block className="h-3 w-20" />
          </div>
          <Block className="h-[34px] w-[34px] shrink-0 rounded-full" />
        </div>
      </div>
    </article>
  )
}

/** A values game's item card (GridCard): picture box on top, the name centred, price + arrow. */
function GridCardSkeleton() {
  return (
    <article aria-hidden className="flex flex-col overflow-hidden rounded-lg bg-[#212228]">
      <div className="h-[92px] bg-[#2E2F36] sm:h-[136px]" />
      <div className="flex flex-col px-2.5 pb-2.5 pt-2.5 sm:px-4 sm:pb-4 sm:pt-3">
        <Block className="mx-auto h-4 w-3/5" />
        <div className="mt-3 flex items-end justify-between gap-2 sm:mt-4">
          <Block className="h-5 w-2/5 sm:h-9" />
          <Block className="h-7 w-7 shrink-0 sm:h-9 sm:w-9" />
        </div>
      </div>
    </article>
  )
}

/**
 * `grid`: a values game's Items page (picture-top cards, 2 / 3 / 4 to a row); else
 * the listings view. `subnav` off: the real sub-navbar is already on screen.
 */
export default function ItemsSkeleton({ grid = false, subnav = true }: { grid?: boolean; subnav?: boolean }) {
  return (
    <main className="min-h-screen" aria-busy>
      {subnav ? <GameSubNavSkeleton tabs={2} /> : null}

      {/* Title + toolbar — mirrors CategoryHeader and FilterToolbar: one bold line
          and its count, then search + filters + sort (desktop) or search +
          Filters (below lg), all 44px. */}
      <div className="mx-auto w-full max-w-7xl px-4 pb-2 pt-7 sm:px-6 sm:pt-4 lg:px-8">
        <div className="mb-[17px] flex items-baseline gap-3">
          <Block className="h-[31px] w-56 max-w-[70%] sm:h-[37px] sm:w-72" />
          <Block className="h-4 w-14" />
        </div>
        <div className="flex items-center gap-2">
          <Block className="h-11 min-w-0 flex-1 rounded-lg" />
          {[108, 100, 96].map((w, i) => (
            <Block key={i} className="hidden h-11 shrink-0 lg:block" style={{ width: w }} />
          ))}
          <span aria-hidden className="mx-1 hidden h-6 w-px bg-white/[0.12] lg:block" />
          <Block className="hidden h-11 w-[214px] shrink-0 lg:block" />
          <Block className="h-11 w-[108px] shrink-0 rounded-lg lg:hidden" />
        </div>
      </div>

      {/* Results + grid — 1/2/xl-3 col grid, --gap-grid gutter.
          Render 9 cards (enough to fill a typical above-fold view). */}
      <div className="mx-auto w-full max-w-7xl px-4 pb-20 pt-3 sm:px-6 lg:px-8">
        {grid ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4" style={{ gap: 'var(--gap-grid)' }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <GridCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" style={{ gap: 'var(--gap-grid)' }}>
            {Array.from({ length: 9 }).map((_, i) => (
              <ItemCardSkeleton key={i} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

/**
 * V19/P23 — Items-shaped route skeleton. Picked by loading.tsx when
 * the URL category slug is "items" (the items showcase grid).
 *
 * Every wrapper className matches _ItemsPageClient.tsx so the swap
 * is geometric-free. Source-of-truth references:
 *   • Filter band wrapper   → _ItemsPageClient.tsx :: return() top <section>
 *   • Page header block     → _ItemsPageClient.tsx :: "<game> Items" row
 *   • Filter pills + sort   → _ItemsPageClient.tsx :: Filter row grid
 *   • Search field          → _ItemsPageClient.tsx :: Search input wrapper
 *   • Results grid          → _ItemsPageClient.tsx :: grid-cols-1/2/xl-3
 *   • Item card             → _ItemCard.tsx :: <article> landscape card
 */

/** Shared placeholder block — also used by the listing detail skeleton. */
export function Block({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  // bg-bg-inset (#2C333F) — one step LIGHTER than the card surface. It used
  // to be bg-overlay-2, which is the same hex as the card's bg-overlay
  // (#252B34), so every block inside a skeleton card was invisible and the
  // cards loaded as empty boxes.
  return (
    <div className={`animate-pulse rounded-md bg-bg-inset ${className}`} style={style} />
  )
}

/* ── Item card skeleton — mirrors the current _ItemCard.tsx <article>:
      breadcrumb row → content row (2-line title min-h + delivery chip |
      square image) → bottom strip (price + /Unit left | avatar + name +
      rating right). No stock pill, no arrow chip (both removed from the
      real card). */
/** Exported: the listing detail page's "Similar Listings" row uses the
    same ItemCard, so its skeleton reuses this rather than drawing another. */
export function ItemCardSkeleton() {
  return (
    <article
      className="relative flex flex-col overflow-hidden rounded-lg border border-border-default bg-bg-overlay"
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
            {/* Delivery chip only */}
            <div className="mt-2">
              <Block className="h-7 w-24 rounded-md" />
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
        <div className="flex shrink-0 items-center gap-2.5">
          <Block className="h-[34px] w-[34px] shrink-0 rounded-full" />
          <div className="space-y-1.5">
            <Block className="h-3 w-24" />
            <Block className="h-3 w-16" />
          </div>
        </div>
      </div>
    </article>
  )
}

export default function ItemsSkeleton() {
  return (
    <main className="min-h-screen" aria-busy>
      {/* GameSubNav skeleton — wrapper and pill classes copied from the
          live GameSubNav (measured 2026-09-25: 60px desktop = 6px padding +
          48px pill; 52px on mobile). The old copy used py-5 and a 44px
          round pill, which pushed the whole skeleton 24px lower than the
          real page and made everything jump on swap. */}
      <div className="relative z-40 flex justify-center px-3 py-0.5 pointer-events-none sm:py-1 md:py-1.5 max-md:h-[52px] max-md:px-0 max-md:py-0">
        <div
          className="pointer-events-auto w-full max-w-fit flex items-center gap-0.5 rounded-[10px] border border-white/[0.1] shadow-2xl backdrop-blur-2xl backdrop-saturate-150 px-1.5 py-0.5 sm:px-2 sm:py-1 max-md:fixed max-md:inset-x-0 max-md:top-[var(--navbar-bottom)] max-md:z-[45] max-md:max-w-none max-md:!rounded-none max-md:!border-x-0 max-md:!border-t-0 max-md:border-b max-md:border-white/[0.08] max-md:px-2 max-md:py-1.5 max-md:!bg-[#171B21]"
          style={{ backgroundColor: 'var(--subnav-pill-bg, rgba(28, 28, 37, 0.30))' }}
        >
          {/* One block per slot (game + each category). Slots are 38px
              tall, like the real tabs. */}
          <div className="flex h-[38px] flex-shrink-0 items-center px-2.5 sm:px-3">
            <Block className="h-3.5 w-20 sm:w-24" />
          </div>
          <div className="mx-1 h-5 w-px flex-shrink-0 bg-white/[0.12] sm:mx-1.5" aria-hidden />
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex h-[38px] items-center px-2.5 sm:px-3">
              <Block className="h-3.5 w-14 sm:w-16" />
            </div>
          ))}
        </div>
      </div>

      {/* Filter band — mirrors _ItemsPageClient.tsx top <section>:
          transparent, bottom hairline only (the real band dropped its
          background), same wrapper padding. */}
      <section className="relative overflow-hidden border-b border-border-subtle">
        <div className="relative mx-auto w-full max-w-7xl px-4 pb-5 pt-2 sm:px-6 sm:pb-6 sm:pt-3 lg:px-8">
          {/* Page header — centred + stacked on mobile, row on md+:
              72px logo | "{Game} Items" title / meta line. */}
          <div className="mb-5 flex flex-col items-center gap-4 sm:mb-6 md:flex-row md:gap-6">
            <Block className="h-16 w-16 shrink-0 rounded-2xl sm:h-[72px] sm:w-[72px]" />
            <div className="flex w-full min-w-0 flex-1 flex-col items-center md:items-start">
              {/* H1 — same clamp()ed size × line-height as the real title,
                  so the block is exactly one title line at every width. */}
              <Block
                className="w-60 max-w-full"
                style={{ height: 'calc(var(--fs-page-title) * var(--lh-page-title))' }}
              />
              {/* Meta line — listings · from · delivery · SafeDrop. Each real
                  line is 20.8px (13px text beside 14px icons). On phones the
                  centred row wraps to TWO lines (20.8 + 6px gap + 20.8), so
                  the skeleton draws two there and one from sm up. */}
              <div className="mt-3 flex h-[47.6px] flex-col items-center justify-between sm:h-[20.8px] sm:justify-center md:items-start">
                <div className="flex h-[20.8px] items-center">
                  <Block className="h-3.5 w-56 max-w-full sm:w-72" />
                </div>
                <div className="flex h-[20.8px] items-center sm:hidden">
                  <Block className="h-3.5 w-32" />
                </div>
              </div>
            </div>
          </div>

          {/* Filter row — ONE row: search | filters | sort, 42px tall,
              wrapping on sm+ and sliding on mobile, like the real row. */}
          <div className="-mx-4 flex items-center gap-2.5 overflow-hidden px-4 pb-0.5 sm:mx-0 sm:flex-wrap sm:px-0">
            {/* Search, then content-width filter buttons (widths measured
                off the live Adopt Me row: Item Type, Trait, Price,
                Delivery Time), then sort. No Clear link any more. */}
            <Block className="h-[42px] w-[220px] shrink-0 rounded sm:w-[300px]" />
            <Block className="h-[42px] w-[145px] shrink-0 rounded" />
            <Block className="h-[42px] w-[109px] shrink-0 rounded" />
            <Block className="h-[42px] w-[113px] shrink-0 rounded" />
            <Block className="h-[42px] w-[171px] shrink-0 rounded" />
            {/* Sort — shows the current sort ("Recommended"), 180px. */}
            <Block className="h-[42px] w-[180px] shrink-0 rounded" />
          </div>
        </div>
      </section>

      {/* Results + grid — 1/2/xl-3 col grid, --gap-grid gutter.
          Render 9 cards (enough to fill a typical above-fold view). */}
      <div className="mx-auto w-full max-w-7xl px-4 pb-20 pt-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" style={{ gap: 'var(--gap-grid)' }}>
          {Array.from({ length: 9 }).map((_, i) => (
            <ItemCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </main>
  )
}

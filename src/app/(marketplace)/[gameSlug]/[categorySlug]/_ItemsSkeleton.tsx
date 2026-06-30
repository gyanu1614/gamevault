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

function Block({ className = '' }: { className?: string }) {
  // V21/P7.p — Solid white-tint fill. The previous bg-bg-overlay/80
  // was near-invisible now that the skeleton sits over the hero
  // backdrop (transparent main) — small blocks (title, filter pills)
  // vanished. white/[0.07] reads clearly on any dark surface.
  return (
    <div className={`animate-pulse rounded-md bg-white/[0.07] ${className}`} />
  )
}

/* ── Item card skeleton — mirrors _ItemCard.tsx <article> exactly.
      Landscape card: outer rounded-2xl border, top row = left text +
      right square image, bottom strip = seller chip + arrow chip. */
function ItemCardSkeleton() {
  return (
    <article
      className="relative flex flex-col overflow-hidden rounded-lg border border-border-default bg-bg-overlay"
      aria-hidden
    >
      {/* MAIN ROW — left text column + right square image */}
      <div className="relative z-10 flex items-stretch gap-4 p-3.5 sm:p-4">
        {/* Left column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Name h3 — text-[15.5px] sm:text-[16px], 2 lines */}
          <div className="space-y-1.5">
            <Block className="h-[16px] w-3/4" />
            <Block className="h-[16px] w-1/2" />
          </div>

          {/* Meta pills row — delivery + stock */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Block className="h-6 w-20 rounded-full" />
            <Block className="h-6 w-16 rounded-full" />
          </div>

          {/* Price block at bottom — text-[22px] sm:text-[24px] */}
          <div className="mt-auto flex items-end justify-between gap-3 pt-3">
            <div className="space-y-1.5">
              <Block className="h-[24px] w-24" />
              <Block className="h-3 w-12" />
            </div>
          </div>
        </div>

        {/* Right column — aspect-square thumbnail w-[88px] sm:w-[110px] */}
        <Block className="aspect-square h-auto w-[88px] shrink-0 self-start rounded-md sm:w-[110px]" />
      </div>

      {/* Bottom strip — seller chip + meta + arrow chip */}
      <div className="relative z-10 flex items-center justify-between gap-3 border-t border-border-subtle px-3 py-2 sm:px-3.5">
        {/* Seller chip */}
        <div className="inline-flex max-w-[55%] items-center gap-2 rounded-full border border-border-subtle bg-bg-base/60 px-1.5 py-1 pr-2.5">
          <Block className="h-[22px] w-[22px] shrink-0 rounded-full" />
          <Block className="h-3 w-20" />
        </div>

        {/* Inline meta — sold count + rating */}
        <div className="flex shrink-0 items-center gap-2">
          <Block className="h-3 w-12" />
          <Block className="h-3 w-10" />
        </div>

        {/* Lime arrow chip — h-8 w-8 round */}
        <Block className="h-8 w-8 shrink-0 rounded-full" />
      </div>
    </article>
  )
}

export default function ItemsSkeleton() {
  return (
    <main className="min-h-screen" aria-busy>
      {/* GameSubNav skeleton — identical to currency skeleton's so the
          chrome doesn't jump when the real page mounts and replaces
          the skeleton. */}
      <div className="relative z-40 flex justify-center py-6 sm:py-8 md:py-10 pointer-events-none px-3">
        <div className="pointer-events-auto w-full max-w-fit flex items-center gap-0.5 rounded-full border border-white/[0.1] shadow-2xl backdrop-blur-2xl backdrop-saturate-150 px-2 py-2 sm:px-3 sm:py-2.5" style={{ backgroundColor: 'rgba(28, 28, 37, 0.30)' }}>
          {/* V21/P7.q — One block per slot (game + each category),
              not icon+label pairs — cleaner, less busy. */}
          <div className="flex flex-shrink-0 items-center px-3 py-1.5 sm:px-4 sm:py-2">
            <Block className="h-3.5 w-20 sm:w-24" />
          </div>
          <div className="mx-1 h-4 w-px bg-white/[0.12] flex-shrink-0 sm:mx-1.5 sm:h-5" aria-hidden />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center px-3 py-1.5 sm:px-4 sm:py-2">
              <Block className="h-3.5 w-14 sm:w-16" />
            </div>
          ))}
        </div>
      </div>

      {/* Filter band — mirrors _ItemsPageClient.tsx top <section>.
          The real section uses a dark linear gradient + radial lime
          wash; we use a flat bg-bg-overlay/30 here for the skeleton
          surface so the eye doesn't latch onto the gradient first. */}
      <section className="relative overflow-hidden border-b border-border-subtle bg-bg-overlay/30">
        <div className="relative mx-auto w-full max-w-7xl px-4 pb-6 pt-5 sm:px-6 sm:pb-7 sm:pt-6 lg:px-8">
          {/* Page header — logo + "{Game} Items" + listings count */}
          <div className="mb-6 flex items-center gap-4 sm:mb-7 sm:gap-5">
            <Block className="h-14 w-14 shrink-0 rounded-2xl sm:h-16 sm:w-16" />
            <div className="min-w-0 flex-1 space-y-2">
              {/* "Marketplace" eyebrow — text-[11px] uppercase */}
              <Block className="h-3 w-24" />
              {/* H1 — text-[22px] sm:text-[28px] lg:text-[32px] */}
              <Block className="h-[28px] w-64 max-w-full sm:h-[32px]" />
              {/* Listings count subtitle — text-[12.5px] */}
              <Block className="h-3 w-32" />
            </div>
          </div>

          {/* Filter row — 2-col grid on mobile, flex on sm+.
              Real layout has 3-4 filter pills + "Clear filters" + Sort. */}
          <div className="mb-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-start sm:gap-2.5">
            {/* Filter pills — h-9, rounded-lg (canonical), variable width */}
            <Block className="h-9 w-full rounded-lg sm:w-32" />
            <Block className="h-9 w-full rounded-lg sm:w-28" />
            <Block className="h-9 w-full rounded-lg sm:w-32" />
            <Block className="h-9 w-full rounded-lg sm:w-28" />
            {/* Clear filters underline — h-9, text-only */}
            <Block className="col-span-2 h-9 w-24 sm:col-span-1 sm:ml-1" />
            {/* Sort — right-pushed on sm+ */}
            <div className="col-span-2 sm:col-span-1 sm:ml-auto">
              <Block className="h-9 w-full rounded-lg sm:w-40" />
            </div>
          </div>

          {/* Search input — h-11 sm:h-12, rounded-lg */}
          <Block className="h-11 w-full rounded-lg sm:h-12" />
        </div>
      </section>

      {/* Results + grid — 1/2/xl-3 col grid, gap-5 sm:gap-6.
          Render 9 cards (enough to fill a typical above-fold view). */}
      <div className="mx-auto w-full max-w-7xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <ItemCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </main>
  )
}

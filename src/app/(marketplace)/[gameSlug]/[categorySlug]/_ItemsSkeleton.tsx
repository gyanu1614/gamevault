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
  // Greyish solid fill (a step above the card surface) so blocks read as
  // clear placeholders, not faint transparent ghosts. bg-bg-overlay-2
  // (#23232E) matches the app's raised-grey surfaces.
  return (
    <div className={`animate-pulse rounded-md bg-bg-overlay-2 ${className}`} />
  )
}

/* ── Item card skeleton — mirrors the current _ItemCard.tsx <article>:
      breadcrumb row → content row (2-line title min-h + delivery chip |
      square image) → bottom strip (price + /Unit left | avatar + name +
      rating right). No stock pill, no arrow chip (both removed from the
      real card). */
function ItemCardSkeleton() {
  return (
    <article
      className="relative flex flex-col overflow-hidden rounded-lg border border-border-default bg-bg-overlay"
      aria-hidden
    >
      {/* MAIN BLOCK — breadcrumb + content row */}
      <div className="relative z-10 flex flex-col p-3.5 sm:p-4">
        {/* Breadcrumb line */}
        <Block className="mb-2 h-3 w-40 max-w-[70%]" />

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
      <div className="relative z-10 flex items-center justify-between gap-3 border-t border-border-subtle px-3 py-2.5 sm:px-3.5">
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
      {/* GameSubNav skeleton — identical to currency skeleton's so the
          chrome doesn't jump when the real page mounts and replaces
          the skeleton. */}
      <div className="relative z-40 flex justify-center py-3 sm:py-4 md:py-5 pointer-events-none px-3">
        <div className="pointer-events-auto w-full max-w-fit flex items-center gap-0.5 rounded-full border border-white/[0.1] shadow-2xl backdrop-blur-2xl backdrop-saturate-150 px-2 py-1.5 sm:px-2.5 sm:py-2" style={{ backgroundColor: 'rgba(28, 28, 37, 0.30)' }}>
          {/* V21/P7.q — One block per slot (game + each category),
              not icon+label pairs — cleaner, less busy. */}
          <div className="flex flex-shrink-0 items-center px-2.5 py-1 sm:px-3.5 sm:py-1.5">
            <Block className="h-3.5 w-20 sm:w-24" />
          </div>
          <div className="mx-1 h-4 w-px bg-white/[0.12] flex-shrink-0 sm:mx-1.5 sm:h-5" aria-hidden />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center px-2.5 py-1 sm:px-3.5 sm:py-1.5">
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
        <div className="relative mx-auto w-full max-w-7xl px-4 pb-5 pt-2 sm:px-6 sm:pb-6 sm:pt-3 lg:px-8">
          {/* Page header — logo + "{Game} Items" + listings count */}
          <div className="mb-4 flex items-center gap-4 sm:mb-5 sm:gap-5">
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
      <div className="mx-auto w-full max-w-7xl px-4 pb-20 pt-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <ItemCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </main>
  )
}

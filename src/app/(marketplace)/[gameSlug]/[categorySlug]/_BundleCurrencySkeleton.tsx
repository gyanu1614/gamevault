/**
 * V19/P24/P7.d — Bundle currency skeleton.
 *
 * Mirrors _BundleCurrencyPageClient exactly so the swap is invisible:
 *   • GameSubNav pill (same as flexible skeleton)
 *   • Header row: 56px icon + title + tagline
 *   • Platform tile row (3 tiles, 140×88)
 *   • Region pill row (3 pills, h-10)
 *   • 2-col grid: bundle tile grid (4 across) on the left,
 *     OFFER PRICE eyebrow + card on the right
 *   • HowItWorks 3-col + FAQ stack below
 */

function Block({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-bg-overlay-2 ${className}`} />
  )
}

function GameSubNavSkeleton() {
  return (
    <div className="relative z-40 flex justify-center px-3 py-3 pointer-events-none sm:py-4 md:py-5 max-md:h-[42px] max-md:px-0 max-md:py-0">
      <div className="pointer-events-auto w-full max-w-fit flex items-center gap-0.5 rounded-full border border-white/[0.1] shadow-2xl backdrop-blur-2xl backdrop-saturate-150 px-2 py-1.5 sm:px-2.5 sm:py-2 max-md:fixed max-md:inset-x-0 max-md:top-[60px] max-md:z-40 max-md:h-[42px] max-md:max-w-none max-md:overflow-hidden max-md:!rounded-none max-md:!border-x-0 max-md:!border-t-0 max-md:border-b max-md:border-white/[0.08] max-md:!bg-[rgba(14,22,17,0.94)]" style={{ backgroundColor: 'rgba(28, 28, 37, 0.30)' }}>
        {/* V21/P7.q — One block per slot (game + each category). */}
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
  )
}

// V19/P24/P7.jj — Match the real bundle tile shape (shadcn <Card>
// default = rounded-lg, 1px border, p-3). Image area h-16 sm:h-20
// + faint divider above the "from $x.xx" line. No more rounded-2xl
// + 2px border (that was a tighter skeleton-only treatment).
function BundleTileSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-lg border border-border-default bg-bg-overlay/40 p-3">
      <div className="flex h-16 items-center justify-center sm:h-20">
        <Block className="h-14 w-14 rounded-md" />
      </div>
      <Block className="mt-2 h-4 w-24" />
      {/* Faint divider — matches the real tile */}
      <div className="mt-2 h-px bg-border-subtle" aria-hidden />
      <Block className="mt-2 h-3 w-20" />
    </div>
  )
}

function PlatformTileSkeleton() {
  // 140×88 card, icon h-10 + label.
  return (
    <div className="relative flex h-[88px] w-[140px] flex-col items-center justify-center gap-1.5 overflow-hidden rounded-lg border border-border-default bg-bg-overlay/40 p-2">
      <Block className="h-10 w-10 rounded-md" />
      <Block className="h-3 w-12" />
    </div>
  )
}

function OfferPanelSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border-default bg-bg-raised p-5 shadow-elevated">
      {/* Price */}
      <div className="flex items-baseline gap-2">
        <Block className="h-8 w-28" />
        <Block className="h-3 w-8" />
      </div>
      {/* Delivery row */}
      <div className="mt-4 flex items-center justify-between">
        <Block className="h-3 w-20" />
        <Block className="h-3 w-16" />
      </div>
      {/* Quantity row */}
      <div className="mt-3 flex items-center justify-between">
        <Block className="h-3 w-16" />
        <Block className="h-9 w-32 rounded-md" />
      </div>
      {/* Seller chip */}
      <div className="mt-4">
        <Block className="mb-2 h-3 w-12" />
        <div className="flex items-center gap-2">
          <Block className="h-9 w-9 rounded-full" />
          <Block className="h-4 w-32" />
        </div>
      </div>
      <div className="my-4 h-px bg-border-subtle" aria-hidden />
      <Block className="h-12 w-full rounded-md" />
      <Block className="mx-auto mt-3 h-2.5 w-56" />
    </div>
  )
}

export default function BundleCurrencySkeleton() {
  return (
    <main className="min-h-screen pb-24 pt-3 sm:pt-4">
      <GameSubNavSkeleton />

      {/* Header — icon + title + tagline (Buy Fortnite V-Bucks) */}
      <header className="relative overflow-hidden border-b border-border-subtle">
        <div className="relative mx-auto flex w-full max-w-7xl items-center gap-4 px-4 pt-2 pb-5 sm:gap-5 sm:px-6 sm:pt-3 sm:pb-6 lg:px-8">
          <Block className="h-14 w-14 shrink-0 rounded-2xl sm:h-16 sm:w-16" />
          <div className="min-w-0 flex-1 space-y-2">
            <Block className="h-7 w-64 max-w-full sm:h-8" />
            <Block className="h-3.5 w-80 max-w-full" />
          </div>
        </div>
      </header>

      {/* Platform tile row */}
      <section className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <Block className="mb-3 h-3 w-20" />
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <PlatformTileSkeleton key={i} />
          ))}
        </div>
      </section>

      {/* Region pill row */}
      <section className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <Block className="mb-3 h-3 w-16" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Block key={i} className="h-10 w-28 rounded-full" />
          ))}
        </div>
      </section>

      {/* 2-col grid — bundles left, offer panel right */}
      <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 pt-4 sm:px-6 lg:grid-cols-[1fr_360px] lg:gap-8 lg:px-8">
        {/* LEFT: AVAILABLE OFFERS eyebrow + bundle grid */}
        <div className="space-y-6">
          <section>
            <Block className="mb-3 h-3 w-32" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <BundleTileSkeleton key={i} />
              ))}
            </div>
          </section>
        </div>

        {/* RIGHT: OFFER PRICE eyebrow + sticky offer card */}
        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <Block className="mb-3 h-3 w-24" />
          <OfferPanelSkeleton />
        </aside>
      </div>

      {/* How it works + FAQ stack */}
      <div className="mx-auto mt-16 w-full max-w-7xl space-y-16 px-4 sm:px-6 lg:px-8">
        {/* HowItWorks */}
        <section>
          <div className="mx-auto max-w-md space-y-2 text-center">
            <Block className="mx-auto h-7 w-40" />
            <Block className="mx-auto h-3 w-72 max-w-full" />
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border-subtle bg-bg-raised p-5">
                <div className="flex items-start justify-between">
                  <Block className="h-10 w-10 rounded-xl" />
                  <Block className="h-6 w-8" />
                </div>
                <Block className="mt-3 h-4 w-32" />
                <Block className="mt-2 h-3 w-full" />
                <Block className="mt-1.5 h-3 w-4/5" />
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section>
          <div className="mx-auto max-w-md space-y-2 text-center">
            <Block className="mx-auto h-7 w-72" />
            <Block className="mx-auto h-3 w-60 max-w-full" />
          </div>
          <div className="mx-auto mt-7 max-w-2xl space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-xl border border-border-subtle bg-bg-raised px-5 py-4"
              >
                <Block className="h-4 w-3/4" />
                <Block className="h-7 w-7 rounded-full" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}

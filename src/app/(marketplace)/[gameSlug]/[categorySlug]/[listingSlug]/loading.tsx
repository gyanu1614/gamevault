/**
 * V16 — Listing detail skeleton.
 *
 * Mirrors the real _ListingDetailClient layout so the transition into
 * the actual page is shape-stable: breadcrumb → title row → 2-col grid
 * (square gallery left + sticky purchase card right) → tabs card →
 * carousels → trust band → FAQ. Same widths, same gaps, same proportions.
 *
 * Every block is a bordered bg-bg-overlay surface with `animate-pulse`
 * so the user sees a deliberate shimmering layout instead of a blank
 * page or a generic spinner.
 */

function Block({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-bg-overlay/80 ${className}`} />
  )
}

function CardShell({ className = '', children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border border-border-default bg-bg-overlay ${className}`}>
      {children}
    </div>
  )
}

export default function ListingDetailLoading() {
  return (
    <main className="min-h-screen bg-bg-base pb-32 sm:pb-12">
      <div className="mx-auto w-full max-w-7xl px-3 pt-4 sm:px-6 sm:pt-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="mb-4 flex items-center gap-1.5 sm:mb-5">
          <Block className="h-4 w-32" />
          <Block className="h-4 w-3" />
          <Block className="h-4 w-40" />
        </div>

        {/* Title row + share/wishlist icons */}
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <Block className="h-7 w-28 rounded-full" />
            <Block className="h-9 w-3/4 max-w-xl" />
            <div className="flex flex-wrap gap-3 pt-1">
              <Block className="h-4 w-20" />
              <Block className="h-4 w-32" />
              <Block className="h-4 w-24" />
            </div>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <Block className="h-9 w-9 rounded-full" />
            <Block className="h-9 w-9 rounded-full" />
          </div>
        </div>

        {/* 2-col grid */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-7">
          {/* LEFT */}
          <div className="min-w-0 space-y-5">
            {/* Gallery — square, max-w-[400px], centered */}
            <CardShell className="overflow-hidden">
              <div className="mx-auto aspect-square w-full max-w-[400px] animate-pulse bg-bg-overlay/80" />
              <div className="flex gap-2 border-t border-border-subtle p-3">
                <Block className="h-16 w-16 sm:h-20 sm:w-20" />
                <Block className="h-16 w-16 sm:h-20 sm:w-20" />
                <Block className="h-16 w-16 sm:h-20 sm:w-20" />
                <Block className="h-16 w-16 sm:h-20 sm:w-20" />
              </div>
            </CardShell>

            {/* Tabs card (info / description / price history) */}
            <CardShell>
              <div className="flex gap-1 border-b border-border-subtle px-3 py-3 sm:px-4">
                <Block className="h-8 w-20 rounded-md" />
                <Block className="h-8 w-28 rounded-md" />
                <Block className="h-8 w-28 rounded-md" />
              </div>
              <div className="space-y-3 px-4 py-5 sm:px-6">
                <Block className="h-5 w-1/2" />
                <Block className="h-5 w-2/3" />
                <Block className="h-5 w-1/3" />
                <Block className="h-5 w-3/4" />
                <Block className="h-5 w-1/2" />
              </div>
            </CardShell>
          </div>

          {/* RIGHT — sticky purchase + seller stack */}
          <div className="space-y-3 lg:sticky lg:top-24 lg:self-start">
            {/* Purchase card */}
            <CardShell className="shadow-elevated">
              <div className="space-y-3 p-5">
                <Block className="h-3 w-12" />
                <Block className="h-9 w-32" />
                <Block className="h-6 w-24 rounded-full" />
                <Block className="h-12 w-full rounded-xl" />
                <div className="space-y-2 pt-3">
                  <Block className="h-4 w-48" />
                  <Block className="h-4 w-40" />
                  <Block className="h-4 w-44" />
                </div>
              </div>
            </CardShell>

            {/* Seller card */}
            <CardShell>
              <div className="space-y-3 p-4">
                <Block className="h-3 w-12" />
                <div className="flex items-center gap-3">
                  <Block className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Block className="h-4 w-32" />
                    <Block className="h-3 w-20" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Block className="h-12" />
                  <Block className="h-12" />
                  <Block className="h-12" />
                </div>
              </div>
            </CardShell>

            {/* Mini trust strip */}
            <CardShell>
              <div className="grid grid-cols-3 gap-2 p-3">
                <Block className="h-10" />
                <Block className="h-10" />
                <Block className="h-10" />
              </div>
            </CardShell>
          </div>
        </div>

        {/* Carousel section — 4 mini cards */}
        <section className="mt-16 sm:mt-20">
          <div className="mb-4 space-y-2">
            <Block className="h-6 w-48" />
            <Block className="h-4 w-72 max-w-full" />
          </div>
          <div className="flex gap-3 overflow-hidden sm:gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <CardShell key={i} className="w-[240px] shrink-0 sm:w-[280px]">
                <Block className="aspect-[4/3] w-full rounded-none rounded-t-xl" />
                <div className="space-y-2 p-3">
                  <Block className="h-4 w-3/4" />
                  <div className="flex justify-between gap-2 border-t border-border-subtle pt-2">
                    <Block className="h-5 w-16" />
                    <Block className="h-7 w-7 rounded-full" />
                  </div>
                </div>
              </CardShell>
            ))}
          </div>
        </section>

        {/* Trust band — 3 cards */}
        <section className="mt-16 sm:mt-20">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <CardShell key={i}>
                <div className="flex items-start gap-3 p-5">
                  <Block className="h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Block className="h-5 w-32" />
                    <Block className="h-4 w-full" />
                    <Block className="h-4 w-4/5" />
                  </div>
                </div>
              </CardShell>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-16 sm:mt-20">
          <div className="mb-5 flex flex-col items-center gap-2">
            <Block className="h-7 w-72 max-w-full" />
            <Block className="h-4 w-80 max-w-full" />
          </div>
          <CardShell className="mx-auto max-w-3xl">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-4 border-b border-border-subtle px-5 py-4 last:border-b-0"
              >
                <Block className="h-5 w-3/4" />
                <Block className="h-4 w-4" />
              </div>
            ))}
          </CardShell>
        </section>
      </div>
    </main>
  )
}

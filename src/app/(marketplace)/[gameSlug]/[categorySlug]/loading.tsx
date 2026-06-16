/**
 * V15 — Route loading skeleton for any /{gameSlug}/{categorySlug}.
 *
 * Matches the Items page chrome (filter band + card grid) so the
 * skeleton previews exactly what's about to render. RouteProgress
 * still drives the top progress bar; this fills in the actual surface
 * with shimmering blocks while the server finishes.
 */

export default function CategoryLoading() {
  return (
    <main className="min-h-screen bg-bg-base">
      {/* Filter band skeleton */}
      <section
        className="relative overflow-hidden border-b border-border-subtle"
        style={{ background: 'linear-gradient(180deg, #0c0c13, #0a0a0f)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(680px 300px at 88% -50%, rgba(198,255,61,0.07), transparent 60%)',
          }}
        />
        <div className="relative mx-auto w-full max-w-7xl px-4 pb-7 pt-8 sm:px-6 lg:px-8">
          <div className="mb-6">
            <div className="mb-3 h-3 w-24 animate-pulse rounded-full bg-bg-overlay" />
            <div className="mb-2 h-9 w-52 animate-pulse rounded-md bg-bg-overlay" />
            <div className="h-4 w-80 max-w-full animate-pulse rounded-md bg-bg-overlay" />
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2.5">
            <div className="h-11 w-44 animate-pulse rounded-xl bg-bg-overlay" />
            <div className="h-11 w-40 animate-pulse rounded-xl bg-bg-overlay" />
            <div className="h-11 w-32 animate-pulse rounded-xl bg-bg-overlay" />
          </div>

          <div className="h-12 max-w-md animate-pulse rounded-xl bg-bg-overlay" />
        </div>
      </section>

      {/* Grid skeleton */}
      <div className="mx-auto w-full max-w-7xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-baseline justify-between">
          <div className="h-6 w-40 animate-pulse rounded-md bg-bg-overlay" />
          <div className="h-10 w-44 animate-pulse rounded-xl bg-bg-overlay" />
        </div>
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(232px, 1fr))' }}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-2xl border border-border-subtle bg-bg-raised"
            >
              <div className="h-[172px] animate-pulse bg-bg-overlay" />
              <div className="space-y-3 p-3.5">
                <div className="h-4 w-3/4 animate-pulse rounded bg-bg-overlay" />
                <div className="flex gap-1.5">
                  <div className="h-5 w-12 animate-pulse rounded bg-bg-overlay" />
                  <div className="h-5 w-16 animate-pulse rounded bg-bg-overlay" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 animate-pulse rounded-md bg-bg-overlay" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 w-1/2 animate-pulse rounded bg-bg-overlay" />
                    <div className="h-2 w-1/3 animate-pulse rounded bg-bg-overlay" />
                  </div>
                </div>
                <div className="flex items-end justify-between border-t border-border-subtle pt-3">
                  <div className="space-y-1">
                    <div className="h-2 w-8 animate-pulse rounded bg-bg-overlay" />
                    <div className="h-5 w-16 animate-pulse rounded bg-bg-overlay" />
                  </div>
                  <div className="h-9 w-16 animate-pulse rounded-lg bg-bg-overlay" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

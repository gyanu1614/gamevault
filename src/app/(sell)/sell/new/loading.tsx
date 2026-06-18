/**
 * V16 — Sell wizard skeleton.
 *
 * Mirrors SellWizard's outer shell: max-w-4xl/5xl wrapper, big rounded
 * Card with StepBar at top and a content area underneath. We render the
 * generic 3-step layout (Category / Game / Details) since the real
 * wizard always lands on Step 1 on first paint.
 */

function Block({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-bg-overlay/80 ${className}`} />
  )
}

export default function SellNewLoading() {
  return (
    <main className="mx-auto w-full max-w-4xl px-3 pb-24 pt-24 sm:px-6 sm:pt-28 lg:max-w-5xl lg:pt-32">
      <section className="relative isolate overflow-visible rounded-3xl border border-border-default bg-bg-raised p-4 shadow-elevated sm:p-5 lg:p-6">
        {/* StepBar */}
        <nav className="mb-5">
          <ol className="mb-3 flex items-center justify-between gap-1 sm:gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <li key={i} className="min-w-0 flex-1">
                <div className="flex items-center justify-center gap-2 px-3 py-1.5">
                  <Block className="h-3.5 w-3.5 rounded-full" />
                  <Block className="h-3 w-16 sm:w-20" />
                </div>
              </li>
            ))}
          </ol>
          <Block className="h-1 w-full rounded-full" />
        </nav>

        {/* Step header */}
        <div className="mb-5 sm:mb-6">
          <Block className="mb-2 h-7 w-56 max-w-full" />
          <Block className="h-4 w-72 max-w-full" />
        </div>

        {/* Category tiles grid (mimics Step 1) */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-border-default bg-bg-overlay/60 p-5"
            >
              <Block className="mb-4 h-11 w-11 rounded-xl" />
              <Block className="mb-1.5 h-5 w-28" />
              <Block className="h-3 w-40" />
            </div>
          ))}
        </div>

        {/* Footer action row */}
        <div className="mt-7 flex items-center justify-between">
          <Block className="h-9 w-24 rounded-md" />
          <Block className="h-11 w-40 rounded-xl" />
        </div>
      </section>
    </main>
  )
}

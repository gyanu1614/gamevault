/**
 * V16 — Checkout skeleton.
 *
 * Layout-faithful with the real Checkout page:
 *   - Back chip + "Checkout • Protected" header
 *   - 2-col grid: form (StepBar + SubCards stack) / OrderSummary rail
 *
 * Replaces the V14j fullscreen lime spinner. Same proportions as the
 * real layout so the transition into the actual page is shape-stable.
 */

function Block({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-bg-overlay/80 ${className}`} />
  )
}

function SubCardShell({ children }: { children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border-default bg-bg-overlay/60 p-4 sm:p-5">
      {children}
    </div>
  )
}

export default function CheckoutLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-16 sm:px-6 sm:pt-20">
      {/* Back chip */}
      <Block className="h-7 w-32 rounded-full" />

      {/* Header */}
      <div className="mt-3 mb-5 flex flex-wrap items-center gap-3">
        <Block className="h-9 w-32" />
        <Block className="h-6 w-24 rounded-full" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_380px]">
        {/* Left column — form */}
        <div className="space-y-5">
          {/* StepBar */}
          <div className="mb-2 flex gap-3">
            <div className="flex-1 space-y-2">
              <Block className="h-4 w-24" />
              <Block className="h-2 w-full rounded-full" />
            </div>
            <div className="flex-1 space-y-2">
              <Block className="h-4 w-16" />
              <Block className="h-2 w-full rounded-full" />
            </div>
          </div>

          {/* Order preview SubCard */}
          <SubCardShell>
            <Block className="mb-3 h-4 w-20" />
            <div className="flex gap-4">
              <Block className="h-20 w-20 shrink-0 rounded-lg sm:h-24 sm:w-24" />
              <div className="min-w-0 flex-1 space-y-2">
                <Block className="h-3 w-20" />
                <Block className="h-5 w-3/4" />
                <Block className="mt-2 h-9 w-44 rounded-lg" />
              </div>
              <div className="shrink-0 space-y-1.5 text-right">
                <Block className="ml-auto h-7 w-20" />
                <Block className="ml-auto h-3 w-24" />
              </div>
            </div>
            {/* Seller chip below */}
            <div className="mt-4 flex items-center gap-3 border-t border-border-subtle pt-4">
              <Block className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Block className="h-4 w-32" />
                <Block className="h-3 w-48" />
              </div>
              <Block className="h-5 w-5 rounded-full" />
            </div>
          </SubCardShell>

          {/* VaultShield protection SubCard */}
          <SubCardShell>
            <Block className="mb-2 h-4 w-44" />
            <Block className="mb-4 h-3 w-64 max-w-full" />
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border-subtle bg-bg-base/50 p-3"
                >
                  <div className="flex items-center gap-2">
                    <Block className="h-7 w-7 rounded-md" />
                    <div className="flex-1 space-y-1">
                      <Block className="h-3.5 w-16" />
                      <Block className="h-3 w-20" />
                    </div>
                  </div>
                  <Block className="mt-2 h-2.5 w-full" />
                  <Block className="mt-1 h-2.5 w-3/4" />
                </div>
              ))}
            </div>
          </SubCardShell>

          {/* Promo SubCard */}
          <SubCardShell>
            <Block className="mb-3 h-4 w-28" />
            <div className="flex gap-2">
              <Block className="h-10 flex-1 rounded-lg" />
              <Block className="h-10 w-20 rounded-lg" />
            </div>
          </SubCardShell>

          {/* Continue button */}
          <div className="flex justify-end">
            <Block className="h-12 w-40 rounded-xl" />
          </div>
        </div>

        {/* Right column — OrderSummary rail */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-border-default bg-bg-overlay">
            {/* Game row */}
            <div className="border-b border-border-subtle p-4 sm:p-5">
              <div className="mb-2 flex items-center gap-1.5">
                <Block className="h-5 w-5 rounded" />
                <Block className="h-3 w-24" />
              </div>
              <div className="flex gap-3">
                <Block className="h-14 w-14 shrink-0 rounded-lg sm:h-16 sm:w-16" />
                <div className="flex-1 space-y-1.5">
                  <Block className="h-4 w-3/4" />
                  <Block className="h-7 w-32 rounded-full" />
                  <Block className="h-3 w-12" />
                </div>
              </div>
            </div>

            {/* Price breakdown */}
            <div className="space-y-2.5 p-4 sm:p-5">
              <div className="flex justify-between">
                <Block className="h-4 w-16" />
                <Block className="h-4 w-12" />
              </div>
              <div className="flex justify-between">
                <Block className="h-4 w-24" />
                <Block className="h-4 w-12" />
              </div>
              <div className="flex justify-between">
                <Block className="h-4 w-32" />
                <Block className="h-4 w-12" />
              </div>
              <div className="mt-3 flex items-baseline justify-between border-t border-border-subtle pt-3">
                <Block className="h-4 w-12" />
                <Block className="h-7 w-20" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

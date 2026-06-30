/**
 * V22 — Account route skeleton (segment-level loading.tsx).
 *
 * Mirrors the Seller Dashboard shape (header + KPI strip + 2-col main grid),
 * the most representative account landing. Uses the items/currency skeleton
 * convention: `bg-white/[0.07]` pulse blocks (read clearly over the hero) and
 * `card-frost` card surfaces — no opaque bg-bg-overlay "black box" cards.
 */

function Block({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-white/[0.07] ${className}`} />
}

export default function AccountLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-2 sm:px-6 lg:px-8">
      {/* Header — lime logo tile + title + subtitle (mirrors AccountPageHeader) */}
      <div className="flex items-center gap-3.5">
        <Block className="h-12 w-12 shrink-0 rounded-lg" />
        <div className="space-y-2">
          <Block className="h-7 w-52 max-w-full" />
          <Block className="h-4 w-72 max-w-full" />
        </div>
      </div>

      {/* KPI strip — 4 cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border-subtle card-frost p-4">
            <div className="flex items-center gap-2">
              <Block className="h-4 w-4 rounded" />
              <Block className="h-3 w-20" />
            </div>
            <Block className="mt-3 h-7 w-24" />
          </div>
        ))}
      </div>

      {/* Main grid — left (trend + top offers) / right (attention + reputation) */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* Left column */}
        <div className="space-y-4">
          {/* Earnings trend card */}
          <div className="rounded-lg border border-border-subtle card-frost p-5">
            <Block className="mb-4 h-4 w-32" />
            <Block className="h-48 w-full rounded-lg" />
          </div>
          {/* Top offers card */}
          <div className="rounded-lg border border-border-subtle card-frost p-5">
            <Block className="mb-4 h-4 w-28" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <Block className="h-4 w-40" />
                  <Block className="h-4 w-24" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Attention queue card */}
          <div className="rounded-lg border border-border-subtle card-frost p-5">
            <Block className="mb-4 h-4 w-44" />
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-border-subtle bg-white/[0.02] px-3 py-2.5">
                  <Block className="h-8 w-8 shrink-0 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <Block className="h-3.5 w-3/4" />
                    <Block className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Reputation card */}
          <div className="rounded-lg border border-border-subtle card-frost p-5">
            <Block className="mb-4 h-4 w-28" />
            <div className="flex items-center gap-4">
              <Block className="h-14 w-14 rounded-full" />
              <div className="flex-1 space-y-2">
                <Block className="h-4 w-24" />
                <Block className="h-3 w-32" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

/**
 * V33 — Seller offers-table skeleton.
 *
 * Mirrors the revamped /account/listings layout: title + Add New Offer,
 * filter chip row (Game / Status / Bulk Actions / search / sort), then
 * the results card with a count strip, shimmer rows, and the
 * pagination footer. Transparent so the persisted account HeroBackdrop
 * shows through (V21/P7.ah).
 */

function Block({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-white/[0.07] ${className}`} />
  )
}

export default function ListingsLoading() {
  return (
    <div className="min-h-screen pb-20">
      <div className="mx-auto w-full max-w-[1400px] px-4 pt-2 sm:px-6 lg:px-10 xl:px-14">
        {/* Header — AccountPageHeader shape: flush title, action right */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <Block className="h-8 w-52" />
          <Block className="h-10 w-40" />
        </div>

        {/* Filter row */}
        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <Block className="h-10 w-28" />
          <Block className="h-10 w-28" />
          <Block className="h-10 w-32" />
          <Block className="h-10 w-full max-w-[320px] flex-1" />
          <Block className="ml-auto h-10 w-24" />
        </div>

        {/* Results card */}
        <div className="mt-4 overflow-hidden rounded-lg border border-border-default bg-[rgba(16,18,25,0.72)]">
          <div className="border-b border-white/[0.06] px-5 py-3.5">
            <Block className="h-4 w-20" />
          </div>
          <div className="divide-y divide-white/[0.05]">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                <Block className="h-4 w-4 rounded" />
                <Block className="h-10 w-10 rounded-md" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Block className="h-4 w-44 max-w-full" />
                  <Block className="h-3 w-24" />
                </div>
                <Block className="hidden h-8 w-24 sm:block" />
                <Block className="hidden h-10 w-36 md:block" />
                <Block className="hidden h-6 w-16 lg:block" />
                <Block className="hidden h-4 w-14 lg:block" />
                <Block className="h-8 w-8" />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-3.5">
            <Block className="h-4 w-48" />
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Block key={i} className="h-8 w-8" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * V16 — Seller listings skeleton.
 *
 * Mirrors /account/listings (V14q row layout): max-w-7xl wrapper,
 * header w/ title + bulk upload + new listing buttons, search +
 * status filter row, then a stack of landscape listing rows.
 */

function Block({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-bg-overlay/80 ${className}`} />
  )
}

function ListingRowSkeleton() {
  return (
    <div className="rounded-xl border border-border-default bg-bg-overlay p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Left: checkbox + image + content */}
        <div className="flex flex-1 items-center gap-3 sm:gap-4">
          <Block className="h-4 w-4 shrink-0 rounded" />
          <Block className="h-16 w-16 shrink-0 rounded-xl sm:h-20 sm:w-20" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap gap-1.5">
              <Block className="h-4 w-20 rounded-md" />
              <Block className="h-4 w-24 rounded-md" />
            </div>
            <Block className="h-5 w-3/4 max-w-xs" />
            <div className="flex flex-wrap gap-1.5">
              <Block className="h-4 w-16 rounded-full" />
              <Block className="h-4 w-20 rounded-full" />
            </div>
          </div>
        </div>
        {/* Right: metric rail + actions */}
        <div className="flex items-center justify-end gap-4 sm:gap-5">
          <div className="hidden gap-5 lg:flex">
            <Block className="h-10 w-12" />
            <Block className="h-10 w-12" />
          </div>
          <div className="hidden gap-5 md:flex">
            <Block className="h-10 w-20" />
            <Block className="h-10 w-20" />
          </div>
          <Block className="h-9 w-32 rounded-md" />
          <div className="flex gap-1.5">
            <Block className="h-9 w-9 rounded-md" />
            <Block className="h-9 w-9 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ListingsLoading() {
  return (
    <div className="min-h-screen bg-bg-base pb-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-end sm:justify-between sm:pt-8">
          <div className="space-y-1.5">
            <Block className="h-8 w-44" />
            <Block className="h-4 w-64" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Block className="h-10 w-32 rounded-md" />
            <Block className="h-10 w-32 rounded-md" />
          </div>
        </header>

        {/* Search + filter row */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Block className="h-10 w-full rounded-xl sm:max-w-md" />
          <div className="flex gap-2 sm:ml-auto">
            <Block className="h-10 w-28 rounded-lg" />
            <Block className="h-10 w-28 rounded-lg" />
          </div>
        </div>

        {/* Listings stack */}
        <div className="mt-5 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <ListingRowSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}

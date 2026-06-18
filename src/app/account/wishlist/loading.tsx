/**
 * V16 — Wishlist skeleton.
 *
 * Mirrors /account/wishlist: max-w-4xl wrapper, page header, 3-stat
 * row, search + filter row, then a 1/2/3/4-col grid of listing cards.
 */

function Block({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-bg-overlay/80 ${className}`} />
  )
}

function MiniListingCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border-default bg-bg-overlay">
      <Block className="aspect-square w-full rounded-none" />
      <div className="space-y-2 p-3">
        <Block className="h-4 w-3/4" />
        <div className="flex justify-between gap-2">
          <Block className="h-5 w-16" />
          <Block className="h-7 w-7 rounded-full" />
        </div>
      </div>
    </div>
  )
}

export default function WishlistLoading() {
  return (
    <div className="min-h-screen bg-black pb-20">
      <div className="mx-auto max-w-4xl px-4 pt-6 sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="mb-6 space-y-1.5">
          <Block className="h-8 w-36" />
          <Block className="h-4 w-52" />
        </div>

        {/* Stats grid */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-border-default bg-bg-overlay/60 p-4"
            >
              <Block className="mb-2 h-3 w-20" />
              <Block className="h-7 w-16" />
            </div>
          ))}
        </div>

        {/* Search + filter row */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Block className="h-10 w-full rounded-xl sm:max-w-md" />
          <Block className="h-10 w-32 rounded-xl sm:ml-auto" />
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <MiniListingCard key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}

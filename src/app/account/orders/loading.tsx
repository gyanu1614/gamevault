/**
 * V16 — Orders list skeleton.
 *
 * Mirrors /account/orders: max-w-7xl wrapper, page header, tab row
 * (Purchases / Sales), filter chip row, then a stack of order cards.
 */

function Block({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-bg-overlay/80 ${className}`} />
  )
}

function OrderCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border-default bg-bg-overlay p-4 sm:p-5">
      <div className="flex items-start gap-4">
        <Block className="h-16 w-16 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <Block className="h-5 w-3/4 max-w-xs" />
          <div className="flex flex-wrap gap-1.5">
            <Block className="h-5 w-20 rounded-md" />
            <Block className="h-5 w-24 rounded-md" />
          </div>
          <Block className="h-3 w-40" />
        </div>
        <div className="hidden shrink-0 space-y-2 text-right sm:block">
          <Block className="ml-auto h-6 w-20" />
          <Block className="ml-auto h-6 w-24 rounded-full" />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border-subtle pt-3">
        <Block className="h-4 w-32" />
        <Block className="h-9 w-28 rounded-lg" />
      </div>
    </div>
  )
}

export default function OrdersLoading() {
  return (
    <div className="min-h-screen bg-bg-base pb-20">
      <div className="mx-auto w-full max-w-full px-4 pt-6 sm:px-6 md:max-w-7xl lg:px-8">
        {/* Page header */}
        <div className="mb-6 space-y-1.5">
          <Block className="h-8 w-32" />
          <Block className="h-4 w-64" />
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-3">
          <Block className="h-10 w-28 rounded-lg" />
          <Block className="h-10 w-24 rounded-lg" />
        </div>

        {/* Filter chips */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Block className="h-9 w-24 rounded-full" />
          <Block className="h-9 w-28 rounded-full" />
          <Block className="h-9 w-32 rounded-full" />
          <Block className="h-9 w-24 rounded-full" />
          <Block className="ml-auto h-9 w-9 rounded-lg" />
        </div>

        {/* Order cards */}
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <OrderCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}

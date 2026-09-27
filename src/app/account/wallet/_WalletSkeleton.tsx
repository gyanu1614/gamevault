/**
 * Wallet skeleton — mirrors _WalletClient 1:1 (same container, header,
 * balance block, tabs, search row and list) so the route fallback and the
 * client's data-loading state are the SAME picture and nothing jumps when
 * the figures land.
 *
 *  - Seller: Available + Pending cards (sm: 2-up), 3-up stats strip,
 *    three tabs.
 *  - Buyer: one balance card with a rewards row, 2-up (lg: 4-up) stats,
 *    one tab.
 */

function Block({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-white/[0.07] ${className}`} />
}

export function WalletSkeleton({ isSeller }: { isSeller: boolean }) {
  return (
    <div className="pb-12" aria-busy="true" aria-label="Loading your wallet">
      <div className="mx-auto w-full max-w-full px-4 sm:px-6 md:max-w-7xl lg:px-8">
        <div className="mb-6">
          {/* AccountPageHeader: title + subtitle */}
          <div className="mb-4 space-y-2">
            <Block className="h-7 w-28" />
            <Block className="h-3.5 w-48" />
          </div>

          {isSeller ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-start justify-between gap-4 rounded-lg border border-border-subtle card-frost p-5">
                  <div className="space-y-2.5">
                    <Block className="h-3.5 w-36" />
                    <Block className="h-8 w-28" />
                    <Block className="h-3 w-48" />
                  </div>
                  <Block className="h-11 w-28 shrink-0 rounded-lg" />
                </div>
                <div className="space-y-2.5 rounded-lg border border-border-subtle card-frost p-5">
                  <Block className="h-3.5 w-32" />
                  <Block className="h-8 w-28" />
                  <Block className="h-3 w-4/5" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-2 rounded-lg border border-border-subtle card-frost px-3 py-3">
                    <Block className="h-3 w-16" />
                    <Block className="h-5 w-14" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-border-subtle p-1">
              <div className="rounded-lg bg-black/40 p-6">
                <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2.5">
                    <Block className="h-3 w-20" />
                    <Block className="h-10 w-32" />
                  </div>
                  <Block className="h-10 w-28 rounded-lg" />
                </div>
                <div className="grid grid-cols-2 gap-2.5 border-t border-border-subtle pt-3">
                  <Block className="h-12 rounded-lg" />
                  <Block className="h-12 rounded-lg" />
                </div>
              </div>
            </div>
          )}
        </div>

        {!isSeller && (
          <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Block key={i} className="h-[72px] rounded-lg" />
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="mb-4 flex gap-2 sm:gap-3">
          {Array.from({ length: isSeller ? 3 : 1 }).map((_, i) => (
            <Block key={i} className="h-10 w-28 rounded-lg sm:h-12" />
          ))}
        </div>

        {/* Search + filter */}
        <div className="mb-3 flex gap-2">
          <Block className="h-9 flex-1 rounded-lg" />
          <Block className="h-9 w-24 rounded-lg" />
        </div>

        {/* Transactions */}
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-border-subtle card-frost p-3.5">
              <Block className="h-10 w-10 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Block className="h-4 w-1/2" />
                <Block className="h-3 w-1/3" />
              </div>
              <div className="shrink-0 space-y-1.5">
                <Block className="ml-auto h-4 w-16" />
                <Block className="ml-auto h-3 w-12" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

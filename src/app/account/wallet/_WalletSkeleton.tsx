/**
 * Wallet skeleton — mirrors _WalletClient 1:1 (same container, header,
 * balance block, tabs, search row and list) so the route fallback and the
 * client's data-loading state are the SAME picture and nothing jumps when
 * the figures land.
 *
 *  - One balance panel: sellers get three columns (Available + Withdraw,
 *    Store Credit, Pending), buyers one balance (+ top-up); a stats line
 *    under it. Then the compact segmented tabs.
 */

function Block({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-white/[0.07] ${className}`} />
}

/** Label · figure · one-line note, as BalanceCell draws it. */
function Cell() {
  return (
    <div className="space-y-2">
      <Block className="h-3 w-28" />
      <Block className="h-8 w-24" />
      <Block className="h-3 w-40" />
    </div>
  )
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

          <div className="overflow-hidden rounded-lg bg-bg-raised">
            {isSeller ? (
              <div className="grid divide-y divide-white/[0.07] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                <div className="flex items-start justify-between gap-3 p-5">
                  <Cell />
                  <Block className="h-10 w-28 shrink-0" />
                </div>
                <div className="p-5"><Cell /></div>
              </div>
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-4 p-5">
                <Cell />
              </div>
            )}
            <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-white/[0.07] px-5 py-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Block key={i} className="h-3.5 w-28" />
              ))}
            </div>
          </div>
        </div>

        {/* Tabs — segmented control */}
        <div className="mb-3 flex w-fit gap-1 rounded-md border border-white/[0.08] bg-[rgba(20,20,27,0.56)] p-1">
          {Array.from({ length: isSeller ? 3 : 1 }).map((_, i) => (
            <Block key={i} className="h-8 w-24 rounded-[5px]" />
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

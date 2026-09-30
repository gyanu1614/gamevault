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

        {/* Tabs: SegmentedTabs, first tab selected (Sales for sellers, Purchases for buyers) */}
        <div className="mb-3 flex w-fit gap-1 rounded-md border border-white/[0.08] bg-bg-well p-1">
          {(isSeller ? [78, 104, 92] : [104]).map((w, i) => (
            <div key={i} className={`h-8 rounded-[5px] ${i === 0 ? 'bg-white/[0.09]' : 'animate-pulse bg-white/[0.07] opacity-40'}`} style={{ width: w }} />
          ))}
        </div>

        {/* Search (+ status filter on Purchases) */}
        <div className="mb-3 flex gap-2">
          <Block className="h-10 flex-1" />
          {!isSeller && <Block className="h-10 w-28" />}
        </div>

        {/* Transactions: one panel, hairlines between rows */}
        <div className="divide-y divide-white/[0.07] overflow-hidden rounded-lg bg-bg-raised">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-4 sm:gap-4 sm:px-5">
              <Block className="h-10 w-10 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Block className="h-3 w-24" />
                <Block className="h-4 w-1/2" />
                <Block className="h-3 w-1/3" />
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <Block className="h-6 w-20 rounded-full" />
                <Block className="h-4 w-14" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

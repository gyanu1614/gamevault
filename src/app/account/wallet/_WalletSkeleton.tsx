/**
 * Wallet skeleton, the same picture the page draws: heading, the balance with its
 * stats, the tabs, the search box and the list. Used by loading.tsx.
 */

function Block({ className }: { className: string }) {
  return <div className={`skeleton rounded ${className}`} />
}

export function WalletSkeleton({ isSeller }: { isSeller: boolean }) {
  return (
    <div className="pb-12" aria-busy="true" aria-label="Loading your wallet">
      <div className="mx-auto w-full max-w-full px-4 sm:px-6 md:max-w-7xl lg:px-8">
        <Block className="mb-4 h-7 w-28" />

        <div className="grid overflow-hidden rounded-lg bg-bg-raised lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
          <div className="space-y-3 p-6 sm:p-8">
            <Block className="h-4 w-28" />
            <Block className="h-12 w-44" />
            <Block className="h-3.5 w-72 max-w-full" />
            {isSeller && <Block className="h-11 w-64 max-w-full rounded-md" />}
          </div>
          <div className="space-y-5 bg-white/[0.03] p-6 sm:p-8">
            {Array.from({ length: isSeller ? 4 : 2 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <Block className="h-4 w-32" />
                <Block className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-lg bg-bg-raised">
          <div className="flex flex-col gap-3 border-b border-white/[0.07] p-3 sm:px-5 sm:py-4 lg:flex-row lg:items-center lg:justify-between">
            <Block className="h-10 w-72 max-w-full rounded-md" />
            <Block className="h-10 w-full rounded-md lg:w-[400px]" />
          </div>
          <div className="divide-y divide-white/[0.07]">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3 sm:px-5">
                <Block className="h-10 w-10 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Block className="h-4 w-48 max-w-full" />
                  <Block className="h-3 w-32" />
                </div>
                <Block className="h-5 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

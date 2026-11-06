/**
 * Wallet skeleton, the same picture the page draws: heading, the two balances, then the
 * Activity heading and its rows. Used by loading.tsx.
 */

function Block({ className }: { className: string }) {
  return <div className={`skeleton rounded ${className}`} />
}

export function WalletSkeleton({ isSeller: _isSeller }: { isSeller: boolean }) {
  return (
    <div className="pb-12" aria-busy="true" aria-label="Loading your wallet">
      <div className="mx-auto w-full max-w-full px-4 sm:px-6 md:max-w-7xl lg:px-8">
        <Block className="mb-4 h-8 w-28" />
        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-4 rounded-lg bg-bg-raised p-5 lg:p-6">
              <Block className="h-12 w-12 shrink-0" />
              <div className="space-y-2">
                <Block className="h-4 w-32" />
                <Block className="h-9 w-36" />
              </div>
            </div>
          ))}
        </div>
        <div className="mb-4 mt-8 flex items-center justify-between gap-4">
          <Block className="h-7 w-24" />
          <Block className="h-10 w-80 max-w-[50%]" />
        </div>
        <div className="divide-y divide-white/[0.07] overflow-hidden rounded-lg bg-bg-raised">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 sm:px-6">
              <Block className="h-12 w-12 shrink-0 rounded-md" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Block className="h-4 w-56 max-w-full" />
                <Block className="h-3 w-36" />
              </div>
              <Block className="h-5 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

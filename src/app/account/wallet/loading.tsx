/**
 * V16 — Wallet skeleton.
 *
 * Mirrors /account/wallet: max-w-7xl wrapper, page header w/ lime
 * icon + title + subtitle, big balance card, tab row, then a
 * transactions table.
 */

function Block({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-bg-overlay/80 ${className}`} />
  )
}

export default function WalletLoading() {
  return (
    <div className="min-h-screen bg-black pb-20">
      <div className="mx-auto w-full max-w-full px-4 pt-6 sm:px-6 md:max-w-7xl lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <div className="mb-4 flex items-center gap-3">
            <Block className="h-11 w-11 rounded-xl" />
            <div className="space-y-1.5">
              <Block className="h-6 w-32" />
              <Block className="h-3 w-44" />
            </div>
          </div>

          {/* Balance card */}
          <div className="rounded-2xl border border-border-default bg-bg-overlay p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-2">
                <Block className="h-3 w-24" />
                <Block className="h-9 w-32" />
                <Block className="h-3 w-40" />
              </div>
              <Block className="h-10 w-36 rounded-xl" />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-5 flex gap-3">
          <Block className="h-10 w-28 rounded-lg" />
          <Block className="h-10 w-24 rounded-lg" />
          <Block className="h-10 w-24 rounded-lg" />
        </div>

        {/* Transactions list */}
        <div className="space-y-2.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl border border-border-default bg-bg-overlay p-4"
            >
              <Block className="h-10 w-10 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Block className="h-4 w-1/2" />
                <Block className="h-3 w-1/3" />
              </div>
              <div className="shrink-0 space-y-1 text-right">
                <Block className="ml-auto h-5 w-20" />
                <Block className="ml-auto h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

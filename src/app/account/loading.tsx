/**
 * V16 — Account dashboard skeleton.
 *
 * Mirrors /account (and /account/dashboard which shares the same shape):
 * max-w-7xl wrapper, welcome header, 1/2/3-col grid of action cards.
 */

function Block({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-bg-overlay/80 ${className}`} />
  )
}

export default function AccountLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="mb-6 space-y-1.5">
        <Block className="h-8 w-72 max-w-full" />
        <Block className="h-4 w-80 max-w-full" />
      </header>

      {/* Action card grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-border-default bg-bg-overlay p-5"
          >
            <div className="mb-3 flex items-center justify-between">
              <Block className="h-10 w-10 rounded-xl" />
              <Block className="h-4 w-4 rounded" />
            </div>
            <Block className="mb-1.5 h-5 w-32" />
            <Block className="h-3 w-44" />
          </div>
        ))}
      </div>
    </main>
  )
}

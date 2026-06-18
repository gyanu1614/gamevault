/**
 * V16 — Messages skeleton.
 *
 * Mirrors the real /account/messages layout: max-w-7xl wrapper,
 * page header on top, then a 360px conversation rail + chat thread
 * grid (single column on mobile).
 */

function Block({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-bg-overlay/80 ${className}`} />
  )
}

export default function MessagesLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <Block className="h-8 w-44" />
        <Block className="h-9 w-32 rounded-lg" />
      </div>

      <div className="grid h-[calc(100vh-200px)] grid-cols-1 gap-3 lg:grid-cols-[360px_1fr]">
        {/* Conversation rail */}
        <div className="overflow-hidden rounded-2xl border border-border-default bg-bg-overlay">
          {/* Search input */}
          <div className="border-b border-border-subtle p-3">
            <Block className="h-9 w-full rounded-xl" />
          </div>
          {/* Conversation list */}
          <div className="space-y-1 p-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl p-2.5"
              >
                <Block className="h-10 w-10 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Block className="h-3.5 w-28" />
                    <Block className="h-2.5 w-10" />
                  </div>
                  <Block className="h-3 w-40 max-w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat thread */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-border-default bg-bg-overlay">
          {/* Thread header */}
          <div className="flex items-center justify-between gap-3 border-b border-border-subtle p-4">
            <div className="flex items-center gap-3">
              <Block className="h-10 w-10 rounded-full" />
              <div className="space-y-1.5">
                <Block className="h-4 w-32" />
                <Block className="h-3 w-20" />
              </div>
            </div>
            <Block className="h-9 w-9 rounded-lg" />
          </div>

          {/* Messages */}
          <div className="flex flex-1 flex-col gap-3 overflow-hidden p-4">
            {Array.from({ length: 6 }).map((_, i) => {
              const mine = i % 3 === 0
              return (
                <div
                  key={i}
                  className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                >
                  <Block
                    className={`h-12 ${mine ? 'w-2/5' : 'w-1/2'} ${
                      mine ? 'rounded-2xl rounded-br-sm' : 'rounded-2xl rounded-bl-sm'
                    }`}
                  />
                </div>
              )
            })}
          </div>

          {/* Composer */}
          <div className="border-t border-border-subtle p-3">
            <div className="flex items-center gap-2">
              <Block className="h-10 w-10 shrink-0 rounded-lg" />
              <Block className="h-10 flex-1 rounded-xl" />
              <Block className="h-10 w-10 shrink-0 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

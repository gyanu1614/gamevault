/**
 * V16 — Order detail skeleton.
 *
 * Mirrors the buyer order detail page: back chip → header (image +
 * title + game/category chips + order id) → 2-col split (order
 * timeline / progress on the left, chat panel on the right).
 */

function Block({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-white/[0.07] ${className}`} />
  )
}

export default function OrderDetailLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] via-[#0d0d14] to-[#0a0a0f]">
      <div className="mx-auto max-w-6xl px-4 pb-8 pt-4 sm:px-6 md:pt-6 lg:px-8">
        {/* Back chip */}
        <Block className="mb-7 h-9 w-36 rounded-lg" />

        {/* Header */}
        <div className="mb-7 flex items-center gap-4">
          <Block className="h-[72px] w-[72px] shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Block className="h-6 w-3/4 max-w-md" />
            <div className="flex gap-2">
              <Block className="h-5 w-20 rounded-md" />
              <Block className="h-5 w-24 rounded-md" />
            </div>
            <Block className="h-4 w-40" />
          </div>
          {/* Status badge */}
          <Block className="h-7 w-28 shrink-0 rounded-full" />
        </div>

        {/* Body grid */}
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          {/* Left — main content */}
          <div className="space-y-5">
            {/* Progress bar card */}
            <div className="rounded-lg border border-border-subtle card-frost p-5">
              <Block className="mb-3 h-4 w-32" />
              <Block className="mb-2 h-2 w-full rounded-full" />
              <div className="mt-4 flex justify-between">
                <Block className="h-3 w-16" />
                <Block className="h-3 w-16" />
                <Block className="h-3 w-16" />
                <Block className="h-3 w-16" />
              </div>
            </div>

            {/* Order details card */}
            <div className="rounded-lg border border-border-subtle card-frost p-5">
              <Block className="mb-4 h-5 w-28" />
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Block className="h-4 w-32" />
                    <Block className="h-4 w-24" />
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline card */}
            <div className="rounded-lg border border-border-subtle card-frost p-5">
              <Block className="mb-4 h-5 w-28" />
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Block className="h-8 w-8 shrink-0 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Block className="h-4 w-1/2" />
                      <Block className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right — chat / actions rail */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-lg border border-border-subtle card-frost">
              {/* Chat header */}
              <div className="flex items-center gap-2 border-b border-border-subtle p-4">
                <Block className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Block className="h-4 w-24" />
                  <Block className="h-3 w-16" />
                </div>
              </div>

              {/* Chat messages */}
              <div className="space-y-3 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}
                  >
                    <Block className={`h-12 ${i % 2 === 0 ? 'w-3/4' : 'w-1/2'}`} />
                  </div>
                ))}
              </div>

              {/* Chat input */}
              <div className="border-t border-border-subtle p-3">
                <Block className="h-10 w-full rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

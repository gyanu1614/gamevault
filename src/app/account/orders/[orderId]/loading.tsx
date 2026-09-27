/**
 * Order detail skeleton — mirrors _OrderClient 1:1: same container, the
 * back link + presence row, the header (compact on phones), the phone
 * status card, then the grid (status strip + chat on the left, Order
 * Details + payout on the right rail). Phone cards are full-bleed like
 * the real OrderCard.
 */

function Block({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-white/[0.07] ${className}`} />
}

/** Same surface as OrderCard (full-bleed below sm). */
const CARD =
  'rounded-lg border border-border-default bg-bg-raised max-sm:-mx-5 max-sm:rounded-none max-sm:border-0'

export default function OrderDetailLoading() {
  return (
    <div className="relative min-h-screen">
      <div className="mx-auto max-w-[1400px] px-5 pb-10 pt-6 sm:px-8 lg:px-10 lg:pt-8">
        {/* Back link + presence */}
        <div className="mb-6 flex items-center justify-between max-sm:mb-7">
          <Block className="h-4 w-32" />
          <div className="flex items-center gap-2.5">
            <Block className="h-8 w-8 rounded-full" />
            <div className="space-y-1">
              <Block className="h-2.5 w-10" />
              <Block className="h-3.5 w-20" />
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 sm:items-start sm:gap-5">
          <Block className="h-12 w-12 shrink-0 rounded-xl sm:h-[88px] sm:w-[88px] sm:rounded-2xl" />
          <div className="min-w-0 flex-1 space-y-2 sm:space-y-3 sm:pt-1">
            <Block className="h-5 w-3/4 max-w-md sm:h-7" />
            <div className="flex gap-3">
              <Block className="h-4 w-20" />
              <Block className="h-4 w-20" />
            </div>
          </div>
          <div className="hidden shrink-0 flex-col items-end gap-2 pt-1 sm:flex">
            <Block className="h-8 w-32 rounded-[9px]" />
            <Block className="h-8 w-40 rounded-[9px]" />
          </div>
        </div>

        {/* Phone status card */}
        <div className={`${CARD} mt-7 flex items-start gap-3 px-5 py-4 sm:hidden`}>
          <Block className="h-10 w-10 shrink-0 rounded-[10px]" />
          <div className="flex-1 space-y-2">
            <Block className="h-4 w-32" />
            <Block className="h-3 w-40" />
            <Block className="h-3 w-4/5" />
          </div>
        </div>

        {/* Body grid */}
        <div className="mt-6 grid grid-cols-1 gap-[22px] lg:grid-cols-[1fr_412px]">
          <div className="flex flex-col gap-[18px]">
            {/* Status strip */}
            <div className={`${CARD} flex items-center gap-3.5 px-5 py-4`}>
              <Block className="h-11 w-11 shrink-0 rounded-[11px]" />
              <div className="flex-1 space-y-2">
                <Block className="h-4 w-40" />
                <Block className="h-3 w-56 max-w-full" />
              </div>
            </div>

            {/* Chat */}
            <div
              className={`${CARD} flex h-[clamp(360px,100dvh_-_180px,720px)] flex-col overflow-hidden max-sm:h-[clamp(340px,100dvh_-_230px,640px)] lg:h-[580px]`}
            >
              <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-3">
                <Block className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Block className="h-3.5 w-24" />
                  <Block className="h-3 w-40" />
                </div>
              </div>
              <div className="flex-1 space-y-3 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                    <Block className={`h-11 rounded-[14px] ${i % 2 === 0 ? 'w-3/5' : 'w-2/5'}`} />
                  </div>
                ))}
              </div>
              <div className="border-t border-border-subtle px-4 py-3">
                <Block className="h-11 w-full rounded-lg sm:h-10" />
              </div>
            </div>
          </div>

          {/* Right rail — Order Details */}
          <aside className="flex flex-col gap-[18px] lg:sticky lg:top-[18px] lg:self-start">
            <div className={`${CARD} px-5 pb-4 pt-5`}>
              <Block className="mb-4 h-5 w-32" />
              <div className="space-y-3.5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Block className="h-3.5 w-24" />
                    <Block className="h-3.5 w-28" />
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

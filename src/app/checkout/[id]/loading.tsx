/**
 * V80 — Checkout skeleton, shape-faithful to the handoff card shell:
 * centered 1040px radial shell, header (emblem + SSL pill), 1fr/350px
 * grid of method rows + order panel, trust strip, marquee strip. Same
 * proportions as the real page so the transition is shape-stable.
 */

function Block({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-white/[0.05] ${className}`} />
}

export default function CheckoutLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-12 pt-5 sm:px-6 sm:pt-7 lg:px-8">
      <div>
        <div className="mb-8 flex items-center justify-between sm:mb-10">
          <div className="flex items-center gap-2.5">
            <Block className="h-8 w-8 rounded-lg" />
            <Block className="h-5 w-32" />
          </div>
          <Block className="h-8 w-40 rounded-md" />
        </div>
        <Block className="mb-6 hidden h-7 w-28 sm:block" />

        <div className="grid gap-6 sm:gap-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start xl:grid-cols-[minmax(0,1fr)_420px] xl:gap-10">
          {/* Left — Pay with rows */}
          <div className="order-2 lg:order-1">
            <Block className="mb-4 h-6 w-28 sm:mb-[18px]" />
            <div className="flex flex-col gap-3.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3.5 rounded-md border border-white/[0.06] bg-[#12151e] px-4 py-3">
                  <Block className="h-[30px] w-[30px] rounded-[8px]" />
                  <div className="flex-1 space-y-1.5">
                    <Block className="h-4 w-40 max-w-full" />
                    <Block className="h-3 w-52 max-w-full" />
                  </div>
                  <Block className="h-[22px] w-[22px] rounded-full" />
                </div>
              ))}
            </div>
            {/* SafeDrop tier */}
            <Block className="mb-4 mt-8 h-5 w-44 sm:mt-10" />
            <Block className="h-[52px] w-full rounded-md" />
            <Block className="mt-2.5 h-32 w-full rounded-md" />
          </div>

          {/* Right — item card + order details card */}
          <div className="order-1 flex flex-col gap-5 sm:gap-6 lg:order-2">
            <div className="rounded-lg border border-white/[0.08] bg-[linear-gradient(180deg,#151a26,#0f131d)] p-4 sm:p-6">
              <div className="mb-4 flex items-center gap-[9px]">
                <Block className="h-7 w-7" />
                <Block className="h-4 w-24" />
              </div>
              <div className="mb-4 h-px bg-white/[0.07]" />
              <div className="mb-4 flex items-center gap-3">
                <Block className="h-14 w-14 rounded-md" />
                <div className="flex-1 space-y-1.5">
                  <Block className="h-4 w-3/4" />
                  <Block className="h-3 w-1/2" />
                </div>
                <Block className="h-5 w-14" />
              </div>
              <div className="mb-4 h-px bg-white/[0.07]" />
              <div className="flex justify-between">
                <Block className="h-4 w-16" />
                <Block className="h-7 w-24 rounded-md" />
              </div>
            </div>

            <div className="rounded-lg border border-white/[0.08] bg-[linear-gradient(180deg,#151a26,#0f131d)] p-4 sm:p-6">
              <div className="mb-4 flex items-center gap-[9px]">
                <Block className="h-7 w-7" />
                <Block className="h-4 w-28" />
              </div>
              <div className="mb-4 h-px bg-white/[0.07]" />
              <Block className="mb-4 h-4 w-44" />
              <div className="mb-4 h-px bg-white/[0.07]" />
              <div className="space-y-[11px]">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <Block className="h-3.5 w-28" />
                    <Block className="h-3.5 w-12" />
                  </div>
                ))}
              </div>
              <div className="my-4 h-px bg-white/[0.07]" />
              <div className="mb-4 flex items-end justify-between">
                <Block className="h-6 w-16" />
                <Block className="h-8 w-24" />
              </div>
              <Block className="h-[54px] w-full rounded-md" />
              <Block className="mx-auto mt-3 h-3 w-56 max-w-full" />
            </div>
          </div>
        </div>

        {/* Trust strip */}
        <Block className="mt-8 h-[110px] w-full rounded-lg sm:mt-10" />
        {/* Marquee strip */}
        <Block className="mt-6 h-[50px] w-full rounded-lg sm:mt-8" />
      </div>
    </main>
  )
}

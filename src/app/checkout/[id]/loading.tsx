/**
 * Checkout skeleton — the same frame as the live page (owner 2026-10-27):
 * the item page's max-w-7xl width, the Secure Checkout header, then the
 * 1fr / 420px (xl 460px) grid —
 * payment rows (radio, name + line, logo tile), the three floating seals
 * and the closed How Your Order Works bar on the left; the item card, the
 * Order Summary box and the rating bar on the right (the item card comes
 * first on phones).
 */

import { BAND_CLASS, CARD_CLASS, rowStyle } from './_surfaces'

const GROUND = '#16171B'

function Block({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-white/[0.07] ${className}`} />
}

function ItemCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <Card className={className}>
      <div className="grid grid-cols-[48px_minmax(0,1fr)] gap-x-3 p-4 sm:grid-cols-[64px_minmax(0,1fr)] sm:gap-x-4">
        <Block className="h-12 w-12 sm:row-span-2 sm:h-16 sm:w-16" />
        <div className="min-w-0 self-center sm:self-start">
          <Block className="h-4 w-44" />
          <Block className="mt-1.5 h-3 w-24" />
        </div>
        <Block className="col-span-2 mt-3 h-3.5 w-full max-w-[260px] sm:col-span-1 sm:col-start-2 sm:mt-1.5" />
      </div>
      <div className={`${BAND_CLASS} px-4 pb-3.5 pt-3`}>
        <Block className="h-3 w-12" />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2.5">
          <Block className="h-4 w-28" />
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <Block key={i} className="h-7 w-24" />
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}

/** Order Summary's top: title, discount toggle, line items (no lines). */
function SummaryTop() {
  return (
    <div className="px-4 pb-4 pt-4 lg:px-5">
      <Block className="mb-3.5 h-4 w-32" />
      <Block className="h-3.5 w-40" />
      <div className="mt-4 space-y-2">
        {[0, 1].map((i) => (
          <div key={i} className="flex justify-between">
            <Block className="h-3.5 w-28" />
            <Block className="h-3.5 w-14" />
          </div>
        ))}
      </div>
    </div>
  )
}

function TotalRow() {
  return (
    <div className="flex justify-between">
      <Block className="h-5 w-12" />
      <Block className="h-6 w-20" />
    </div>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`${CARD_CLASS} ${className}`}>
      {children}
    </div>
  )
}

export default function CheckoutLoading() {
  return (
    <div className="min-h-screen" style={{ background: GROUND }}>
      {/* Navbar strip */}
      <div className="flex h-16 items-center justify-between px-4 sm:px-10">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 animate-pulse rounded-md bg-white/10" />
          <div className="h-4 w-24 animate-pulse rounded bg-white/10" />
        </div>
        {/* The site account trigger: avatar + caret (avatar alone on phones) */}
        <div className="h-9 w-9 animate-pulse rounded-full bg-white/10 lg:h-10 lg:w-[62px] lg:rounded-[8px]" />
      </div>

      <div className="mx-auto w-full max-w-7xl px-3 pb-24 pt-8 sm:px-6 sm:pt-10 lg:px-8">
        {/* Header row */}
        <div className="flex items-center gap-3">
          <Block className="h-9 w-9" />
          <Block className="h-7 w-48" />
        </div>

        <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_460px] xl:gap-10">
          {/* Phones: the item card first */}
          <ItemCardSkeleton className="lg:hidden" />

          {/* Left — payment column */}
          <div>
            <div className="mb-3 flex items-center justify-between gap-4">
              <Block className="h-6 w-40" />
              <Block className="h-4 w-44" />
            </div>
            {/* Method rows: radio, name, logo tile */}
            <div className="flex flex-col gap-2.5">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex min-h-[48px] items-center gap-3 rounded-lg bg-[#1C1D22] px-3.5 py-1.5"
                  style={rowStyle(false)}
                >
                  <Block className="h-[18px] w-[18px] rounded-full" />
                  <Block className="h-4 w-28 flex-1" />
                  <Block className="h-7 w-[48px]" />
                </div>
              ))}
            </div>

            {/* Phones: discount + money rows under the list */}
            <Card className="mt-5 lg:hidden">
              <SummaryTop />
              <div className={`${BAND_CLASS} px-4 pb-4 pt-3.5`}>
                <TotalRow />
                <Block className="mx-auto mt-3 h-3 w-44" />
              </div>
            </Card>

            {/* Seals: three floating items, no box (stacked on phones and lg) */}
            <div className="mt-8 grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-[auto_auto_auto] md:justify-between lg:grid-cols-1 xl:grid-cols-[auto_auto_auto]">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Block className="h-8 w-8" />
                  <div className="space-y-1.5">
                    <Block className="h-3 w-28" />
                    <Block className="h-2.5 w-40" />
                  </div>
                </div>
              ))}
            </div>

            {/* How Your Order Works: the slim tinted bar, closed */}
            <div className="mt-8 flex items-center gap-3 rounded-md bg-[rgba(18,24,40,0.78)] px-3.5 py-2.5 shadow-[inset_0_0_0_1px_rgba(106,168,255,0.22)] sm:px-4">
              <Block className="h-8 w-8" />
              <Block className="h-4 w-44" />
            </div>
          </div>

          {/* Right — the item card, then the buy box */}
          <div className="hidden flex-col gap-3.5 lg:flex">
            <ItemCardSkeleton />
            <Card>
              <SummaryTop />
              <div className={`${BAND_CLASS} px-5 pb-4 pt-3.5`}>
                <TotalRow />
                <Block className="mt-3.5 h-12 w-full" />
                <Block className="mx-auto mt-3 h-3 w-56" />
                <Block className="mx-auto mt-3 h-3 w-44" />
              </div>
            </Card>
            {/* Buyer rating: the slim green bar */}
            <div className="flex items-center gap-3 rounded-md bg-[rgba(12,30,22,0.78)] px-3.5 py-2.5 shadow-[inset_0_0_0_1px_rgba(63,217,134,0.24)] sm:px-4">
              <Block className="h-8 w-8" />
              <div className="space-y-1.5">
                <Block className="h-3.5 w-24" />
                <Block className="h-3 w-32" />
              </div>
              <Block className="ml-auto h-4 w-28" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

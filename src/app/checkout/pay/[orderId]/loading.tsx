/**
 * Payment page skeleton: the 2026-10 layout. Checkout navbar strip, title,
 * then the payment column (amount hero, QR square + address/buttons, footer
 * line) beside the 340px side column (order summary, status timeline,
 * policy links). One column on phones, payment first. Shape-stable.
 */

import { MARKET_CARD } from '@/lib/ui/surfaces'

function Block({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-white/[0.07] motion-reduce:animate-none ${className}`} />
}

export default function PayLoading() {
  return (
    <div className="min-h-[100dvh] bg-bg-base" aria-busy="true" aria-label="Loading payment">
      <div className="flex h-16 items-center justify-between border-b border-white/[0.08] px-4 sm:px-10">
        <div className="flex items-center gap-2">
          <Block className="h-6 w-6" />
          <Block className="h-4 w-24" />
        </div>
        <Block className="h-7 w-7 rounded-full" />
      </div>

      <div className="mx-auto w-full max-w-[1080px] px-4 pb-16 pt-6 sm:px-6 sm:pt-10 lg:px-8">
        <Block className="h-7 w-64 sm:h-8" />
        <Block className="mt-2 h-4 w-44" />

        <div className="mt-6 grid grid-cols-1 gap-4 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
          {/* Payment column */}
          <div className={`${MARKET_CARD} overflow-hidden rounded-lg`}>
            <div className="p-5 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <Block className="h-4 w-24" />
                <Block className="h-8 w-32 rounded-full" />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <Block className="h-10 w-52 sm:h-11" />
                <Block className="h-10 w-[92px]" />
              </div>
              <Block className="mt-3 h-3.5 w-56" />
            </div>
            <div className="grid grid-cols-1 gap-6 border-t border-white/[0.07] p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-8 sm:p-8">
              <Block className="h-[240px] w-[240px] justify-self-center sm:h-[260px] sm:w-[260px] sm:justify-self-start" />
              <div className="min-w-0">
                <Block className="h-4 w-32" />
                <Block className="mt-3 h-4 w-full" />
                <Block className="mt-2 h-4 w-2/3" />
                <div className="mt-4 grid grid-cols-1 gap-2.5 sm:flex">
                  <Block className="h-10 w-full sm:w-[92px]" />
                  <Block className="h-10 w-full sm:w-36" />
                </div>
                <Block className="mt-6 h-3.5 w-full" />
              </div>
            </div>
            <div className="border-t border-white/[0.07] px-5 py-4 sm:px-8">
              <Block className="h-3.5 w-72 max-w-full" />
            </div>
          </div>

          {/* Side column: status first on phones, summary first on desktop */}
          <div className="flex min-w-0 flex-col gap-4">
            <div className={`${MARKET_CARD} order-1 rounded-lg p-5 lg:order-2`}>
              <Block className="h-4 w-28" />
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="mt-4 flex items-center gap-3">
                  <Block className="h-4 w-4 rounded-full" />
                  <Block className="h-3.5 w-36" />
                </div>
              ))}
            </div>
            <div className={`${MARKET_CARD} order-2 rounded-lg p-5 lg:order-1`}>
              <div className="flex items-start gap-3.5">
                <Block className="h-[52px] w-[52px]" />
                <div className="min-w-0 flex-1">
                  <Block className="h-4 w-full" />
                  <Block className="mt-1.5 h-3.5 w-24" />
                  <Block className="mt-1.5 h-3 w-32" />
                </div>
              </div>
              {[0, 1, 2].map((i) => (
                <div key={i} className="mt-4 flex justify-between">
                  <Block className="h-3.5 w-20" />
                  <Block className="h-3.5 w-14" />
                </div>
              ))}
            </div>
            <div className="order-3 px-1 pt-1">
              <Block className="h-3.5 w-64 max-w-full" />
              <Block className="mt-3 ml-6 h-3.5 w-48" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

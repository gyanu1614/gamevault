/**
 * /shop/[slug] skeleton — the storefront exactly as SellerStorefront draws
 * it: ONE header card (short banner strip, overlapping avatar + identity row,
 * hairline, five stats), the tab row, the filter band and a grid of landscape offer
 * cards. Keep it in lockstep with the page.
 */

import { cn } from '@/lib/utils'
import { MARKET_CARD } from '@/lib/ui/surfaces'

function Bar({ className }: { className: string }) {
  return <div className={cn('skeleton rounded', className)} />
}

export default function ShopLoading() {
  return (
    <main className="min-h-screen bg-bg-base pb-16" aria-busy="true" aria-label="Loading shop">
      <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8">
        {/* Header card: banner strip, identity, hairline, stats — one card */}
        <div className={cn('overflow-hidden rounded-lg', MARKET_CARD)}>
          <div className="skeleton h-[132px] w-full rounded-none sm:h-[172px] lg:h-[212px]" />
          <div className="px-4 pb-5 sm:px-6 sm:pb-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-5">
              <div className="relative -mt-10 h-20 w-20 shrink-0 rounded-xl bg-[#24252B] shadow-[0_0_0_4px_#212228] sm:-mt-12 sm:h-24 sm:w-24" />
              <div className="min-w-0 flex-1 space-y-2.5 sm:pb-1">
                <Bar className="h-7 w-56 max-w-full" />
                <div className="flex flex-wrap gap-3">
                  <Bar className="h-7 w-24" />
                  <Bar className="h-5 w-28" />
                  <Bar className="h-5 w-36" />
                </div>
              </div>
              <Bar className="h-11 w-full rounded-md sm:h-10 sm:w-40" />
            </div>
          </div>
          <div className="px-4 sm:px-6">
            <div className="grid grid-cols-2 gap-x-4 gap-y-5 border-t border-white/[0.07] py-4 sm:gap-x-6 sm:py-5 lg:grid-cols-5 lg:gap-0 lg:divide-x lg:divide-white/[0.07]">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className={cn('min-w-0 lg:px-5 lg:first:pl-0 lg:last:pr-0 xl:px-6', i === 4 && 'col-span-2 lg:col-span-1')}>
                  <Bar className="h-3.5 w-24" />
                  <Bar className="mt-2 h-6 w-16" />
                  <Bar className="mt-1.5 h-3 w-20" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6 flex w-fit gap-1 rounded-lg bg-bg-well p-1">
          <Bar className="h-8 w-24 rounded-md" />
          <Bar className="h-8 w-24 rounded-md" />
          <Bar className="h-8 w-16 rounded-md" />
        </div>

        {/* Filter band */}
        <div className="mt-5 flex flex-col gap-2.5 lg:flex-row lg:items-center">
          <div className="flex gap-2">
            <Bar className="h-10 w-32 rounded-md sm:h-[42px]" />
            <Bar className="h-10 w-36 rounded-md sm:h-[42px]" />
            <Bar className="h-10 w-28 rounded-md sm:h-[42px]" />
          </div>
          <Bar className="h-10 w-full rounded-lg sm:h-[42px] lg:ml-auto lg:max-w-sm" />
        </div>
        <Bar className="mt-4 h-4 w-20" />

        {/* Offer grid */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" style={{ gap: 'var(--gap-grid)' }}>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className={cn('flex flex-col overflow-hidden rounded-lg', MARKET_CARD)}>
              <div className="flex gap-4" style={{ padding: 'var(--gap-card)' }}>
                <div className="min-w-0 flex-1 space-y-2.5">
                  <Bar className="h-3 w-28" />
                  <Bar className="h-4 w-full" />
                  <Bar className="h-4 w-2/3" />
                  <div className="flex gap-1.5 pt-1">
                    <Bar className="h-7 w-20 rounded-md" />
                    <Bar className="h-7 w-14 rounded-md" />
                  </div>
                </div>
                <Bar className="aspect-square w-[88px] shrink-0 rounded-md sm:w-[110px]" />
              </div>
              <div className="mt-auto flex items-center justify-between border-t border-white/[0.07] bg-[#17181C] px-4" style={{ minHeight: 58 }}>
                <Bar className="h-5 w-20" />
                <Bar className="h-8 w-32 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

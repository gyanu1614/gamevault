import GameSubNavSkeleton from '@/components/marketplace/GameSubNavSkeleton'
import { PAGE_END, PAGE_TOP, TITLE_GAP } from '@/components/marketplace/page-scale'
import { GLASS, ITEM_SECTION_GAP } from '@/features/item-buy/layout'
import { cn } from '@/lib/utils'
import { Block } from '../_ItemsSkeleton'

/**
 * The pet page while it loads, drawn on the page's own layout (ItemBuyClient,
 * BuyBox) so nothing jumps when it arrives. Desktop: the glass panel and the buy
 * card side by side, the seller under the buy card, then the offers. Phones:
 * the back row, title, picture, the facts 2 × 2, then the buy box on the page.
 */
export default function ItemPageSkeleton() {
  return (
    <>
      <GameSubNavSkeleton tabs={2} phoneBack />
      <main aria-busy className={cn('mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8', PAGE_TOP, PAGE_END)}>
        <div className="relative">
          <Block className="mb-4 h-11 w-11 max-md:hidden min-[1400px]:absolute min-[1400px]:-left-[60px] min-[1400px]:top-0 min-[1400px]:mb-0" />
          <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[220px_minmax(0,1fr)_340px] lg:gap-x-8 lg:gap-y-0 xl:grid-cols-[300px_minmax(0,1fr)_380px] xl:gap-x-10">
            <Block className="h-[30px] w-36 lg:hidden" />
            <div>
              <Block className="h-[200px] w-full rounded-lg sm:h-[240px] lg:h-[400px]" />
              <Block className="mt-3 hidden h-12 w-full rounded-lg lg:block" />
            </div>
            <div>
              <Block className="mb-6 hidden h-[37px] w-44 lg:block" />
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 lg:gap-x-4 xl:gap-x-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Block className="h-3.5 w-3/5" />
                    <Block className="h-4 w-4/5" />
                  </div>
                ))}
              </div>
              <div className="mt-6 hidden space-y-3 pt-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] lg:block">
                <Block className="h-4 w-40" />
                <Block className="h-3.5 w-full" />
                <Block className="h-3.5 w-4/5" />
              </div>
            </div>

            <div className={`${GLASS} lg:p-6`}>
              <div className="lg:hidden">
                <Block className="h-12 w-full" />
                <div aria-hidden className="my-5 h-px bg-white/[0.08]" />
              </div>
              <div className="flex items-center justify-between gap-4">
                <Block className="h-8 w-32" />
                <Block className="h-11 w-[124px]" />
              </div>
              <Block className="mt-6 h-14 w-full rounded-lg lg:mt-5 lg:h-[52px]" />
              <Block className="mt-6 h-5 w-full lg:hidden" />
              <div className="mb-5 mt-5 hidden space-y-3 lg:block">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Block key={i} className="h-10 w-3/4" />
                ))}
              </div>
              <div className="hidden pt-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] lg:block">
                <Block className="h-5 w-full" />
              </div>
              <div aria-hidden className="mt-4 hidden h-px bg-white/[0.08] lg:block" />
              <div className="mt-6 flex items-center gap-3 py-3.5 lg:mt-1 lg:py-2">
                <Block className="h-10 w-10 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Block className="h-3.5 w-28" />
                  <Block className="h-3 w-36" />
                </div>
              </div>
            </div>
            <Block className="h-4 w-full lg:hidden" />
          </div>
        </div>

        <div className={ITEM_SECTION_GAP}>
          <div className="flex items-center justify-between gap-6">
            <Block className="h-7 w-28" />
            <Block className="h-11 w-36" />
          </div>
          <div className={cn('space-y-3', TITLE_GAP)}>
            {Array.from({ length: 2 }).map((_, i) => (
              <Block key={i} className="h-[88px] w-full rounded-lg" />
            ))}
          </div>
        </div>
      </main>
    </>
  )
}

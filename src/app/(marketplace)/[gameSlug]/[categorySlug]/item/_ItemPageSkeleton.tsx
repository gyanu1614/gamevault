import GameSubNavSkeleton from '@/components/marketplace/GameSubNavSkeleton'
import { GLASS, ITEM_SECTION_GAP } from '@/features/item-buy/layout'
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
      <main aria-busy className="mx-auto w-full max-w-7xl px-4 pb-24 pt-7 sm:px-6 md:pt-0 lg:px-8">
        <div className="relative">
          <Block className="mb-4 h-11 w-11 max-md:hidden min-[1400px]:absolute min-[1400px]:-left-[60px] min-[1400px]:top-0 min-[1400px]:mb-0" />
          <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-[auto_1fr] lg:gap-x-6 lg:gap-y-3 xl:grid-cols-[minmax(0,1fr)_400px]">
            <div className={`${GLASS} lg:row-span-2 lg:p-7`}>
              <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)] lg:gap-x-6 xl:grid-cols-[minmax(0,280px)_minmax(0,1fr)] xl:gap-x-8">
                <Block className="h-[30px] w-36 lg:hidden" />
                <div>
                  <Block className="h-[200px] w-full rounded-lg sm:h-[240px] lg:h-[349px]" />
                  <Block className="mt-4 hidden h-12 w-full rounded-lg lg:block" />
                </div>
                <div>
                  <Block className="mb-5 hidden h-[46px] w-44 lg:block" />
                  <div className="grid grid-cols-2 gap-x-6 gap-y-6 lg:gap-x-4 lg:gap-y-5 xl:gap-x-6">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="space-y-2">
                        <Block className="h-3.5 w-3/5" />
                        <Block className="h-4 w-4/5" />
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 hidden space-y-3 pt-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] lg:block">
                    <Block className="h-4 w-40" />
                    <Block className="h-3.5 w-full" />
                    <Block className="h-3.5 w-4/5" />
                  </div>
                </div>
              </div>
            </div>

            <div className={`${GLASS} lg:p-7`}>
              <div className="lg:hidden">
                <Block className="h-12 w-full" />
                <div aria-hidden className="my-5 h-px bg-white/[0.08]" />
              </div>
              <div className="flex items-center justify-between gap-4">
                <Block className="h-8 w-32" />
                <Block className="h-11 w-[124px]" />
              </div>
              <Block className="mt-5 h-14 w-full rounded-lg" />
              <Block className="mt-6 h-5 w-full lg:hidden" />
              <div className="mb-6 mt-7 hidden space-y-4 lg:block">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Block key={i} className="h-10 w-3/4" />
                ))}
              </div>
              <div className="hidden pt-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] lg:block">
                <Block className="h-5 w-full" />
              </div>
            </div>

            <div className={`flex items-center gap-3 py-3.5 lg:col-start-2 lg:self-start lg:px-5 ${GLASS}`}>
              <Block className="h-[38px] w-[38px] shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Block className="h-3.5 w-28" />
                <Block className="h-3 w-36" />
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
          <div className="mt-4 space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Block key={i} className="h-[88px] w-full rounded-lg" />
            ))}
          </div>
        </div>
      </main>
    </>
  )
}

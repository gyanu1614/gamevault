import { VALUE_SURFACE } from '@/components/values/styles'
import { Block } from '../[categorySlug]/_ItemsSkeleton'

/**
 * The Inventory Worth body while it streams — the fallback of its in-page
 * Suspense (not a route loading.tsx: a route-level boundary flushes a 200
 * before a page can 404). Block for block: the tool surface (total +
 * actions, quick-add tiles), the sell row, the method surface.
 */
export function InventorySkeleton() {
  return (
    <div aria-busy aria-label="Loading the MM2 inventory calculator" className="mx-auto w-full max-w-7xl space-y-12 px-4 pb-10 pt-4 sm:px-6 lg:px-8">
      <div className={VALUE_SURFACE}>
        <div className="flex flex-col gap-5 p-5 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Block className="h-4 w-48" />
            <Block className="mt-3 h-12 w-56 sm:h-14" />
            <Block className="mt-3 h-4 w-60" />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:flex">
            <Block className="h-11 w-full rounded-md sm:w-32" />
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Block className="h-11 rounded-md sm:w-48" />
              <Block className="h-11 rounded-md sm:w-40" />
            </div>
          </div>
        </div>
        <div className="space-y-3 border-t border-white/[0.07] px-5 py-8 sm:px-8 sm:py-10">
          <Block className="h-5 w-72 max-w-full" />
          <Block className="h-4 w-80 max-w-full" />
          <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Block key={i} className="h-[76px] rounded-md" />
            ))}
          </div>
        </div>
      </div>

      <div className={`flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-8 ${VALUE_SURFACE}`}>
        <Block className="hidden h-[72px] w-[72px] rounded-md sm:block" />
        <div className="flex-1">
          <Block className="h-6 w-80 max-w-full" />
          <Block className="mt-2.5 h-4 w-72 max-w-full" />
        </div>
        <Block className="h-11 w-full rounded-md sm:w-52" />
      </div>

      <div className={`p-5 sm:p-8 ${VALUE_SURFACE}`}>
        <Block className="h-7 w-96 max-w-full" />
        <Block className="mt-4 h-4 w-full" />
        <Block className="mt-2 h-4 w-2/3" />
        <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-4 border-t border-white/[0.07] pt-6 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <Block className="h-9 w-9 shrink-0 rounded-md" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Block className="h-4 w-28" />
                <Block className="h-3.5 w-40 max-w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

import { Block } from '../../[categorySlug]/_ItemsSkeleton'
import { VALUE_SURFACE } from '@/components/values/styles'

/**
 * Value-list skeleton — the fallback of ValueListPage's in-page Suspense (not
 * a route loading.tsx: that flushes a 200 before a page can 404).
 *
 * Mirrors ValueListClient 1:1 inside the same section wrapper, so nothing
 * shifts when the list lands: toolbar (48px search + 224px sort) → filter
 * tiles → "Showing" line → two rows of ValueCards → pagination.
 */
export function ValueListSkeleton() {
  return (
    <div aria-busy aria-label="Loading values">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Block className="h-12 flex-1" />
        <Block className="h-12 w-full shrink-0 sm:w-56" />
      </div>
      <div className="mt-2 flex gap-1.5 overflow-hidden">
        {Array.from({ length: 7 }, (_, i) => (
          <Block key={i} className="h-[42px] min-w-[96px] flex-1" />
        ))}
      </div>
      <div className="mt-3 flex h-5 items-center">
        <Block className="h-3.5 w-40" />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }, (_, i) => (
          <ValueCardSkeleton key={i} />
        ))}
      </div>
      <div className="mt-8 flex justify-center gap-1.5">
        {Array.from({ length: 5 }, (_, i) => (
          <Block key={i} className="h-9 w-12" />
        ))}
      </div>
    </div>
  )
}

/** One ValueCard's footprint: header → 86px art → name + sub → stat band. */
export function ValueCardSkeleton() {
  return (
    <div className={`flex flex-col overflow-hidden ${VALUE_SURFACE}`}>
      <div className="flex min-h-[18px] items-center justify-between gap-2 px-3 pt-2.5">
        <Block className="h-3 w-12" />
        <Block className="h-3 w-12" />
      </div>
      <div className="flex h-[86px] items-center justify-center px-3 pt-1">
        <Block className="h-[64px] w-[64px] rounded-lg" />
      </div>
      <div className="flex flex-col items-center gap-1.5 px-3 pb-2 pt-1">
        <Block className="h-3.5 w-24" />
        <Block className="h-3 w-16" />
      </div>
      <div className="mt-auto flex border-t border-white/[0.07] bg-[#17181C]">
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1.5 px-1.5 py-2.5">
            <Block className="h-2.5 w-12" />
            <Block className="h-4 w-14" />
          </div>
        ))}
      </div>
    </div>
  )
}

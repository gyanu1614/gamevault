import { VALUE_SURFACE } from '@/components/values/styles'
import { Block } from '../[categorySlug]/_ItemsSkeleton'
import { ValueCardSkeleton } from '../values/_generic/ValueListSkeleton'

/**
 * The free-items body while it streams — the fallback of its in-page
 * Suspense (not a route loading.tsx: a route-level boundary flushes a 200
 * before a page can 404). Block for block: the ways surface (head · rows ·
 * callout), then the Godly grid.
 */

function WayRowSkeleton({ first }: { first: boolean }) {
  return (
    <div className={`grid grid-cols-[36px_1fr] gap-x-3.5 gap-y-3 py-4 sm:grid-cols-[36px_1fr_auto] sm:items-center sm:gap-x-5 ${first ? '' : 'border-t border-white/[0.07]'}`}>
      <Block className="h-9 w-9 rounded-md" />
      <div className="flex flex-col gap-2">
        <Block className="h-4 w-64 max-w-full" />
        <Block className="h-3.5 w-full" />
      </div>
      <div className="col-start-2 flex flex-col gap-1.5 sm:col-start-auto sm:w-[176px] sm:items-end">
        <Block className="h-5 w-24" />
        <Block className="h-3 w-36" />
      </div>
    </div>
  )
}

export function FreeItemsSkeleton() {
  return (
    <div aria-busy aria-label="Loading the free items guide" className="mx-auto w-full max-w-7xl space-y-12 px-4 pb-10 pt-4 sm:px-6 lg:px-8">
      <div className={`p-5 sm:p-8 ${VALUE_SURFACE}`}>
        <div className="flex items-center gap-3">
          <Block className="h-8 w-8 rounded-md" />
          <Block className="h-6 w-72 max-w-full" />
        </div>
        <div className="mt-6">
          {Array.from({ length: 7 }, (_, i) => (
            <WayRowSkeleton key={i} first={i === 0} />
          ))}
        </div>
        <Block className="mt-5 h-11 w-full rounded-md" />
      </div>
      <div>
        <Block className="h-7 w-96 max-w-full" />
        <Block className="mt-3 h-4 w-2/3" />
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }, (_, i) => (
            <ValueCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}

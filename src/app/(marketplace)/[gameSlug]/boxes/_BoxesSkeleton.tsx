import { VALUE_SURFACE } from '@/components/values/styles'
import { Block } from '../[categorySlug]/_ItemsSkeleton'
import { ValueCardSkeleton } from '../values/_generic/ValueListSkeleton'

/**
 * Skeletons for the Box Odds pages — fallbacks of their in-page Suspense
 * (not a route loading.tsx: a route-level boundary flushes a 200 before a
 * page can 404). Each mirrors its page block for block.
 */

function SectionHead({ w }: { w: string }) {
  return (
    <div className="flex items-center gap-3">
      <Block className="h-8 w-8 rounded-md" />
      <Block className={`h-6 ${w} max-w-full`} />
    </div>
  )
}

function ShopRowSkeleton({ first }: { first: boolean }) {
  return (
    <div className={`grid grid-cols-1 items-center gap-3 py-3.5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_112px_20px] lg:gap-x-5 ${first ? '' : 'border-t border-white/[0.07]'}`}>
      <div className="flex items-center gap-3.5">
        <Block className="h-[52px] w-[52px] rounded-md" />
        <div className="flex flex-col gap-1.5">
          <Block className="h-5 w-32" />
          <Block className="h-3.5 w-48" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 lg:contents">
        <Block className="h-9 w-24" />
        <Block className="h-9 w-24" />
        <Block className="h-5 w-16 lg:justify-self-end" />
      </div>
    </div>
  )
}

export function BoxesHubSkeleton() {
  return (
    <div aria-busy aria-label="Loading box odds" className="mx-auto w-full max-w-7xl space-y-12 px-4 pb-10 pt-4 sm:px-6 lg:px-8">
      <div className={`p-5 sm:p-8 ${VALUE_SURFACE}`}>
        <SectionHead w="w-72" />
        <Block className="mt-4 h-4 w-full" />
        <div className="mt-6">
          {Array.from({ length: 6 }, (_, i) => (
            <ShopRowSkeleton key={i} first={i === 0} />
          ))}
        </div>
        <Block className="mt-5 h-11 w-full rounded-md" />
      </div>
      <div className={`p-5 sm:p-8 ${VALUE_SURFACE}`}>
        <SectionHead w="w-64" />
        <Block className="mt-4 h-4 w-full" />
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Block className="h-9 w-9 shrink-0 rounded-md" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Block className="h-4 w-24" />
                <Block className="h-3.5 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function BoxPageSkeleton() {
  return (
    <div aria-busy aria-label="Loading box" className="mx-auto w-full max-w-7xl space-y-12 px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <div className={`p-5 sm:p-8 ${VALUE_SURFACE}`}>
        <div className="flex flex-col gap-2">
          <Block className="h-4 w-full" />
          <Block className="h-4 w-11/12" />
          <Block className="h-4 w-2/3" />
        </div>
        <div className="mt-7 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-white/[0.07] pt-6 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Block className="h-9 w-9 rounded-md" />
              <div className="flex flex-col gap-1.5">
                <Block className="h-3 w-14" />
                <Block className="h-4 w-24" />
              </div>
            </div>
          ))}
        </div>
        <Block className="mt-6 h-11 w-full rounded-md" />
      </div>
      <div className={`p-5 sm:p-8 ${VALUE_SURFACE}`}>
        <Block className="h-7 w-80 max-w-full" />
        <div className="mt-6 flex flex-col gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Block key={i} className="h-5 w-full" />
          ))}
        </div>
      </div>
      <div>
        <Block className="h-7 w-96 max-w-full" />
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6">
          {Array.from({ length: 12 }, (_, i) => (
            <ValueCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}

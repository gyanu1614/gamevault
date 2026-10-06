import { VALUE_SURFACE } from '@/components/values/styles'
import { Block } from '../[categorySlug]/_ItemsSkeleton'
import { ValueCardSkeleton } from '../values/_generic/ValueListSkeleton'

/**
 * Skeletons for the events pages — fallbacks of their in-page Suspense (not a
 * route loading.tsx: a route-level boundary flushes a 200 before a page can
 * 404, c8cb309a). Each mirrors its page block for block so nothing shifts
 * when the data lands.
 */

/** One event row's footprint: tile · name + dates · thumbs · two stats. */
function RowSkeleton({ first }: { first: boolean }) {
  return (
    <div
      className={`flex flex-col gap-3 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:gap-6 ${first ? '' : 'border-t border-white/[0.07]'}`}
    >
      <div className="flex flex-1 items-center gap-3.5">
        <Block className="h-[42px] w-[42px] rounded-md" />
        <div className="flex flex-1 flex-col gap-1.5">
          <Block className="h-4 w-36" />
          <Block className="h-3 w-44" />
        </div>
      </div>
      <div className="flex gap-1.5 lg:w-[196px] lg:justify-end">
        {Array.from({ length: 5 }, (_, i) => (
          <Block key={i} className="h-9 w-9 rounded-md" />
        ))}
      </div>
      <Block className="hidden h-9 w-16 lg:block" />
      <Block className="hidden h-9 w-24 lg:block" />
    </div>
  )
}

/** The hero lead's two lines — inline (it sits inside the lead's <p>). */
export function HubLeadSkeleton() {
  return (
    <span aria-hidden className="flex flex-col items-center gap-2.5 pt-1">
      <span className="block h-4 w-[min(600px,80vw)] animate-pulse rounded-md bg-bg-inset" />
      <span className="block h-4 w-[min(440px,64vw)] animate-pulse rounded-md bg-bg-inset" />
    </span>
  )
}

export function EventsHubSkeleton() {
  return (
    <div aria-busy aria-label="Loading events">
      <div className="mx-auto w-full max-w-7xl space-y-12 px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <div className={`flex flex-col gap-5 p-5 sm:p-7 lg:flex-row lg:items-center ${VALUE_SURFACE}`}>
          <div className="flex flex-1 items-center gap-4">
            <Block className="h-14 w-14 rounded-md" />
            <div className="flex flex-col gap-2">
              <Block className="h-6 w-60" />
              <Block className="h-4 w-72" />
            </div>
          </div>
          <Block className="h-11 w-56" />
        </div>
        <div>
          <Block className="h-7 w-72" />
          <div className="mt-6 flex gap-1.5 overflow-hidden">
            {Array.from({ length: 6 }, (_, i) => (
              <Block key={i} className="h-[42px] min-w-[96px] flex-1" />
            ))}
          </div>
          {[4, 3].map((n, g) => (
            <div key={g} className="mt-10">
              <Block className="h-6 w-16" />
              <div className={`mt-4 overflow-hidden ${VALUE_SURFACE}`}>
                {Array.from({ length: n }, (_, i) => (
                  <RowSkeleton key={i} first={i === 0} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Event page body: overview surface (answer · facts · callout) → items grid → how-to section. */
export function EventPageSkeleton() {
  return (
    <div aria-busy aria-label="Loading event" className="mx-auto w-full max-w-7xl space-y-12 px-4 pb-10 pt-6 sm:px-6 lg:px-8">
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
        <Block className="mt-5 h-11 w-full rounded-md" />
      </div>
      <div>
        <Block className="h-7 w-80" />
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }, (_, i) => (
            <ValueCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}

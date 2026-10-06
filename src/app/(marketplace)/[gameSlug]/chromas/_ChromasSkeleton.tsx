import { VALUE_SURFACE } from '@/components/values/styles'
import { Block } from '../[categorySlug]/_ItemsSkeleton'
import { ValueCardSkeleton } from '../values/_generic/ValueListSkeleton'

/**
 * The Chroma hub body while it streams — the fallback of its in-page
 * Suspense (not a route loading.tsx: a route-level boundary flushes a 200
 * before a page can 404). Block for block: the grid (heading · filters ·
 * cards), the unbox-vs-buy surface, the Chroma-vs-normal surface.
 */

function StepsSkeleton({ n }: { n: number }) {
  return (
    <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="flex items-start gap-3">
          <Block className="h-9 w-9 shrink-0 rounded-md" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Block className="h-4 w-28" />
            <Block className="h-3.5 w-40 max-w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

function PairRowSkeleton({ first }: { first: boolean }) {
  return (
    <div className={`flex items-center gap-3 py-3 ${first ? '' : 'border-t border-white/[0.07]'}`}>
      <Block className="h-11 w-11 shrink-0 rounded-md" />
      <div className="flex flex-1 flex-col gap-1.5">
        <Block className="h-4 w-40 max-w-full" />
        <Block className="h-3 w-28" />
      </div>
      <Block className="h-5 w-14" />
    </div>
  )
}

export function ChromasSkeleton() {
  return (
    <div aria-busy aria-label="Loading MM2 Chromas" className="mx-auto w-full max-w-7xl space-y-12 px-4 pb-10 pt-4 sm:px-6 lg:px-8">
      <div>
        <Block className="h-7 w-96 max-w-full" />
        <Block className="mt-3 h-4 w-2/3" />
        <div className="mt-6 flex flex-col gap-2 lg:flex-row">
          <Block className="h-11 flex-1 rounded-md" />
          <Block className="h-12 w-full rounded-md lg:w-56" />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }, (_, i) => (
            <ValueCardSkeleton key={i} />
          ))}
        </div>
      </div>

      <div className={`p-5 sm:p-8 ${VALUE_SURFACE}`}>
        <Block className="h-7 w-80 max-w-full" />
        <Block className="mt-4 h-4 w-full" />
        <div className="mt-7 border-t border-white/[0.07] pt-6">
          <div className="flex items-center gap-3">
            <Block className="h-8 w-8 rounded-md" />
            <Block className="h-6 w-72 max-w-full" />
          </div>
          <StepsSkeleton n={4} />
          <Block className="mt-5 h-11 w-full rounded-md" />
        </div>
        <div className="mt-7 border-t border-white/[0.07] pt-6">
          <div className="flex items-center gap-3">
            <Block className="h-8 w-8 rounded-md" />
            <Block className="h-6 w-64 max-w-full" />
          </div>
          <StepsSkeleton n={3} />
          <Block className="mt-5 h-11 w-full rounded-md" />
        </div>
      </div>

      <div className={`p-5 sm:p-8 ${VALUE_SURFACE}`}>
        <Block className="h-7 w-96 max-w-full" />
        <Block className="mt-4 h-4 w-full" />
        <div className="mt-6 grid grid-cols-1 gap-x-10 lg:grid-cols-2">
          {[0, 1].map((col) => (
            <div key={col}>
              <Block className="mb-2 h-5 w-48" />
              {Array.from({ length: 5 }, (_, i) => (
                <PairRowSkeleton key={i} first={i === 0} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

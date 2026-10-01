import { Sk } from '@/components/account/AccountSkeletons'

/** Order page skeleton: back link + title + badges, main column, side column. */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy aria-label="Loading">
      <div>
        <Sk className="h-4 w-16" />
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <Sk className="h-8 w-48 rounded-md" />
            <Sk className="mt-2 h-3.5 w-72 max-w-full" />
          </div>
          <div className="flex gap-1.5">
            <Sk className="h-7 w-20 rounded-full" />
            <Sk className="h-7 w-28 rounded-full" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="flex items-center gap-4 rounded-lg bg-bg-raised p-5">
            <Sk className="h-14 w-14 rounded-md" />
            <div className="flex-1">
              <Sk className="h-4 w-64 max-w-full" />
              <Sk className="mt-2 h-3.5 w-40" />
            </div>
          </div>
          <div className="space-y-4 rounded-lg bg-bg-raised p-5 sm:p-6">
            <Sk className="h-4 w-16" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <Sk className="h-3.5 w-28" />
                <Sk className="h-3.5 w-16" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-5">
          <div className="space-y-5 rounded-lg bg-bg-raised p-5">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Sk className="h-10 w-10 rounded-full" />
                <div className="flex-1">
                  <Sk className="h-3.5 w-28" />
                  <Sk className="mt-2 h-3 w-40" />
                </div>
              </div>
            ))}
          </div>
          <Sk className="h-40 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}

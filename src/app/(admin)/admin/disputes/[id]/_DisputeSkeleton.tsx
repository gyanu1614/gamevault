import { Sk } from '@/components/account/AccountSkeletons'

/** Dispute page skeleton: back link, header card with tiles, conversation, parties + actions. */
export function DisputeSkeleton() {
  return (
    <div className="space-y-5" aria-busy aria-label="Loading">
      <Sk className="h-4 w-20" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="rounded-lg bg-bg-raised">
            <div className="flex gap-4 p-4 sm:p-6">
              <Sk className="h-16 w-16 shrink-0 rounded-md sm:h-20 sm:w-20" />
              <div className="flex-1">
                <Sk className="h-5 w-64 max-w-full" />
                <Sk className="mt-2 h-3.5 w-36" />
                <Sk className="mt-3 h-5 w-28 rounded-full" />
              </div>
            </div>
            <div className="space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
              <Sk className="h-3.5 w-32" />
              <Sk className="h-4 w-72 max-w-full" />
              <Sk className="h-3.5 w-full" />
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Sk className="h-[68px] rounded-md" />
                <Sk className="h-[68px] rounded-md" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-bg-raised p-4 sm:px-5">
            <Sk className="h-9 w-9 rounded-md" />
            <div className="flex-1">
              <Sk className="h-4 w-40" />
              <Sk className="mt-1.5 h-3 w-56 max-w-full" />
            </div>
          </div>
        </div>
        <div className="space-y-5">
          <div className="space-y-5 rounded-lg bg-bg-raised p-5">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i}>
                <Sk className="h-3 w-12" />
                <div className="mt-3 flex items-center gap-3">
                  <Sk className="h-10 w-10 rounded-full" />
                  <div className="flex-1">
                    <Sk className="h-3.5 w-28" />
                    <Sk className="mt-2 h-3 w-40" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-2 rounded-lg bg-bg-raised p-6">
            <Sk className="mb-3 h-4 w-20" />
            <Sk className="h-10 w-full rounded-md" />
            <Sk className="h-10 w-full rounded-md" />
          </div>
        </div>
      </div>
    </div>
  )
}

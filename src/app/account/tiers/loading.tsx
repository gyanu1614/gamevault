export default function TiersLoading() {
  return (
    <div>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        {/* Header row: title + stats */}
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="space-y-2">
            <div className="skeleton h-3.5 w-24 rounded" />
            <div className="flex items-center gap-3">
              <div className="skeleton h-7 w-40 rounded-lg" />
              <div className="skeleton h-6 w-20 rounded-full" />
            </div>
            <div className="skeleton h-3.5 w-72 rounded" />
          </div>
          <div className="flex divide-x divide-border-subtle rounded-lg border border-border-subtle bg-[#0e0e0e]">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-1.5 px-4 py-2.5 first:pl-5 last:pr-5">
                <div className="skeleton h-2.5 w-16 rounded" />
                <div className="skeleton h-4 w-12 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Rank rail (3 slides visible) */}
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex w-[86%] shrink-0 flex-col rounded-lg border border-border-subtle bg-[#0e0e0e] sm:w-[380px] lg:w-[420px]"
            >
              <div className="flex h-[52px] items-center gap-2.5 px-4">
                <div className="skeleton h-[26px] w-[26px] rounded-md" />
                <div className="skeleton h-3.5 w-16 rounded" />
              </div>
              <div className="flex h-11 items-center justify-between px-4">
                <div className="skeleton h-6 w-14 rounded" />
                <div className="skeleton h-5 w-20 rounded-md" />
              </div>
              <div className="mx-4 mt-2 min-h-[118px] border-t border-border-subtle pt-3">
                <div className="skeleton mb-2.5 h-2 w-32 rounded" />
                <div className="space-y-2.5">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div key={j} className="flex justify-between">
                      <div className="skeleton h-2.5 w-16 rounded" />
                      <div className="skeleton h-2.5 w-10 rounded" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="mx-4 flex h-10 items-center border-t border-border-subtle">
                <div className="skeleton h-3 w-28 rounded" />
              </div>
            </div>
          ))}
        </div>

        {/* Progress strip (floating) */}
        <div className="pt-1">
          <div className="mb-3 flex justify-between">
            <div className="skeleton h-3.5 w-32 rounded" />
            <div className="skeleton h-3 w-20 rounded" />
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between">
                  <div className="skeleton h-2.5 w-20 rounded" />
                  <div className="skeleton h-2.5 w-14 rounded" />
                </div>
                <div className="skeleton h-1 w-full rounded-sm" />
              </div>
            ))}
          </div>
        </div>

        {/* Footnote */}
        <div className="skeleton h-3 w-3/4 rounded" />
      </div>
    </div>
  )
}

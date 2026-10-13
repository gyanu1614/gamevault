import { Sk } from '@/components/account/AccountSkeletons'

/** Item fields builder skeleton: back link, title, path, Finder columns. */
export default function Loading() {
  return (
    <div className="space-y-4" aria-busy aria-label="Loading">
      <div>
        <Sk className="h-4 w-36" />
        <Sk className="mt-3 h-8 w-72 max-w-full rounded-md" />
        <Sk className="mt-2 h-3.5 w-[380px] max-w-full" />
      </div>
      <Sk className="h-4 w-56" />
      <div className="flex gap-3">
        {[0, 1, 2].map((c) => (
          <div key={c} className={`w-full space-y-2 rounded-lg bg-[#1D1E23] p-3 lg:w-[320px] ${c > 0 ? 'hidden lg:block' : ''}`}>
            <Sk className="h-9 w-32 rounded-md" />
            <Sk className="h-10 rounded-md" />
            {Array.from({ length: 6 }).map((_, i) => (
              <Sk key={i} className="h-11 rounded-md" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

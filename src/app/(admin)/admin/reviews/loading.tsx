import { Sk } from '@/components/account/AccountSkeletons'
import { SkAdminHeader, SkAdminStrip } from '../components/AdminSkeletons'

/** Reviews skeleton: header, four numbers, search + filter chips, review cards. */
export default function Loading() {
  return (
    <div aria-busy aria-label="Loading">
      <SkAdminHeader titleWidth="w-36" />
      <div className="space-y-5">
        <SkAdminStrip count={4} />
        <div className="space-y-3">
          <Sk className="h-10 w-full rounded-md" />
          <div className="flex gap-1.5 overflow-hidden">
            {Array.from({ length: 9 }).map((_, i) => (
              <Sk key={i} className="h-8 w-16 shrink-0 rounded-full" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg bg-bg-raised p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <Sk className="h-3.5 w-24" />
                <Sk className="h-5 w-16 rounded-full" />
                <Sk className="ml-auto h-3 w-20" />
              </div>
              <Sk className="mt-4 h-4 w-40" />
              <Sk className="mt-2 h-3.5 w-full" />
              <Sk className="mt-1.5 h-3.5 w-3/4" />
              <Sk className="mt-3 h-3 w-64 max-w-full" />
              <div className="mt-4 flex gap-1.5 border-t border-white/[0.06] pt-3.5">
                <Sk className="h-8 w-16 rounded-md" />
                <Sk className="h-8 w-16 rounded-md" />
                <Sk className="h-8 w-24 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

import { Sk } from '@/components/account/AccountSkeletons'
import { SkAdminHeader, SkAdminStrip } from '../components/AdminSkeletons'

/** Founding sellers skeleton: header + actions, four numbers, tabs, card grid. */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy aria-label="Loading">
      <SkAdminHeader actions />
      <SkAdminStrip count={4} />
      <Sk className="h-[40px] w-[440px] max-w-full rounded-lg" />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-4 rounded-lg bg-bg-raised p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <Sk className="h-10 w-10 rounded-full" />
              <div className="flex-1">
                <Sk className="h-4 w-32" />
                <Sk className="mt-2 h-3 w-20" />
              </div>
            </div>
            <Sk className="h-4 w-48" />
            <div className="flex gap-1.5">
              <Sk className="h-7 w-28 rounded-full" />
              <Sk className="h-7 w-24 rounded-full" />
            </div>
            <Sk className="h-12 w-full rounded-md" />
            <div className="flex gap-2">
              <Sk className="h-9 flex-1 rounded-md" />
              <Sk className="h-9 w-20 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

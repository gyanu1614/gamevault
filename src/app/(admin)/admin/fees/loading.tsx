import { Sk } from '@/components/account/AccountSkeletons'
import { SkAdminHeader } from '../components/AdminSkeletons'

/** Fees skeleton: header, three tabs, the Timing and Gates card. */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy aria-label="Loading">
      <SkAdminHeader titleWidth="w-52" />
      <Sk className="h-[40px] w-[380px] max-w-full rounded-lg" />
      <div className="divide-y divide-white/[0.06] rounded-lg bg-bg-raised p-4 sm:p-6">
        <Sk className="mb-4 h-4 w-36" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <Sk className="h-4 w-40" />
              <Sk className="mt-2 h-3 w-80 max-w-full" />
            </div>
            <div className="flex gap-2">
              <Sk className="h-9 w-24 rounded-md" />
              <Sk className="h-8 w-14 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

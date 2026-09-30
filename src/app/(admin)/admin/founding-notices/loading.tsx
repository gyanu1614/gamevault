import { Sk } from '@/components/account/AccountSkeletons'
import { SkAdminHeader, SkAdminRows, SkAdminStrip } from '../components/AdminSkeletons'

/** Founding notices skeleton: header, three numbers, composer + preview/list. */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy aria-label="Loading">
      <SkAdminHeader actions />
      <SkAdminStrip count={3} lgCols="lg:grid-cols-3" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_0.9fr]">
        <div className="space-y-4 rounded-lg bg-bg-raised p-4 sm:p-6">
          <Sk className="h-4 w-28" />
          <Sk className="h-10 w-full rounded-md" />
          <Sk className="h-24 w-full rounded-md" />
          <div className="flex gap-6">
            <Sk className="h-6 w-28 rounded-full" />
            <Sk className="h-6 w-28 rounded-full" />
          </div>
          <Sk className="h-10 w-32 rounded-md" />
        </div>
        <div className="space-y-3">
          <Sk className="h-4 w-36" />
          <Sk className="h-28 w-full rounded-lg" />
          <Sk className="mt-3 h-4 w-24" />
          <SkAdminRows count={3} />
        </div>
      </div>
    </div>
  )
}

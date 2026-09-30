import { Sk } from '@/components/account/AccountSkeletons'
import { SkAdminHeader, SkAdminRows, SkAdminStrip } from '../components/AdminSkeletons'

/** Active sellers skeleton: header + export, four numbers, toolbar, rows. */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy aria-label="Loading">
      <SkAdminHeader actions />
      <SkAdminStrip count={4} />
      <div className="flex flex-col gap-2 lg:flex-row">
        <Sk className="h-10 w-full rounded-md lg:w-[300px]" />
        <div className="flex gap-2 overflow-hidden">
          <Sk className="h-10 w-28 shrink-0 rounded-md" />
          <Sk className="h-10 w-32 shrink-0 rounded-md" />
          <Sk className="h-8 w-28 shrink-0 self-center rounded-full" />
        </div>
      </div>
      <SkAdminRows count={8} />
    </div>
  )
}

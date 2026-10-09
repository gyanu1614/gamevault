import { Sk } from '@/components/account/AccountSkeletons'
import { SkAdminHeader, SkAdminRows, SkAdminStrip } from '../components/AdminSkeletons'

/** Sellers skeleton: header, the funnel strip, toolbar, rows. */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy aria-label="Loading">
      <SkAdminHeader />
      <SkAdminStrip count={7} />
      <div className="flex flex-col gap-2 lg:flex-row">
        <Sk className="h-10 w-full rounded-md lg:w-[300px]" />
        <div className="flex gap-2 overflow-hidden">
          <Sk className="h-8 w-24 shrink-0 self-center rounded-full" />
          <Sk className="h-8 w-28 shrink-0 self-center rounded-full" />
          <Sk className="h-8 w-20 shrink-0 self-center rounded-full" />
        </div>
      </div>
      <SkAdminRows count={8} />
    </div>
  )
}

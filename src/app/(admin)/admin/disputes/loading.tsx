import { Sk } from '@/components/account/AccountSkeletons'
import { SkAdminHeader, SkAdminRows, SkAdminStrip } from '../components/AdminSkeletons'

/** Disputes skeleton: header, four numbers, search, status + priority chips, rows. */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy aria-label="Loading">
      <SkAdminHeader />
      <SkAdminStrip count={4} />
      <div className="flex gap-2">
        <Sk className="h-10 flex-1 rounded-md" />
        <Sk className="h-10 w-20 rounded-md" />
      </div>
      <div className="flex gap-1.5 overflow-hidden">
        {Array.from({ length: 9 }).map((_, i) => (
          <Sk key={i} className="h-8 w-20 shrink-0 rounded-full" />
        ))}
      </div>
      <SkAdminRows count={6} />
    </div>
  )
}

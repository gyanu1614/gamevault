import { Sk } from '@/components/account/AccountSkeletons'
import { SkAdminHeader, SkAdminRows, SkAdminStrip } from '../components/AdminSkeletons'

/** Orders skeleton: header, six numbers, tabs, search + chips, rows. */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy aria-label="Loading">
      <SkAdminHeader />
      <SkAdminStrip count={6} lgCols="md:grid-cols-3 xl:grid-cols-6" />
      <Sk className="h-[40px] w-[380px] max-w-full rounded-lg" />
      <div className="flex gap-2">
        <Sk className="h-10 flex-1 rounded-md" />
        <Sk className="h-10 w-20 rounded-md" />
      </div>
      <div className="flex gap-1.5 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <Sk key={i} className="h-8 w-20 shrink-0 rounded-full" />
        ))}
      </div>
      <SkAdminRows count={8} />
    </div>
  )
}

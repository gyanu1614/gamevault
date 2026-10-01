import { Sk } from '@/components/account/AccountSkeletons'
import { SkAdminHeader, SkAdminRows, SkAdminStrip } from '../components/AdminSkeletons'

/** Fraud skeleton: header + Run Scan, five numbers, status tabs, flags, rules panel. */
export default function Loading() {
  return (
    <div aria-busy aria-label="Loading">
      <SkAdminHeader actions titleWidth="w-60" />
      <div className="space-y-5">
        <SkAdminStrip
          count={5}
          lgCols="md:grid-cols-5 lg:grid-cols-5"
          className="[&>div:first-child]:col-span-2 md:[&>div:first-child]:col-span-1"
        />
        <Sk className="h-[40px] w-[300px] max-w-full rounded-lg" />
        <SkAdminRows count={4} />
        <div className="rounded-lg bg-bg-raised p-4 sm:p-5">
          <Sk className="h-4 w-28" />
          <Sk className="mt-2 h-3 w-72 max-w-full" />
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Sk key={i} className="h-[62px] rounded-md" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

import { Sk } from '@/components/account/AccountSkeletons'
import { SkAdminHeader, SkAdminStrip } from '../components/AdminSkeletons'

/** Analytics skeleton: header, six numbers, two charts, three breakdown panels, two tiles panels. */
export default function Loading() {
  const panel = 'rounded-lg bg-bg-raised p-4 sm:p-5'
  return (
    <div aria-busy aria-label="Loading">
      <SkAdminHeader titleWidth="w-40" />
      <div className="space-y-5">
        <SkAdminStrip count={6} lgCols="md:grid-cols-3 lg:grid-cols-3" />
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className={panel}>
              <div className="flex justify-between">
                <Sk className="h-4 w-44" />
                <Sk className="h-6 w-20" />
              </div>
              <Sk className="mt-2 h-3 w-24" />
              <Sk className="mt-4 h-32 w-full rounded-md" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={panel}>
              <Sk className="h-4 w-36" />
              <Sk className="mt-2 h-3 w-24" />
              {Array.from({ length: 4 }).map((_, r) => (
                <div key={r} className="mt-4 flex justify-between">
                  <Sk className="h-3.5 w-28" />
                  <Sk className="h-3.5 w-8" />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className={panel}>
              <Sk className="h-4 w-44" />
              <Sk className="mt-2 h-3 w-64 max-w-full" />
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Sk className="h-[68px] rounded-md" />
                <Sk className="h-[68px] rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

import { Sk } from '@/components/account/AccountSkeletons'
import { SkAdminHeader, SkAdminStrip } from '../components/AdminSkeletons'

/** SEO Health skeleton: header, numbers strip, gate panel, sections table, two side-by-side lists. */
export default function Loading() {
  const panel = 'rounded-lg bg-bg-raised p-4 sm:p-5'
  return (
    <div aria-busy aria-label="Loading">
      <SkAdminHeader titleWidth="w-44" />
      <div className="space-y-5">
        <SkAdminStrip count={4} />
        <div className={panel}>
          <Sk className="h-4 w-40" />
          <Sk className="mt-2 h-3 w-72" />
          {Array.from({ length: 4 }).map((_, r) => (
            <Sk key={r} className="mt-4 h-9 w-full rounded-md" />
          ))}
        </div>
        <div className={panel}>
          <Sk className="h-4 w-48" />
          {Array.from({ length: 6 }).map((_, r) => (
            <Sk key={r} className="mt-3 h-8 w-full rounded-md" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className={panel}>
              <Sk className="h-4 w-36" />
              {Array.from({ length: 4 }).map((_, r) => (
                <Sk key={r} className="mt-3 h-4 w-full" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

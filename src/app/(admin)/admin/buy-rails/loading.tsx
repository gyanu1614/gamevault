import { Sk } from '@/components/account/AccountSkeletons'
import { SkAdminHeader } from '../components/AdminSkeletons'

/** Buy Rails skeleton: header, one panel with four switch rows. */
export default function Loading() {
  return (
    <div aria-busy aria-label="Loading">
      <SkAdminHeader titleWidth="w-32" />
      <div className="rounded-lg bg-bg-raised p-4 sm:p-5">
        <Sk className="h-4 w-24" />
        <Sk className="mt-2 h-3 w-32" />
        {Array.from({ length: 4 }).map((_, r) => (
          <div key={r} className="flex items-center justify-between gap-4 py-3.5">
            <div className="flex-1">
              <Sk className="h-4 w-36" />
              <Sk className="mt-1.5 h-3 w-72" />
            </div>
            <Sk className="h-6 w-11 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

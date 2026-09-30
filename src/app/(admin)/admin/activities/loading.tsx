import { Sk } from '@/components/account/AccountSkeletons'
import { SkAdminRows } from '../components/AdminSkeletons'

/** Activities skeleton: back link, header, type tabs + status chips, feed rows. */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy aria-label="Loading">
      <div>
        <Sk className="h-4 w-24" />
        <Sk className="mt-3 h-8 w-52 rounded-md" />
        <Sk className="mt-2 h-4 w-96 max-w-full" />
      </div>
      <div className="flex flex-col gap-3 lg:flex-row lg:justify-between">
        <Sk className="h-[40px] w-[420px] max-w-full rounded-lg" />
        <div className="flex gap-1.5">
          <Sk className="h-8 w-12 rounded-full" />
          <Sk className="h-8 w-16 rounded-full" />
          <Sk className="h-8 w-20 rounded-full" />
        </div>
      </div>
      <SkAdminRows count={7} />
    </div>
  )
}

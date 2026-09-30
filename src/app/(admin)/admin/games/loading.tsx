import { Sk } from '@/components/account/AccountSkeletons'
import { SkAdminHeader } from '../components/AdminSkeletons'

/** Games skeleton: header + Add Game, review tabs + filter, game rows. */
export default function Loading() {
  return (
    <div aria-busy aria-label="Loading">
      <SkAdminHeader actions titleWidth="w-32" />
      <div className="space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:justify-between">
          <Sk className="h-[40px] w-[360px] max-w-full rounded-lg" />
          <Sk className="h-10 w-full rounded-md lg:w-[320px]" />
        </div>
        <div className="divide-y divide-white/[0.06] overflow-hidden rounded-lg bg-bg-raised">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="px-4 py-3.5 xl:flex xl:items-center xl:gap-4">
              <div className="flex items-center gap-3 xl:w-[26%]">
                <Sk className="h-10 w-10 shrink-0 rounded-md" />
                <div className="flex-1">
                  <Sk className="h-3.5 w-36" />
                  <Sk className="mt-2 h-3 w-28" />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-4 xl:mt-0 xl:flex-1">
                <div className="flex gap-1.5">
                  <Sk className="h-5 w-20 rounded-full" />
                  <Sk className="h-5 w-16 rounded-full" />
                </div>
                <Sk className="h-8 w-44 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

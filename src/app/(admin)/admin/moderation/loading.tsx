import { Sk } from '@/components/account/AccountSkeletons'
import { SkAdminHeader, SkAdminStrip } from '../components/AdminSkeletons'

/** Moderation skeleton: header, five numbers, tabs + search, two seller groups. */
export default function Loading() {
  return (
    <div aria-busy aria-label="Loading">
      <SkAdminHeader titleWidth="w-44" />
      <div className="space-y-5">
        <SkAdminStrip
          count={5}
          lgCols="md:grid-cols-5 lg:grid-cols-5"
          className="[&>div:first-child]:col-span-2 md:[&>div:first-child]:col-span-1"
        />
        <div className="flex flex-col gap-3 lg:flex-row lg:justify-between">
          <Sk className="h-[40px] w-[330px] max-w-full rounded-lg" />
          <Sk className="h-10 w-full rounded-md lg:w-[320px]" />
        </div>
        {Array.from({ length: 2 }).map((_, g) => (
          <div key={g} className="rounded-lg bg-bg-raised">
            <div className="flex items-center gap-3 px-4 pb-3 pt-3.5">
              <Sk className="h-10 w-10 rounded-md" />
              <div className="flex-1">
                <Sk className="h-4 w-32" />
                <Sk className="mt-1.5 h-3 w-44 max-w-full" />
              </div>
              <Sk className="h-8 w-28 rounded-md" />
            </div>
            <div className="space-y-1.5 px-2 pb-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-md bg-bg-overlay p-3">
                  <Sk className="h-11 w-11 rounded-md" />
                  <div className="flex-1">
                    <Sk className="h-3.5 w-56 max-w-[80%]" />
                    <Sk className="mt-2 h-3 w-72 max-w-[90%]" />
                  </div>
                  <Sk className="hidden h-8 w-64 rounded-md md:block" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

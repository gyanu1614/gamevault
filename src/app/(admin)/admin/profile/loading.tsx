import { Sk } from '@/components/account/AccountSkeletons'
import { SkAdminHeader } from '../components/AdminSkeletons'

/** Profile skeleton: header, identity card, account form card. */
export default function Loading() {
  return (
    <div aria-busy aria-label="Loading">
      <SkAdminHeader titleWidth="w-32" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex items-center gap-4 rounded-lg bg-bg-raised p-5 lg:flex-col">
          <Sk className="h-16 w-16 rounded-full lg:h-24 lg:w-24" />
          <div className="space-y-2 lg:flex lg:flex-col lg:items-center">
            <Sk className="h-4 w-32" />
            <Sk className="h-5 w-24 rounded-full" />
          </div>
        </div>
        <div className="space-y-4 rounded-lg bg-bg-raised p-5 lg:col-span-2">
          <Sk className="h-4 w-44" />
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Sk key={i} className="h-[68px] rounded-md" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

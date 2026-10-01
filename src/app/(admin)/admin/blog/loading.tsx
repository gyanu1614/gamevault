import { Sk } from '@/components/account/AccountSkeletons'
import { SkAdminHeader } from '../components/AdminSkeletons'

/** Blog skeleton: header + New Post, All / General tiles, game tiles. */
export default function Loading() {
  return (
    <div aria-busy aria-label="Loading">
      <SkAdminHeader actions titleWidth="w-52" />
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Sk className="h-[68px] rounded-lg" />
          <Sk className="h-[68px] rounded-lg" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Sk key={i} className="h-[68px] rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}

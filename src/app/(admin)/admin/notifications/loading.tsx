import { Sk } from '@/components/account/AccountSkeletons'
import { SkAdminHeader, SkAdminRows } from '../components/AdminSkeletons'

/** Notifications skeleton: header, All / Unread tabs, rows. */
export default function Loading() {
  return (
    <div aria-busy aria-label="Loading">
      <SkAdminHeader titleWidth="w-52" />
      <div className="space-y-5">
        <Sk className="h-[40px] w-[170px] rounded-lg" />
        <SkAdminRows count={6} />
      </div>
    </div>
  )
}

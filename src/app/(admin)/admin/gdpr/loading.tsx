import { Sk } from '@/components/account/AccountSkeletons'
import { SkAdminHeader, SkAdminRows, SkAdminStrip } from '../components/AdminSkeletons'

/** GDPR skeleton: header, four numbers, tabs, requests. */
export default function Loading() {
  return (
    <div aria-busy aria-label="Loading">
      <SkAdminHeader titleWidth="w-56" />
      <div className="space-y-5">
        <SkAdminStrip count={4} />
        <Sk className="h-[40px] w-[220px] rounded-lg" />
        <SkAdminRows count={4} />
      </div>
    </div>
  )
}

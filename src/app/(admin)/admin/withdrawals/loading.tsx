import { Sk } from '@/components/account/AccountSkeletons'
import { SkAdminHeader, SkAdminRows, SkAdminStrip } from '../components/AdminSkeletons'

/** Withdrawals skeleton: header, four numbers, status tabs, rows. */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy aria-label="Loading">
      <SkAdminHeader />
      <SkAdminStrip count={4} />
      <Sk className="h-[40px] w-[520px] max-w-full rounded-lg" />
      <SkAdminRows count={6} />
    </div>
  )
}

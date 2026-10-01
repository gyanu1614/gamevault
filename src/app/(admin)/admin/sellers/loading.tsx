import { Sk } from '@/components/account/AccountSkeletons'
import { SkAdminHeader, SkAdminRows } from '../components/AdminSkeletons'

/** Seller applications skeleton: header, status tabs, rows. */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy aria-label="Loading">
      <SkAdminHeader titleWidth="w-64" />
      <Sk className="h-[40px] w-[560px] max-w-full rounded-lg" />
      <SkAdminRows count={8} />
    </div>
  )
}

import { Sk } from '@/components/account/AccountSkeletons'
import { SkAdminHeader, SkAdminRows } from '../components/AdminSkeletons'

/** Reports skeleton: header, Open / Resolved chips, report rows. */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy aria-label="Loading">
      <SkAdminHeader titleWidth="w-32" />
      <div className="flex gap-2">
        <Sk className="h-8 w-16 rounded-full" />
        <Sk className="h-8 w-20 rounded-full" />
      </div>
      <SkAdminRows count={6} />
    </div>
  )
}

import { Sk } from '@/components/account/AccountSkeletons'
import { SkAdminHeader, SkAdminRows, SkAdminStrip } from '../components/AdminSkeletons'

/** INFORM skeleton: header + Run Threshold Check, two numbers, tabs, disclosures. */
export default function Loading() {
  return (
    <div aria-busy aria-label="Loading">
      <SkAdminHeader actions titleWidth="w-44" />
      <div className="space-y-5">
        <SkAdminStrip count={2} lgCols="" />
        <Sk className="h-[40px] w-[440px] max-w-full rounded-lg" />
        <SkAdminRows count={4} />
      </div>
    </div>
  )
}

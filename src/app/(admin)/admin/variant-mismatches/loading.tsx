import { AdminLoadingRows } from '../components/kit'
import { SkAdminHeader } from '../components/AdminSkeletons'

/** Variant Mismatches skeleton: header with the Fix All button, then the rows. */
export default function Loading() {
  return (
    <div aria-busy aria-label="Loading">
      <SkAdminHeader actions titleWidth="w-52" />
      <AdminLoadingRows rows={8} />
    </div>
  )
}

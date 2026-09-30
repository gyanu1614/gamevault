import { SkAdminHeader, SkAdminRows, SkAdminStrip } from '../components/AdminSkeletons'

/** Promo codes skeleton: header + New Promo Code, three numbers, code rows. */
export default function Loading() {
  return (
    <div aria-busy aria-label="Loading">
      <SkAdminHeader actions titleWidth="w-52" />
      <div className="space-y-5">
        <SkAdminStrip count={3} lgCols="grid-cols-3 lg:grid-cols-3" />
        <SkAdminRows count={5} />
      </div>
    </div>
  )
}

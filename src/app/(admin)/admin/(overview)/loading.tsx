import { Sk } from '@/components/account/AccountSkeletons'
import { SkAdminHeader, SkAdminRows, SkAdminStrip, SkSectionLabel } from '../components/AdminSkeletons'

/** Dashboard skeleton: mirrors CompactDashboard section for section. */
export default function Loading() {
  return (
    <div className="space-y-7 sm:space-y-8" aria-busy aria-label="Loading">
      <SkAdminHeader actions titleWidth="w-72" />

      <section>
        <SkSectionLabel />
        <div className="-mx-4 flex gap-3 overflow-hidden px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-[44%] min-w-[152px] shrink-0 rounded-lg bg-bg-raised p-4 sm:w-auto sm:min-w-0">
              <div className="flex items-start justify-between">
                <Sk className="h-11 w-11 rounded-md" />
                <Sk className="h-6 w-8" />
              </div>
              <Sk className="mt-4 h-4 w-28" />
            </div>
          ))}
        </div>
      </section>

      <section>
        <SkSectionLabel />
        <SkAdminStrip count={6} lgCols="md:grid-cols-3 xl:grid-cols-6" />
      </section>

      <div className="grid grid-cols-1 gap-7 lg:grid-cols-5 lg:gap-6">
        <section className="lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <SkSectionLabel className="mb-0" />
            <Sk className="h-[38px] w-40 rounded-lg" />
          </div>
          <SkAdminRows count={5} />
        </section>
        <section className="lg:col-span-2">
          <div className="mb-3 flex h-[38px] items-center">
            <SkSectionLabel className="mb-0" />
          </div>
          <SkAdminRows count={5} />
        </section>
      </div>

      <section>
        <SkSectionLabel />
        <SkAdminStrip count={4} />
      </section>
    </div>
  )
}

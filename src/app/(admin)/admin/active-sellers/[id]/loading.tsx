import { Sk } from '@/components/account/AccountSkeletons'
import { SkAdminStrip } from '../../components/AdminSkeletons'

/** Seller page skeleton: back link + identity header, the numbers, two columns of titled cards. */
export default function Loading() {
  const section = (rows: number) => (
    <div>
      <Sk className="mb-2.5 h-5 w-32" />
      <div className="space-y-3 rounded-lg bg-bg-raised p-4 sm:p-5">
        {Array.from({ length: rows }).map((_, i) => (
          <Sk key={i} className="h-9 w-full rounded-md" />
        ))}
      </div>
    </div>
  )
  return (
    <div className="space-y-5" aria-busy aria-label="Loading">
      <div>
        <Sk className="h-4 w-28" />
        <div className="mt-3 flex items-start gap-4">
          <Sk className="h-16 w-16 rounded-lg sm:h-[72px] sm:w-[72px]" />
          <div className="flex-1">
            <Sk className="h-8 w-56 rounded-md" />
            <Sk className="mt-2 h-4 w-72 max-w-full" />
            <Sk className="mt-2 h-3.5 w-48" />
          </div>
        </div>
      </div>
      <SkAdminStrip count={6} lgCols="md:grid-cols-3 2xl:grid-cols-6" />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="space-y-5">
          {section(2)}
          {section(4)}
        </div>
        <div className="space-y-5">
          {section(3)}
          {section(2)}
        </div>
      </div>
    </div>
  )
}

import { Sk } from '@/components/account/AccountSkeletons'

/** Game edit skeleton: back link, game tile + title, settings tabs, stepper, form card. */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy aria-label="Loading">
      <div>
        <Sk className="h-4 w-16" />
        <div className="mt-3 flex items-center gap-3.5">
          <Sk className="h-12 w-12 rounded-md" />
          <div>
            <Sk className="h-7 w-48 rounded-md" />
            <Sk className="mt-2 h-3.5 w-72 max-w-full" />
          </div>
        </div>
      </div>
      <Sk className="h-[40px] w-[420px] max-w-full rounded-lg" />
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Sk key={i} className="h-10 rounded-md" />
        ))}
      </div>
      <div className="space-y-4 rounded-lg bg-bg-raised p-4 sm:p-6">
        <Sk className="h-4 w-24" />
        <Sk className="h-10 w-full rounded-md" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Sk key={i} className="h-16 rounded-md" />
          ))}
        </div>
      </div>
    </div>
  )
}

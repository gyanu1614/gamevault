import { Sk } from '@/components/account/AccountSkeletons'

/** Template builder skeleton: back link, title, fields tree + editor, preview. */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy aria-label="Loading">
      <div>
        <Sk className="h-4 w-36" />
        <Sk className="mt-3 h-8 w-72 max-w-full rounded-md" />
        <Sk className="mt-2 h-3.5 w-[420px] max-w-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-2 rounded-lg bg-bg-raised p-4 sm:p-5">
          <Sk className="h-4 w-20" />
          <Sk className="h-3 w-full" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Sk key={i} className="h-10 rounded-md" />
          ))}
        </div>
        <Sk className="h-64 rounded-lg" />
      </div>
      <Sk className="h-40 rounded-lg" />
    </div>
  )
}

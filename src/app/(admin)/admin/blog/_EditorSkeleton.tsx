import { Sk } from '@/components/account/AccountSkeletons'

/** Blog editor skeleton: back link, header, section tabs, title/slug card, body card. */
export function EditorSkeleton() {
  return (
    <div className="space-y-4" aria-busy aria-label="Loading">
      <div>
        <Sk className="h-4 w-28" />
        <Sk className="mt-3 h-8 w-40 rounded-md" />
        <Sk className="mt-2 h-3.5 w-72 max-w-full" />
      </div>
      <Sk className="h-[40px] w-[300px] max-w-full rounded-lg" />
      <div className="grid gap-4 rounded-lg bg-bg-raised p-4 sm:grid-cols-[2fr_1fr] sm:p-5">
        <Sk className="h-[68px] rounded-md" />
        <Sk className="h-[68px] rounded-md" />
      </div>
      <div className="space-y-3 rounded-lg bg-bg-raised p-4 sm:p-5">
        <Sk className="h-4 w-16" />
        <div className="flex gap-1.5 overflow-hidden">
          {Array.from({ length: 10 }).map((_, i) => (
            <Sk key={i} className="h-8 w-14 shrink-0 rounded-md" />
          ))}
        </div>
        <Sk className="h-[380px] rounded-md" />
      </div>
    </div>
  )
}

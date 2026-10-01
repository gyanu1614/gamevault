import { Sk } from '@/components/account/AccountSkeletons'

/** Application page skeleton: back link + store header + actions, verification panel, cards + rail. */
export default function Loading() {
  const card = (rows: number) => (
    <div className="rounded-lg bg-bg-raised p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <Sk className="h-9 w-9 rounded-md" />
        <div>
          <Sk className="h-4 w-36" />
          <Sk className="mt-2 h-3 w-56 max-w-full" />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Sk key={i} className="h-10 w-full rounded-md" />
        ))}
      </div>
    </div>
  )
  return (
    <div className="space-y-5" aria-busy aria-label="Loading">
      <div>
        <Sk className="h-4 w-36" />
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="flex flex-1 items-start gap-4">
            <Sk className="h-16 w-16 rounded-lg sm:h-[72px] sm:w-[72px]" />
            <div className="flex-1">
              <Sk className="h-8 w-56 rounded-md" />
              <Sk className="mt-2 h-4 w-80 max-w-full" />
              <Sk className="mt-2 h-3.5 w-72 max-w-full" />
            </div>
          </div>
          <div className="flex gap-2">
            <Sk className="h-10 w-10 rounded-md" />
            <Sk className="h-10 w-10 rounded-md" />
            <Sk className="h-10 w-24 rounded-md" />
            <Sk className="h-10 w-36 rounded-md" />
          </div>
        </div>
      </div>
      <Sk className="h-[88px] w-full rounded-lg" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          {card(3)}
          {card(2)}
        </div>
        <div className="space-y-5">
          {card(2)}
          {card(3)}
        </div>
      </div>
    </div>
  )
}

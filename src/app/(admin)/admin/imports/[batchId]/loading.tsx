/** Matches BatchDetailClient: back link, header + actions, 5 stat cards, row table. */
export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="mb-4 h-4 w-28 rounded bg-[rgba(255,255,255,0.05)]" />

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="h-8 w-56 rounded bg-[rgba(255,255,255,0.06)]" />
          <div className="mt-2 h-4 w-80 max-w-full rounded bg-[rgba(255,255,255,0.04)]" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-28 rounded-md bg-[rgba(255,255,255,0.05)]" />
          <div className="h-8 w-32 rounded-lg bg-[rgba(255,255,255,0.06)]" />
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border-subtle bg-[rgba(22,23,27,0.6)] p-4">
            <div className="h-3 w-20 rounded bg-[rgba(255,255,255,0.05)]" />
            <div className="mt-2 h-6 w-12 rounded bg-[rgba(255,255,255,0.07)]" />
          </div>
        ))}
      </div>

      <div className="mb-3 flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-7 w-20 rounded-md bg-[rgba(255,255,255,0.05)]" />
        ))}
      </div>

      <div className="rounded-xl border border-border-subtle bg-[rgba(22,23,27,0.6)]">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border-subtle px-4 py-3 last:border-b-0">
            <div className="h-4 w-6 rounded bg-[rgba(255,255,255,0.04)]" />
            <div className="h-7 w-7 shrink-0 rounded bg-[rgba(255,255,255,0.05)]" />
            <div className="h-4 flex-1 rounded bg-[rgba(255,255,255,0.05)]" />
            <div className="h-4 w-16 rounded bg-[rgba(255,255,255,0.04)]" />
            <div className="h-4 w-16 rounded bg-[rgba(255,255,255,0.04)]" />
            <div className="h-4 w-20 rounded bg-[rgba(255,255,255,0.04)]" />
          </div>
        ))}
      </div>
    </div>
  )
}

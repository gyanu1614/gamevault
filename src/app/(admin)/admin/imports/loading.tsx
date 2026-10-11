/** Matches ImportsPageClient: header, the new-import panel, then the batch table. */
export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6">
        <div className="h-8 w-48 rounded bg-[rgba(255,255,255,0.06)]" />
        <div className="mt-2 h-4 w-96 max-w-full rounded bg-[rgba(255,255,255,0.04)]" />
      </div>

      {/* new-import panel */}
      <div className="mb-8 rounded-xl border border-border-subtle bg-[rgba(22,23,27,0.6)] p-5">
        <div className="h-3 w-24 rounded bg-[rgba(255,255,255,0.05)]" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <div className="mb-1.5 h-3 w-20 rounded bg-[rgba(255,255,255,0.04)]" />
              <div className="h-9 rounded-lg bg-[rgba(255,255,255,0.05)]" />
            </div>
          ))}
        </div>
        <div className="mt-5 h-40 rounded-lg bg-[rgba(255,255,255,0.04)]" />
        <div className="mt-5 h-9 w-40 rounded-lg bg-[rgba(255,255,255,0.06)]" />
      </div>

      {/* batch table */}
      <div className="mb-3 h-3 w-16 rounded bg-[rgba(255,255,255,0.05)]" />
      <div className="rounded-xl border border-border-subtle bg-[rgba(22,23,27,0.6)]">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border-subtle px-4 py-3 last:border-b-0">
            <div className="h-4 flex-1 rounded bg-[rgba(255,255,255,0.05)]" />
            <div className="h-4 w-24 rounded bg-[rgba(255,255,255,0.04)]" />
            <div className="h-4 w-20 rounded bg-[rgba(255,255,255,0.04)]" />
            <div className="h-4 w-16 rounded bg-[rgba(255,255,255,0.04)]" />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * V34 — Messages skeleton.
 *
 * Mirrors the revamped /account/messages: flush title block → chat tabs
 * segmented bar → two-panel grid (conversation list card with search +
 * divider rows, thread card with header / bubbles / composer). Same
 * container + gutter as the offers page so nothing shifts on load.
 */

function Block({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-white/[0.07] ${className}`} />
  )
}

export default function MessagesLoading() {
  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 pb-16 pt-2 sm:px-6 lg:px-10 xl:px-14">
      {/* Title block */}
      <div className="mb-4 space-y-2 pt-2">
        <Block className="h-8 w-44" />
        <Block className="h-4 w-72 max-w-full" />
      </div>

      {/* Chat tabs bar */}
      <div className="mb-4 flex w-fit items-center gap-1 rounded-md border border-white/[0.08] bg-[rgba(20,20,27,0.56)] p-1">
        {['w-10', 'w-16', 'w-[86px]', 'w-14', 'w-20', 'w-16', 'w-[128px]'].map((w, i) => (
          <Block key={i} className={`h-8 rounded-[5px] ${w}`} />
        ))}
      </div>

      <div className="grid h-[calc(100vh-252px)] grid-cols-1 gap-3 lg:grid-cols-[380px_1fr]">
        {/* Conversation list */}
        <div className="flex flex-col overflow-hidden rounded-lg border border-border-default bg-[rgba(20,20,27,0.56)]">
          <div className="border-b border-white/[0.05] p-3">
            <Block className="h-10 w-full" />
          </div>
          <div className="divide-y divide-white/[0.05]">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                <Block className="h-11 w-11 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Block className="h-4 w-40 max-w-full" />
                    <Block className="h-3 w-6" />
                  </div>
                  <Block className="h-3 w-28" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Thread */}
        <div className="flex flex-col overflow-hidden rounded-lg border border-border-default bg-[rgba(20,20,27,0.56)]">
          <div className="flex items-center gap-3 border-b border-white/[0.05] p-4">
            <Block className="h-10 w-10 rounded-full" />
            <div className="space-y-1.5">
              <Block className="h-4 w-32" />
              <Block className="h-3 w-16" />
            </div>
          </div>
          <div className="flex-1 space-y-4 p-4">
            <Block className="ml-auto h-10 w-40 max-w-[60%]" />
            <Block className="h-10 w-52 max-w-[70%]" />
            <Block className="ml-auto h-10 w-32 max-w-[50%]" />
          </div>
          <div className="flex items-end gap-2 border-t border-white/[0.05] p-4">
            <Block className="h-[42px] flex-1" />
            <Block className="h-[42px] w-[42px]" />
          </div>
        </div>
      </div>
    </main>
  )
}

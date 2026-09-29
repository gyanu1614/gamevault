/**
 * Messages skeleton — the SAME fixed shell as page.tsx (pinned under the
 * navbar, "Chat" title, tabs, list + thread grid). Used by the route
 * fallback (loading.tsx) and by the page while conversations load, so a
 * visit shows one skeleton and then the page, never skeleton → spinner.
 * Phones show the list only, like the page.
 */

function Block({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-white/[0.07] ${className}`} />
}

const PANEL =
  'relative flex-col overflow-hidden rounded-lg border border-border-default bg-[#1D1E23] backdrop-blur-md'

export function MessagesSkeleton() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading messages"
      className="fixed inset-x-0 bottom-0 top-[var(--navbar-bottom)] z-[1] flex flex-col overflow-hidden px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-7 sm:px-6 lg:left-72 lg:px-10 lg:pb-4 xl:px-14"
    >
      <div className="mx-auto flex h-full w-full max-w-[1400px] min-h-0 flex-col">
        <Block className="ml-1 h-7 w-20" />

        <div className="mt-3.5 flex w-fit max-w-full shrink-0 items-center gap-1 overflow-hidden rounded-md border border-white/[0.08] bg-[#1D1E23] p-1">
          {['w-10', 'w-16', 'w-[86px]', 'w-14', 'w-20', 'w-16'].map((w, i) => (
            <Block key={i} className={`h-8 rounded-[5px] ${w}`} />
          ))}
        </div>

        <div className="mt-3 grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[320px_1fr] xl:grid-cols-[380px_1fr]">
          {/* Conversation list */}
          <div className={`${PANEL} flex`}>
            <div className="border-b border-border-subtle p-3">
              <Block className="h-10 w-full" />
            </div>
            <div className="divide-y divide-white/[0.05]">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                  <Block className="h-12 w-12 shrink-0 rounded-[10px] sm:h-11 sm:w-11 sm:rounded-full" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Block className="h-3.5 w-28" />
                      <Block className="h-3 w-8" />
                    </div>
                    <Block className="h-3 w-24 sm:hidden" />
                    <Block className="h-3 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Thread (desktop only, like the page) */}
          <div className={`${PANEL} hidden lg:flex`}>
            <div className="flex items-center gap-3 border-b border-border-subtle p-4">
              <Block className="h-10 w-10 rounded-full" />
              <div className="space-y-1.5">
                <Block className="h-3.5 w-28" />
                <Block className="h-3 w-12" />
              </div>
            </div>
            <div className="flex-1 space-y-3 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                  <Block className={`h-11 rounded-[14px] ${i % 2 === 0 ? 'w-2/5' : 'w-1/3'}`} />
                </div>
              ))}
            </div>
            <div className="border-t border-border-subtle px-4 py-3">
              <Block className="h-10 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

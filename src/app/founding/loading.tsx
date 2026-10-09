/**
 * Route-level loading UI for /founding — mirrors the page 1:1: transparent
 * bar space, header, the checklist card (progress + four rows) and the
 * Why Sell Here panel, so the session + games reads never show a blank body.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-bg-base text-text-primary" aria-busy="true" aria-label="Loading">
      <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-24 sm:px-6 lg:px-8 lg:pt-32">
        <div className="max-w-2xl">
          <div className="h-8 w-56 rounded bg-bg-overlay sm:h-10 sm:w-72" />
          <div className="mt-3 h-5 w-80 max-w-full rounded bg-bg-overlay" />
        </div>
        <div className="mt-8 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
          <div className="rounded-lg bg-bg-raised">
            <div className="px-5 pt-5 sm:px-6">
              <div className="h-4 w-48 rounded bg-bg-overlay" />
              <div className="mt-3 h-1 w-full rounded-full bg-bg-overlay" />
            </div>
            <div className="mt-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex h-14 items-center gap-3 border-t border-white/[0.07] px-5 sm:px-6">
                  <div className="h-7 w-7 rounded-md bg-bg-overlay" />
                  <div className="h-4 w-40 rounded bg-bg-overlay" />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg bg-bg-raised p-5 sm:p-6">
            <div className="h-6 w-36 rounded bg-bg-overlay" />
            <div className="mt-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-3.5 border-t border-white/[0.07] py-4 first:border-t-0">
                  <div className="h-7 w-7 rounded bg-bg-overlay" />
                  <div className="flex-1">
                    <div className="h-4 w-44 rounded bg-bg-overlay" />
                    <div className="mt-2 h-4 w-full rounded bg-bg-overlay" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

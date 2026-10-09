'use client'

/**
 * Route-level error boundary for /founding (the open seller signup flow).
 *
 * Why /founding has its own boundary — JAVASCRIPT-NEXTJS-5, 16 Sep 2026: a
 * visitor opened the page inside an in-app webview, a fetch failed with
 * WebKit's "TypeError: Load failed", and with no boundary here it escalated to
 * app/error.tsx — the global screen inside the site chrome, with a generic
 * Error ID and "Browse Marketplace" as the way out. In-app webviews make that
 * routine: they kill in-flight requests when backgrounded.
 *
 * So this boundary keeps the visitor on the flow's own dark surface and leads
 * with Try Again (Next's `reset()` re-runs the server render). It does NOT
 * capture to Sentry: anything reaching here is already reported upstream.
 */

import { useEffect, useState } from 'react'
import { ArrowsClockwise } from '@phosphor-icons/react/dist/ssr/ArrowsClockwise'
import { WifiSlash } from '@phosphor-icons/react/dist/ssr/WifiSlash'
import { isNetworkError } from '@/lib/utils/safe-background'

export default function FoundingError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [retrying, setRetrying] = useState(false)
  const offline = isNetworkError(error)

  // A retry that fails re-renders this same boundary with a NEW error object,
  // so the spinner must clear when that happens or it would spin forever.
  useEffect(() => {
    setRetrying(false)
  }, [error])

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-bg-base px-5 py-16 text-text-primary">
      <div className="w-full max-w-[460px] text-center">
        <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-bg-overlay text-text-secondary">
          {offline ? <WifiSlash weight="duotone" className="h-6 w-6" /> : <ArrowsClockwise weight="duotone" className="h-6 w-6" />}
        </div>

        <h1 className="mt-6 text-[26px] font-semibold tracking-tight">Couldn&apos;t Load This Page</h1>

        <p className="mt-3 text-[14.5px] leading-relaxed text-text-secondary">
          {offline
            ? 'We couldn’t reach DropMarket just now. That usually means the connection dropped for a moment. Your progress is saved.'
            : 'Something went wrong while loading the seller signup. Your progress is saved. Try again.'}
        </p>

        <button
          type="button"
          onClick={() => {
            setRetrying(true)
            reset()
          }}
          disabled={retrying}
          className="mt-7 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-md bg-white px-8 text-[15px] font-semibold text-black transition-opacity disabled:opacity-60"
        >
          <ArrowsClockwise className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} />
          {retrying ? 'Retrying…' : 'Try Again'}
        </button>

        {error?.digest && (
          <p className="mt-5 font-mono text-[11px] text-text-tertiary">{error.digest}</p>
        )}
      </div>
    </div>
  )
}

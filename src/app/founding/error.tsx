'use client'

/**
 * Route-level error boundary for the Founding Seller HQ.
 *
 * Why /founding needs its own boundary — JAVASCRIPT-NEXTJS-5, 16 Sep 2026:
 * a founder opened their magic link (/founding?id=…&token=…) inside the Google
 * app's in-app webview, a fetch failed with WebKit's "TypeError: Load failed",
 * and with no boundary on this route it escalated to app/error.tsx. That is the
 * global "Something Went Wrong" screen inside the site chrome — it drops the
 * founder out of their own onboarding surface, shows a generic Error ID, and
 * offers "Browse Marketplace" as the way out. For someone arriving from a
 * personal invite, a transient radio handover ended the journey.
 *
 * In-app webviews make this routine, not rare: they kill in-flight requests
 * when the host app backgrounds them, and they hand back the same opaque
 * "Load failed" for every network-layer cause.
 *
 * So this boundary keeps the founder inside the Forest Ledger surface and
 * leads with the action that actually fixes a transient failure — Try Again
 * (Next's `reset()` re-runs the server render) — rather than an apology.
 *
 * It deliberately does NOT capture to Sentry: the page's own data loaders now
 * degrade in place, so anything reaching here is already reported by
 * app/error.tsx's ancestor handler or is a genuine render defect that Next
 * reports itself. Double-capturing would make one failure look like two.
 */

import { useEffect, useState } from 'react'
import { RefreshCw, WifiOff } from 'lucide-react'
import { isNetworkError } from '@/lib/utils/safe-background'

/** The Forest Ledger palette this route renders in (see page.tsx THESIS). */
const PALETTE = {
  ground: '#FAFAF7',
  ink: '#10231A',
  ink2: '#5A6B61',
  forest: '#0F3320',
  line: '#E3E4DE',
}

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
    <div
      className="flex min-h-screen w-full items-center justify-center px-5 py-16"
      style={{ backgroundColor: PALETTE.ground }}
    >
      <div className="w-full max-w-[460px] text-center">
        <div
          className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full"
          style={{ backgroundColor: '#EEF1EC', color: PALETTE.forest }}
        >
          {offline ? <WifiOff className="h-6 w-6" /> : <RefreshCw className="h-6 w-6" />}
        </div>

        <h1
          className="mt-6 text-[26px] font-extrabold"
          style={{ color: PALETTE.ink, letterSpacing: '-0.4px' }}
        >
          Couldn&apos;t Load Your HQ
        </h1>

        <p className="mt-3 text-[14.5px] leading-relaxed" style={{ color: PALETTE.ink2 }}>
          {offline
            ? 'We couldn’t reach DropMarket just now — that usually means the connection dropped for a moment. Your founding spot is safe.'
            : 'Something went wrong while loading your founding page. Your founding spot is safe — try again.'}
        </p>

        <button
          type="button"
          onClick={() => {
            setRetrying(true)
            reset()
          }}
          disabled={retrying}
          className="mt-7 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg px-8 text-[15px] font-semibold text-white transition-opacity disabled:opacity-60"
          style={{ backgroundColor: PALETTE.forest }}
        >
          <RefreshCw className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} />
          {retrying ? 'Retrying…' : 'Try Again'}
        </button>

        <p className="mt-5 text-[12.5px]" style={{ color: PALETTE.ink2 }}>
          Still stuck? Reopen the link from your invite email.
        </p>

        {error?.digest && (
          <p className="mt-3 font-mono text-[11px]" style={{ color: PALETTE.line }}>
            {error.digest}
          </p>
        )}
      </div>
    </div>
  )
}

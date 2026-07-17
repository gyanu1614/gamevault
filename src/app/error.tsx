'use client'

/**
 * Global error boundary — renders inside the root layout (navbar and
 * footer intact) instead of Next's unstyled default error screen.
 */

import Link from 'next/link'
import { AlertCircle } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-20 text-center sm:px-6">
      <div className="inline-flex rounded-2xl border border-warning/30 bg-warning-bg/30 p-4">
        <AlertCircle className="h-10 w-10 text-warning" />
      </div>

      <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-text-primary sm:text-4xl">
        Something Went Wrong
      </h1>

      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-text-tertiary">
        An unexpected error occurred while loading this page. Try again, or
        head back to the marketplace.
      </p>

      {error?.digest && (
        <p className="mt-2 font-mono text-[12px] text-text-tertiary">
          Error ID: {error.digest}
        </p>
      )}

      <div className="mt-8 flex w-full max-w-sm flex-col items-center gap-3 sm:w-auto sm:max-w-none sm:flex-row">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-[48px] w-full items-center justify-center rounded-lg bg-lime px-8 font-semibold text-text-inverse transition-colors hover:bg-lime-hover sm:w-auto"
        >
          Try Again
        </button>
        <Link
          href="/"
          className="inline-flex min-h-[48px] w-full items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.05] px-8 font-medium text-text-secondary transition-colors hover:bg-white/[0.08] hover:text-text-primary sm:w-auto"
        >
          Browse Marketplace
        </Link>
      </div>
    </main>
  )
}

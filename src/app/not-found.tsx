/**
 * Global 404 page — renders inside the root layout, so the site
 * navbar and footer stay in place instead of Next's unstyled default.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { Compass } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Page Not Found',
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-20 text-center sm:px-6">
      <div className="inline-flex rounded-2xl border border-lime/20 bg-lime/10 p-4">
        <Compass className="h-10 w-10 text-lime-text" />
      </div>

      <div className="mt-6 text-[13px] font-bold uppercase tracking-[0.14em] text-lime-text">
        404
      </div>

      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-text-primary sm:text-4xl">
        Page Not Found
      </h1>

      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-text-tertiary">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
        Head back to the marketplace to keep browsing.
      </p>

      <div className="mt-8 flex w-full max-w-sm flex-col items-center gap-3 sm:w-auto sm:max-w-none sm:flex-row">
        <Link
          href="/"
          className="inline-flex min-h-[48px] w-full items-center justify-center rounded-lg bg-lime px-8 font-semibold text-text-inverse transition-colors hover:bg-lime-hover sm:w-auto"
        >
          Browse Marketplace
        </Link>
        <Link
          href="/browse"
          className="inline-flex min-h-[48px] w-full items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.05] px-8 font-medium text-text-secondary transition-colors hover:bg-white/[0.08] hover:text-text-primary sm:w-auto"
        >
          Browse All Games
        </Link>
      </div>
    </main>
  )
}

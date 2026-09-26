import type { Metadata } from 'next'

import { devOnlyRoute } from '@/lib/env/dev-only-route'

/**
 * ROUTE-002 — one server-side gate for every /dev/* design preview.
 *
 * A layout is the right seam here: three of these pages are client components
 * ('use client'), so they cannot call notFound() themselves, and a layout gates
 * all of them from the server regardless. On the live site every /dev/* URL
 * 404s; in local dev and on preview deployments they render normally.
 *
 * robots.ts keeps its '/dev/' disallow — that governs crawling, this governs
 * reachability, and they are not substitutes for one another.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function DevLayout({ children }: { children: React.ReactNode }) {
  devOnlyRoute()
  return <>{children}</>
}

'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import type { PrefetchKind } from 'next/dist/client/components/router-reducer/router-reducer-types'
import { bindIntentPrefetch } from '@/lib/navigation/intent-prefetch'

/**
 * Mount once (Providers). Prefetches AppLink links on hover, touch or focus; renders nothing.
 *
 * `kind: 'auto'`: without a kind, Next 14.2 does a FULL prefetch, which
 * renders a dynamic page on the server on hover (2026-10-20 usage audit).
 */
export function IntentPrefetch() {
  const router = useRouter()
  useEffect(
    () =>
      bindIntentPrefetch(document, {
        prefetch: (href) => router.prefetch(href, { kind: 'auto' as PrefetchKind }),
        saveData: () => (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true,
      }),
    [router],
  )
  return null
}

'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { bindIntentPrefetch } from '@/lib/navigation/intent-prefetch'

/** Mount once (Providers). Prefetches AppLink links on hover, touch or focus; renders nothing. */
export function IntentPrefetch() {
  const router = useRouter()
  useEffect(
    () =>
      bindIntentPrefetch(document, {
        prefetch: (href) => router.prefetch(href),
        saveData: () => (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true,
      }),
    [router],
  )
  return null
}

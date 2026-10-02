import NextLink from 'next/link'
import { createElement, forwardRef, type ComponentPropsWithoutRef } from 'react'

import { INTENT_ATTR } from '@/lib/navigation/intent-prefetch'

export type AppLinkProps = Omit<ComponentPropsWithoutRef<typeof NextLink>, 'prefetch'> & {
  /**
   * Omit it: the link prefetches on intent (hover, touch, focus) only.
   * `false`: never prefetch, not even on intent (seller-gated routes).
   * `true` is not offered. next/link would then prefetch every link that
   * scrolls into view, which is what this wrapper exists to stop.
   */
  prefetch?: false
}

/**
 * Drop-in for `next/link` (import it as `Link`). Automatic viewport prefetching
 * is off; the one document-level listener in <IntentPrefetch /> prefetches a
 * link when someone hovers, touches or focuses it. See lib/navigation/intent-prefetch.ts.
 *
 * No hooks and no 'use client', so it also works inside server components such
 * as the footer game directory. `forwardRef` keeps `ref` working for SmartLink.
 */
const AppLink = forwardRef<HTMLAnchorElement, AppLinkProps>(function AppLink({ prefetch, ...props }, ref) {
  // next/link@14.2 prefetches visible links unless prefetch === false, and then
  // ignores hover and touch as well; intent is handled by our own listener.
  const marker = prefetch === undefined ? { [INTENT_ATTR]: '' } : {}
  return createElement(NextLink, { ...props, ...marker, prefetch: false, ref })
})

export default AppLink

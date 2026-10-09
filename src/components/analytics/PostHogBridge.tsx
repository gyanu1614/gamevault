'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { identify, reset, startAnalytics } from '@/lib/analytics/client'
import { whenIdleAfterLoad } from '@/lib/dom/when-idle-after-load'

/**
 * Growth point 1 — starts PostHog once the page is idle (never on the first
 * paint's critical path) and keeps its identity in step with the session:
 * the internal user id on sign-in, a fresh anonymous visitor on sign-out.
 * Renders nothing; inert without NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN.
 */
export function PostHogBridge() {
  const { user, loading } = useAuth()
  const lastId = useRef<string | null>(null)

  useEffect(() => whenIdleAfterLoad(() => { void startAnalytics() }), [])

  const userId = user?.id ?? null
  useEffect(() => {
    if (loading) return
    if (userId && userId !== lastId.current) identify(userId)
    else if (!userId && lastId.current) reset()
    lastId.current = userId
  }, [userId, loading])

  return null
}

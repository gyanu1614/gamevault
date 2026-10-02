'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

import { whenIdleAfterLoad } from '@/lib/dom/when-idle-after-load'

// Client-only widgets that are not part of the first view: each opens Supabase
// calls (the purchase toast also holds a realtime socket). Loaded after the page
// has loaded and the browser is idle, so they are not in the first-load window.
const RecentPurchaseToast = dynamic(() => import('@/components/marketplace/RecentPurchaseToast'), { ssr: false })
const DailyStatsToast = dynamic(
  () => import('@/components/marketplace/RecentPurchaseToast').then((m) => m.DailyStatsToast),
  { ssr: false },
)

/** The two social-proof toasts, mounted once the page is idle. Renders nothing before that. */
export function DeferredSocialProof() {
  const [ready, setReady] = useState(false)
  useEffect(() => whenIdleAfterLoad(() => setReady(true)), [])
  if (!ready) return null
  return (
    <>
      <RecentPurchaseToast />
      <DailyStatsToast />
    </>
  )
}

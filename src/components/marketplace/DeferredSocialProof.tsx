'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

import { whenIdleAfterLoad } from '@/lib/dom/when-idle-after-load'

// Client-only widget that is not part of the first view: it makes a Supabase
// call (signed-in users only, once per tab session). Loaded after the page has
// loaded and the browser is idle, so it is not in the first-load window.
// (The realtime "Recent Purchase" toast that lived here was removed: it held an
// `orders` socket for every visitor that RLS guaranteed would never fire.)
const DailyStatsToast = dynamic(() => import('@/components/marketplace/RecentPurchaseToast'), { ssr: false })

/** The social-proof toast, mounted once the page is idle. Renders nothing before that. */
export function DeferredSocialProof() {
  const [ready, setReady] = useState(false)
  useEffect(() => whenIdleAfterLoad(() => setReady(true)), [])
  if (!ready) return null
  return <DailyStatsToast />
}

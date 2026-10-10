'use client'

import { Analytics } from '@vercel/analytics/next'
import { vercelBeforeSend } from '@/lib/analytics/vercel'

/** Vercel Web Analytics with private query strings stripped (lib/analytics/vercel). */
export function VercelAnalytics() {
  return <Analytics beforeSend={vercelBeforeSend} />
}

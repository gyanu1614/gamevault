/**
 * Public Trustpilot social proof (home + listing pages + /safedrop).
 *
 * Renders NOTHING until an admin records 10+ reviews on /admin — no "0
 * reviews", no empty widget, no rating we did not earn. Then: Trustpilot's
 * TrustBox when a template id is configured (the free showcase widget from
 * the Trustpilot dashboard), else our plain profile link. Server component:
 * the count is a cookie-free cached read, so pages stay static.
 */
import type { ReactNode } from 'react'

import { getPublicReviewCount, trustboxVisible } from '@/lib/trustpilot/settings'
import { TrustBoxWidget } from './TrustBoxWidget'
import { TrustpilotLink } from './TrustpilotLink'

/** Renders its children only once the profile has 10+ reviews (e.g. a whole "reviews" section). */
export async function TrustpilotGate({ children }: { children: ReactNode }) {
  return trustboxVisible(await getPublicReviewCount()) ? <>{children}</> : null
}

export async function TrustpilotShowcase({ className }: { className?: string }) {
  if (!trustboxVisible(await getPublicReviewCount())) return null

  const templateId = process.env.NEXT_PUBLIC_TRUSTBOX_TEMPLATE_ID
  const businessUnitId = process.env.NEXT_PUBLIC_TRUSTPILOT_BUSINESS_UNIT_ID
  if (templateId && businessUnitId) {
    return <TrustBoxWidget templateId={templateId} businessUnitId={businessUnitId} className={className} />
  }
  return <TrustpilotLink className={className} />
}

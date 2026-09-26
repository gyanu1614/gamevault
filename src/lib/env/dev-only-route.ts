import { notFound } from 'next/navigation'

import { isProductionDeployment } from './deployment'

/**
 * ROUTE-002 — call at the top of an internal-only page so it 404s on the live
 * site while staying usable in local dev and on preview deployments.
 *
 * robots.ts already disallows /dev/, but robots.txt is advisory: it stops
 * indexing, not reachability. These pages render real product chrome with no
 * metadata and no auth, so anyone with the URL could load them in production.
 *
 * `notFound()` (rather than a redirect) makes the route indistinguishable from
 * one that was never deployed, and reuses the styled root not-found.tsx.
 */
export function devOnlyRoute(): void {
  if (isProductionDeployment()) notFound()
}

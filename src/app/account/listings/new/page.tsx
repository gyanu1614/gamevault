/**
 * Legacy /account/listings/new → /sell/new redirect.
 *
 * The seller listing wizard now lives under the (sell) route group at
 * /sell/new (no-sidebar layout). This route was a 1600-line pre-redesign
 * duplicate of that wizard — orphaned but still URL-reachable, and badly out
 * of sync with the design system. Replaced with a permanent redirect to the
 * canonical wizard (mirrors the sibling /account/listings/[id]/edit redirect).
 */

import { permanentRedirect } from 'next/navigation'

export default function LegacyNewListingRedirect() {
  permanentRedirect('/sell/new')
}

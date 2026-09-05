/**
 * Route-level loading UI for /early-seller. The page does server work before it
 * renders anything — an auth check + a founder-redirect DB lookup, then fetching
 * progress + games. Without this, that gap shows the dark root-layout body as a
 * black flash (and, for a logged-in founder, a black hang before the redirect to
 * /founding lands). This renders the branded forest loader instead so the
 * transition from "Start Earning" is smooth.
 */

import SellerFlowLoader from '@/app/account/become-seller/_redesign/components/SellerFlowLoader'

export default function Loading() {
  return <SellerFlowLoader label="Getting your spot ready…" />
}

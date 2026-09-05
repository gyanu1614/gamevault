/**
 * Route-level loading UI for /account/become-seller. Without this, the parent
 * /account section's dark dashboard skeleton flashes first, THEN the seller
 * flow's own green "Checking your application…" loader takes over — two
 * mismatched loaders for one navigation. This renders the same branded forest
 * loader from the first frame, so entering the wizard is one continuous state.
 */

import SellerFlowLoader from './_redesign/components/SellerFlowLoader'

export default function Loading() {
  return <SellerFlowLoader label="Checking your application…" />
}

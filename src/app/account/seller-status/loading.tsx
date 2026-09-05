/**
 * Route-level loading UI for /account/seller-status. Shown while the page
 * resolves the application on the server — including the hop straight after
 * submit (?submitted=1). Renders the same branded forest loader as the seller
 * flow so submit → status is ONE continuous transition, with no blank flash or
 * skeleton stage in between.
 */

import SellerFlowLoader from '@/app/account/become-seller/_redesign/components/SellerFlowLoader'

export default function Loading() {
  return <SellerFlowLoader label="Loading your application…" />
}

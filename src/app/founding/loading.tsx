/**
 * Route-level loading UI for /founding. The HQ resolves the founder + their
 * journey (several service-role DB reads) before rendering. Without this, that
 * gap shows the dark root-layout body as a black flash — worst on the redirect
 * hop into /founding from "Set Up Store" or the magic link. This renders the
 * branded forest loader so every entry into the HQ is a smooth transition.
 */

import SellerFlowLoader from '@/app/account/become-seller/_redesign/components/SellerFlowLoader'

export default function Loading() {
  return <SellerFlowLoader label="Opening your Founding HQ…" />
}

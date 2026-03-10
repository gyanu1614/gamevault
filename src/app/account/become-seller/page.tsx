/**
 * Seller Registration Page
 *
 * This is the main entry point for the seller registration flow.
 * Protected by AuthGate to require authentication.
 * The actual implementation is in SellerRegistration.tsx for better modularity.
 */

import SellerRegistration from './SellerRegistration'
import AuthGate from './components/AuthGate'

export default function SellerRegisterPage() {
  return (
    <AuthGate>
      <SellerRegistration />
    </AuthGate>
  )
}

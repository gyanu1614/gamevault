/**
 * Seller Registration Page
 *
 * Main entry point for the seller registration flow.
 * Server component: fetches the full active games list from the DB and
 * hands it to the client wizard (games step is DB-driven, not hardcoded).
 * Protected by AuthGate to require authentication.
 */

import SellerRegistration from './SellerRegistration'
import AuthGate from './components/AuthGate'
import { getAllGames } from '@/lib/utils/games'

export default async function SellerRegisterPage() {
  const games = await getAllGames()

  return (
    <AuthGate>
      <SellerRegistration games={games} />
    </AuthGate>
  )
}

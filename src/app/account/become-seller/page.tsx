/**
 * Seller Registration Page — "Forest Ledger" redesign entry point.
 *
 * Server component: fetches the full active games list from the DB and, for each
 * game, precomputes the REAL category sections it supports (getGameCategories)
 * so Step 1 can offer per-game category picks without a client round-trip. Both
 * are handed to the client stepper. Protected by AuthGate to require auth.
 *
 * The page owns its OWN full-screen layout (no site navbar/footer) via the
 * redesigned shell — nothing else wraps it here.
 */

import SellerRegistration from './SellerRegistration'
import AuthGate from './components/AuthGate'
import { getAllGames } from '@/lib/utils/games'
import { getGameCategories } from './_redesign/game-categories'
import type { SectionsByGameId } from './_redesign/components'

export default async function SellerRegisterPage() {
  const games = await getAllGames()

  // Precompute the category sections each game supports (Items / Accounts /
  // Currency / Top-Up / Boosting) so Step 1 can render per-game category picks.
  const gameCategoryOptions = await getGameCategories(
    games.map((g) => ({ id: g.id, slug: g.slug, name: g.name })),
  )
  const sectionsByGameId: SectionsByGameId = {}
  for (const opt of gameCategoryOptions) {
    sectionsByGameId[opt.gameId] = opt.sections
  }

  return (
    <AuthGate>
      <SellerRegistration games={games} sectionsByGameId={sectionsByGameId} />
    </AuthGate>
  )
}

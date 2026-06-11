/**
 * /admin/games-v2/new — server entry for the create wizard.
 * Renders the shared GameWizard client component with no initial game.
 */

import { fetchGlobalCategoriesForWizard } from '@/lib/actions/admin-game-wizard'
import GameWizard from '../_components/GameWizard'

export const dynamic = 'force-dynamic'

export default async function NewGamePage() {
  const globalCategories = await fetchGlobalCategoriesForWizard()
  return (
    <GameWizard
      mode="create"
      game={null}
      globalCategories={globalCategories}
      initialGameCategories={[]}
    />
  )
}

/**
 * /admin/games-v2/[id]/edit — server entry for the edit wizard.
 * Loads the game + its game_categories and renders the shared GameWizard.
 */

import { notFound } from 'next/navigation'
import {
  fetchGameById,
  fetchGameCategoryRows,
  fetchGlobalCategoriesForWizard,
} from '@/lib/actions/admin-game-wizard'
import GameWizard from '../../_components/GameWizard'

export const dynamic = 'force-dynamic'

export default async function EditGamePage({
  params,
}: {
  params: { id: string }
}) {
  const id = params.id
  const [game, rows, globalCategories] = await Promise.all([
    fetchGameById(id),
    fetchGameCategoryRows(id),
    fetchGlobalCategoriesForWizard(),
  ])

  if (!game) notFound()

  return (
    <GameWizard
      mode="edit"
      game={game}
      globalCategories={globalCategories}
      initialGameCategories={rows}
    />
  )
}

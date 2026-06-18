/**
 * /admin/games/[id]/edit — server entry for the game detail panel.
 *
 * V17y — Renders the tabbed GameDetailTabs instead of jumping
 * straight into the linear wizard. The wizard still lives behind
 * the Setup tab; new Currency / Items / Accounts / Boosting tabs
 * surface per-category configuration.
 */

import { notFound } from 'next/navigation'
import {
  fetchGameById,
  fetchGameCategoryRows,
  fetchGlobalCategoriesForWizard,
} from '@/lib/actions/admin-game-wizard'
import GameDetailTabs from '../../_components/GameDetailTabs'

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
    <GameDetailTabs
      game={game}
      globalCategories={globalCategories}
      initialGameCategories={rows}
    />
  )
}

/**
 * V54 — /admin/games server wrapper.
 *
 * Fetches the game list + category badges ON THE SERVER and seeds the
 * client component's react-query caches via initialData. The page
 * ships fully rendered — no client-side "Loading games…" pass on every
 * visit/refresh — while mutations keep their invalidate→refetch flow.
 */

import { fetchAdminGames } from '@/lib/actions/admin-games'
import { fetchAdminGameCategoryBadges } from '@/lib/actions/admin-game-categories'
import GamesPageClient from './_components/GamesPageClient'

export const metadata = { title: 'Games' }

export default async function AdminGamesPage() {
  const [games, badges] = await Promise.all([
    fetchAdminGames(),
    fetchAdminGameCategoryBadges(),
  ])

  return (
    <GamesPageClient
      initialGames={(games ?? []) as any}
      initialBadges={badges ?? []}
    />
  )
}

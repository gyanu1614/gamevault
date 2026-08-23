/**
 * /admin/early-sellers — founding-seller waitlist review.
 *
 * Server wrapper: fetches every early_seller_signups row on the server (via
 * the admin-guarded action), plus a slug → {name, icon} map so the client can
 * render the games each applicant sells as real logo chips (the row stores game
 * slugs / 'custom:<name>' entries). Auth is enforced by the (admin) layout.
 */

import { getEarlySellerSignups } from '@/lib/actions/early-seller'
import { getAllGames } from '@/lib/utils/games'
import { GAME_ICONS } from '@/features/home/lib/game-icons'
import EarlySellersClient, { type GameMeta } from './_EarlySellersClient'

export const metadata = { title: 'Founding Sellers' }

export default async function AdminEarlySellersPage() {
  const [result, games] = await Promise.all([getEarlySellerSignups(), getAllGames()])

  // slug → {name, icon} for rendering game chips. Only slugs with a real logo
  // get an icon; the rest still resolve a name (falls back to the slug itself).
  const gameMeta: Record<string, GameMeta> = {}
  for (const g of games) {
    gameMeta[g.slug] = { name: g.name, icon: GAME_ICONS[g.slug] ?? null }
  }

  return (
    <EarlySellersClient
      initialSignups={result.ok ? result.signups ?? [] : []}
      fetchError={result.ok ? undefined : result.error}
      gameMeta={gameMeta}
    />
  )
}

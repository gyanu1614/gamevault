/**
 * Every game the daily catalogue job runs. Adding a game = an adapter in
 * games/, its parse test, one line here, and its key in the workflow matrix
 * (.github/workflows/values-catalogue-daily.yml, pinned by a guard test).
 */
import { stealABrainrot } from './games/steal-a-brainrot'
import type { CatalogueGame } from './types'

export const CATALOGUE_GAMES: readonly CatalogueGame[] = [{ key: 'sab', name: 'Steal a Brainrot', adapter: stealABrainrot }]

export function findCatalogueGame(key: string): CatalogueGame {
  const game = CATALOGUE_GAMES.find((g) => g.key === key)
  if (!game) throw new Error(`unknown catalogue game "${key}" (known: ${CATALOGUE_GAMES.map((g) => g.key).join(', ')})`)
  return game
}

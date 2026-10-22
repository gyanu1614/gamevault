/**
 * Every game the daily catalogue job runs. Adding a game = an adapter in
 * games/, its parse test, one line here, and its key in the workflow matrix
 * (.github/workflows/values-catalogue-daily.yml, pinned by a guard test).
 */
import { murderMystery2 } from './games/murder-mystery-2'
import { stealABrainrot } from './games/steal-a-brainrot'
import { stealAnEgg } from './games/steal-an-egg'
import type { CatalogueGame } from './types'

export const CATALOGUE_GAMES: readonly CatalogueGame[] = [
  { key: 'sab', name: 'Steal a Brainrot', adapter: stealABrainrot },
  { key: 'murder-mystery-2', name: 'Murder Mystery 2', adapter: murderMystery2 },
  { key: 'steal-an-egg', name: 'Steal an Egg', adapter: stealAnEgg },
]

export function findCatalogueGame(key: string): CatalogueGame {
  const game = CATALOGUE_GAMES.find((g) => g.key === key)
  if (!game) throw new Error(`unknown catalogue game "${key}" (known: ${CATALOGUE_GAMES.map((g) => g.key).join(', ')})`)
  return game
}

import { unstable_cache } from 'next/cache'
import { createAnonClient } from '@/lib/supabase/anon'
import { GAME_DIRECTORY_TAG } from '@/lib/marketplace/gameDirectoryCache'

// Game mapping type
export interface Game {
  id: string
  name: string
  slug: string
  emoji: string | null
  image_url: string | null
}

/**
 * Fetch all active games.
 *
 * STATE-010 — this used to memoize into a module-scope variable with a
 * hand-rolled 5-minute TTL. That is process-global state shared across every
 * request and every user on a warm lambda, invisible to revalidateTag and
 * unbounded until redeploy. The data is public and read-only so nothing leaked,
 * but the mechanism was wrong: unstable_cache gives the same benefit plus
 * managed invalidation, and it is tagged with GAME_DIRECTORY_TAG so the admin
 * game mutations expire it immediately instead of serving up to 5 minutes of
 * stale rows.
 *
 * The read is cookie-free, which is also what makes it cacheable at all.
 */
export const getAllGames = unstable_cache(
  async (): Promise<Game[]> => {
    try {
      const supabase = createAnonClient()
      const { data, error } = await supabase
        .from('games')
        .select('id, name, slug, emoji, image_url')
        .eq('is_active', true)
        .order('name')

      if (error) {
        console.error('Error fetching games:', error)
        return []
      }

      return (data ?? []) as unknown as Game[]
    } catch (error) {
      console.error('Error in getAllGames:', error)
      return []
    }
  },
  ['all-active-games'],
  { tags: [GAME_DIRECTORY_TAG], revalidate: 3600 },
)

/**
 * Convert game IDs to game names
 * @param gameIds Array of game IDs (can be numeric or string IDs)
 * @returns Array of game names
 */
export async function getGameNames(gameIds: (string | number)[]): Promise<string[]> {
  if (!gameIds || gameIds.length === 0) return []

  const games = await getAllGames()

  // Create mapping: both numeric index and string ID
  const gameMap = new Map<string, string>()

  games.forEach((game, index) => {
    // Map by actual ID
    gameMap.set(game.id, game.name)
    // Also map by 1-based index for legacy data (1 = Roblox, 2 = Fortnite, etc.)
    gameMap.set(String(index + 1), game.name)
  })

  return gameIds
    .map(id => gameMap.get(String(id)) || `Game ${id}`)
    .filter(Boolean)
}

/**
 * Get a single game name by ID
 */
export async function getGameName(gameId: string | number): Promise<string> {
  const names = await getGameNames([gameId])
  return names[0] || `Game ${gameId}`
}

/**
 * Get game emoji by ID
 */
export async function getGameEmoji(gameId: string | number): Promise<string | null> {
  const games = await getAllGames()
  const game = games.find((g, idx) => g.id === String(gameId) || idx + 1 === Number(gameId))
  return game?.emoji || null
}

/**
 * Client-side helper to format game display
 */
export function formatGameDisplay(gameIds: (string | number)[], gameNames: string[]): Array<{ id: string | number, name: string }> {
  return gameIds.map((id, idx) => ({
    id,
    name: gameNames[idx] || `Game ${id}`
  }))
}

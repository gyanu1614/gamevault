import { createClient } from '@/lib/supabase/server'

// Game mapping type
export interface Game {
  id: string
  name: string
  slug: string
  emoji: string | null
  image_url: string | null
}

// Cache for games to avoid repeated queries
let gamesCache: Game[] | null = null
let gamesCacheTime: number = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

/**
 * Fetch all games from database with caching
 */
export async function getAllGames(): Promise<Game[]> {
  const now = Date.now()

  // Return cached data if available and fresh
  if (gamesCache && (now - gamesCacheTime) < CACHE_DURATION) {
    return gamesCache
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('games')
      .select('id, name, slug, emoji, image_url')
      .eq('is_active', true)
      .order('name')

    if (error) {
      console.error('Error fetching games:', error)
      return []
    }

    gamesCache = data || []
    gamesCacheTime = now
    return gamesCache
  } catch (error) {
    console.error('Error in getAllGames:', error)
    return []
  }
}

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

import { CONTENT_HUB_GAME_SLUGS } from '@/lib/content/theme'
import { contentHubSlugs } from '@/lib/content/hub-games'
import { getAllGames } from '@/lib/utils/games'
import { rethrowFailedRead } from '@/lib/supabase/failed-read'

/** The games an admin has switched on (games.content_hub_enabled). Cached with the game directory. */
export async function getContentHubGameSlugs(): Promise<string[]> {
  return contentHubSlugs(await getAllGames())
}

/**
 * Every game with a blog hub: the games switched on in admin (Blog v2,
 * 2026-10-13 — a post alone no longer opens a hub). This is the prerender set
 * for `/[gameSlug]/blog`, a closed set (`dynamicParams = false`). A failed read
 * stops the build, which leaves the live site as it is; with no games switched
 * on, it falls back to the compile-time hub games.
 */
export async function getBlogHubGameSlugs(
  loadEnabled: () => Promise<string[]> = getContentHubGameSlugs,
  fallback: readonly string[] = CONTENT_HUB_GAME_SLUGS,
): Promise<string[]> {
  let slugs: string[] = []
  try {
    slugs = await loadEnabled()
  } catch (e) {
    rethrowFailedRead(e)
    slugs = []
  }
  return [...new Set(slugs.length ? slugs : fallback)].sort()
}

/**
 * Runtime twin of getBlogHubGameSlugs, for the page body: a hub exists only
 * for a switched-on game.
 *
 * Needed because `dynamicParams = false` is not enforced on Vercel — Next only
 * throws its fallback-false 404 outside minimal mode (base-server.js), and the
 * Step 7a preview served /rust/blog as a 200 empty hub despite the closed set.
 * The page 404s here by the same rule; on ISR that 404 is then cached.
 */
export function isBlogHubGame(gameSlug: string, enabled: readonly string[]): boolean {
  return enabled.includes(gameSlug)
}

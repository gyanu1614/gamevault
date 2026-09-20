import { CONTENT_HUB_GAME_SLUGS } from '@/lib/content/theme'
import { getAllPublishedPosts } from '@/lib/blog/db'

type PostWithGame = { primaryGameSlug: string | null }

/**
 * Every game that has a blog hub today: the content-hub games plus any game a
 * published post is filed under (`/valorant/blog` exists because of one post,
 * not a theme). This is the prerender set for `/[gameSlug]/blog`, which is a
 * closed set (`dynamicParams = false`) — a slug missing here is a static 404,
 * so the post loader failing must not shrink the list below the hub games.
 */
export async function getBlogHubGameSlugs(
  hubSlugs: readonly string[] = CONTENT_HUB_GAME_SLUGS,
  loadPosts: () => Promise<PostWithGame[]> = getAllPublishedPosts,
): Promise<string[]> {
  const slugs = new Set(hubSlugs)
  try {
    for (const post of await loadPosts()) {
      if (post.primaryGameSlug) slugs.add(post.primaryGameSlug)
    }
  } catch {
    // Build-time DB hiccup: keep the compile-time hub set rather than 404 a
    // live hub until the next deploy.
  }
  return [...slugs].sort()
}

/**
 * Runtime twin of getBlogHubGameSlugs, for the page body: a hub exists for a
 * content-hub game, or for any game with at least one published post.
 *
 * Needed because `dynamicParams = false` is not enforced on Vercel — Next only
 * throws its fallback-false 404 outside minimal mode (base-server.js), and the
 * Step 7a preview served /rust/blog as a 200 empty hub despite the closed set.
 * The page 404s here by the same rule; on ISR that 404 is then cached.
 */
export function isBlogHubGame(
  gameSlug: string,
  posts: readonly unknown[],
  hubSlugs: readonly string[] = CONTENT_HUB_GAME_SLUGS,
): boolean {
  return hubSlugs.includes(gameSlug) || posts.length > 0
}

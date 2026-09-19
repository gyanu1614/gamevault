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

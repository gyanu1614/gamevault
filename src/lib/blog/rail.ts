/**
 * Server helper: fetch the blog-rail posts for a game from the DB and resolve
 * each post's true href (nested /[game]/blog/[slug] when it has a game, else
 * flat /blog/[slug]). Used by marketplace server pages to feed <BlogSection>.
 */

import 'server-only'
import { getPostsTaggedForGame } from '@/lib/blog/db'
import { postHref } from '@/lib/blog/post-url'
import type { BlogRailPost } from '@/components/blog/BlogSection'

export async function getBlogRail(gameSlug: string, limit = 4): Promise<BlogRailPost[]> {
  const posts = await getPostsTaggedForGame(gameSlug, limit)
  return posts.map((p) => ({
    ...p,
    href: postHref(p),
  }))
}

/** The game's blog index for the "More Blogs" link. */
export function gameBlogIndexHref(gameSlug: string): string {
  return `/${gameSlug}/blog`
}

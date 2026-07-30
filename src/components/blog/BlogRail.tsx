/**
 * BlogRail — a SERVER component that fetches the game's blog-rail posts from
 * the DB and renders the presentational <BlogSection>. Drop this into any
 * server page (items, SAB landing, listing detail) to show the "guides" band.
 * Self-hides when the game has no published posts.
 */

import { getBlogRail, gameBlogIndexHref } from '@/lib/blog/rail'
import { BlogSection } from '@/components/blog/BlogSection'

export async function BlogRail({
  gameSlug,
  gameName,
}: {
  gameSlug: string
  gameName: string
}) {
  const posts = await getBlogRail(gameSlug, 4)
  if (posts.length === 0) return null
  return (
    <BlogSection posts={posts} gameName={gameName} moreHref={gameBlogIndexHref(gameSlug)} />
  )
}

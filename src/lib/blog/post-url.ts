/**
 * A post's one true URL: under its PRIMARY game (/{game}/blog/{slug}), or
 * site-wide (/blog/{slug}) when it has none. Tag matches (game_slugs) never
 * decide the URL — a post tagged for three games built three nested URLs,
 * two of them 404s.
 */
export interface PostUrlFields {
  slug: string
  primaryGameSlug: string | null
}

export function postHref(post: PostUrlFields): string {
  return post.primaryGameSlug ? `/${post.primaryGameSlug}/blog/${post.slug}` : `/blog/${post.slug}`
}

/**
 * Where /{requestedGame}/blog/{slug} should permanently redirect when the post
 * now lives elsewhere (moved to another game in admin), else null.
 */
export function movedPostTarget(found: PostUrlFields | null, requestedGame: string): string | null {
  if (!found || found.primaryGameSlug === requestedGame) return null
  return postHref(found)
}

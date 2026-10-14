/**
 * A post's one true URL: under its PRIMARY game (/{game}/blog/{slug}), or
 * site-wide (/blog/{slug}) when it has none. Tag matches (game_slugs) never
 * decide the URL — a post tagged for three games built three nested URLs,
 * two of them 404s.
 */
export interface PostUrlFields {
  slug: string
  primaryGameSlug: string | null
  /** 'codes' posts (Blog v2) live at the game's one codes page, /{game}/codes. */
  postType?: string | null
}

export function postHref(post: PostUrlFields): string {
  if (post.postType === 'codes' && post.primaryGameSlug) return `/${post.primaryGameSlug}/codes`
  return post.primaryGameSlug ? `/${post.primaryGameSlug}/blog/${post.slug}` : `/blog/${post.slug}`
}

/**
 * Where /{requestedGame}/blog/{requestedSlug} should permanently redirect when
 * the post now lives elsewhere — moved to another game, or renamed (found by
 * one of its old URLs) — else null.
 */
export function movedPostTarget(found: PostUrlFields | null, requestedGame: string, requestedSlug?: string): string | null {
  if (!found) return null
  if (found.primaryGameSlug === requestedGame && (requestedSlug === undefined || found.slug === requestedSlug)) return null
  return postHref(found)
}

/**
 * A post's old URLs, after a save. Only a URL that was public (the post was
 * live) is kept, so links and search results that point at it keep working;
 * the post's current URL is never in the list.
 */
export function nextOldSlugs(p: { wasLive: boolean; previousSlug: string | null; newSlug: string; known: string[] }): string[] {
  const all = [...p.known, ...(p.wasLive && p.previousSlug ? [p.previousSlug] : [])]
  return [...new Set(all)].filter((s) => s && s !== p.newSlug)
}

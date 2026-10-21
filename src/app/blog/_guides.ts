/**
 * /blog: the site-wide guide index, grouped. Pure (the page does the reads).
 * The newest post of a known game is featured; every other post sits in its
 * game's row, games ordered by their newest post, the game-less "General"
 * bucket last. A game links to its blog home only when that hub is switched
 * on (isBlogHubGame), so the index never links to a 404.
 */
import type { DbBlogPost as BlogPost } from '@/lib/blog/db'
import { isBlogHubGame } from '@/lib/blog/hub-params'

export interface GuideGame {
  slug: string
  name: string
  imageUrl: string | null
}

type Post = Pick<BlogPost, 'slug' | 'title' | 'excerpt' | 'postType' | 'publishedAt' | 'cover' | 'readMinutes' | 'primaryGameSlug'>

export interface GuideGroup<P extends Post = Post> {
  key: string
  name: string
  imageUrl: string | null
  hubHref: string | null
  /** Every guide of the game, the featured one included. */
  total: number
  posts: P[]
}

const GENERAL = 'general'

export function groupGuides<P extends Post>(
  posts: P[],
  games: Map<string, GuideGame>,
  hubSlugs: readonly string[],
): { featured: P | null; games: GuideGroup<P>[]; sections: GuideGroup<P>[] } {
  const byKey = new Map<string, P[]>()
  for (const p of posts) {
    const key = p.primaryGameSlug ?? GENERAL
    // A post whose game is gone (inactive) is not listed.
    if (key !== GENERAL && !games.has(key)) continue
    byKey.set(key, [...(byKey.get(key) ?? []), p])
  }
  const newest = (list: P[]) => list.reduce((m, p) => (p.publishedAt > m ? p.publishedAt : m), '')
  const groups: GuideGroup<P>[] = [...byKey.entries()]
    .map(([key, list]) => {
      const game = games.get(key)
      const sorted = [...list].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      return {
        key,
        name: game?.name ?? 'General',
        imageUrl: game?.imageUrl ?? null,
        hubHref: game && isBlogHubGame(key, hubSlugs) ? `/${key}/blog` : null,
        total: sorted.length,
        posts: sorted,
      }
    })
    .sort((a, b) => (a.key === GENERAL ? 1 : b.key === GENERAL ? -1 : newest(b.posts).localeCompare(newest(a.posts))))

  const featured = groups.find((g) => g.key !== GENERAL)?.posts[0] ?? null
  const sections = groups
    .map((g) => ({ ...g, posts: g.posts.filter((p) => p !== featured) }))
    .filter((g) => g.posts.length > 0)
  return { featured, games: groups.filter((g) => g.key !== GENERAL), sections }
}

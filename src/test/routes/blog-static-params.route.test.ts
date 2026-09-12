/**
 * ROUTE-008 — /blog/[slug] must not prerender slugs that redirect away.
 *
 * generateStaticParams used getAllPosts(), so the build prerendered all 9
 * file-based posts. Six of them are game-tagged and were migrated to the
 * DB-backed nested hub at /{game}/blog/{slug}, with permanent:true redirects
 * in next.config.js — redirects run ahead of the render, so those six HTML
 * artifacts were built and could never be served.
 *
 * The migration criterion IS the game tag, so `games.length === 0` is exactly
 * the still-flat set. That rule now lives in one place (getFlatPosts) shared
 * by generateStaticParams and sitemap.ts.
 *
 * The strongest assertion here is the cross-check against next.config.js: no
 * slug we prerender may have a /blog/ redirect. That catches future drift
 * whichever side moves.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

import { getAllPosts, getFlatPosts, getPost } from '@/lib/blog/posts'

/** Slugs with a `source: '/blog/<slug>'` redirect in next.config.js. */
const redirectedSlugs = new Set(
  [...readFileSync('next.config.js', 'utf8').matchAll(/source: '\/blog\/([^']+)'/g)].map(
    (m) => m[1],
  ),
)

describe('ROUTE-008 — prerendered blog slugs', () => {
  it('finds redirects to check against (guards a vacuous pass)', () => {
    expect(redirectedSlugs.size).toBeGreaterThan(0)
    expect(getFlatPosts().length).toBeGreaterThan(0)
  })

  it('never prerenders a slug that redirects away', () => {
    const prerendered = getFlatPosts().map((p) => p.slug)
    expect(prerendered.filter((s) => redirectedSlugs.has(s))).toEqual([])
  })

  it('still prerenders every post that has no redirect', () => {
    const expected = getAllPosts()
      .map((p) => p.slug)
      .filter((s) => !redirectedSlugs.has(s))
      .sort()
    expect(getFlatPosts().map((p) => p.slug).sort()).toEqual(expected)
  })

  it('game-tagged posts are exactly the redirected ones', () => {
    // The invariant getFlatPosts() relies on. If a post is ever tagged without
    // a matching redirect (or vice versa), this fails rather than silently
    // dropping or resurrecting a URL.
    for (const post of getAllPosts()) {
      expect(redirectedSlugs.has(post.slug)).toBe(post.games.length > 0)
    }
  })

  it('getFlatPosts posts still resolve through getPost', () => {
    for (const p of getFlatPosts()) expect(getPost(p.slug)).not.toBeNull()
  })
})

describe('ROUTE-008 — generateMetadata 404s for real', () => {
  it('calls notFound() rather than returning a "Post Not Found" title', () => {
    const source = readFileSync('src/app/blog/[slug]/page.tsx', 'utf8')
    expect(source).toMatch(/if \(!post\) notFound\(\)/)
    expect(source).not.toMatch(/title: 'Post Not Found'/)
  })
})
